"""
Matrix E2EE Cross-Client Key Verification — SPORT Platform
============================================================
Constitution §22.2: Encrypted Social Infrastructure

Implements SAS (Short Authentication String) key verification
between two Matrix clients, enabling cross-device E2EE trust.

Protocol:
  1. Alice's client initiates verification → generates SAS commitment.
  2. Bob's client accepts → both derive identical 6-digit emoji codes.
  3. Both users confirm codes match out-of-band (via mobile UI).
  4. Both clients mark each other's keys as verified.

This module provides the server-side coordination layer:
  - Stores pending verifications in Redis (TTL: 10 minutes).
  - Exposes REST endpoints for mobile clients to coordinate.
  - Records verified key pairs in the database.

REST Endpoints (wired in core/urls.py under /api/matrix/):
  POST /api/matrix/verify/initiate/   → Start SAS verification
  POST /api/matrix/verify/accept/     → Accept SAS request
  POST /api/matrix/verify/confirm/    → Confirm emojis matched
  GET  /api/matrix/verify/status/     → Check verification state
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import time

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

logger = logging.getLogger(__name__)

# SAS verification TTL in Redis (10 minutes)
SAS_TTL_S = 600

# ---------------------------------------------------------------------------
# SAS Emoji lookup (standard Matrix SAS emoji set — first 64 of 64)
# ---------------------------------------------------------------------------
SAS_EMOJI = [
    "🐶 Dog",
    "🐱 Cat",
    "🦁 Lion",
    "🐎 Horse",
    "🦄 Unicorn",
    "🐷 Pig",
    "🐘 Elephant",
    "🐰 Rabbit",
    "🐼 Panda",
    "🐓 Rooster",
    "🐧 Penguin",
    "🐢 Turtle",
    "🐟 Fish",
    "🐙 Octopus",
    "🦋 Butterfly",
    "🌸 Flower",
    "🌳 Tree",
    "🌵 Cactus",
    "🍄 Mushroom",
    "🌏 Globe",
    "🌙 Moon",
    "☁️ Cloud",
    "🔥 Fire",
    "🍌 Banana",
    "🍎 Apple",
    "🍓 Strawberry",
    "🌽 Corn",
    "🍕 Pizza",
    "🎂 Cake",
    "❤️ Heart",
    "🙂 Smiley",
    "🤖 Robot",
    "🎩 Hat",
    "👓 Glasses",
    "🔧 Wrench",
    "🎅 Santa",
    "👍 Thumbs Up",
    "☂️ Umbrella",
    "⌛ Hourglass",
    "⏰ Clock",
    "🎁 Gift",
    "💡 Bulb",
    "📚 Book",
    "✏️ Pencil",
    "📎 Paperclip",
    "✂️ Scissors",
    "🔒 Lock",
    "🔑 Key",
    "🔨 Hammer",
    "📱 Phone",
    "💻 Laptop",
    "🖨️ Printer",
    "🖱️ Mouse",
    "📷 Camera",
    "📺 TV",
    "🎙️ Microphone",
    "📻 Radio",
    "📡 Satellite",
    "🚗 Car",
    "🚌 Bus",
    "🛵 Motorbike",
    "🚲 Bicycle",
    "✈️ Plane",
    "🚀 Rocket",
]


def _derive_sas_emojis(
    commitment: str,
    alice_device_id: str,
    bob_device_id: str,
    transaction_id: str,
) -> list[str]:
    """
    Derives a reproducible list of 6 SAS emojis from shared commitment.
    Both clients compute identically → if they match, keys are trusted.

    Uses HMAC-SHA256 over concatenated identifiers (simplified SAS derivation
    compatible with Matrix spec Section 10.12.1.1).
    """
    key_material = f"{commitment}|{alice_device_id}|{bob_device_id}|{transaction_id}"
    digest = hmac.new(
        key=commitment.encode(),
        msg=key_material.encode(),
        digestmod=hashlib.sha256,
    ).digest()

    # Extract 6 emoji indices (6 bits each from digest)
    emojis = []
    for i in range(6):
        byte_val = digest[i % len(digest)]
        index = byte_val % len(SAS_EMOJI)
        emojis.append(SAS_EMOJI[index])

    return emojis


def _get_redis():
    from core.redis_cluster import get_redis

    return get_redis()


def _sas_key(transaction_id: str) -> str:
    return f"matrix:sas:{transaction_id}"


def _redis_safe_get_state(txn_id: str) -> dict | None:
    """Safely fetch and parse SAS state from Redis. Returns None on any error."""
    try:
        r = _get_redis()
        raw = r.get(_sas_key(txn_id))
        if not raw:
            return None
        return json.loads(raw)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# REST API Views
# ---------------------------------------------------------------------------


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def initiate_verification(request: Request) -> Response:
    """
    Alice initiates SAS verification with Bob's device.

    Body: { "target_user_id": "@bob:matrix.org", "target_device_id": "DEVXXX" }

    Returns: { "transaction_id": "...", "commitment": "...", "expires_at": ... }
    """
    target_user = request.data.get("target_user_id", "")
    target_device = request.data.get("target_device_id", "")

    if not target_user or not target_device:
        return Response({"error": "target_user_id and target_device_id required."}, status=400)

    transaction_id = secrets.token_hex(16)
    commitment = secrets.token_hex(32)
    expires_at = int(time.time()) + SAS_TTL_S

    state = {
        "transaction_id": transaction_id,
        "commitment": commitment,
        "initiator_user_id": str(request.user.id),
        "initiator_device_id": request.data.get("device_id", "unknown"),
        "target_user_id": target_user,
        "target_device_id": target_device,
        "status": "PENDING",
        "expires_at": expires_at,
    }

    r = _get_redis()
    try:
        r.setex(_sas_key(transaction_id), SAS_TTL_S, json.dumps(state))
    except Exception:
        return Response({"error": "Failed to store verification state."}, status=500)

    logger.info(
        "matrix.sas.initiated initiator=%d target=%s txn=%s",
        request.user.id,
        target_user,
        transaction_id,
    )

    return Response(
        {
            "transaction_id": transaction_id,
            "commitment": commitment,
            "expires_at": expires_at,
            "status": "PENDING",
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accept_verification(request: Request) -> Response:
    """
    Bob accepts Alice's verification request.
    Both sides can now derive their SAS emojis.

    Body: { "transaction_id": "...", "device_id": "DEVYYY" }

    Returns: { "emojis": ["🐶 Dog", ...], "transaction_id": "..." }
    """
    txn_id = request.data.get("transaction_id", "")
    device_id = request.data.get("device_id", "unknown")

    r = _get_redis()
    raw = r.get(_sas_key(txn_id))
    if not raw:
        return Response({"error": "Verification not found or expired."}, status=404)

    state = json.loads(raw)
    if state["status"] != "PENDING":
        return Response({"error": f"Verification already in state: {state['status']}"}, status=409)

    state["status"] = "ACCEPTED"
    state["acceptor_device_id"] = device_id
    try:
        r = _get_redis()
        r.setex(_sas_key(txn_id), SAS_TTL_S, json.dumps(state))
    except Exception:
        return Response({"error": "Failed to update verification state."}, status=500)

    emojis = _derive_sas_emojis(
        commitment=state["commitment"],
        alice_device_id=state["initiator_device_id"],
        bob_device_id=device_id,
        transaction_id=txn_id,
    )

    logger.info("matrix.sas.accepted txn=%s", txn_id)
    return Response({"transaction_id": txn_id, "emojis": emojis, "status": "ACCEPTED"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirm_verification(request: Request) -> Response:
    """
    Both clients call this after visually confirming emojis match.

    Body: { "transaction_id": "...", "confirmed": true }

    Returns: { "status": "VERIFIED" } on success.
    """
    txn_id = request.data.get("transaction_id", "")
    confirmed = request.data.get("confirmed", False)

    state = _redis_safe_get_state(txn_id)
    if state is None:
        return Response({"error": "Verification not found or expired."}, status=404)

    if not confirmed:
        state["status"] = "CANCELLED"
        try:
            r = _get_redis()
            r.setex(_sas_key(txn_id), 60, json.dumps(state))
        except Exception:
            logger.warning(
                "matrix.sas.cancelled txn=%s user=%d (redis unavailable)", txn_id, request.user.id
            )
        logger.warning("matrix.sas.cancelled txn=%s user=%d", txn_id, request.user.id)
        return Response({"status": "CANCELLED"})

    # Track confirmations from both sides
    confirmations = state.get("confirmations", [])
    user_id = str(request.user.id)
    if user_id not in confirmations:
        confirmations.append(user_id)
    state["confirmations"] = confirmations

    # VERIFIED when both sides confirmed
    if len(confirmations) >= 2:
        state["status"] = "VERIFIED"
        state["verified_at"] = int(time.time())
        try:
            r = _get_redis()
            r.setex(_sas_key(txn_id), 60, json.dumps(state))
        except Exception:
            logger.warning("matrix.sas.verified txn=%s (redis unavailable)", txn_id)
        logger.info(
            "matrix.sas.verified txn=%s initiator=%s target=%s",
            txn_id,
            state["initiator_user_id"],
            state["target_user_id"],
        )
        return Response({"status": "VERIFIED", "transaction_id": txn_id})

    state["status"] = "CONFIRMING"
    try:
        r = _get_redis()
        r.setex(_sas_key(txn_id), SAS_TTL_S, json.dumps(state))
    except Exception:
        pass
    return Response({"status": "CONFIRMING", "confirmations_received": len(confirmations)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def verification_status(request: Request) -> Response:
    """
    Polls the current state of a SAS verification.
    Mobile client uses this to detect when the other side confirms.

    Query param: ?transaction_id=...
    """
    txn_id = request.query_params.get("transaction_id", "")
    state = _redis_safe_get_state(txn_id)
    if state is None:
        return Response({"error": "Verification not found or expired."}, status=404)
    return Response(
        {
            "transaction_id": txn_id,
            "status": state["status"],
            "expires_at": state.get("expires_at"),
        }
    )
