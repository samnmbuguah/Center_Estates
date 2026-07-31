from rest_framework import serializers
from .models import ComparableEvidence,DraftValuationReport,FinalValuationReport,ValuationAuditEvent,ValuationClient,ValuationInspection,ValuationInstruction,ValuationInvoice,ValuationPayment

class ClientSerializer(serializers.ModelSerializer):
 class Meta: model=ValuationClient; exclude=('organization',)
class InstructionSerializer(serializers.ModelSerializer):
 client_name=serializers.CharField(source='client.name',read_only=True); valuer_name=serializers.CharField(source='valuer.get_full_name',read_only=True)
 class Meta: model=ValuationInstruction; exclude=('organization',)
class InspectionSerializer(serializers.ModelSerializer):
 instruction_reference=serializers.CharField(source='instruction.reference',read_only=True); property_description=serializers.CharField(source='instruction.property_description',read_only=True); inspector_name=serializers.CharField(source='inspector.get_full_name',read_only=True)
 class Meta: model=ValuationInspection; exclude=('organization',)
class ComparableSerializer(serializers.ModelSerializer):
 instruction_reference=serializers.CharField(source='instruction.reference',read_only=True)
 class Meta: model=ComparableEvidence; exclude=('organization',)
class DraftSerializer(serializers.ModelSerializer):
 instruction_reference=serializers.CharField(source='instruction.reference',read_only=True); property_description=serializers.CharField(source='instruction.property_description',read_only=True); prepared_by_name=serializers.CharField(source='prepared_by.get_full_name',read_only=True)
 class Meta: model=DraftValuationReport; exclude=('organization',); read_only_fields=('prepared_by','status')
class FinalSerializer(serializers.ModelSerializer):
 instruction_reference=serializers.CharField(source='instruction.reference',read_only=True); property_description=serializers.CharField(source='instruction.property_description',read_only=True); client_name=serializers.CharField(source='instruction.client.name',read_only=True)
 class Meta: model=FinalValuationReport; exclude=('organization',); read_only_fields=('signed_by','market_value','delivered_at','delivery_method')
class InvoiceSerializer(serializers.ModelSerializer):
 instruction_reference=serializers.CharField(source='instruction.reference',read_only=True); client_name=serializers.CharField(source='instruction.client.name',read_only=True)
 class Meta: model=ValuationInvoice; exclude=('organization',)
class PaymentSerializer(serializers.ModelSerializer):
 invoice_number=serializers.CharField(source='invoice.number',read_only=True); client_name=serializers.CharField(source='invoice.instruction.client.name',read_only=True)
 class Meta: model=ValuationPayment; exclude=('organization','received_by')
class AuditEventSerializer(serializers.ModelSerializer):
 instruction_reference=serializers.CharField(source='instruction.reference',read_only=True); actor_name=serializers.CharField(source='actor.username',read_only=True)
 class Meta: model=ValuationAuditEvent; exclude=('organization','actor')
