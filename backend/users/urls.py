from django.urls import path
from .views import RegisterView, UserProfileView, TenantBrandingView, TenantUpdateView, ImpersonateUserView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('branding/<str:tenant_id>/', TenantBrandingView.as_view(), name='tenant-branding'),
    path('branding/<str:pk>/update/', TenantUpdateView.as_view(), name='tenant-update'),
    path('impersonate/<int:target_user_id>/', ImpersonateUserView.as_view(), name='impersonate'),
]

