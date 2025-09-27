import numpy as np
from email_security_pipeline.parsers import ParsedEmail
from email_security_pipeline.features import build_feature_vector

def test_feature_vector_shape():
    p = ParsedEmail(
        subject="s", body_text="b", compact_header_text="h",
        urls=["http://example.com","https://bit.ly/x"],
        has_punycode=False, display_vs_addr_distance=1,
        spf="pass", dkim="none", dmarc="none", received_count=2,
        reply_to_mismatch=False,
        attachments_meta=[{"archive_like": False, "suspicious_macro": True, "size_bytes": 2048}],
        grammar_error_count=3, perplexity_score=15.5
    )
    vec, cols = build_feature_vector(p)
    assert vec.shape[0] == len(cols)
    assert vec.dtype == np.float32

