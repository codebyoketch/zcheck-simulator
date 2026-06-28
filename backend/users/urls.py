from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.CustomTokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', views.me, name='me'),
    path('profile/', views.ProfileView.as_view(), name='profile'),
    # Admin
    path('admin/users/', views.UserListView.as_view(), name='user_list'),
    path('admin/users/<int:pk>/', views.UserDetailView.as_view(), name='user_detail'),
    path('admin/users/<int:pk>/reset-password/', views.admin_reset_password, name='admin_reset_password'),
]
