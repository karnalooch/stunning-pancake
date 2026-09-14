"""Outbound webhook URL safety helpers (SSRF protection).

T09: Live Map webhooks are admin-controlled but historically accepted any URL.
This module centralises the SSRF guard used by both the serializer (write
time) and the Celery worker (delivery time) so the policy cannot be bypassed
by editing the record out-of-band.

The guard:

* allows only ``https`` (no http, file, ftp, gopher, etc.);
* rejects URLs containing userinfo (``https://user:pass@host``);
* requires a well-formed TCP port when one is present (numeric,
  ``1..65535``; non-numeric, zero or ``>65535`` are rejected);
* resolves the host through ``socket.getaddrinfo``;
* rejects the URL if DNS resolution fails or returns zero addresses;
* accepts the URL only if **every** returned IPv4/IPv6 address is
  globally routable (``is_global``); a single private/loopback/link-local/
  multicast/unspecified/reserved or IPv4-mapped-IPv6 address fails the check;
* treats literal IPv4/IPv6 hosts in the URL the same as resolved addresses;
* never opens an actual TCP/UDP connection — pure DNS resolution + parsing.

DNS rebinding / TOCTOU between write-time and delivery-time validation is
**not** fully eliminated by this helper — ``requests.post`` performs its own
``getaddrinfo`` and the resolved address can change in between. The worker
re-runs the same guard immediately before sending so the policy is enforced
on the actual outbound payload, but a pinned-address socket pool is out of
scope for T09.

All ``UnsafeWebhookURL`` messages are intentionally short, fixed strings.
They never include the original URL, hostname, resolved IP addresses, the
port value provided by the caller, userinfo, or the query string. The
serializer surfaces these messages directly to API clients, and the worker
also uses the same codes for log/reporting — leaking any of the above would
turn a refused URL into an information disclosure channel.
"""

from __future__ import annotations

import ipaddress
import socket
from typing import Any
from urllib.parse import urlsplit


class UnsafeWebhookURL(ValueError):
    """Raised when a webhook URL fails the SSRF guard.

    The message is a short, fixed reason code; it must never echo user input.
    """

    # Stable reason codes. Callers (serializer, worker) may rely on these
    # for logging and metrics — they are part of the public contract.
    REASON_HOST_MISSING = "URL is missing a host."
    REASON_NON_EMPTY_STRING = "URL must be a non-empty string."
    REASON_MALFORMED = "Malformed URL."
    REASON_SCHEME = "Only https URLs are allowed."
    REASON_USERINFO = "URLs with userinfo are not allowed."
    REASON_INVALID_PORT = "URL contains an invalid port."
    REASON_UNRESOLVABLE = "Hostname could not be resolved."
    REASON_NO_ADDRESSES = "Hostname resolved to no usable addresses."
    REASON_NON_PUBLIC = "Host resolves to a non-public address."


def _ip_is_safe(ip: ipaddress._BaseAddress) -> bool:
    """Return True if ``ip`` is a globally routable IPv4 or IPv6 address.

    Conservative: any non-``is_global`` flag is treated as unsafe. This covers
    loopback, private, link-local, multicast, unspecified, reserved, IPv4
    mapped/private IPv6 (``::ffff:10.0.0.1`` etc.), and ``is_site_local``
    IPv6 deprecation territories.
    """

    if isinstance(ip, ipaddress.IPv6Address):
        # IPv4-mapped IPv6 (::ffff:a.b.c.d) — unwrap and re-check.
        if ip.ipv4_mapped is not None:
            return _ip_is_safe(ip.ipv4_mapped)
        if ip.sixtofour is not None:
            return _ip_is_safe(ip.sixtofour)
        if ip.teredo is not None:
            return _ip_is_safe(
                ipaddress.ip_address(ip.teredo[1] if isinstance(ip.teredo, tuple) else ip.teredo)
            )

    if not getattr(ip, "is_global", False):
        return False
    # is_global already excludes loopback/private/link_local/multicast/
    # unspecified/reserved on the stdlib versions we target. Keep an explicit
    # belt-and-braces check for categories is_global misses in older Python
    # releases so the test suite remains deterministic.
    if (
        getattr(ip, "is_loopback", False)
        or getattr(ip, "is_private", False)
        or getattr(ip, "is_link_local", False)
        or getattr(ip, "is_multicast", False)
        or getattr(ip, "is_unspecified", False)
        or getattr(ip, "is_reserved", False)
        or getattr(ip, "is_site_local", False)
    ):
        return False
    return True


def _resolve_host(host: str) -> list[ipaddress._BaseAddress]:
    """Resolve ``host`` to a list of IP addresses. Raises ``UnsafeWebhookURL``.

    The raised message never includes ``host`` — callers must not propagate it.
    """

    if not host:
        raise UnsafeWebhookURL(UnsafeWebhookURL.REASON_HOST_MISSING)

    # Literal IP — short-circuit DNS but still validate.
    try:
        literal = ipaddress.ip_address(host.strip("[]"))
        return [literal]
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(
            host,
            None,
            proto=socket.IPPROTO_TCP,
        )
    except socket.gaierror:
        # Never echo the failing host: it is user input and would defeat the
        # purpose of returning a fixed reason.
        raise UnsafeWebhookURL(UnsafeWebhookURL.REASON_UNRESOLVABLE)

    seen: set[str] = set()
    addrs: list[ipaddress._BaseAddress] = []
    for info in infos:
        sockaddr = info[4] if len(info) >= 5 else None
        if not sockaddr:
            continue
        candidate = sockaddr[0]
        try:
            ip = ipaddress.ip_address(candidate)
        except ValueError:
            continue
        key = str(ip)
        if key in seen:
            continue
        seen.add(key)
        addrs.append(ip)

    if not addrs:
        raise UnsafeWebhookURL(UnsafeWebhookURL.REASON_NO_ADDRESSES)
    return addrs


def _validate_port(parts: Any) -> None:
    """Reject non-TCP / out-of-range ports. Raises ``UnsafeWebhookURL``.

    ``urllib.parse.urlsplit`` exposes ``parts.port`` only when the port is a
    numeric literal. Non-numeric or out-of-range values raise
    ``ValueError`` on access — this helper captures that. A missing port is
    allowed (TCP defaults apply downstream).
    """
    # ``parts.port`` is None if no port was present; access it once inside the
    # try so a malformed scheme/suffix cannot leak through.
    try:
        port = parts.port
    except ValueError:
        raise UnsafeWebhookURL(UnsafeWebhookURL.REASON_INVALID_PORT)
    if port is None:
        return
    if not 1 <= int(port) <= 65535:
        raise UnsafeWebhookURL(UnsafeWebhookURL.REASON_INVALID_PORT)


def validate_outbound_url(url: Any) -> str:
    """Validate ``url`` for outbound use. Returns the original URL on success.

    Raises ``UnsafeWebhookURL`` with a short, fixed reason on any failure.
    The full URL, hostname, resolved addresses, port value, userinfo, and
    query string are never included in the raised message.
    """

    if not isinstance(url, str) or not url:
        raise UnsafeWebhookURL(UnsafeWebhookURL.REASON_NON_EMPTY_STRING)

    try:
        parts = urlsplit(url)
    except ValueError:
        # ``urlsplit`` raises ValueError for a small set of pathological
        # inputs (e.g. NUL bytes or unclosed IPv6 brackets). We do not echo
        # the parser message because it can contain parts of the URL.
        raise UnsafeWebhookURL(UnsafeWebhookURL.REASON_MALFORMED)

    scheme = (parts.scheme or "").lower()
    if scheme != "https":
        raise UnsafeWebhookURL(UnsafeWebhookURL.REASON_SCHEME)

    if parts.username or parts.password:
        raise UnsafeWebhookURL(UnsafeWebhookURL.REASON_USERINFO)

    # Reject obviously invalid ports (non-numeric, 0, >65535) before any
    # DNS lookup. ``urllib.parse`` will raise ``ValueError`` when ``port`` is
    # accessed for non-numeric values, and the range check above catches
    # out-of-range numeric ones.
    _validate_port(parts)

    host = (parts.hostname or "").strip()
    if not host:
        raise UnsafeWebhookURL(UnsafeWebhookURL.REASON_HOST_MISSING)

    addrs = _resolve_host(host)
    unsafe = [ip for ip in addrs if not _ip_is_safe(ip)]
    if unsafe:
        raise UnsafeWebhookURL(UnsafeWebhookURL.REASON_NON_PUBLIC)
    return url
