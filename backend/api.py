# backend/api.py
"""
Svenska AI Practice - Backend API Entry Point
This file serves as the main entry point for the FastAPI application,
responsible for routing, request handling, and response formatting.
"""

import os
import json
import logging
import asyncio
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# --- Imports for background tasks and caching ---
from cachetools import TTLCache

# --- Project-specific module imports ---
from .prompt_managements import pm
from .models import (
    ScenarioRequest, ScenarioResponse, ChatMessage, ChatResponse,
    ExampleDialogResponse, ReviewRequest, ReviewResponse, HealthCheckResponse,
    CEFRLevel, MessageRole, ScenarioType,
    TranscriptionResponse, AIResponseRequest, AIResponseResponse
)
from .main import (
    transcribe_audio_async,
    generate_response_async,
    generate_audio_async,
    generate_example_dialogue,
    generate_review,
    start_background_tasks,
    audio_processor,
    model_manager
)
from .audio_processor import concatenate_audios_sync

# --- Application Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash").strip('\"')
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_MODEL_NAME = os.getenv("DEEPSEEK_MODEL_NAME", "deepseek-chat")

AUDIO_CACHE_DIR = Path("audio_cache")
AUDIO_CACHE_DIR.mkdir(exist_ok=True)

# --- FastAPI App Instantiation & Middleware ---
app = FastAPI(
    title="Svenska AI Practice Backend",
    description="Backend API for the Swedish AI conversational practice application.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_path = Path(__file__).parent.parent / "frontend"
if frontend_path.exists() and frontend_path.is_dir():
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")
    logger.info(f"Frontend static files mounted from: {frontend_path}")
else:
    logger.warning(f"Frontend directory not found at {frontend_path}, skipping static file mount.")

# --- Cache Instance ---
# A cache to store up to 500 dialogues, with each entry expiring after 1 hour (3600 seconds).
dialogue_cache = TTLCache(maxsize=500, ttl=3600)


# --- Rate Limiting ---
request_counts = {}
RATE_LIMIT_PER_MINUTE = 60

def check_rate_limit(client_ip: str) -> bool:
    """Checks if a client has exceeded the rate limit."""
    now = datetime.now()
    minute_key = now.strftime("%Y-%m-%d %H:%M")
    client_records = request_counts.setdefault(client_ip, {})
    
    # Clean up records older than 5 minutes
    five_minutes_ago = now - timedelta(minutes=5)
    for key in list(client_records.keys()):
        if datetime.strptime(key, "%Y-%m-%d %H:%M") < five_minutes_ago:
            del client_records[key]
            
    client_records[minute_key] = client_records.get(minute_key, 0) + 1
    return client_records[minute_key] <= RATE_LIMIT_PER_MINUTE

# --- API Route Definitions ---

# --- Helper function for background tasks ---
async def generate_and_cache_dialogue_task(level: CEFRLevel, situation: str):
    """
    A background task that generates an example dialogue and stores it in the cache.
    It does not return anything and operates silently.
    """
    try:
        # Mock a request object as the endpoint function expects it.
        mock_request_data = {"level": level.value, "situation": situation}
        mock_scenario_request = ScenarioRequest(**mock_request_data)
        mock_http_request = Request(scope={"type": "http", "method": "POST", "headers": []})
        
        logger.info(f"BACKGROUND TASK: Pre-generating dialogue for level '{level.value}' and situation: '{situation[:30]}...'")
        
        # Directly call the endpoint function, which contains the caching logic.
        await get_example_dialogue(request=mock_scenario_request, http_request=mock_http_request)
        
        logger.info("BACKGROUND TASK: Dialogue pre-generation and caching complete.")
        
    except Exception as e:
        logger.error(f"BACKGROUND TASK FAILED for situation '{situation[:30]}...': {e}", exc_info=True)


@app.post("/api/scenarios/random", response_model=ScenarioResponse, tags=["Scenarios"])
async def generate_scenario_endpoint(
    request: ScenarioRequest, 
    http_request: Request,
    background_tasks: BackgroundTasks
):
    """
    Generates a random conversation scenario based on CEFR level and an optional situation.
    Returns a hardcoded default scenario if the AI generation fails.
    """
    if not check_rate_limit(http_request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the server.")

    logger.info(f"Generating scenario for level: {request.level}, situation: '{request.situation or 'random'}'")
    
    scenario_text = ""
    try:
        prompt_name = "context_prompt" if request.situation else "random_context"
        variables = {"CEFR_Level": request.level.value}
        if request.situation:
            variables["Situation"] = request.situation

        prompt = pm.get_prompt(name=prompt_name, variables=variables)

        # Attempt to generate from the AI
        raw_text, _ = await generate_response_async(
            scenario_prompt=prompt,
            chat_history=[]
        )
        if raw_text and len(raw_text.strip()) > 10:
            scenario_text = raw_text

    except Exception as e:
        # If the AI call fails, log the error but continue to the fallback.
        logger.error(f"AI scenario generation failed, will use fallback. Error: {e}")

    # If AI generation yields an empty result, use the fallback scenario.
    if not scenario_text:
        logger.warning("AI generated an empty or invalid scenario. Using hardcoded fallback scenario.")
        scenario_text = f"På ett café i Stockholm. Jag är en barista och du är en kund. Du vill beställa en kaffe och en kanelbulle. Fråga mig vad jag rekommenderar."
        # Translation: At a café in Stockholm. I am a barista and you are a customer. You want to order a coffee and a cinnamon bun. Ask me for a recommendation.

    # Start a background task to pre-generate a dialogue for this new scenario.
    background_tasks.add_task(
        delayed_dialogue_generation,
        level=request.level,
        situation=scenario_text
    )

    return ScenarioResponse(
        scenario=scenario_text,
        type=ScenarioType.CUSTOM if request.situation else ScenarioType.RANDOM,
        level=request.level,
        situation=request.situation
    )


@app.post("/api/chat/process", response_model=ChatResponse, tags=["Chat"])
async def process_chat(
    background_tasks: BackgroundTasks,
    http_request: Request,
    audio: UploadFile = File(...),
    scenario: str = Form(...),
    level: CEFRLevel = Form(...),
    history: str = Form("[]"),
):
    """
    Handles the core chat flow: receives audio, transcribes it,
    generates an AI response, and generates audio for that response.
    """
    if not check_rate_limit(http_request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the server.")

    try:
        try:
            chat_history_list = json.loads(history)
            parsed_chat_history = [ChatMessage(**msg) for msg in chat_history_list]
        except (json.JSONDecodeError, TypeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid chat history format: {e}")

        audio_data = await audio.read()
        if not audio_data:
            raise HTTPException(status_code=400, detail="Received empty audio file.")
        
        transcription, transcription_time = await transcribe_audio_async(audio_data, audio.content_type)
        if not transcription or not transcription.strip():
            # If transcription is empty, return a canned response prompting the user to try again.
            return JSONResponse(
                status_code=200,
                content={
                    "transcription": "",
                    "response": "Jag hörde inte vad du sa, kan du försöka igen?", # I didn't hear what you said, can you try again?
                    "audioUrl": None,
                    "level": level,
                    "scenario": scenario,
                    "processing_time": {"transcription_time": transcription_time}
                }
            )

        user_message = ChatMessage(role=MessageRole.USER, content=transcription)
        parsed_chat_history.append(user_message)

        system_prompt = pm.get_prompt(
            name="chat_prompt",
            variables={"Context": scenario, "CEFR_Level": level.value}
        )
        
        chat_generation_config = {"stopSequences": ["\nJag:", "Jag:", "(", ")"]}

        ai_response_text, gen_metadata = await generate_response_async(
            scenario_prompt=system_prompt,
            chat_history=parsed_chat_history,
            api_key=GEMINI_API_KEY,
            model_name=GEMINI_MODEL_NAME,
            generation_config=chat_generation_config
        )

        ai_audio_data, audio_timing = await generate_audio_async(ai_response_text)

        audio_filename = f"ai_response_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.mp3"
        audio_file_path = AUDIO_CACHE_DIR / audio_filename
        
        # Write the audio file in the background to avoid blocking the response.
        def write_audio_file():
            with open(audio_file_path, "wb") as f:
                f.write(ai_audio_data)
        
        background_tasks.add_task(write_audio_file)
        
        # Dynamically construct the base URL from the request headers.
        base_url = f"{http_request.url.scheme}://{http_request.headers['host']}"
        audio_url = f"{base_url}/audio_cache/{audio_filename}"

        processing_time = {
            "transcription_time": transcription_time,
            **gen_metadata,
            **audio_timing
        }

        return ChatResponse(
            transcription=transcription,
            response=ai_response_text,
            audioUrl=audio_url,
            level=level,
            scenario=scenario,
            processing_time=processing_time
        )

    except Exception as e:
        logger.error(f"Error processing chat: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


@app.get("/audio_cache/{audio_filename}", tags=["Audio"])
async def get_audio_file(audio_filename: str):
    """Serves a cached audio file."""
    if ".." in audio_filename or "/" in audio_filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    file_path = AUDIO_CACHE_DIR / audio_filename
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found.")
    
    # Return with the correct MP3 MIME type and caching headers.
    return FileResponse(file_path, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=3600"})

@app.post("/api/transcribe", response_model=TranscriptionResponse, tags=["Refactored Chat"])
async def transcribe_only(audio: UploadFile = File(...)):
    """
    Receives an audio file, performs speech-to-text transcription, and returns the result.
    """
    try:
        audio_data = await audio.read()
        transcription, _ = await transcribe_audio_async(audio_data, audio.content_type)
        return TranscriptionResponse(transcription=transcription)
    except Exception as e:
        logger.error(f"Transcription-only endpoint failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Audio transcription failed.")


@app.post("/api/get_ai_response", response_model=AIResponseResponse, tags=["Refactored Chat"])
async def get_ai_response_and_audio(request: AIResponseRequest, background_tasks: BackgroundTasks, http_request: Request):
    """
    Receives text and conversation history, generates an AI response,
    and returns the response text along with its corresponding MP3 audio.
    """
    try:
        # 1. Prepare system prompt
        system_prompt = pm.get_prompt(
            name="chat_prompt",
            variables={"Context": request.scenario, "CEFR_Level": request.level.value}
        )
        
        # 2. Call LLM to generate text response
        user_message = ChatMessage(role=MessageRole.USER, content=request.text)
        current_history = request.history + [user_message]

        ai_response_text, _ = await generate_response_async(
            scenario_prompt=system_prompt,
            chat_history=current_history
        )

        # 3. Generate MP3 audio
        ai_audio_data, _ = await generate_audio_async(ai_response_text)

        # 4. Save audio and return URL
        audio_filename = f"ai_response_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.mp3"
        audio_file_path = AUDIO_CACHE_DIR / audio_filename
        
        def write_audio_file():
            with open(audio_file_path, "wb") as f:
                f.write(ai_audio_data)
        
        background_tasks.add_task(write_audio_file)
        
        base_url = f"{http_request.url.scheme}://{http_request.headers['host']}"
        audio_url = f"{base_url}/audio_cache/{audio_filename}"

        return AIResponseResponse(response=ai_response_text, audioUrl=audio_url)

    except Exception as e:
        logger.error(f"AI response generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate AI response.")


@app.post("/api/example_dialogue", response_model=ExampleDialogResponse, tags=["Scenarios"])
async def get_example_dialogue(request: ScenarioRequest, http_request: Request):
    """
    Generates an example dialogue and key phrases based on a scenario.
    This endpoint is cached to improve performance.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the server.")

    # Only check rate limit for actual client requests, not background tasks.
    if http_request.client and not check_rate_limit(http_request.client.host):
        if "background" not in str(http_request.scope.get("client")):
             raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # 1. Create a unique cache key.
    situation_norm = request.situation.strip() if request.situation else ""
    cache_key = f"{request.level.value}-{situation_norm}"

    # 2. Check the cache first.
    if cache_key in dialogue_cache:
        logger.info(f"Cache HIT for key: {cache_key}")
        cached_data = dialogue_cache[cache_key]
        return ExampleDialogResponse(
            dialog=cached_data["dialog"],
            audio_url=None,
            level=request.level,
            key_phrases=cached_data["key_phrases"],
            generation_time=0.0
        )
    
    logger.info(f"Cache MISS for key: {cache_key}. Generating new dialogue...")

    try:
        prompt = pm.get_prompt(
            name="example_dialogue",
            variables={
                "CEFR_Level": request.level.value,
                "Context": situation_norm
            }
        )
        dialog_text, key_phrases, gen_metadata = generate_example_dialogue(
            context_prompt=prompt
        )
        
        # 3. Store the valid result in the cache.
        if dialog_text and key_phrases:
             dialogue_cache[cache_key] = {"dialog": dialog_text, "key_phrases": key_phrases}
             logger.info(f"Result for key '{cache_key}' stored in cache.")

        return ExampleDialogResponse(
            dialog=dialog_text,
            audio_url=None,
            level=request.level,
            key_phrases=key_phrases,
            generation_time=gen_metadata.get("total_generation_time", 0.0)
        )
    except Exception as e:
        logger.error(f"Error generating example dialogue: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate example dialogue: {str(e)}")


@app.post("/api/generate_dialogue_audio", tags=["Audio"])
async def generate_dialogue_audio_endpoint(
    http_request: Request,
    dialog_text: str = Form(...),
):
    """Generates a single audio file from a multi-line dialogue text."""
    if not check_rate_limit(http_request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    try:
        dialog_lines = [
            line.split(':', 1)[1].strip()
            for line in dialog_text.split('\n')
            if line.strip() and (line.startswith('Jag:') or line.startswith('Du:'))
        ]

        if not dialog_lines:
            raise ValueError("No valid dialogue lines found to generate audio.")

        tasks = [generate_audio_async(line) for line in dialog_lines]
        audio_results = await asyncio.gather(*tasks)
        audio_segments = [result[0] for result in audio_results]

        combined_audio = concatenate_audios_sync(audio_segments, gap_ms=800)

        audio_filename = f"dialogue_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.wav"
        audio_file_path = AUDIO_CACHE_DIR / audio_filename
        with open(audio_file_path, "wb") as f:
            f.write(combined_audio)
        
        base_url = f"{http_request.url.scheme}://{http_request.headers['host']}"
        audio_url = f"{base_url}/audio_cache/{audio_filename}"

        return JSONResponse(content={"audio_url": audio_url})

    except Exception as e:
        logger.error(f"Error generating dialogue audio: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate dialogue audio: {str(e)}")


@app.post("/api/review/performance", response_model=ReviewResponse, tags=["Review"])
async def review_performance(request: ReviewRequest, http_request: Request):
    """Generates a performance review based on the conversation history."""
    if not check_rate_limit(http_request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the server.")

    try:
        review_text, strengths, improvements, score, _ = generate_review(
            conversation_history=[msg.dict() for msg in request.messages],
            level=request.level.value,
            scenario_context=request.scenario
        )

        return ReviewResponse(
            review=review_text,
            strengths=strengths,
            improvements=improvements,
            score=score,
            level=request.level,
            message_count=len(request.messages)
        )
    except Exception as e:
        logger.error(f"Error generating review: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate performance review: {str(e)}")

# --- Application Lifecycle Events ---
@app.on_event("startup")
async def startup_event():
    """Handles application startup procedures."""
    global BACKEND_BASE_URL
    logger.info("--- Starting Svenska AI Practice Backend ---")

    # 1. Attempt to get a public URL from ngrok if available.
    try:
        response = requests.get("http://localhost:4040/api/tunnels")
        tunnels_data = response.json()
        for tunnel in tunnels_data.get("tunnels", []):
            if tunnel.get("proto") == "https":
                public_url = tunnel.get("public_url")
                BACKEND_BASE_URL = public_url
                logger.info(f"Ngrok public URL detected: {BACKEND_BASE_URL}")
                break
    except requests.exceptions.ConnectionError:
        logger.warning("Could not connect to ngrok API. Using default BACKEND_BASE_URL.")
    except Exception as e:
        logger.error(f"An error occurred while fetching ngrok URL: {e}")

    # 2. Check for required API keys.
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY environment variable is not set. API calls will fail.")

    # 3. Pre-warm models to reduce initial request latency.
    loop = asyncio.get_event_loop()
    logger.info("Initiating model pre-warming. This may take a moment...")
    await loop.run_in_executor(None, model_manager.get_whisper_model)
    await loop.run_in_executor(None, model_manager.get_tts_model)
    logger.info("Models pre-warmed successfully.")

    # 4. Start background tasks for cleanup.
    asyncio.create_task(start_background_tasks())
    asyncio.create_task(cleanup_old_audio_files())
    logger.info("Background tasks initiated.")


@app.on_event("shutdown")
async def shutdown_event():
    """Handles application shutdown procedures."""
    logger.info("--- Shutting down Svenska AI Practice Backend ---")
    audio_processor.cleanup()
    logger.info("Resources cleaned up.")

async def cleanup_old_audio_files():
    """Periodically cleans up old audio files from the cache directory."""
    while True:
        await asyncio.sleep(3600) # Run every hour
        try:
            cleaned_count = 0
            two_hours_ago = datetime.now().timestamp() - 7200
            for file_path in AUDIO_CACHE_DIR.glob("*.wav"):
                if file_path.stat().st_mtime < two_hours_ago:
                    file_path.unlink()
                    cleaned_count += 1
            if cleaned_count > 0:
                logger.info(f"Cleaned up {cleaned_count} old audio cache files.")
        except Exception as e:
            logger.error(f"Error during audio file cleanup: {e}", exc_info=True)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler to catch unhandled errors."""
    logger.error(f"Unhandled exception for request {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected internal server error occurred."}
    )

async def delayed_dialogue_generation(level: CEFRLevel, situation: str, delay_seconds: int = 1):
    """
    Wrapper for the dialogue generation task that adds a delay.
    This helps prevent hitting API rate limits during rapid scenario generation.
    """
    logger.info(f"BACKGROUND TASK: Waiting for {delay_seconds}s before starting dialogue generation to avoid rate limits.")
    await asyncio.sleep(delay_seconds)
    await generate_and_cache_dialogue_task(level=level, situation=situation)

# --- Static File Mounting ---
# Find the path to the 'frontend' directory relative to this file.
frontend_dir = Path(__file__).parent.parent / "frontend"

# Mount the audio cache directory to be accessible via the /audio_cache URL path.
app.mount("/audio_cache", StaticFiles(directory=AUDIO_CACHE_DIR), name="audio_cache")

# Mount the frontend directory to the root path ("/"), serving index.html by default.
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")

