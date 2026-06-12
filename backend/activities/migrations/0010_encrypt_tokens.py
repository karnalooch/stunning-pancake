# Generated migration - encrypts plaintext OAuth tokens at rest
import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import migrations


def _get_fernet():
    """Replicate the Fernet key derivation from models.py."""
    key_raw = os.getenv(
        "TOKEN_ENCRYPTION_KEY",
        base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest()).decode(),
    )
    return Fernet(key_raw.encode() if isinstance(key_raw, str) else key_raw)


def encrypt_existing_tokens(apps, schema_editor):
    """
    Encrypts any plaintext access_token / refresh_token values using Fernet.
    Already-encrypted tokens (starting with 'gAAAAA') are skipped.
    """
    WearableIntegration = apps.get_model("activities", "WearableIntegration")
    fernet = _get_fernet()
    total = 0
    encrypted = 0

    for integration in WearableIntegration.objects.iterator():
        total += 1
        changed = False

        if integration.access_token and not integration.access_token.startswith("gAAAAA"):
            try:
                fernet.decrypt(integration.access_token.encode())
            except (InvalidToken, UnicodeDecodeError):
                integration.access_token = fernet.encrypt(
                    integration.access_token.encode()
                ).decode()
                changed = True

        if integration.refresh_token and not integration.refresh_token.startswith("gAAAAA"):
            try:
                fernet.decrypt(integration.refresh_token.encode())
            except (InvalidToken, UnicodeDecodeError):
                integration.refresh_token = fernet.encrypt(
                    integration.refresh_token.encode()
                ).decode()
                changed = True

        if changed:
            integration.save(update_fields=["access_token", "refresh_token"])
            encrypted += 1

    if total > 0:
        print(f"  Encrypted {encrypted} of {total} existing WearableIntegration tokens.")


def reverse_encrypt_existing_tokens(apps, schema_editor):
    """No-op reverse - decryption requires the Fernet key; not safe to automate."""
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("activities", "0009_add_poi_category_and_wearable_integration"),
    ]

    operations = [
        migrations.RunPython(
            encrypt_existing_tokens,
            reverse_code=reverse_encrypt_existing_tokens,
        ),
    ]
