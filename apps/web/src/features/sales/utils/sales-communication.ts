/**
 * Sales Communication Utilities
 * Phone normalization, WhatsApp deep-link generation, and message templates.
 */

/**
 * Normalizes phone numbers to international standard (defaulting to Kenya +254).
 * Handles formats like:
 * 0712345678 -> 254712345678
 * 0112345678 -> 254112345678
 * +254712345678 -> 254712345678
 * 254712345678 -> 254712345678
 */
export function cleanPhoneNumber(rawPhone: string | null | undefined): string {
  if (!rawPhone) return "";
  // Strip all non-digit characters
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";

  // Kenya 10-digit mobile starting with 07 or 01
  if (digits.length === 10 && digits.startsWith("0")) {
    return `254${digits.slice(1)}`;
  }

  // Already prefixed with 254
  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }

  // Fallback to plain digits
  return digits;
}

/**
 * Generates an instant WhatsApp Web/App click-to-chat URL.
 */
export function createWhatsAppUrl(phone: string, message: string): string {
  const normalizedPhone = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(message.trim());
  if (normalizedPhone) {
    return `https://wa.me/${normalizedPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

export type SiteVisitCommData = {
  visitor_name?: string;
  phone?: string;
  project_name?: string;
  visited_at?: string;
  follow_up_on?: string;
  agent_name?: string;
  notes?: string;
  org_name?: string;
};

export function buildSiteVisitMessage(data: SiteVisitCommData): string {
  const org = data.org_name || "Center Estates";
  const visitor = data.visitor_name ? data.visitor_name.split(" ")[0] : "Client";
  const project = data.project_name || "our development site";
  const agent = data.agent_name ? ` (${data.agent_name})` : "";

  let msg = `Hello ${visitor},\n\nThank you for touring *${project}* with us${agent} at *${org}*.`;

  if (data.follow_up_on) {
    const formattedDate = new Date(data.follow_up_on).toLocaleDateString("en-KE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    msg += `\n\nWe have scheduled our next follow-up on *${formattedDate}*. Please let us know if you have any questions regarding unit availability, pricing, or financing options.`;
  } else {
    msg += `\n\nWe would be glad to share full floor plans, pricing sheets, and payment plan options tailored to your preference.`;
  }

  msg += `\n\nBest regards,\n*${org} Sales Team*`;
  return msg;
}

export type PaymentReceiptCommData = {
  buyer_name?: string;
  reference?: string;
  external_reference?: string;
  amount?: unknown;
  paid_on?: string;
  method?: string;
  sale_reference?: string;
  org_name?: string;
};

export function buildPaymentReceiptMessage(data: PaymentReceiptCommData): string {
  const org = data.org_name || "Center Estates";
  const buyer = data.buyer_name ? data.buyer_name.split(" ")[0] : "Client";
  const amtNum = typeof data.amount === "number" ? data.amount : Number(data.amount ?? 0);
  const amt = amtNum > 0 ? `KES ${amtNum.toLocaleString()}` : data.amount ? `KES ${String(data.amount)}` : "payment";
  const ref = data.reference || data.external_reference || "N/A";
  const dateStr = data.paid_on
    ? new Date(data.paid_on).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
    : "today";

  let msg = `Dear ${buyer},\n\nWe confirm receipt of *${amt}* on *${dateStr}* for property sale reference *${data.sale_reference || "your unit"}*.`;
  msg += `\n\n• *Receipt Ref:* ${ref}`;
  if (data.method) {
    msg += `\n• *Payment Channel:* ${data.method.toUpperCase()}`;
  }
  if (data.external_reference && data.external_reference !== ref) {
    msg += `\n• *Transaction Code:* ${data.external_reference}`;
  }

  msg += `\n\nYour payment has been verified and credited against your schedule. Thank you for your continued partnership with *${org}*.\n\nBest regards,\n*${org} Finance & Accounts*`;
  return msg;
}

export type InstallmentReminderCommData = {
  buyer_name?: string;
  description?: string;
  amount?: unknown;
  paid_amount?: unknown;
  due_on?: string;
  sale_reference?: string;
  pay_url?: string;
  org_name?: string;
};

export function buildInstallmentReminderMessage(data: InstallmentReminderCommData): string {
  const org = data.org_name || "Center Estates";
  const buyer = data.buyer_name ? data.buyer_name.split(" ")[0] : "Client";
  const totalAmt = Number(data.amount ?? 0);
  const paidAmt = Number(data.paid_amount ?? 0);
  const balance = Math.max(0, totalAmt - paidAmt);
  const amtFormatted = `KES ${balance.toLocaleString()}`;
  const milestone = data.description || "scheduled installment";
  const dueDate = data.due_on
    ? new Date(data.due_on).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : "the scheduled date";

  const isOverdue = data.due_on && new Date(data.due_on).getTime() < Date.now();
  const headline = isOverdue
    ? `Friendly reminder that your installment for *${milestone}* is overdue since *${dueDate}*.`
    : `Friendly reminder that your upcoming installment for *${milestone}* is due on *${dueDate}*.`;

  let msg = `Dear ${buyer},\n\n${headline}`;
  msg += `\n\n• *Outstanding Due:* ${amtFormatted}`;
  msg += `\n• *Sale Ref:* ${data.sale_reference || "N/A"}`;

  if (data.pay_url) {
    msg += `\n\nYou can review your schedule and pay online here:\n${data.pay_url}`;
  }

  msg += `\n\nIf you have already settled this balance, kindly share your transaction reference for verification.\n\nWarm regards,\n*${org} Collections Team*`;
  return msg;
}
