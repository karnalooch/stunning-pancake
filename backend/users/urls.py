from django.urls import path
from .views import RegisterView, UserProfileView, TenantBrandingView, TenantUpdateView, ImpersonateUserView, UserListView, TenantListView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('branding/<str:tenant_id>/', TenantBrandingView.as_view(), name='tenant-branding'),
    path('branding/<str:pk>/update/', TenantUpdateView.as_view(), name='tenant-update'),
    path('impersonate/<int:target_user_id>/', ImpersonateUserView.as_view(), name='impersonate'),
    path('all/', UserListView.as_view(), name='user-list'),
    path('tenants/all/', TenantListView.as_view(), name='tenant-list'),
]

