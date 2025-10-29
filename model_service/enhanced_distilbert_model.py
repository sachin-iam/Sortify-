#!/usr/bin/env python3
"""
Enhanced DistilBERT Model for Email Classification
Multi-input architecture combining:
- Email text (subject + body) processed by DistilBERT
- Sender metadata (domain, name, professor title)
- Category indicators (has_placement, has_nptel, etc.)

Target: 95%+ accuracy
"""

import torch
import torch.nn as nn
from transformers import DistilBertModel, DistilBertConfig
from typing import Dict, Optional

class EnhancedEmailClassifier(nn.Module):
    """
    Enhanced DistilBERT model with multi-input architecture
    """
    
    def __init__(self, 
                 num_labels: int,
                 distilbert_model_name: str = 'distilbert-base-uncased',
                 dropout_rate: float = 0.3,
                 use_sender_features: bool = True,
                 use_category_indicators: bool = True):
        super(EnhancedEmailClassifier, self).__init__()
        
        self.num_labels = num_labels
        self.use_sender_features = use_sender_features
        self.use_category_indicators = use_category_indicators
        
        # Load DistilBERT model
        self.distilbert = DistilBertModel.from_pretrained(distilbert_model_name)
        self.distilbert_hidden_size = self.distilbert.config.hidden_size  # 768
        
        # Freeze early layers to prevent overfitting (optional, can be tuned)
        # for param in self.distilbert.transformer.layer[:3].parameters():
        #     param.requires_grad = False
        
        # Subject attention mechanism (to emphasize subject)
        self.subject_attention = nn.Sequential(
            nn.Linear(self.distilbert_hidden_size, 128),
            nn.Tanh(),
            nn.Linear(128, 1),
            nn.Softmax(dim=1)
        )
        
        # Sender feature embeddings
        if self.use_sender_features:
            self.sender_domain_embedding = nn.Embedding(1000, 64, padding_idx=0)  # Top 1000 domains
            self.sender_name_embedding = nn.Embedding(500, 32, padding_idx=0)  # Top 500 names
            self.professor_title_embedding = nn.Embedding(50, 16, padding_idx=0)  # Professor titles
            
            self.sender_features_size = 64 + 32 + 16  # 112
        else:
            self.sender_features_size = 0
        
        # Category indicators
        if self.use_category_indicators:
            self.category_indicator_size = 7  # 7 binary indicators
        else:
            self.category_indicator_size = 0
        
        # Calculate total feature size
        combined_size = (
            self.distilbert_hidden_size +  # DistilBERT output
            self.sender_features_size +     # Sender features
            self.category_indicator_size    # Category indicators
        )
        
        # Classification head with multiple dense layers
        self.classifier = nn.Sequential(
            nn.Dropout(dropout_rate),
            nn.Linear(combined_size, 512),
            nn.ReLU(),
            nn.BatchNorm1d(512),
            nn.Dropout(dropout_rate),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.BatchNorm1d(256),
            nn.Dropout(dropout_rate * 0.5),  # Less dropout in final layer
            nn.Linear(256, num_labels)
        )
        
        # Initialize weights
        self._init_weights()
    
    def _init_weights(self):
        """Initialize weights for new layers"""
        for module in [self.subject_attention, self.classifier]:
            for layer in module:
                if isinstance(layer, nn.Linear):
                    layer.weight.data.normal_(mean=0.0, std=0.02)
                    if layer.bias is not None:
                        layer.bias.data.zero_()
    
    def forward(self,
                input_ids: torch.Tensor,
                attention_mask: torch.Tensor,
                sender_domain_ids: Optional[torch.Tensor] = None,
                sender_name_ids: Optional[torch.Tensor] = None,
                professor_title_ids: Optional[torch.Tensor] = None,
                category_indicators: Optional[torch.Tensor] = None):
        """
        Forward pass
        
        Args:
            input_ids: Token IDs (batch_size, seq_length)
            attention_mask: Attention mask (batch_size, seq_length)
            sender_domain_ids: Sender domain IDs (batch_size,)
            sender_name_ids: Sender name IDs (batch_size,)
            professor_title_ids: Professor title IDs (batch_size,)
            category_indicators: Binary category indicators (batch_size, 7)
        
        Returns:
            logits: Class logits (batch_size, num_labels)
        """
        # Get DistilBERT outputs
        outputs = self.distilbert(
            input_ids=input_ids,
            attention_mask=attention_mask
        )
        
        # Get sequence output (batch_size, seq_length, hidden_size)
        sequence_output = outputs.last_hidden_state
        
        # Apply attention mechanism
        attention_weights = self.subject_attention(sequence_output)
        attended_output = torch.sum(attention_weights * sequence_output, dim=1)
        
        # Start with attended output
        combined_features = [attended_output]
        
        # Add sender features if available
        if self.use_sender_features and sender_domain_ids is not None:
            sender_domain_emb = self.sender_domain_embedding(sender_domain_ids)
            sender_name_emb = self.sender_name_embedding(sender_name_ids)
            professor_title_emb = self.professor_title_embedding(professor_title_ids)
            
            combined_features.extend([
                sender_domain_emb,
                sender_name_emb,
                professor_title_emb
            ])
        
        # Add category indicators if available
        if self.use_category_indicators and category_indicators is not None:
            combined_features.append(category_indicators.float())
        
        # Concatenate all features
        combined = torch.cat(combined_features, dim=1)
        
        # Pass through classification head
        logits = self.classifier(combined)
        
        return logits

class LabelSmoothingCrossEntropy(nn.Module):
    """
    Label smoothing loss to prevent overconfidence
    Helps improve generalization and achieve higher accuracy
    """
    
    def __init__(self, epsilon: float = 0.1, reduction: str = 'mean'):
        super().__init__()
        self.epsilon = epsilon
        self.reduction = reduction
    
    def forward(self, preds, target):
        n_classes = preds.size(-1)
        log_preds = torch.nn.functional.log_softmax(preds, dim=-1)
        
        # Standard cross entropy loss
        nll_loss = -log_preds.gather(dim=-1, index=target.unsqueeze(1))
        nll_loss = nll_loss.squeeze(1)
        
        # Smooth loss
        smooth_loss = -log_preds.mean(dim=-1)
        
        # Combine
        loss = (1 - self.epsilon) * nll_loss + self.epsilon * smooth_loss
        
        if self.reduction == 'mean':
            return loss.mean()
        elif self.reduction == 'sum':
            return loss.sum()
        else:
            return loss

class FocalLoss(nn.Module):
    """
    Focal Loss to handle class imbalance
    Focuses on hard examples
    """
    
    def __init__(self, alpha: float = 1.0, gamma: float = 2.0, reduction: str = 'mean'):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction
    
    def forward(self, inputs, targets):
        ce_loss = torch.nn.functional.cross_entropy(inputs, targets, reduction='none')
        pt = torch.exp(-ce_loss)
        focal_loss = self.alpha * (1 - pt) ** self.gamma * ce_loss
        
        if self.reduction == 'mean':
            return focal_loss.mean()
        elif self.reduction == 'sum':
            return focal_loss.sum()
        else:
            return focal_loss

def create_enhanced_model(num_labels: int, 
                         model_name: str = 'distilbert-base-uncased',
                         dropout_rate: float = 0.3,
                         use_sender_features: bool = True,
                         use_category_indicators: bool = True) -> EnhancedEmailClassifier:
    """
    Factory function to create enhanced model
    
    Args:
        num_labels: Number of categories to classify
        model_name: Pre-trained DistilBERT model name
        dropout_rate: Dropout rate for regularization
        use_sender_features: Whether to use sender metadata
        use_category_indicators: Whether to use category indicators
    
    Returns:
        EnhancedEmailClassifier model
    """
    model = EnhancedEmailClassifier(
        num_labels=num_labels,
        distilbert_model_name=model_name,
        dropout_rate=dropout_rate,
        use_sender_features=use_sender_features,
        use_category_indicators=use_category_indicators
    )
    
    return model

if __name__ == '__main__':
    # Test model creation
    print("Testing Enhanced DistilBERT Model...")
    
    # Create model for 7 categories (without Other and All)
    model = create_enhanced_model(num_labels=7)
    
    print(f"✅ Model created successfully")
    print(f"   Total parameters: {sum(p.numel() for p in model.parameters()):,}")
    print(f"   Trainable parameters: {sum(p.numel() for p in model.parameters() if p.requires_grad):,}")
    
    # Test forward pass
    batch_size = 4
    seq_length = 128
    
    dummy_input_ids = torch.randint(0, 30000, (batch_size, seq_length))
    dummy_attention_mask = torch.ones(batch_size, seq_length)
    dummy_sender_domain_ids = torch.randint(0, 100, (batch_size,))
    dummy_sender_name_ids = torch.randint(0, 100, (batch_size,))
    dummy_professor_title_ids = torch.randint(0, 10, (batch_size,))
    dummy_category_indicators = torch.randint(0, 2, (batch_size, 7))
    
    with torch.no_grad():
        outputs = model(
            input_ids=dummy_input_ids,
            attention_mask=dummy_attention_mask,
            sender_domain_ids=dummy_sender_domain_ids,
            sender_name_ids=dummy_sender_name_ids,
            professor_title_ids=dummy_professor_title_ids,
            category_indicators=dummy_category_indicators
        )
    
    print(f"✅ Forward pass successful")
    print(f"   Output shape: {outputs.shape}")
    print(f"   Expected: ({batch_size}, {model.num_labels})")
    
    print("\n✅ Model architecture validated!")

