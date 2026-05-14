from django.urls import path

from .views import (
    AuditLogListView,
    ImpersonateUserView,
    InvitationTokenView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    TenantBrandingView,
    TenantListView,
    TenantUpdateView,
    UserCreateView,
    UserDeleteView,
    UserListView,
    UserProfileView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('password/change/', PasswordChangeView.as_view(), name='password-change'),
    path('password/reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password/reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('branding/<str:tenant_id>/', TenantBrandingView.as_view(), name='tenant-branding'),
    path('branding/<str:pk>/update/', TenantUpdateView.as_view(), name='tenant-update'),
    path('impersonate/<int:target_user_id>/', ImpersonateUserView.as_view(), name='impersonate'),
    path('all/', UserListView.as_view(), name='user-list'),
    path('tenants/all/', TenantListView.as_view(), name='tenant-list'),
    path('audit-log/', AuditLogListView.as_view(), name='audit-log-list'),
    path('create/', UserCreateView.as_view(), name='user-create'),
    path('<int:pk>/delete/', UserDeleteView.as_view(), name='user-delete'),
    path('invitation/', InvitationTokenView.as_view(), name='invitation'),
]
