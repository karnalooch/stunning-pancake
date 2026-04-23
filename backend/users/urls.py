from django.urls import path
from .views import RegisterView, UserProfileView, TenantBrandingView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('branding/<str:tenant_id>/', TenantBrandingView.as_view(), name='tenant-branding'),
]

