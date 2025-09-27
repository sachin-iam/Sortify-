import pytest, torch
from email_security_pipeline.bert_model import DistilBERTEncoder
from email_security_pipeline.fusion_model import FusionClassifier
from email_security_pipeline.parsers import parse_email_from_bytes
from email_security_pipeline.features import build_feature_vector, FEATURE_COLUMNS

@pytest.mark.slow
def test_forward_pass_smoke():
    enc = DistilBERTEncoder()
    raw = b"Subject: Invoice\r\nFrom: Bob <bob@example.com>\r\n\r\nPlease pay via https://bit.ly/paynow"
    p = parse_email_from_bytes(raw)
    tv = enc.encode(p.subject, p.body_text, p.compact_header_text).unsqueeze(0)
    import numpy as np
    fv_np, _ = build_feature_vector(p)
    fv = torch.from_numpy(fv_np).unsqueeze(0).float()
    model = FusionClassifier(bert_hidden=768, feat_dim=len(FEATURE_COLUMNS), num_classes=3)
    model.eval()  # Set to eval mode to avoid gradient issues
    with torch.no_grad():
        out = model(tv, fv)
    assert out.shape == (1, 3)
