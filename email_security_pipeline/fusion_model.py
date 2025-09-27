from __future__ import annotations
import torch
import torch.nn as nn

class FusionClassifier(nn.Module):
    def __init__(self, bert_hidden: int = 768, feat_dim: int = 24, num_classes: int = 4, dropout: float = 0.2):
        super().__init__()
        self.norm_feats = nn.LayerNorm(feat_dim)
        self.proj_feats = nn.Linear(feat_dim, 128)
        self.proj_text  = nn.Linear(bert_hidden, 512)
        self.backbone = nn.Sequential(
            nn.LayerNorm(640),
            nn.Linear(640, 256), nn.ReLU(inplace=True), nn.Dropout(dropout),
            nn.Linear(256, 64),  nn.ReLU(inplace=True), nn.Dropout(dropout),
        )
        self.classifier = nn.Linear(64, num_classes)

    def forward(self, text_vec: torch.Tensor, feat_vec: torch.Tensor) -> torch.Tensor:
        f = self.norm_feats(feat_vec)
        f = self.proj_feats(f)
        t = self.proj_text(text_vec)
        x = torch.cat([t, f], dim=-1)
        x = self.backbone(x)
        return self.classifier(x)

