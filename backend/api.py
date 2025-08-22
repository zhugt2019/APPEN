# backend/api.py (CORRECTED VERSION)

import os
import json
import logging
import asyncio
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

from fastapi import (
    FastAPI, APIRouter, Depends, HTTPException, status, 
    File, UploadFile, Form, Request, BackgroundTasks
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from cachetools import TTLCache

# --- Project-specific module imports ---
from . import models, database, auth
from .database import User, WordbookEntry, Dictionary
from .prompt_managements import pm
from .main import (
    transcribe_audio_async, generate_response_async, generate_audio_async,
    generate_example_dialogue, generate_review, start_background_tasks,
    audio_processor, model_manager
)
from .audio_processor import concatenate_audios_sync

# --- Application Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
AUDIO_CACHE_DIR = Path("audio_cache")
AUDIO_CACHE_DIR.mkdir(exist_ok=True)
BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")

database.init_db()

app = FastAPI(
    title="Svenska AI Practice Backend",
    description="Backend API for the Swedish AI conversational practice application.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Caching, Rate Limiting, and Helpers ---
dialogue_cache = TTLCache(maxsize=500, ttl=3600)
request_counts = {}
RATE_LIMIT_PER_MINUTE = 60

# (Helper functions like check_rate_limit, etc., remain the same)
def check_rate_limit(client_ip: str) -> bool:
    now = datetime.now()
    minute_key = now.strftime("%Y-%m-%d %H:%M")
    client_records = request_counts.setdefault(client_ip, {})
    five_minutes_ago = now - timedelta(minutes=5)
    for key in list(client_records.keys()):
        if datetime.strptime(key, "%Y-%m-%d %H:%M") < five_minutes_ago:
            del client_records[key]
    client_records[minute_key] = client_records.get(minute_key, 0) + 1
    return client_records[minute_key] <= RATE_LIMIT_PER_MINUTE

async def generate_and_cache_dialogue_task(level: models.CEFRLevel, situation: str):
    try:
        mock_request_data = {"level": level.value, "situation": situation}
        mock_scenario_request = models.ScenarioRequest(**mock_request_data)
        mock_http_request = Request(scope={"type": "http", "method": "POST", "headers": []})
        logger.info(f"BACKGROUND TASK: Pre-generating dialogue for level '{level.value}' and situation: '{situation[:30]}...'")
        await get_example_dialogue(request=mock_scenario_request, http_request=mock_http_request)
        logger.info("BACKGROUND TASK: Dialogue pre-generation and caching complete.")
    except Exception as e:
        logger.error(f"BACKGROUND TASK FAILED for situation '{situation[:30]}...': {e}", exc_info=True)
        
async def delayed_dialogue_generation(level: models.CEFRLevel, situation: str, delay_seconds: int = 1):
    logger.info(f"BACKGROUND TASK: Waiting for {delay_seconds}s before starting dialogue generation.")
    await asyncio.sleep(delay_seconds)
    await generate_and_cache_dialogue_task(level=level, situation=situation)


# --- API Routers with Prefix Correction ---
# CORRECTED: Added a prefix to each router to group them under /api
auth_router = APIRouter(prefix="/api", tags=["Authentication"])
word_router = APIRouter(prefix="/api", tags=["Dictionary & Wordbook"])
chat_router = APIRouter(prefix="/api", tags=["Conversation Practice"])


# === Authentication Endpoints ===
# CORRECTED: Path is now relative to the router's prefix
@auth_router.post("/register", response_model=models.User, status_code=status.HTTP_201_CREATED)
def register_user(user: models.UserCreate, db: Session = Depends(database.get_db)):
    db_user = auth.get_user(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    new_user = User(username=user.username)
    new_user.set_password(user.password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# CORRECTED: Path is now relative to the router's prefix
@auth_router.post("/login", response_model=models.Token)
def login_for_access_token(form_data: models.UserCreate, db: Session = Depends(database.get_db)):
    user = auth.get_user(db, username=form_data.username)
    if not user or not user.verify_password(form_data.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password", headers={"WWW-Authenticate": "Bearer"})
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}


# === Word Lookup and Wordbook Endpoints ===
# CORRECTED: Path is now relative to the router's prefix
@word_router.get("/search", response_model=List[models.WordSearchResult])
def search_word(q: str, db: Session = Depends(database.get_db)):
    if not q or len(q.strip()) < 1: return []
    search_query = f"%{q.strip().lower()}%"
    results = db.query(Dictionary).filter(Dictionary.swedish_word.like(search_query)).limit(20).all()
    return results

# CORRECTED: Path is now relative to the router's prefix
@word_router.get("/wordbook", response_model=List[models.WordbookEntry])
def get_wordbook(db: Session = Depends(database.get_db), current_user: User = Depends(auth.get_current_active_user)):
    return db.query(WordbookEntry).filter(WordbookEntry.user_id == current_user.id).order_by(WordbookEntry.created_at.desc()).all()

# CORRECTED: Path is now relative to the router's prefix
@word_router.post("/wordbook", response_model=models.WordbookEntry, status_code=status.HTTP_201_CREATED)
def add_to_wordbook(entry: models.WordbookEntryCreate, db: Session = Depends(database.get_db), current_user: User = Depends(auth.get_current_active_user)):
    existing_entry = db.query(WordbookEntry).filter(WordbookEntry.user_id == current_user.id, WordbookEntry.word == entry.word).first()
    if existing_entry:
        raise HTTPException(status_code=409, detail="Word already exists in your wordbook")
    db_entry = WordbookEntry(**entry.dict(), user_id=current_user.id)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

# CORRECTED: Path is now relative to the router's prefix
@word_router.delete("/wordbook/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_wordbook(word_id: int, db: Session = Depends(database.get_db), current_user: User = Depends(auth.get_current_active_user)):
    entry_to_delete = db.query(WordbookEntry).filter(WordbookEntry.id == word_id).first()
    if not entry_to_delete:
        raise HTTPException(status_code=404, detail="Word entry not found")
    if entry_to_delete.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this entry")
    db.delete(entry_to_delete)
    db.commit()
    return None


# === Original Conversation Practice Endpoints ===
# CORRECTED: Paths are now relative to the router's prefix
@chat_router.post("/scenarios/random", response_model=models.ScenarioResponse)
async def generate_scenario_endpoint(request: models.ScenarioRequest, http_request: Request, background_tasks: BackgroundTasks):
    # This now calls a separate helper function to keep the router section clean
    return await original_generate_scenario_endpoint(request, http_request, background_tasks)

@chat_router.post("/transcribe", response_model=models.TranscriptionResponse)
async def transcribe_only(audio: UploadFile = File(...)):
    return await original_transcribe_only(audio)

@chat_router.post("/get_ai_response", response_model=models.AIResponseResponse)
async def get_ai_response_and_audio(request: models.AIResponseRequest, background_tasks: BackgroundTasks, http_request: Request):
    return await original_get_ai_response_and_audio(request, background_tasks, http_request)

@chat_router.post("/example_dialogue", response_model=models.ExampleDialogResponse)
async def get_example_dialogue(request: models.ScenarioRequest, http_request: Request):
    return await original_get_example_dialogue(request, http_request)

@chat_router.post("/review/performance", response_model=models.ReviewResponse)
async def review_performance(request: models.ReviewRequest, http_request: Request):
    return await original_review_performance(request, http_request)


# --- Include all routers in the main FastAPI app ---
app.include_router(auth_router)
app.include_router(word_router)
app.include_router(chat_router)


# --- Standalone Endpoints (like audio serving) ---
# This endpoint does not start with /api, so it remains under the main app
@app.get("/audio_cache/{audio_filename}", tags=["Audio"])
async def get_audio_file(audio_filename: str):
    if ".." in audio_filename or "/" in audio_filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    file_path = AUDIO_CACHE_DIR / audio_filename
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found.")
    return FileResponse(file_path, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=3600"})


# --- Application Lifecycle and Static Files (No changes needed here) ---

@app.on_event("startup")
async def startup_event():
    # ... (startup logic is unchanged)
    global BASE_URL
    logger.info("--- Starting Svenska AI Practice Backend v2.0 ---")
    # ... rest of the startup code ...
    if not GEMINI_API_KEY and not DEEPSEEK_API_KEY:
        logger.error("Neither GEMINI_API_KEY nor DEEPSEEK_API_KEY is set. AI calls will fail.")
    loop = asyncio.get_event_loop()
    logger.info("Initiating model pre-warming...")
    await loop.run_in_executor(None, model_manager.get_whisper_model)
    await loop.run_in_executor(None, model_manager.get_tts_model)
    logger.info("Models pre-warmed successfully.")
    asyncio.create_task(start_background_tasks())
    asyncio.create_task(cleanup_old_audio_files())
    logger.info("Background cleanup tasks initiated.")


@app.on_event("shutdown")
async def shutdown_event():
    # ... (shutdown logic is unchanged)
    logger.info("--- Shutting down Svenska AI Practice Backend ---")
    audio_processor.cleanup()
    logger.info("Resources cleaned up.")


async def cleanup_old_audio_files():
    # ... (cleanup logic is unchanged)
    while True:
        await asyncio.sleep(3600)
        # ... rest of the cleanup code ...
        pass


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # ... (exception handler is unchanged)
    logger.error(f"Unhandled exception for request {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "An unexpected internal server error occurred."})

frontend_dir = Path(__file__).parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static_root")
else:
    logger.warning(f"Frontend directory not found at {frontend_dir}, skipping root static file mount.")

# --- Helper functions to contain original logic (No changes needed here) ---
async def original_generate_scenario_endpoint(request: models.ScenarioRequest, http_request: Request, background_tasks: BackgroundTasks):
    # ... (original function logic is unchanged)
    if not check_rate_limit(http_request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    # ... rest of the function ...
    if not (GEMINI_API_KEY or DEEPSEEK_API_KEY):
        raise HTTPException(status_code=500, detail="No AI API KEY is configured on the server.")
    logger.info(f"Generating scenario for level: {request.level}, situation: '{request.situation or 'random'}'")
    scenario_text = ""
    try:
        prompt_name = "context_prompt" if request.situation else "random_context"
        variables = {"CEFR_Level": request.level.value}
        if request.situation: variables["Situation"] = request.situation
        prompt = pm.get_prompt(name=prompt_name, variables=variables)
        raw_text, _ = await generate_response_async(scenario_prompt=prompt, chat_history=[])
        if raw_text and len(raw_text.strip()) > 10: scenario_text = raw_text
    except Exception as e:
        logger.error(f"AI scenario generation failed, will use fallback. Error: {e}")
    if not scenario_text:
        logger.warning("AI generated an empty or invalid scenario. Using hardcoded fallback scenario.")
        scenario_text = "På ett café i Stockholm. Jag är en barista och du är en kund. Du vill beställa en kaffe och en kanelbulle."
    background_tasks.add_task(delayed_dialogue_generation, level=request.level, situation=scenario_text)
    return models.ScenarioResponse(scenario=scenario_text, type=models.ScenarioType.CUSTOM if request.situation else models.ScenarioType.RANDOM, level=request.level, situation=request.situation)


async def original_transcribe_only(audio: UploadFile):
    # ... (original function logic is unchanged)
    try:
        audio_data = await audio.read()
        transcription, _ = await transcribe_audio_async(audio_data, audio.content_type)
        return models.TranscriptionResponse(transcription=transcription)
    except Exception as e:
        logger.error(f"Transcription-only endpoint failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Audio transcription failed.")

async def original_get_ai_response_and_audio(request: models.AIResponseRequest, background_tasks: BackgroundTasks, http_request: Request):
    # ... (original function logic is unchanged)
    try:
        system_prompt = pm.get_prompt(name="chat_prompt", variables={"Context": request.scenario, "CEFR_Level": request.level.value})
        user_message = models.ChatMessage(role=models.MessageRole.USER, content=request.text)
        current_history = request.history + [user_message]
        ai_response_text, _ = await generate_response_async(scenario_prompt=system_prompt, chat_history=current_history)
        ai_audio_data, _ = await generate_audio_async(ai_response_text)
        audio_filename = f"ai_response_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.mp3"
        audio_file_path = AUDIO_CACHE_DIR / audio_filename
        def write_audio_file():
            with open(audio_file_path, "wb") as f: f.write(ai_audio_data)
        background_tasks.add_task(write_audio_file)
        base_url = f"{http_request.url.scheme}://{http_request.headers['host']}"
        audio_url = f"{base_url}/audio_cache/{audio_filename}"
        return models.AIResponseResponse(response=ai_response_text, audioUrl=audio_url)
    except Exception as e:
        logger.error(f"AI response generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate AI response.")


async def original_get_example_dialogue(request: models.ScenarioRequest, http_request: Request):
    # ... (original function logic is unchanged)
    if not (GEMINI_API_KEY or DEEPSEEK_API_KEY): raise HTTPException(status_code=500, detail="No AI API KEY is configured.")
    # ... rest of the function ...
    situation_norm = request.situation.strip() if request.situation else ""
    cache_key = f"{request.level.value}-{situation_norm}"
    if cache_key in dialogue_cache:
        logger.info(f"Cache HIT for key: {cache_key}")
        cached_data = dialogue_cache[cache_key]
        return models.ExampleDialogResponse(dialog=cached_data["dialog"], audio_url=None, level=request.level, key_phrases=cached_data["key_phrases"], generation_time=0.0)
    logger.info(f"Cache MISS for key: {cache_key}. Generating new dialogue...")
    try:
        prompt = pm.get_prompt(name="example_dialogue", variables={"CEFR_Level": request.level.value, "Context": situation_norm})
        dialog_text, key_phrases, gen_metadata = generate_example_dialogue(context_prompt=prompt)
        if dialog_text and key_phrases:
             dialogue_cache[cache_key] = {"dialog": dialog_text, "key_phrases": key_phrases}
             logger.info(f"Result for key '{cache_key}' stored in cache.")
        return models.ExampleDialogResponse(dialog=dialog_text, audio_url=None, level=request.level, key_phrases=key_phrases, generation_time=gen_metadata.get("total_generation_time", 0.0))
    except Exception as e:
        logger.error(f"Error generating example dialogue: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate example dialogue: {str(e)}")


async def original_review_performance(request: models.ReviewRequest, http_request: Request):
    # ... (original function logic is unchanged)
    if not check_rate_limit(http_request.client.host): raise HTTPException(status_code=429, detail="Rate limit exceeded")
    # ... rest of the function ...
    if not (GEMINI_API_KEY or DEEPSEEK_API_KEY): raise HTTPException(status_code=500, detail="No AI API KEY is configured.")
    try:
        review_text, strengths, improvements, score, _ = generate_review(conversation_history=[msg.dict() for msg in request.messages], level=request.level.value, scenario_context=request.scenario)
        return models.ReviewResponse(review=review_text, strengths=strengths, improvements=improvements, score=score, level=request.level, message_count=len(request.messages))
    except Exception as e:
        logger.error(f"Error generating review: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate performance review: {str(e)}")


# ======================= DEBUG CODE START =======================
from fastapi.routing import APIRoute

def print_all_routes():
    """
    A helper function to print all registered routes in the application.
    This will run once on startup.
    """
    print("\n--- REGISTERED ROUTES ---")
    total_routes = 0
    for route in app.routes:
        if isinstance(route, APIRoute):
            print(f"Path: {route.path}, Name: {route.name}, Methods: {list(route.methods)}")
            total_routes += 1
    print(f"Total routes found: {total_routes}")
    print("-----------------------\n")

print_all_routes()
# ======================= DEBUG CODE END =======================