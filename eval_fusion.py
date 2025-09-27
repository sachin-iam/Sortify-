from __future__ import annotations
import argparse, json, os, torch
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import classification_report, f1_score
from email_security_pipeline.parsers import parse_email_from_bytes
from email_security_pipeline.features import build_feature_vector, FEATURE_COLUMNS
from email_security_pipeline.bert_model import DistilBERTEncoder
from email_security_pipeline.fusion_model import FusionClassifier

class EvalDataset(Dataset):
    def __init__(self, jsonl_path: str, encoder: DistilBERTEncoder, label_map: dict):
        self.rows = [json.loads(l) for l in open(jsonl_path,"r",encoding="utf-8").read().splitlines() if l.strip()]
        self.encoder = encoder; self.label_map = label_map
    def __len__(self): return len(self.rows)
    def __getitem__(self, idx: int):
        r = self.rows[idx]
        raw = open(r["raw_path"], "rb").read()
        p = parse_email_from_bytes(raw)
        tv = self.encoder.encode(p.subject, p.body_text, p.compact_header_text)
        fv, _ = build_feature_vector(p)
        y = self.label_map[r["label"]]
        return tv, torch.from_numpy(fv), torch.tensor(y)

def collate(batch):
    import torch
    tv = torch.stack([b[0] for b in batch], dim=0)
    fv = torch.stack([b[1].float() for b in batch], dim=0)
    y  = torch.stack([b[2] for b in batch], dim=0)
    return tv, fv, y

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", required=True)
    ap.add_argument("--ckpt_dir", required=True)
    ap.add_argument("--model_name", default="distilbert-base-uncased")
    args = ap.parse_args()

    ckpt = torch.load(os.path.join(args.ckpt_dir, "model.pt"), map_location="cpu")
    label_names = ckpt["label_names"]
    label_map = json.load(open(os.path.join(args.ckpt_dir, "label_map.json"), "r", encoding="utf-8"))

    encoder = DistilBERTEncoder(model_name=args.model_name)
    model = FusionClassifier(bert_hidden=768, feat_dim=len(FEATURE_COLUMNS), num_classes=len(label_names))
    model.load_state_dict(ckpt["state_dict"]); device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device).eval()

    ds = EvalDataset(args.test, encoder, label_map)
    dl = DataLoader(ds, batch_size=8, shuffle=False, collate_fn=collate)

    preds, y_true = [], []
    with torch.no_grad():
        for tv, fv, y in dl:
            tv, fv, y = tv.to(device), fv.to(device), y.to(device)
            logits = model(tv, fv)
            pred = logits.argmax(dim=-1)
            preds.extend(pred.cpu().tolist()); y_true.extend(y.cpu().tolist())

    print(classification_report(y_true, preds, target_names=label_names, zero_division=0))
    print("Weighted F1:", f1_score(y_true, preds, average="weighted"))

if __name__ == "__main__": main()

