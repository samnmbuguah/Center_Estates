from django.contrib import admin

from .models import Contractor, FacilityAsset, FacilityExpense, Inspection, MeterReading, PreventiveSchedule, ServiceRequest, UtilityMeter, WorkOrder

admin.site.register((FacilityAsset, Contractor, WorkOrder, PreventiveSchedule, Inspection, ServiceRequest, UtilityMeter, MeterReading, FacilityExpense))
