import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zcheck.settings')
app = Celery('zcheck')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
