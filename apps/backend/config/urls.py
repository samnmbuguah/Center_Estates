"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from django.http import JsonResponse

def root_index(request):
    return JsonResponse({
        "status": "online",
        "platform": "Center Estates Enterprise ERP",
        "version": "2.4.0",
        "docs": "/api/v1/docs/",
        "health": "/api/v1/health/",
    })

urlpatterns = [
    path('', root_index, name='root-index'),
    path('api/v1/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('admin/', admin.site.urls),
    path('api/v1/', include('core.urls')),
    path('api/v1/property/', include('properties.urls')),
    path('api/v1/facility/', include('facilities.urls')),
    path('api/v1/sales/', include('sales.urls')),
    path('api/v1/tender/', include('tenders.urls')),
    path('api/v1/valuation/', include('valuations.urls')),
    path('api/v1/construction/', include('construction.urls')),
    path('api/v1/companion/', include('companion.urls')),
]
