from __future__ import annotations
import os, torch
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel

from email_security_pipeline.parsers import parse_email_from_bytes
from email_security_pipeline.features import build_feature_vector, FEATURE_COLUMNS
from email_security_pipeline.bert_model import DistilBERTEncoder
from email_security_pipeline.fusion_model import FusionClassifier

APP = FastAPI(title="EmailGuard Fusion Classifier")

class Resp(BaseModel):
    label: str
    score: float
    top3: list

CKPT_DIR = os.environ.get("CKPT_DIR", "artifacts/latest")
MODEL_NAME = os.environ.get("MODEL_NAME", "distilbert-base-uncased")
_encoder = None; _model = None; _label_names = None

def _load():
    global _encoder, _model, _label_names
    if _model is not None: return
    ckpt = torch.load(os.path.join(CKPT_DIR, "model.pt"), map_location="cpu")
    _label_names = ckpt["label_names"]
    _encoder = DistilBERTEncoder(model_name=MODEL_NAME)
    _model = FusionClassifier(bert_hidden=768, feat_dim=len(FEATURE_COLUMNS), num_classes=len(_label_names))
    _model.load_state_dict(ckpt["state_dict"]); _model.eval()

@APP.post("/classify_email", response_model=Resp)
async def classify_email(file: UploadFile = File(...)):
    _load()
    if hasattr(file, "size") and file.size and file.size > 10_000_000:
        raise HTTPException(status_code=413, detail="Email too large")
    raw = await file.read()
    try:
        p = parse_email_from_bytes(raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse error: {e}")
    tv = _encoder.encode(p.subject, p.body_text, p.compact_header_text).unsqueeze(0)
    import numpy as np
    fv_np, _ = build_feature_vector(p)
    fv = torch.from_numpy(fv_np).float().unsqueeze(0)
    with torch.no_grad():
        logits = _model(tv, fv)
        probs = torch.softmax(logits, dim=-1).squeeze(0)
        topk = torch.topk(probs, k=min(3, probs.numel()))
    top3 = [{"label": _label_names[i], "score": float(s)} for s, i in zip(topk.values.tolist(), topk.indices.tolist())]
    pred_idx = int(torch.argmax(probs))
    return Resp(label=_label_names[pred_idx], score=float(probs[pred_idx]), top3=top3)

