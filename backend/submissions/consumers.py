"""
WebSocket consumer for real-time submission results.

Connection: ws://host/ws/submissions/<submission_id>/
- Student connects after POST /api/submit/
- Celery task pushes result when done
- Consumer forwards it to the student and closes
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model

User = get_user_model()


class SubmissionConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.submission_id = self.scope['url_route']['kwargs']['submission_id']
        self.group_name = f'submission_{self.submission_id}'

        # Authenticate via JWT token in query string: ?token=<access_token>
        user = await self._get_user()
        if user is None:
            await self.close(code=4001)
            return

        # Verify this submission belongs to the user
        owns = await self._user_owns_submission(user, self.submission_id)
        if not owns:
            await self.close(code=4003)
            return

        self.user = user

        # Join the submission group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # If submission is already complete (e.g. reconnect), send result immediately
        result = await self._get_completed_result()
        if result:
            await self.send(text_data=json.dumps(result))
            await self.close()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Called by Celery task via channel layer
    async def submission_result(self, event):
        await self.send(text_data=json.dumps(event['data']))
        await self.close()

    # ── Helpers ──────────────────────────────────────────────────────────────

    async def _get_user(self):
        query_string = self.scope.get('query_string', b'').decode()
        params = dict(p.split('=') for p in query_string.split('&') if '=' in p)
        token_str = params.get('token')
        if not token_str:
            return None
        try:
            token = AccessToken(token_str)
            user = await database_sync_to_async(User.objects.get)(id=token['user_id'])
            return user
        except Exception:
            return None

    @database_sync_to_async
    def _user_owns_submission(self, user, submission_id):
        from submissions.models import Submission
        return Submission.objects.filter(id=submission_id, user=user).exists()

    @database_sync_to_async
    def _get_completed_result(self):
        from submissions.models import Submission
        from submissions.serializers import SubmissionSerializer
        try:
            sub = Submission.objects.prefetch_related(
                'test_results__test_case'
            ).get(id=self.submission_id)
            if sub.status not in ('pending', 'running'):
                return SubmissionSerializer(sub).data
        except Submission.DoesNotExist:
            pass
        return None
