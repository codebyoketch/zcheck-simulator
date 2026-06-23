from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'first_name', 'last_name')

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'is_staff', 'avatar_url', 'bio', 'total_xp', 'level',
            'created_at', 'date_joined',
        )
        read_only_fields = ('id', 'role', 'is_staff', 'total_xp', 'level', 'created_at', 'date_joined')


class UserAdminSerializer(serializers.ModelSerializer):
    """Full serializer for admin use."""
    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'is_active', 'is_staff', 'total_xp', 'level',
            'created_at', 'last_login',
        )
        read_only_fields = ('id', 'created_at', 'last_login')
