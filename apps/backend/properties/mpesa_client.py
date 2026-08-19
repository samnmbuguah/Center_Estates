"""
Safaricom Daraja API client for M-Pesa STK Push integration.

Environment variables (set in PaymentGatewayConfiguration.settings JSON):
  - consumer_key: Daraja API consumer key
  - consumer_secret: Daraja API consumer secret
  - passkey: STK Push passkey
  - shortcode: Business short code / paybill number
  - environment: "sandbox" or "production"

Callback URL is constructed from the PaymentGatewayConfiguration.public_key.
"""

import base64
import logging
import os
import time
from datetime import datetime
from decimal import Decimal
from typing import Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

DARAJA_BASE_URLS = {
    "sandbox": "https://sandbox.safaricom.co.ke",
    "production": "https://api.safaricom.co.ke",
}


def get_base_url(environment: str = "sandbox") -> str:
    return DARAJA_BASE_URLS.get(environment, DARAJA_BASE_URLS["sandbox"])


def get_oauth_token(consumer_key: str, consumer_secret: str, environment: str = "sandbox") -> Optional[str]:
    """Generate OAuth access token from Daraja API."""
    url = f"{get_base_url(environment)}/oauth/v1/generate?grant_type=client_credentials"
    try:
        response = requests.get(url, auth=(consumer_key, consumer_secret), timeout=30)
        response.raise_for_status()
        data = response.json()
        return data.get("access_token")
    except Exception as e:
        logger.error("Daraja OAuth token generation failed: %s", e)
        return None


def generate_password(shortcode: str, passkey: str, timestamp: str) -> str:
    """Generate the Base64-encoded password required for STK Push."""
    data_to_encode = f"{shortcode}{passkey}{timestamp}"
    return base64.b64encode(data_to_encode.encode()).decode()


def format_timestamp() -> str:
    """Generate YYYYMMDDHHmmss timestamp for Daraja API."""
    return datetime.now().strftime("%Y%m%d%H%M%S")


def initiate_stk_push(
    consumer_key: str,
    consumer_secret: str,
    shortcode: str,
    passkey: str,
    phone_number: str,
    amount: Decimal,
    callback_url: str,
    account_reference: str,
    transaction_desc: str = "Payment",
    environment: str = "sandbox",
) -> dict:
    """
    Initiate an M-Pesa STK Push request.

    Returns:
        dict with keys:
            - success: bool
            - checkout_request_id: str (if successful)
            - merchant_request_id: str (if successful)
            - response_code: str
            - response_description: str
            - customer_message: str (if successful)
            - error: str (if failed)
    """
    token = get_oauth_token(consumer_key, consumer_secret, environment)
    if not token:
        return {"success": False, "error": "Failed to generate OAuth token"}

    timestamp = format_timestamp()
    password = generate_password(shortcode, passkey, timestamp)

    # Normalize phone number to 254XXXXXXXXX format
    phone = phone_number.strip()
    if phone.startswith("0"):
        phone = "254" + phone[1:]
    elif not phone.startswith("254"):
        phone = "254" + phone

    url = f"{get_base_url(environment)}/mpesa/stkpush/v1/processrequest"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": str(int(amount)),
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": callback_url,
        "AccountReference": account_reference[:12],
        "TransactionDesc": transaction_desc[:13],
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        response_code = str(data.get("ResponseCode", ""))

        if response_code == "0":
            return {
                "success": True,
                "checkout_request_id": data.get("CheckoutRequestID", ""),
                "merchant_request_id": data.get("MerchantRequestID", ""),
                "response_code": response_code,
                "response_description": data.get("ResponseDescription", ""),
                "customer_message": data.get("CustomerMessage", ""),
            }
        else:
            return {
                "success": False,
                "response_code": response_code,
                "response_description": data.get("ResponseDescription", "Unknown error"),
                "error": data.get("ResponseDescription", "STK Push failed"),
            }
    except Exception as e:
        logger.error("STK Push request failed: %s", e)
        return {"success": False, "error": str(e)}


def parse_stk_callback(callback_body: dict) -> dict:
    """
    Parse a Safaricom STK Push callback response.

    Safaricom sends:
    {
        "Body": {
            "stkCallback": {
                "MerchantRequestID": "...",
                "CheckoutRequestID": "...",
                "ResultCode": 0,
                "ResultDesc": "...",
                "CallbackMetadata": {
                    "Item": [
                        {"Name": "Amount", "Value": 100},
                        {"Name": "MpesaReceiptNumber", "Value": "QHK71G4YS0"},
                        {"Name": "Balance"},
                        {"Name": "TransactionDate", "Value": 20260819120000},
                        {"Name": "PhoneNumber", "Value": 254712345678}
                    ]
                }
            }
        }
    }

    Returns:
        dict with standardized fields:
            - merchant_request_id
            - checkout_request_id
            - result_code (0 = success)
            - result_desc
            - amount
            - mpesa_receipt_number
            - transaction_date
            - phone_number
            - is_success: bool
    """
    stk = callback_body.get("Body", {}).get("stkCallback", {})
    result_code = stk.get("ResultCode", -1)

    # Parse callback metadata items
    items = stk.get("CallbackMetadata", {}).get("Item", [])
    metadata = {item.get("Name"): item.get("Value") for item in items if item.get("Name")}

    return {
        "merchant_request_id": stk.get("MerchantRequestID", ""),
        "checkout_request_id": stk.get("CheckoutRequestID", ""),
        "result_code": result_code,
        "result_desc": stk.get("ResultDesc", ""),
        "amount": metadata.get("Amount"),
        "mpesa_receipt_number": metadata.get("MpesaReceiptNumber", ""),
        "transaction_date": metadata.get("TransactionDate"),
        "phone_number": metadata.get("PhoneNumber"),
        "is_success": result_code == 0,
    }
