import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

# 1. Set the environment variable first
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zcheck.settings')

# 2. This loads the Django app registry and makes models available
django_asgi_app = get_asgi_application()

# 3. Import your project files ONLY after get_asgi_application()
import submissions.routing

# 4. Define your application router
application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        URLRouter(submissions.routing.websocket_urlpatterns)
    ),
})
