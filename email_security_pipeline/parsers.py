from __future__ import annotations
import email
import re
from dataclasses import dataclass
from email import policy
from email.parser import BytesParser
from typing import Dict, List, Optional, Tuple

try:
    import magic  # python-magic
except Exception:
    magic = None

try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None

URL_REGEX = re.compile(r"https?://[^\s)>'\"]+", re.IGNORECASE)
SHORTENER_HOSTS = {"bit.ly", "t.co", "tinyurl.com", "goo.gl"}
HOMOGLYPH_SUSPICIOUS = {"\u0430", "\u03BF", "\u200B", "\u202E"}

@dataclass
class ParsedEmail:
    subject: str
    body_text: str
    compact_header_text: str
    urls: List[str]
    has_punycode: bool
    display_vs_addr_distance: int
    spf: Optional[str]
    dkim: Optional[str]
    dmarc: Optional[str]
    received_count: int
    reply_to_mismatch: bool
    attachments_meta: List[Dict]
    grammar_error_count: Optional[int]
    perplexity_score: Optional[float]

def _levenshtein(a: str, b: str) -> int:
    if a == b: return 0
    if not a: return len(b)
    if not b: return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            ins = prev[j] + 1
            dele = curr[j-1] + 1
            sub = prev[j-1] + (ca != cb)
            curr.append(min(ins, dele, sub))
        prev = curr
    return prev[-1]

def _html_to_text(html: str) -> str:
    if not html:
        return ""
    if BeautifulSoup is None:
        return re.sub(r"<[^>]+>", " ", html)
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style", "noscript"]):
        t.decompose()
    text = soup.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()

def _extract_text_from_part(part) -> str:
    try:
        payload = part.get_payload(decode=True) or b""
        charset = part.get_content_charset() or "utf-8"
        text = payload.decode(charset, errors="replace")
    except Exception:
        text = ""
    if part.get_content_type() == "text/html":
        text = _html_to_text(text)
    return text

def _compact_headers(msg: email.message.Message) -> Tuple[str, Dict[str, str]]:
    keys = ["From", "To", "Reply-To", "Subject", "Return-Path", "Received", "Authentication-Results"]
    hdrs: Dict[str, str] = {}
    for k in keys:
        v = msg.get_all(k)
        if v:
            hdrs[k] = " | ".join(str(x) for x in v)
    compact = " ".join(f"{k}:{v}" for k, v in hdrs.items())
    return compact[:2000], hdrs

def _header_signal_extract(hdrs: Dict[str, str]) -> Dict[str, object]:
    auth = hdrs.get("Authentication-Results", "")
    spf = re.search(r"spf=(pass|fail|softfail|neutral|none)", auth or "", re.I)
    dkim = re.search(r"dkim=(pass|fail|neutral|none)", auth or "", re.I)
    dmarc = re.search(r"dmarc=(pass|fail|bestguesspass|none)", auth or "", re.I)

    received = hdrs.get("Received", "")
    received_count = len(re.findall(r"\bby\b", received, re.I))

    from_val = hdrs.get("From", "") or ""
    reply_to_val = hdrs.get("Reply-To", "") or ""
    reply_to_mismatch = False
    if reply_to_val:
        reply_to_mismatch = reply_to_val.strip().lower() not in from_val.strip().lower()

    m = re.search(r"(?P<name>[^<]+)<(?P<addr>[^>]+)>", from_val)
    if m:
        name = m.group("name").strip().strip('"')
        addr = m.group("addr").strip().lower()
        display_vs_addr_distance = _levenshtein(name.lower(), addr.split("@")[0])
        has_punycode = "xn--" in addr
    else:
        display_vs_addr_distance = 0
        has_punycode = False

    return {
        "spf": spf.group(1).lower() if spf else None,
        "dkim": dkim.group(1).lower() if dkim else None,
        "dmarc": dmarc.group(1).lower() if dmarc else None,
        "received_count": received_count,
        "reply_to_mismatch": reply_to_mismatch,
        "display_vs_addr_distance": display_vs_addr_distance,
        "has_punycode": has_punycode,
    }

def _extract_urls(text: str) -> List[str]:
    urls = URL_REGEX.findall(text or "")
    return urls[:100]

def _attachment_meta(part) -> Optional[Dict]:
    try:
        fname = part.get_filename() or ""
        ctype = part.get_content_type() or "application/octet-stream"
        payload = part.get_payload(decode=True) or b""
        size = len(payload)
        if size == 0:
            return None
        if magic:
            try:
                sniff = magic.from_buffer(payload, mime=True)
            except Exception:
                sniff = None
        else:
            sniff = None
        meta = {
            "filename": fname[:128],
            "declared_mime": ctype,
            "sniffed_mime": sniff,
            "size_bytes": size,
            "suspicious_macro": fname.lower().endswith((".doc", ".docm", ".xlsm", ".xls", ".pptm")),
            "archive_like": fname.lower().endswith((".zip", ".rar", ".7z", ".tar", ".gz")),
        }
        return meta
    except Exception:
        return None

def parse_email_from_bytes(raw_bytes: bytes, max_bytes: int = 10_000_000) -> ParsedEmail:
    if len(raw_bytes) > max_bytes:
        raise ValueError("Email too large")
    msg = BytesParser(policy=policy.default).parsebytes(raw_bytes)

    subject = (msg.get("Subject") or "").strip()
    body_texts: List[str] = []
    attachments: List[Dict] = []

    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = (part.get("Content-Disposition") or "").lower()
            if ctype in ("text/plain", "text/html") and "attachment" not in disp:
                t = _extract_text_from_part(part)
                body_texts.append(t)
            elif "attachment" in disp or (part.get_filename() and ctype != "multipart/alternative"):
                meta = _attachment_meta(part)
                if meta:
                    attachments.append(meta)
    else:
        body_texts.append(_extract_text_from_part(msg))

    body_text = " ".join(body_texts)
    urls = _extract_urls(body_text)

    compact_hdr, hdrs = _compact_headers(msg)
    hdr_sig = _header_signal_extract(hdrs)

    for ch in HOMOGLYPH_SUSPICIOUS:
        if ch in body_text:
            body_text += " HOMOGLYPH_FLAG "

    return ParsedEmail(
        subject=subject[:512],
        body_text=body_text[:20000],
        compact_header_text=compact_hdr,
        urls=urls,
        has_punycode=bool(hdr_sig["has_punycode"]),
        display_vs_addr_distance=int(hdr_sig["display_vs_addr_distance"]),
        spf=hdr_sig["spf"],
        dkim=hdr_sig["dkim"],
        dmarc=hdr_sig["dmarc"],
        received_count=int(hdr_sig["received_count"]),
        reply_to_mismatch=bool(hdr_sig["reply_to_mismatch"]),
        attachments_meta=attachments[:20],
        grammar_error_count=None,
        perplexity_score=None,
    )

