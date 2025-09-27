"""
Enhanced ML Service with Dynamic Category Management and Real-time Synchronization
Supports adding/removing categories without model retraining
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
import asyncio
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from dynamic_classifier import DynamicEmailClassifier
import threading
import time

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Sortify Enhanced ML Service",
    version="3.0.0",
    description="Dynamic email classification with real-time category management"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
classifier = None
websocket_connections = set()
performance_stats = {
    "total_predictions": 0,
    "total_batch_predictions": 0,
    "average_confidence": 0.0,
    "last_prediction_time": None,
    "uptime_start": datetime.now()
}

# Pydantic models
class EmailInput(BaseModel):
    subject: str = Field(..., description="Email subject")
    body: str = Field(..., description="Email body")

class BatchEmailInput(BaseModel):
    emails: List[EmailInput] = Field(..., description="List of emails to classify")

class CategoryInput(BaseModel):
    name: str = Field(..., description="Category name")
    description: str = Field("", description="Category description")
    keywords: List[str] = Field(default_factory=list, description="Category keywords")
    color: str = Field("#6B7280", description="Category color")

class CategoryUpdate(BaseModel):
    description: Optional[str] = Field(None, description="Category description")
    keywords: Optional[List[str]] = Field(None, description="Category keywords")
    color: Optional[str] = Field(None, description="Category color")

class PredictionResponse(BaseModel):
    label: str
    confidence: float
    scores: Dict[str, float]
    category_id: int
    error: Optional[str] = None

class CategoryResponse(BaseModel):
    name: str
    id: int
    description: str
    keywords: List[str]
    color: str
    created_at: str
    updated_at: Optional[str] = None

class PerformanceStats(BaseModel):
    total_predictions: int
    total_batch_predictions: int
    average_confidence: float
    last_prediction_time: Optional[str]
    uptime_seconds: float
    cache_size: int
    categories_count: int

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        if self.active_connections:
            message_str = json.dumps(message)
            disconnected = []
            for connection in self.active_connections:
                try:
                    await connection.send_text(message_str)
                except:
                    disconnected.append(connection)
            
            # Remove disconnected connections
            for conn in disconnected:
                self.disconnect(conn)

manager = ConnectionManager()

# Initialize classifier
@app.on_event("startup")
async def startup_event():
    global classifier
    try:
        logger.info("Initializing enhanced ML classifier...")
        classifier = DynamicEmailClassifier()
        logger.info("✅ Enhanced ML classifier initialized successfully")
        
        # Start performance monitoring
        asyncio.create_task(performance_monitor())
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize classifier: {e}")
        # Don't raise in test environment
        if not os.getenv("TESTING"):
            raise

# Initialize classifier for testing
def initialize_classifier():
    global classifier
    if classifier is None:
        try:
            logger.info("Initializing enhanced ML classifier...")
            classifier = DynamicEmailClassifier()
            logger.info("✅ Enhanced ML classifier initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize classifier: {e}")
            raise

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down enhanced ML service...")

# Performance monitoring task
async def performance_monitor():
    """Monitor performance metrics"""
    while True:
        try:
            if classifier:
                stats = classifier.get_performance_stats()
                performance_stats.update({
                    "cache_size": stats["cache_size"],
                    "categories_count": stats["categories_count"]
                })
            
            # Broadcast performance update
            await manager.broadcast({
                "type": "performance_update",
                "data": performance_stats
            })
            
            await asyncio.sleep(30)  # Update every 30 seconds
            
        except Exception as e:
            logger.error(f"Error in performance monitor: {e}")
            await asyncio.sleep(30)

# Health check endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "OK",
        "timestamp": datetime.now().isoformat(),
        "version": "3.0.0",
        "model_loaded": classifier is not None,
        "categories_count": len(classifier.get_categories()) if classifier else 0
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Sortify Enhanced ML Service is running",
        "version": "3.0.0",
        "status": "operational",
        "features": [
            "Dynamic category management",
            "Real-time synchronization",
            "High-performance batch processing",
            "WebSocket support"
        ]
    }

@app.get("/status")
async def model_status():
    """Get model status"""
    if classifier is None:
        return {"status": "error", "message": "Model not loaded"}
    
    try:
        model_info = classifier.get_model_info()
        return {
            "status": "ready",
            "message": "Enhanced ML service is operational",
            "model_info": model_info
        }
    except Exception as e:
        return {"status": "error", "message": f"Model error: {str(e)}"}

# Classification endpoints
@app.post("/predict", response_model=PredictionResponse)
async def predict_email(email: EmailInput):
    """Predict email category"""
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        result = classifier.predict_single(email.subject, email.body)
        
        # Update performance stats
        performance_stats["total_predictions"] += 1
        performance_stats["last_prediction_time"] = datetime.now().isoformat()
        
        # Update average confidence
        total_preds = performance_stats["total_predictions"]
        current_avg = performance_stats["average_confidence"]
        performance_stats["average_confidence"] = (
            (current_avg * (total_preds - 1) + result["confidence"]) / total_preds
        )
        
        return PredictionResponse(**result)
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.post("/predict/batch", response_model=List[PredictionResponse])
async def predict_batch_emails(batch: BatchEmailInput):
    """Predict categories for multiple emails"""
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Convert to list of dicts
        emails_list = [{"subject": email.subject, "body": email.body} for email in batch.emails]
        results = classifier.predict_batch(emails_list)
        
        # Update performance stats
        performance_stats["total_batch_predictions"] += 1
        performance_stats["last_prediction_time"] = datetime.now().isoformat()
        
        return [PredictionResponse(**result) for result in results]
    except Exception as e:
        logger.error(f"Batch prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")

# Category management endpoints
@app.get("/categories", response_model=List[CategoryResponse])
async def get_categories():
    """Get all categories"""
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        categories = classifier.get_categories()
        response = []
        for name, data in categories.items():
            response.append(CategoryResponse(
                name=name,
                id=data["id"],
                description=data["description"],
                keywords=data["keywords"],
                color=data["color"],
                created_at=data["created_at"],
                updated_at=data.get("updated_at")
            ))
        return response
    except Exception as e:
        logger.error(f"Failed to get categories: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get categories: {str(e)}")

@app.post("/categories", response_model=Dict[str, Any])
async def add_category(category: CategoryInput):
    """Add a new category"""
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        success = classifier.add_category(
            name=category.name,
            description=category.description,
            keywords=category.keywords,
            color=category.color
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="Category already exists")
        
        # Broadcast category update
        await manager.broadcast({
            "type": "category_added",
            "data": {
                "name": category.name,
                "id": classifier.get_categories()[category.name]["id"],
                "description": category.description,
                "keywords": category.keywords,
                "color": category.color
            }
        })
        
        return {
            "status": "success",
            "message": f"Category '{category.name}' added successfully",
            "category": {
                "name": category.name,
                "id": classifier.get_categories()[category.name]["id"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add category: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add category: {str(e)}")

@app.delete("/categories/{category_name}")
async def remove_category(category_name: str):
    """Remove a category"""
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        success = classifier.remove_category(category_name)
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to remove category")
        
        # Broadcast category update
        await manager.broadcast({
            "type": "category_removed",
            "data": {"name": category_name}
        })
        
        return {
            "status": "success",
            "message": f"Category '{category_name}' removed successfully"
        }
    except Exception as e:
        logger.error(f"Failed to remove category: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove category: {str(e)}")

@app.put("/categories/{category_name}")
async def update_category(category_name: str, update: CategoryUpdate):
    """Update category metadata"""
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Get current category
        categories = classifier.get_categories()
        if category_name not in categories:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Update category
        update_data = {}
        if update.description is not None:
            update_data["description"] = update.description
        if update.keywords is not None:
            update_data["keywords"] = update.keywords
        if update.color is not None:
            update_data["color"] = update.color
        
        success = classifier.category_manager.update_category(category_name, **update_data)
        
        if not success:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Broadcast category update
        await manager.broadcast({
            "type": "category_updated",
            "data": {
                "name": category_name,
                "updates": update_data
            }
        })
        
        return {
            "status": "success",
            "message": f"Category '{category_name}' updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update category: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update category: {str(e)}")

# Performance and monitoring endpoints
@app.get("/performance", response_model=PerformanceStats)
async def get_performance_stats():
    """Get performance statistics"""
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        model_stats = classifier.get_performance_stats()
        uptime = (datetime.now() - performance_stats["uptime_start"]).total_seconds()
        
        return PerformanceStats(
            total_predictions=performance_stats["total_predictions"],
            total_batch_predictions=performance_stats["total_batch_predictions"],
            average_confidence=performance_stats["average_confidence"],
            last_prediction_time=performance_stats["last_prediction_time"],
            uptime_seconds=uptime,
            cache_size=model_stats["cache_size"],
            categories_count=model_stats["categories_count"]
        )
    except Exception as e:
        logger.error(f"Failed to get performance stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get performance stats: {str(e)}")

@app.post("/cache/clear")
async def clear_cache():
    """Clear prediction cache"""
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        classifier.clear_cache()
        return {"status": "success", "message": "Cache cleared successfully"}
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")

# WebSocket endpoint for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Legacy endpoints for backward compatibility
@app.post("/categorize")
async def categorize_email(content: dict):
    """Legacy categorize endpoint"""
    if "content" in content:
        email_input = EmailInput(subject="", body=content["content"])
        return await predict_email(email_input)
    else:
        raise HTTPException(status_code=400, detail="Use /predict endpoint with {subject, body}")

@app.get("/labels")
async def get_labels():
    """Get available category labels"""
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        categories = classifier.get_categories()
        labels = list(categories.keys())
        return {"labels": labels, "count": len(labels)}
    except Exception as e:
        logger.error(f"Failed to get labels: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get labels: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("MODEL_SERVICE_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
