# CampusClassifier/EmailGuard Repository Map

## Project Overview
Multi-signal email classifier that fuses DistilBERT text vectors with structured security features for enhanced email categorization and security analysis.

## Current Repository Structure

### Existing Components (Sortify Project)
- **Frontend**: React/Vite client in `client/` directory
- **Backend**: Node.js/Express server in `server/` directory  
- **ML Service**: Basic DistilBERT classifier in `model_service/` directory
- **Next.js App**: Additional frontend in `sortify-app/` directory

### Existing ML Service (`model_service/`)
- `app.py` - FastAPI server with basic email categorization endpoints
- `inference.py` - EmailCategorizer class using DistilBERT for text-only classification
- `train_model.py` - ModelTrainer class for fine-tuning DistilBERT
- `requirements.txt` - Basic ML dependencies (transformers, torch, scikit-learn)
- `categories.json` - Label definitions
- `tests/` - Test suite for existing functionality

**Current Categories**: Academic, Promotions, Placement, Spam, Other

## New Multi-Signal Pipeline (To Be Added)

### Core Pipeline (`email_security_pipeline/`)
- `parsers.py` - Email parsing with security feature extraction
- `features.py` - Structured feature vector construction  
- `bert_model.py` - DistilBERT text encoder
- `fusion_model.py` - Multi-signal fusion classifier

### Training & Evaluation
- `train_fusion.py` - Training script with cross-validation
- `eval_fusion.py` - Model evaluation and metrics
- `app/main.py` - FastAPI inference server

### Testing
- `tests/test_parsers.py` - Email parsing tests
- `tests/test_features.py` - Feature extraction tests  
- `tests/test_integration_infer.py` - End-to-end inference tests

### Configuration
- `configs/config.yaml` - Training and model configuration
- `requirements.txt` - Updated dependencies including security parsing

## Data Flow

### Current Flow
1. Email input (subject, body) → DistilBERT tokenization
2. Text encoding → Classification head → Category prediction

### New Multi-Signal Flow  
1. Raw email bytes → `parsers.py` → ParsedEmail object
2. ParsedEmail → `features.py` → Structured feature vector (24 features)
3. Text content → `bert_model.py` → DistilBERT embeddings (768-dim)
4. Features + Embeddings → `fusion_model.py` → Final classification

## Security Features Extracted
- **Authentication**: SPF, DKIM, DMARC status
- **Headers**: Received count, reply-to mismatch, display vs address distance
- **URLs**: Count, shortener detection, punycode detection
- **Attachments**: Count, type analysis, size analysis
- **Content**: Grammar errors, perplexity scores (extensible)

## Files to be Modified/Replaced

### New Files (Create)
- `email_security_pipeline/` (entire directory)
- `train_fusion.py`
- `eval_fusion.py` 
- `app/main.py`
- `tests/test_*.py` (new test files)
- `configs/config.yaml`
- `requirements.txt` (updated)

### Existing Files (Keep)
- `model_service/app.py` (legacy API - keep for backward compatibility)
- `model_service/inference.py` (legacy classifier - keep for fallback)
- `model_service/train_model.py` (legacy trainer - keep for reference)

### Integration Points
- New FastAPI server will run on different port (8001) initially
- Shadow mode testing before replacing legacy system
- Gradual migration with A/B testing capability

## Training Data Format
```jsonl
{"raw_path": "/path/to/email.eml", "label": "spam", "group": "domain.com"}
```

## Model Artifacts
- `artifacts/YYYYMMDD_HHMMSS/model.pt` - Trained model weights
- `artifacts/YYYYMMDD_HHMMSS/label_map.json` - Label to index mapping
- `artifacts/YYYYMMDD_HHMMSS/features.json` - Feature column definitions
- `artifacts/YYYYMMDD_HHMMSS/epoch_*_report.txt` - Training reports

## Performance Targets
- **Minimum**: Weighted F1 ≥ 0.90
- **Stretch**: Weighted F1 ≥ 0.95
- **Gate**: Must pass on representative holdout set
- **Shadow**: Must not degrade >1% on critical classes

## Dependencies Added
- `bs4` - HTML parsing for email content
- `python-magic` - File type detection for attachments
- `pydantic` - Data validation (already present)
- Enhanced `transformers`, `torch`, `scikit-learn` versions

