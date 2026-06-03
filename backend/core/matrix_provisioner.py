"""
Matrix Auto-Provisioning Service — SPORT Platform
===================================================
Constitution §21.2 + §22: Matrix E2EE Integration

Automatically provisions a private, encrypted Matrix room for each
new Club or Event. Uses the Matrix Client-Server API v3.

Rooms are created as private, invite-only with E2EE enabled by default.
Room ID is stored in Club.matrix_room_id for future messaging.

Env vars required:
    MATRIX_HOMESERVER  — e.g. https://matrix.org
    MATRIX_TOKEN       — bot account access token
"""

from __future__ import annotations

import logging
import os
import secrets

import requests

logger = logging.getLogger(__name__)

HOMESERVER = os.getenv("MATRIX_HOMESERVER", "https://matrix.org")
ACCESS_TOKEN = os.getenv("MATRIX_TOKEN", "")
_IS_PLACEHOLDER = not ACCESS_TOKEN or ACCESS_TOKEN == "placeholder_matrix_access_token"

HEADERS = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json",
}


# ---------------------------------------------------------------------------
# Low-level Matrix API helpers
# ---------------------------------------------------------------------------


def _post(endpoint: str, payload: dict) -> dict | None:
    """
    POST to Matrix Client-Server API.

    Returns parsed JSON or None on error.
    Skips actual network calls in dev (placeholder token).
    """
    if _IS_PLACEHOLDER:
        logger.debug("matrix: placeholder token — skipping real API call to %s", endpoint)
        # Return a synthetic room_id for dev/test environments
        return {"room_id": f"!dev_{secrets.token_hex(8)}:matrix.org"}

    url = f"{HOMESERVER}/_matrix/client/v3/{endpoint}"
    try:
        resp = requests.post(url, json=payload, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        logger.error("matrix.api_error endpoint=%s err=%s", endpoint, exc)
        return None


def _put(endpoint: str, payload: dict) -> dict | None:
    """PUT to Matrix Client-Server API."""
    if _IS_PLACEHOLDER:
        return {"ok": True}

    url = f"{HOMESERVER}/_matrix/client/v3/{endpoint}"
    try:
        resp = requests.put(url, json=payload, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        logger.error("matrix.api_error endpoint=%s err=%s", endpoint, exc)
        return None


# ---------------------------------------------------------------------------
# Room provisioning
# ---------------------------------------------------------------------------


class MatrixProvisioner:
    """
    Handles creation and configuration of Matrix rooms for Clubs and Events.
    """

    @classmethod
    def create_club_room(cls, club_name: str, club_id: int) -> str | None:
        """
        Creates a private E2EE Matrix room for a sports club.

        The room is configured with:
        - `join_rule: invite` (closed membership)
        - `history_visibility: joined` (no backdated access)
        - `m.room.encryption` event (E2EE enforced)

        Args:
            club_name: Human-readable club name.
            club_id: Database primary key (used as alias suffix).

        Returns:
            Matrix room_id string (e.g. "!abc123:matrix.org") or None on failure.
        """
        alias = f"sport-club-{club_id}-{secrets.token_hex(4)}"
        payload = {
            "name": f"🏃 {club_name}",
            "topic": f"SPORT Platform — Club Chat for {club_name}",
            "preset": "private_chat",
            "room_alias_name": alias,
            "initial_state": [
                {
                    "type": "m.room.encryption",
                    "state_key": "",
                    "content": {"algorithm": "m.megolm.v1.aes-sha2"},
                },
                {
                    "type": "m.room.history_visibility",
                    "state_key": "",
                    "content": {"history_visibility": "joined"},
                },
                {
                    "type": "m.room.guest_access",
                    "state_key": "",
                    "content": {"guest_access": "forbidden"},
                },
            ],
            "creation_content": {"m.federate": False},
        }

        result = _post("createRoom", payload)
        if result and "room_id" in result:
            room_id = result["room_id"]
            logger.info("matrix.room_created club_id=%d room_id=%s", club_id, room_id)
            return room_id

        logger.error("matrix.room_creation_failed club_id=%d", club_id)
        return None

    @classmethod
    def create_event_room(cls, event_title: str, event_id: int) -> str | None:
        """
        Creates a private E2EE Matrix room for an event.

        Args:
            event_title: Human-readable event title.
            event_id: Database primary key.

        Returns:
            Matrix room_id string or None on failure.
        """
        alias = f"sport-event-{event_id}-{secrets.token_hex(4)}"
        payload = {
            "name": f"🏆 {event_title}",
            "topic": f"SPORT Platform — Event Chat: {event_title}",
            "preset": "private_chat",
            "room_alias_name": alias,
            "initial_state": [
                {
                    "type": "m.room.encryption",
                    "state_key": "",
                    "content": {"algorithm": "m.megolm.v1.aes-sha2"},
                },
            ],
        }

        result = _post("createRoom", payload)
        if result and "room_id" in result:
            room_id = result["room_id"]
            logger.info("matrix.room_created event_id=%d room_id=%s", event_id, room_id)
            return room_id

        logger.error("matrix.room_creation_failed event_id=%d", event_id)
        return None

    @classmethod
    def invite_user(cls, room_id: str, matrix_user_id: str) -> bool:
        """
        Invites a Matrix user to an existing room.

        Args:
            room_id: Matrix room ID (e.g. "!abc123:matrix.org").
            matrix_user_id: User's Matrix ID (e.g. "@user:matrix.org").

        Returns:
            True if the invite was sent successfully.
        """
        result = _post(
            f"rooms/{requests.utils.quote(room_id)}/invite",
            {
                "user_id": matrix_user_id,
            },
        )
        if result is not None:
            logger.info("matrix.invite_sent room=%s user=%s", room_id, matrix_user_id)
            return True
        return False

    @classmethod
    def send_notification(cls, room_id: str, message: str) -> bool:
        """
        Sends a plain-text notification message to a Matrix room.
        Used by the Anti-Cheat system and event milestone alerts.

        Args:
            room_id: Target Matrix room ID.
            message: Text message body.

        Returns:
            True if message was sent successfully.
        """
        txn_id = secrets.token_hex(16)
        result = _put(
            f"rooms/{requests.utils.quote(room_id)}/send/m.room.message/{txn_id}",
            {"msgtype": "m.text", "body": message},
        )
        return result is not None
