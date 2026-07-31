from django.http import JsonResponse


def health(request):
    return JsonResponse({'status': 'ok', 'service': 'center-estates-erp'})

# Create your views here.
