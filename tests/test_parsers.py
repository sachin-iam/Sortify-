import base64
from email_security_pipeline.parsers import parse_email_from_bytes

def test_parse_minimal_plain():
    raw = b"Subject: Hello\r\nFrom: Alice <alice@example.com>\r\n\r\nHi there!"
    p = parse_email_from_bytes(raw)
    assert "Hello" in p.subject
    assert "Hi there!" in p.body_text
    assert p.received_count >= 0
