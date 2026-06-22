from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/', include('exercises.urls')),
    path('api/', include('submissions.urls')),
]
