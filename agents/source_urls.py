"""Which source URLs are real, citable web pages.

A citation must point at a real page someone can open. Placeholder hosts
(example.com and friends, RFC 2606/6761 reserved names), local or private
addresses, empty URLs and non-http(s) schemes are never real sources --
they are how a hand-written demo corpus once reached live reports. Used at
ingest (refuse to store) and at retrieval (never pass to generation).
"""

import ipaddress
from urllib.parse import urlparse

# RFC 2606 / RFC 6761 reserved TLDs, plus .local (mDNS).
_RESERVED_TLDS = {"test", "invalid", "local", "localhost", "example"}


def placeholder_reason(url: str | None) -> str | None:
    """Why `url` isn't a real public web source, or None if it is."""
    if not url or not url.strip():
        return "empty URL"
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return "unparseable URL"
    if parsed.scheme not in ("http", "https"):
        return f"not http(s): {parsed.scheme or 'no scheme'}"
    host = (parsed.hostname or "").rstrip(".").lower()
    if not host:
        return "no host"
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    if ip is not None:
        return None if ip.is_global else f"non-public IP {host}"
    labels = host.split(".")
    if len(labels) < 2:
        return f"single-label host {host}"
    if labels[-1] in _RESERVED_TLDS:
        return f"reserved TLD .{labels[-1]}"
    if "example" in labels:
        return f"placeholder host {host}"
    return None


def is_public_source_url(url: str | None) -> bool:
    return placeholder_reason(url) is None
