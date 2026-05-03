from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import models
from django.conf import settings
from django.utils import timezone


class BetaFeedback(models.Model):
    """Feedback submitted by beta testers during RC v0.2 testing."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='beta_feedback',
    )
    category = models.CharField(
        max_length=30,
        choices=[
            ('BUG', 'Bug Report'),
            ('FEATURE', 'Feature Request'),
            ('UX', 'UX / Design'),
            ('PERF', 'Performance'),
            ('OTHER', 'Other'),
        ],
        default='OTHER',
    )
    message = models.TextField()
    screen = models.CharField(max_length=100, blank=True, help_text='Which screen the feedback is about')
    severity = models.IntegerField(default=3, choices=[(1, 'Critical'), (2, 'High'), (3, 'Medium'), (4, 'Low'), (5, 'Cosmetic')])
    resolved = models.BooleanField(default=False)
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'activities'
        db_table = 'beta_feedback'
        ordering = ['-created_at']

    def __str__(self):
        return f"BetaFeedback #{self.id} — {self.user.username} — {self.category}"


class BetaFeedbackCreateView(APIView):
    """Any authenticated user can submit beta feedback."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        message = request.data.get('message', '').strip()
        if not message:
            return Response({'error': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)

        feedback = BetaFeedback.objects.create(
            user=request.user,
            category=request.data.get('category', 'OTHER'),
            message=message,
            screen=request.data.get('screen', ''),
            severity=request.data.get('severity', 3),
        )
        return Response({
            'id': feedback.id,
            'status': 'received',
            'message': 'Thank you for your feedback!',
        }, status=status.HTTP_201_CREATED)


class BetaFeedbackListView(generics.ListAPIView):
    """Admin view to list all beta feedback entries."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        role = getattr(request.user, 'role', None)
        if role not in ('GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR'):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        qs = BetaFeedback.objects.select_related('user').order_by('-created_at')[:50]
        data = []
        for f in qs:
            data.append({
                'id': f.id,
                'username': f.user.username,
                'category': f.category,
                'message': f.message,
                'screen': f.screen,
                'severity': f.severity,
                'resolved': f.resolved,
                'admin_notes': f.admin_notes,
                'created_at': f.created_at.isoformat(),
            })
        return Response(data)


class BetaFeedbackResolveView(APIView):
    """Admin marks feedback as resolved."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, feedback_id):
        role = getattr(request.user, 'role', None)
        if role not in ('GLOBAL_OWNER', 'TENANT_ADMIN', 'TENANT_MODERATOR'):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        try:
            feedback = BetaFeedback.objects.get(pk=feedback_id)
            feedback.resolved = True
            feedback.admin_notes = request.data.get('admin_notes', feedback.admin_notes)
            feedback.save()
            return Response({'id': feedback.id, 'resolved': True})
        except BetaFeedback.DoesNotExist:
            return Response({'error': 'Feedback not found'}, status=status.HTTP_404_NOT_FOUND)
