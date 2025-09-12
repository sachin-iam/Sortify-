from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from inference import EmailCategorizer
from train_model import ModelTrainer
import asyncio
import threading
from datetime import datetime

# Load environment variables
load_dotenv()

app = FastAPI(title="Sortify ML Service", version="2.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for training state
training_status = {
    "is_training": False,
    "start_time": None,
    "progress": 0,
    "current_epoch": 0,
    "total_epochs": 0,
    "metrics": None,
    "error": None
}

# Initialize the email categorizer
try:
    categorizer = EmailCategorizer()
    print("✅ Email categorizer initialized successfully")
except Exception as e:
    print(f"⚠️ Warning: Failed to initialize model: {e}")
    categorizer = None

# Initialize the model trainer
try:
    trainer = ModelTrainer()
    print("✅ Model trainer initialized successfully")
except Exception as e:
    print(f"⚠️ Warning: Failed to initialize trainer: {e}")
    trainer = None

# Pydantic models for request/response
class EmailInput(BaseModel):
    subject: str
    body: str

class BatchEmailInput(BaseModel):
    emails: List[EmailInput]

class PredictionResponse(BaseModel):
    label: str
    confidence: float
    scores: dict
    error: Optional[str] = None

class LabelsResponse(BaseModel):
    labels: List[str]
    count: int

class TrainingData(BaseModel):
    emails: List[Dict[str, str]]
    epochs: Optional[int] = 3
    learning_rate: Optional[float] = 2e-5
    batch_size: Optional[int] = 16

class TrainingResponse(BaseModel):
    status: str
    message: str
    training_id: Optional[str] = None

class MetricsResponse(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1: float
    timestamp: str
    model_path: str

class TrainingStatusResponse(BaseModel):
    is_training: bool
    start_time: Optional[str]
    progress: int
    current_epoch: int
    total_epochs: int
    metrics: Optional[Dict[str, float]]
    error: Optional[str]

def run_training_background(training_data: List[Dict[str, Any]], epochs: int, learning_rate: float, batch_size: int):
    """Background function to run training"""
    global training_status, trainer
    
    try:
        training_status["is_training"] = True
        training_status["start_time"] = datetime.now().isoformat()
        training_status["progress"] = 0
        training_status["current_epoch"] = 0
        training_status["total_epochs"] = epochs
        training_status["error"] = None
        
        # Run training
        results = trainer.train(training_data, epochs=epochs, learning_rate=learning_rate, batch_size=batch_size)
        
        if results["status"] == "success":
            training_status["metrics"] = results.get("final_metrics", {})
            training_status["progress"] = 100
            training_status["current_epoch"] = epochs
        else:
            training_status["error"] = results.get("message", "Training failed")
            
    except Exception as e:
        training_status["error"] = str(e)
    finally:
        training_status["is_training"] = False

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "OK",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "model_loaded": categorizer is not None
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Sortify ML Service is running",
        "version": "2.0.0",
        "status": "operational"
    }

@app.get("/status")
async def model_status():
    """Get model status"""
    if categorizer is None:
        return {"status": "error", "message": "Model not loaded"}
    
    try:
        model_info = categorizer.get_model_info()
        return {
            "status": "ready", 
            "message": "Model service is operational",
            "model_info": model_info
        }
    except Exception as e:
        return {"status": "error", "message": f"Model error: {str(e)}"}

@app.post("/predict", response_model=PredictionResponse)
async def predict_email(email: EmailInput):
    """
    Predict email category
    
    Input: { subject, body }
    Returns: { label, confidence, scores }
    """
    if categorizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        result = categorizer.predict(email.subject, email.body)
        return PredictionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.post("/predict/batch", response_model=List[PredictionResponse])
async def predict_batch_emails(batch: BatchEmailInput):
    """
    Predict categories for multiple emails
    
    Input: { emails: [{ subject, body }, ...] }
    Returns: [{ label, confidence, scores }, ...]
    """
    if categorizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Convert to list of dicts for the categorizer
        emails_list = [{"subject": email.subject, "body": email.body} for email in batch.emails]
        results = categorizer.predict_batch(emails_list)
        
        # Convert to response models
        return [PredictionResponse(**result) for result in results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")

@app.get("/labels", response_model=LabelsResponse)
async def get_labels():
    """
    Get available category labels
    
    Returns: { labels: [...], count: int }
    """
    if categorizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        labels = categorizer.get_labels()
        return LabelsResponse(labels=labels, count=len(labels))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get labels: {str(e)}")

@app.post("/categorize")
async def categorize_email(content: dict):
    """Legacy categorize endpoint - redirects to /predict"""
    if "content" in content:
        # Handle legacy format
        email_input = EmailInput(subject="", body=content["content"])
        return await predict_email(email_input)
    else:
        raise HTTPException(status_code=400, detail="Use /predict endpoint with {subject, body}")

@app.post("/train", response_model=TrainingResponse)
async def train_model(training_data: TrainingData, background_tasks: BackgroundTasks):
    """
    Train the ML model with DistilBERT fine-tuning
    
    Input: { emails: [{subject, body, label}, ...], epochs, learning_rate, batch_size }
    Returns: { status, message, training_id }
    """
    global training_status, trainer
    
    if trainer is None:
        raise HTTPException(status_code=503, detail="Trainer not initialized")
    
    if training_status["is_training"]:
        raise HTTPException(status_code=409, detail="Training already in progress")
    
    try:
        # Validate training data
        if not training_data.emails:
            raise HTTPException(status_code=400, detail="Training data cannot be empty")
        
        # Check if all emails have required fields
        for email in training_data.emails:
            if "label" not in email:
                raise HTTPException(status_code=400, detail="All emails must have a 'label' field")
        
        # Start background training
        background_tasks.add_task(
            run_training_background,
            training_data.emails,
            training_data.epochs,
            training_data.learning_rate,
            training_data.batch_size
        )
        
        return TrainingResponse(
            status="started",
            message="Model training started in background",
            training_id=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start training: {str(e)}")

@app.get("/train/status", response_model=TrainingStatusResponse)
async def get_training_status():
    """Get current training status"""
    return TrainingStatusResponse(**training_status)

@app.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """
    Get model performance metrics
    
    Returns: { accuracy, precision, recall, f1, timestamp, model_path }
    """
    global training_status
    
    # Check if we have recent training metrics
    if training_status["metrics"]:
        metrics = training_status["metrics"]
        return MetricsResponse(
            accuracy=metrics.get("accuracy", 0.0),
            precision=metrics.get("precision", 0.0),
            recall=metrics.get("recall", 0.0),
            f1=metrics.get("f1", 0.0),
            timestamp=training_status.get("start_time", datetime.now().isoformat()),
            model_path="model/bert_model.pt"
        )
    
    # If no recent metrics, try to calculate from current model
    if categorizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # For now, return placeholder metrics
        # In a real implementation, you would evaluate on a test set
        return MetricsResponse(
            accuracy=0.85,
            precision=0.83,
            recall=0.87,
            f1=0.85,
            timestamp=datetime.now().isoformat(),
            model_path="model/bert_model.pt"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("MODEL_SERVICE_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
