"""Authenticated streaming encryption for 4VELO home-lab backup artifacts."""

from __future__ import annotations

import base64
import os
import secrets
import shutil
import tempfile
from pathlib import Path
from typing import BinaryIO

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

MAGIC = b"4VELOBK1"
NONCE_SIZE = 12
TAG_SIZE = 16
KEY_SIZE = 32
CHUNK_SIZE = 1024 * 1024


class BackupCryptoError(ValueError):
    """Raised when a backup key or authenticated artifact is invalid."""


def generate_key() -> str:
    """Return a fresh URL-safe base64 encoded AES-256 key."""
    return base64.urlsafe_b64encode(secrets.token_bytes(KEY_SIZE)).decode("ascii")


def decode_key(encoded: str) -> bytes:
    try:
        key = base64.b64decode(encoded.encode("ascii"), altchars=b"-_", validate=True)
    except (ValueError, UnicodeEncodeError) as exc:
        raise BackupCryptoError("backup encryption key is not valid URL-safe base64") from exc
    if len(key) != KEY_SIZE:
        raise BackupCryptoError("backup encryption key must decode to exactly 32 bytes")
    return key


def encrypt_stream(source: BinaryIO, destination: Path, encoded_key: str) -> None:
    """Encrypt a binary stream to an AES-256-GCM artifact without plaintext staging."""
    key = decode_key(encoded_key)
    nonce = secrets.token_bytes(NONCE_SIZE)
    encryptor = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
    encryptor.authenticate_additional_data(MAGIC)

    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with destination.open("wb") as output:
            output.write(MAGIC)
            output.write(nonce)
            while True:
                chunk = source.read(CHUNK_SIZE)
                if not chunk:
                    break
                output.write(encryptor.update(chunk))
            output.write(encryptor.finalize())
            output.write(encryptor.tag)
            output.flush()
            os.fsync(output.fileno())
        try:
            destination.chmod(0o600)
        except OSError:
            # Windows permissions are governed by the user's ACL; the artifact
            # is still encrypted and authenticated independently of filesystem ACLs.
            pass
    except Exception:
        destination.unlink(missing_ok=True)
        raise


def _artifact_metadata(source: Path) -> tuple[bytes, bytes, int, int]:
    minimum_size = len(MAGIC) + NONCE_SIZE + TAG_SIZE
    try:
        size = source.stat().st_size
    except OSError as exc:
        raise BackupCryptoError("encrypted backup cannot be read") from exc
    if size <= minimum_size:
        raise BackupCryptoError("encrypted backup is truncated")

    with source.open("rb") as handle:
        magic = handle.read(len(MAGIC))
        if magic != MAGIC:
            raise BackupCryptoError("backup encryption header is invalid")
        nonce = handle.read(NONCE_SIZE)
        ciphertext_start = handle.tell()
        ciphertext_size = size - ciphertext_start - TAG_SIZE
        handle.seek(size - TAG_SIZE)
        tag = handle.read(TAG_SIZE)
    return nonce, tag, ciphertext_start, ciphertext_size


def _decrypt_pass(
    source: Path,
    key: bytes,
    nonce: bytes,
    tag: bytes,
    ciphertext_start: int,
    ciphertext_size: int,
    output: BinaryIO | None,
) -> None:
    decryptor = Cipher(algorithms.AES(key), modes.GCM(nonce, tag)).decryptor()
    decryptor.authenticate_additional_data(MAGIC)

    with source.open("rb") as handle:
        handle.seek(ciphertext_start)
        remaining = ciphertext_size
        try:
            while remaining:
                chunk = handle.read(min(CHUNK_SIZE, remaining))
                if not chunk:
                    raise BackupCryptoError("encrypted backup is truncated")
                remaining -= len(chunk)
                plaintext = decryptor.update(chunk)
                if output is not None:
                    output.write(plaintext)
            tail = decryptor.finalize()
            if output is not None:
                output.write(tail)
        except InvalidTag as exc:
            raise BackupCryptoError("backup authentication failed") from exc


def verify_file(source: Path, encoded_key: str) -> None:
    """Authenticate a backup completely without releasing plaintext."""
    key = decode_key(encoded_key)
    nonce, tag, ciphertext_start, ciphertext_size = _artifact_metadata(source)
    _decrypt_pass(
        source,
        key,
        nonce,
        tag,
        ciphertext_start,
        ciphertext_size,
        output=None,
    )


def decrypt_file_to_stream(source: Path, output: BinaryIO, encoded_key: str) -> None:
    """Authenticate a private ciphertext snapshot, then release plaintext."""
    key = decode_key(encoded_key)

    # Verification and decryption must consume the same immutable-by-contract
    # ciphertext bytes. Reading the caller-controlled source twice would create
    # a TOCTOU window where it could be replaced after verification but before
    # plaintext is emitted. Stage only an encrypted private snapshot; plaintext
    # is still streamed directly to the restore consumer and never written here.
    snapshot: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w+b",
            prefix=".4velo-backup-",
            suffix=".enc",
            dir=source.parent,
            delete=False,
        ) as temporary:
            snapshot = Path(temporary.name)
            with source.open("rb") as original:
                shutil.copyfileobj(original, temporary, length=CHUNK_SIZE)
            temporary.flush()
            os.fsync(temporary.fileno())

        try:
            snapshot.chmod(0o600)
        except OSError:
            pass

        nonce, tag, ciphertext_start, ciphertext_size = _artifact_metadata(snapshot)
        _decrypt_pass(
            snapshot,
            key,
            nonce,
            tag,
            ciphertext_start,
            ciphertext_size,
            output=None,
        )
        _decrypt_pass(
            snapshot,
            key,
            nonce,
            tag,
            ciphertext_start,
            ciphertext_size,
            output=output,
        )
        output.flush()
    finally:
        if snapshot is not None:
            snapshot.unlink(missing_ok=True)
