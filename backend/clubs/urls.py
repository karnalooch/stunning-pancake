from django.urls import path

from . import views

urlpatterns = [
    path('', views.ClubListCreateView.as_view(), name='club-list-create'),
    path('<int:pk>/', views.ClubDetailView.as_view(), name='club-detail'),
    path('<int:pk>/members/', views.ClubMembersView.as_view(), name='club-members'),
    path('<int:pk>/join/', views.join_club, name='club-join'),
    path('<int:pk>/leave/', views.leave_club, name='club-leave'),
    path('<int:pk>/leaderboard/', views.ClubLeaderboardView.as_view(), name='club-leaderboard'),
    path('challenges/', views.ClubChallengeListCreateView.as_view(), name='club-challenges'),
]
