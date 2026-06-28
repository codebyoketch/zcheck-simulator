from rest_framework import generics, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenView
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .models import User
from .serializers import RegisterSerializer, UserProfileSerializer, UserAdminSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserListView(generics.ListAPIView):
    """Admin only — list all users with search support."""
    queryset = User.objects.all().order_by('-created_at')
    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [filters.SearchFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']


class UserDetailView(generics.RetrieveUpdateAPIView):
    """Admin only — manage individual user."""
    queryset = User.objects.all()
    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAdminUser]


class CustomTokenObtainPairView(BaseTokenView):
    """Return block_reason in the 401 response when account is inactive."""
    def post(self, request, *args, **kwargs):
        username = request.data.get('username', '')
        try:
            user = User.objects.get(username=username)
            if not user.is_active and user.block_reason:
                return Response(
                    {'detail': user.block_reason},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        except User.DoesNotExist:
            pass

        return super().post(request, *args, **kwargs)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    serializer = UserProfileSerializer(request.user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def admin_reset_password(request, pk):
    """Admin sets a new password for a user directly."""
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    new_password = request.data.get('password', '').strip()
    if not new_password:
        return Response({'detail': 'Password is required.'}, status=400)

    try:
        validate_password(new_password, user)
    except ValidationError as e:
        return Response({'detail': e.messages}, status=400)

    user.set_password(new_password)
    user.save(update_fields=['password'])
    return Response({'detail': 'Password updated successfully.'})
