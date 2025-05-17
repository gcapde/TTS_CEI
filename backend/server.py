from fastapi import FastAPI, APIRouter, HTTPException, Form, UploadFile, File, Body
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import openai
import io
import zipfile
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# OpenAI API key
openai.api_key = os.environ.get('OPENAI_API_KEY')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class TextToSpeechRequest(BaseModel):
    text: str
    voice: str = "alloy"
    speed: float = 1.0
    model: str = "tts-1"
    
class BatchTextToSpeechRequest(BaseModel):
    texts: List[dict]

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

@api_router.post("/tts/single")
async def text_to_speech(request: TextToSpeechRequest):
    try:
        response = openai.audio.speech.create(
            model=request.model,
            voice=request.voice,
            input=request.text,
            speed=request.speed
        )
        
        # Get the audio content as bytes
        audio_data = response.content
        
        # Return the audio as a streaming response
        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"attachment; filename=speech.mp3"}
        )
    except Exception as e:
        logging.error(f"Error generating speech: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/tts/batch")
async def batch_text_to_speech(request: BatchTextToSpeechRequest):
    try:
        # Create a ZIP file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for i, item in enumerate(request.texts):
                text = item.get("text", "")
                voice = item.get("voice", "alloy")
                filename = item.get("filename", f"speech_{i+1}")
                
                # Ensure filename has .mp3 extension
                if not filename.endswith('.mp3'):
                    filename += '.mp3'
                
                # Generate speech for each text
                response = openai.audio.speech.create(
                    model="tts-1",
                    voice=voice,
                    input=text
                )
                
                # Add the audio file to the ZIP
                zip_file.writestr(filename, response.content)
        
        # Reset buffer position
        zip_buffer.seek(0)
        
        # Return the ZIP file as a streaming response
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=speech_files.zip"}
        )
    except Exception as e:
        logging.error(f"Error generating batch speech: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/voices")
async def get_available_voices():
    # OpenAI's available voices for TTS-1 model
    voices = [
        {"id": "alloy", "name": "Alloy", "description": "Versatile, balanced voice"},
        {"id": "echo", "name": "Echo", "description": "Warm, conversational voice"},
        {"id": "fable", "name": "Fable", "description": "Narrative, storytelling voice"},
        {"id": "onyx", "name": "Onyx", "description": "Deep, authoritative voice"},
        {"id": "nova", "name": "Nova", "description": "Clear, friendly voice"},
        {"id": "shimmer", "name": "Shimmer", "description": "Gentle, optimistic voice"}
    ]
    return voices

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
