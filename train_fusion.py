from __future__ import annotations
import argparse, json, os, random
from datetime import datetime
from typing import List, Tuple
import numpy as np, torch, torch.nn as nn
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import f1_score, classification_report
from torch.utils.data import Dataset, DataLoader

from email_security_pipeline.parsers import parse_email_from_bytes
from email_security_pipeline.features import build_feature_vector, FEATURE_COLUMNS
from email_security_pipeline.bert_model import DistilBERTEncoder
from email_security_pipeline.fusion_model import FusionClassifier

LABEL_MAP = {}

def set_seed(seed=42):
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed); torch.cuda.manual_seed_all(seed)

class EmailSample:
    def __init__(self, raw_bytes: bytes, label: str, group: str = "default"):
        self.raw_bytes = raw_bytes; self.label = label; self.group = group

class EmailDataset(Dataset):
    def __init__(self, items: List[EmailSample], encoder: DistilBERTEncoder):
        self.items = items; self.encoder = encoder
    def __len__(self): return len(self.items)
    def __getitem__(self, idx: int):
        it = self.items[idx]
        p = parse_email_from_bytes(it.raw_bytes)
        text_vec = self.encoder.encode(p.subject, p.body_text, p.compact_header_text)
        feat_vec_np, _ = build_feature_vector(p)
        y = LABEL_MAP[it.label]
        return text_vec, torch.from_numpy(feat_vec_np), torch.tensor(y, dtype=torch.long)

def collate(batch):
    tv = torch.stack([b[0] for b in batch], dim=0)
    fv = torch.stack([b[1].float() for b in batch], dim=0)
    y  = torch.stack([b[2] for b in batch], dim=0)
    return tv, fv, y

def load_jsonl(path: str) -> List[dict]:
    with open(path, "r", encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]

def load_items(jsonl_path: str) -> Tuple[List[EmailSample], List[str], List[str]]:
    rows = load_jsonl(jsonl_path)
    labels = sorted(list({r["label"] for r in rows}))
    for i, lbl in enumerate(labels): LABEL_MAP[lbl] = i
    groups, items = [], []
    for r in rows:
        raw_bytes = open(r["raw_path"], "rb").read()
        grp = r.get("group") or "default"
        items.append(EmailSample(raw_bytes, r["label"], grp)); groups.append(grp)
    return items, labels, groups

def train_epoch(model, loader, optim, device, class_weights=None):
    model.train(); ce = nn.CrossEntropyLoss(weight=class_weights)
    preds, gold, total, correct = [], [], 0, 0
    for tv, fv, y in loader:
        tv, fv, y = tv.to(device), fv.to(device), y.to(device)
        logits = model(tv, fv)
        loss = ce(logits, y)
        optim.zero_grad(); loss.backward(); optim.step()
        with torch.no_grad():
            pred = logits.argmax(-1)
            preds += pred.cpu().tolist(); gold += y.cpu().tolist()
            correct += (pred == y).sum().item(); total += y.size(0)
    return {"f1": f1_score(gold, preds, average="weighted"), "acc": correct / max(1,total)}

@torch.no_grad()
def eval_epoch(model, loader, device):
    model.eval(); preds, gold, total, correct = [], [], 0, 0
    for tv, fv, y in loader:
        tv, fv, y = tv.to(device), fv.to(device), y.to(device)
        logits = model(tv, fv)
        pred = logits.argmax(-1)
        preds += pred.cpu().tolist(); gold += y.cpu().tolist()
        correct += (pred == y).sum().item(); total += y.size(0)
    return {
        "f1": f1_score(gold, preds, average="weighted"),
        "acc": correct / max(1,total),
        "report": classification_report(gold, preds, zero_division=0),
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--batch_size", type=int, default=8)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--max_length", type=int, default=512)
    ap.add_argument("--model_name", default="distilbert-base-uncased")
    ap.add_argument("--output", default="artifacts")
    args = ap.parse_args()

    set_seed(42); device = "cuda" if torch.cuda.is_available() else "cpu"
    items, label_names, groups = load_items(args.data)
    num_classes = len(label_names)

    encoder = DistilBERTEncoder(model_name=args.model_name, max_length=args.max_length)

    labels_for_split = [LABEL_MAP[it.label] for it in items]
    # Use simple train/val split for small datasets
    if len(items) < 10:
        train_size = max(1, len(items) - 1)  # Keep at least 1 for validation
        train_idx = list(range(train_size))
        val_idx = list(range(train_size, len(items)))
    else:
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        indices = list(range(len(items)))
        train_idx, val_idx = next(skf.split(indices, labels_for_split))

    train_items = [items[i] for i in train_idx]
    val_items   = [items[i] for i in val_idx]

    train_dl = DataLoader(EmailDataset(train_items, encoder), batch_size=args.batch_size, shuffle=True,  collate_fn=collate)
    val_dl   = DataLoader(EmailDataset(val_items,   encoder), batch_size=args.batch_size, shuffle=False, collate_fn=collate)

    model = FusionClassifier(bert_hidden=768, feat_dim=len(FEATURE_COLUMNS), num_classes=num_classes).to(device)
    optim = torch.optim.AdamW(model.parameters(), lr=args.lr)

    os.makedirs(args.output, exist_ok=True)
    run_dir = os.path.join(args.output, datetime.now().strftime("%Y%m%d_%H%M%S")); os.makedirs(run_dir, exist_ok=True)
    best_f1 = -1.0

    for epoch in range(1, args.epochs + 1):
        tr = train_epoch(model, train_dl, optim, device)
        ev = eval_epoch(model, val_dl, device)
        print(f"Epoch {epoch} | train_f1={tr['f1']:.4f} acc={tr['acc']:.4f} | val_f1={ev['f1']:.4f} acc={ev['acc']:.4f}")
        with open(os.path.join(run_dir, f"epoch_{epoch}_report.txt"), "w", encoding="utf-8") as f:
            f.write(ev["report"])
        if ev["f1"] > best_f1:
            best_f1 = ev["f1"]
            torch.save({"state_dict": model.state_dict(), "label_names": label_names}, os.path.join(run_dir, "model.pt"))
            import json
            json.dump({k:int(v) for k,v in LABEL_MAP.items()}, open(os.path.join(run_dir,"label_map.json"),"w"), indent=2)
            json.dump({"columns": list(FEATURE_COLUMNS)}, open(os.path.join(run_dir,"features.json"),"w"), indent=2)
    print("Best F1:", best_f1)
if __name__ == "__main__": main()
