from django.urls import path
from . import views

urlpatterns = [
    path('submit/', views.submit_code, name='submit_code'),
    path('submissions/<int:pk>/', views.submission_status, name='submission_status'),
    path('progress/', views.my_progress, name='my_progress'),
    path('history/', views.my_history, name='my_history'),
    path('sessions/start/', views.start_session, name='start_session'),
    path('sessions/<int:pk>/end/', views.end_session, name='end_session'),
    path('sessions/active/', views.active_session, name='active_session'),
    path('sessions/<int:pk>/update/', views.update_session, name='update_session'),
]