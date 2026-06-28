from django.urls import path
from . import views

urlpatterns = [
    # Student
    path('submit/', views.submit_code, name='submit_code'),
    path('submissions/<int:pk>/', views.submission_status, name='submission_status'),
    path('submissions/history/<slug:slug>/', views.exercise_history, name='exercise_history'),
    path('progress/', views.my_progress, name='my_progress'),
    path('history/', views.my_history, name='my_history'),

    # Sessions
    path('sessions/start/', views.start_session, name='start_session'),
    path('sessions/<int:pk>/end/', views.end_session, name='end_session'),
    path('sessions/active/', views.active_session, name='active_session'),
    path('sessions/<int:pk>/update/', views.update_session, name='update_session'),

    # Admin
    path('admin/users/', views.admin_users_list, name='admin_users_list'),
    path('admin/users/<int:user_id>/submissions/', views.admin_user_submissions, name='admin_user_submissions'),
    path('admin/users/<int:user_id>/sessions/', views.admin_user_sessions, name='admin_user_sessions'),
]