from __future__ import annotations

import logging
from typing import Iterable

import requests
from django.utils import timezone

from users.models import UserPushToken

logger = logging.getLogger(__name__)

_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _active_tokens_for_users(user_ids: Iterable[int]) -> list[UserPushToken]:
    return list(
        UserPushToken.objects.filter(user_id__in=list(user_ids), is_active=True).only(
            "id", "token", "user_id", "platform"
        )
    )


def send_expo_notifications(
    *,
    user_ids: Iterable[int],
    title: str,
    body: str,
    data: dict | None = None,
) -> int:
    tokens = _active_tokens_for_users(user_ids)
    if not tokens:
        return 0

    sent = 0
    for push_token in tokens:
        payload = {
            "to": push_token.token,
            "title": title,
            "body": body,
            "sound": "default",
            "data": data or {},
        }
        try:
            response = requests.post(_EXPO_PUSH_URL, json=payload, timeout=10)
            if response.status_code >= 400:
                logger.warning(
                    "push.expo_failed user_id=%s status=%s body=%s",
                    push_token.user_id,
                    response.status_code,
                    response.text[:200],
                )
                continue
            push_token.last_seen_at = timezone.now()
            push_token.save(update_fields=["last_seen_at"])
            sent += 1
        except Exception as exc:
            logger.warning("push.expo_error user_id=%s err=%s", push_token.user_id, exc)
    return sent
