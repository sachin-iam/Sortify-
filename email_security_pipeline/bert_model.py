from __future__ import annotations
import torch
from transformers import AutoTokenizer, AutoModel

class DistilBERTEncoder(torch.nn.Module):
    def __init__(self, model_name: str = "distilbert-base-uncased", max_length: int = 512, use_mean_pool: bool = True):
        super().__init__()
        self.tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=True)
        self.encoder = AutoModel.from_pretrained(model_name)
        self.max_length = max_length
        self.use_mean_pool = use_mean_pool

    @torch.inference_mode()
    def encode(self, subject: str, body: str, compact_headers: str = "") -> torch.Tensor:
        text = (subject or "")
        if compact_headers:
            text = f"{text} [SEP] {compact_headers[:300]}"
        text = f"{text} [SEP] {body or ''}"
        enc = self.tokenizer(text, truncation=True, max_length=self.max_length, return_tensors="pt")
        out = self.encoder(**enc)
        if self.use_mean_pool:
            last_hidden = out.last_hidden_state
            attn_mask = enc["attention_mask"].unsqueeze(-1)
            pooled = (last_hidden * attn_mask).sum(dim=1) / attn_mask.sum(dim=1).clamp(min=1)
        else:
            pooled = out.last_hidden_state[:, 0]
        return pooled.squeeze(0)

