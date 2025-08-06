# backend/main.py
"""
Core Business Logic Module
This module contains all functions related to AI model interaction,
data processing, and business workflows. It is decoupled from the
web framework (FastAPI).
"""

import io
import re
import logging
import time
import hashlib
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional, Tuple, List
from pathlib import Path
from pydub import AudioSegment
from pydub.effects import normalize
import json
import tempfile
import os

import requests
import scipy.io.wavfile
import torch
import numpy as np
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline, VitsModel, AutoTokenizer
from openai import OpenAI

# Relative imports from within the project
from .prompt_managements import pm
from .models import ChatMessage, MessageRole, format_dialog_for_display
from .audio_processor import AudioProcessor, concatenate_audios_sync

# Configure logging
logger = logging.getLogger(__name__)

# --- Global Singletons and Processors ---

class ModelManager:
    """
    Singleton class to manage lazy loading and caching of machine learning models.
    """
    _instance = None
    _models = {}
    _executor = ThreadPoolExecutor(max_workers=2)

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, 'initialized'):
            return

        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        self._audio_cache = {}
        self.cache_dir = Path("cache")
        self.cache_dir.mkdir(exist_ok=True)
        self.initialized = True
        logger.info(f"ModelManager initialized on device: {self.device}")

    def get_whisper_model(self):
        """Lazily loads and returns the Whisper ASR model."""
        if 'whisper' not in self._models:
            logger.info("Loading Whisper model (KBLab/kb-whisper-small)...")
            model_id = "KBLab/kb-whisper-small"
            model = AutoModelForSpeechSeq2Seq.from_pretrained(
                model_id, torch_dtype=self.torch_dtype, use_safetensors=True, cache_dir=str(self.cache_dir)
            )
            model.to(self.device)
            processor = AutoProcessor.from_pretrained(model_id, cache_dir=str(self.cache_dir))
            self._models['whisper'] = pipeline(
                "automatic-speech-recognition", model=model, tokenizer=processor.tokenizer,
                feature_extractor=processor.feature_extractor, max_new_tokens=128,
                chunk_length_s=15, batch_size=16, return_timestamps=True,
                torch_dtype=self.torch_dtype, device=self.device,
            )
            logger.info("Whisper model loaded successfully.")
        return self._models['whisper']

    def get_tts_model(self):
        """Lazily loads and returns the TTS model."""
        if 'tts' not in self._models:
            logger.info("Loading TTS model (facebook/mms-tts-swe)...")
            model_id = "facebook/mms-tts-swe"
            model = VitsModel.from_pretrained(model_id, cache_dir=str(self.cache_dir)).to(self.device)
            tokenizer = AutoTokenizer.from_pretrained(model_id, cache_dir=str(self.cache_dir))
            self._models['tts'] = {'model': model, 'tokenizer': tokenizer}
            logger.info("TTS model loaded successfully.")
        return self._models['tts']

    def get_cached_audio(self, text: str) -> Optional[bytes]:
        """Retrieves generated audio from the in-memory cache."""
        text_hash = hashlib.md5(text.encode()).hexdigest()
        return self._audio_cache.get(text_hash)

    def cache_audio(self, text: str, audio_data: bytes):
        """Caches generated audio data in memory."""
        text_hash = hashlib.md5(text.encode()).hexdigest()
        if len(self._audio_cache) >= 200:
            # Evict the oldest item if cache is full
            oldest_key = next(iter(self._audio_cache))
            del self._audio_cache[oldest_key]
        self._audio_cache[text_hash] = audio_data

    async def cleanup_cache(self):
        """Periodically cleans the in-memory audio cache."""
        while True:
            await asyncio.sleep(1800) # Run every 30 minutes
            try:
                if len(self._audio_cache) > 100:
                    # Trim the cache down to 100 items
                    keys_to_remove = list(self._audio_cache.keys())[:-100]
                    for key in keys_to_remove:
                        del self._audio_cache[key]
                    logger.info(f"Cleaned up audio cache. Current size: {len(self._audio_cache)} items.")
            except Exception as e:
                logger.error(f"Error during cache cleanup: {e}")

model_manager = ModelManager()
audio_processor = AudioProcessor()

# --- Core Business Logic Functions ---

def transcribe_audio(audio_data: bytes, input_format: str = 'webm') -> Tuple[str, float]:
    """
    Transcribes audio data to text using the Whisper model.
    
    Args:
        audio_data (bytes): The raw audio data.
        input_format (str): The format of the input audio.
        
    Returns:
        A tuple containing the transcribed text and the processing duration.
    """
    start_time = time.time()
    if not audio_data:
        raise ValueError("Audio data is empty.")
    
    simple_format = input_format.split('/')[1].split(';')[0] if input_format else 'webm'
    
    # Use temporary files for robust processing with pydub and the model
    temp_input_file = tempfile.NamedTemporaryFile(delete=False, suffix=f".{simple_format}")
    temp_input_path = temp_input_file.name
    temp_input_file.write(audio_data)
    temp_input_file.close()

    temp_wav_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    temp_wav_path = temp_wav_file.name
    temp_wav_file.close()

    try:
        audio = AudioSegment.from_file(temp_input_path, format=simple_format)
        audio = audio.set_channels(1).set_frame_rate(16000)
        audio = normalize(audio, headroom=0.1)
        audio.export(temp_wav_path, format="wav")

        whisper_pipeline = model_manager.get_whisper_model()
        result = whisper_pipeline(temp_wav_path, generate_kwargs={"language": "swedish"})
        text = result["text"]

        duration = time.time() - start_time
        logger.info(f"Audio transcribed in {duration:.2f}s. Text: '{text[:50]}...'")
        return text, duration
    except Exception as e:
        logger.error(f"Transcription failed: {e}", exc_info=True)
        raise RuntimeError(f"Audio transcription failed: {e}")
    finally:
        # Ensure temporary files are cleaned up
        if os.path.exists(temp_input_path): os.remove(temp_input_path)
        if os.path.exists(temp_wav_path): os.remove(temp_wav_path)

async def transcribe_audio_async(audio_data: bytes, input_format: str = 'webm') -> Tuple[str, float]:
    """Asynchronously transcribes audio."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(model_manager._executor, transcribe_audio, audio_data, input_format)

def _call_deepseek_primary(
    scenario_prompt: str,
    chat_history: List[ChatMessage],
    generation_config: Optional[Dict[str, Any]] = None
) -> Tuple[str, Dict[str, float]]:
    """
    Calls the DeepSeek API (primary LLM).
    """
    logger.info("Attempting to generate response with primary API (DeepSeek)...")
    timing_log = {}
    total_start_time = time.time()
    
    api_key = os.getenv("DEEPSEEK_API_KEY")
    base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    model_name = os.getenv("DEEPSEEK_MODEL_NAME", "deepseek-chat")

    if not api_key:
        raise ValueError("DEEPSEEK_API_KEY environment variable not set.")

    client = OpenAI(api_key=api_key, base_url=base_url)

    # Convert chat history to the OpenAI/DeepSeek format
    messages = [{"role": "system", "content": scenario_prompt}]
    for msg in chat_history:
        if isinstance(msg, ChatMessage) and msg.content and msg.content.strip():
            # Map internal 'ai' role to 'assistant'
            role = "assistant" if msg.role == MessageRole.AI else "user"
            messages.append({"role": role, "content": msg.content})

    try:
        api_call_start_time = time.time()
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            stream=False,
            temperature=generation_config.get("temperature", 0.8) if generation_config else 0.8,
            max_tokens=generation_config.get("maxOutputTokens", 2048) if generation_config else 2048,
        )
        timing_log["api_call_time"] = time.time() - api_call_start_time
        
        model_response = response.choices[0].message.content
        timing_log["total_response_time"] = time.time() - total_start_time
        
        logger.info(f"Generated AI response successfully with DeepSeek in {timing_log['total_response_time']:.2f}s.")
        return model_response, timing_log

    except Exception as e:
        logger.error(f"DeepSeek API request failed: {e}", exc_info=True)
        raise # Re-raise the exception to be handled by the scheduler

def _call_gemini_fallback(
    scenario_prompt: str,
    chat_history: List[ChatMessage],
    generation_config: Optional[Dict[str, Any]] = None
) -> Tuple[str, Dict[str, float]]:
    """
    Calls the Gemini API (fallback LLM).
    """
    logger.info("Attempting to generate response with fallback API (Gemini)...")
    timing_log = {}
    total_start_time = time.time()

    api_key = os.getenv("GEMINI_API_KEY")
    model_name = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash")

    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set for fallback.")

    headers = {"Content-Type": "application/json"}
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    contents = []
    if scenario_prompt:
        contents.append({"role": "user", "parts": [{"text": scenario_prompt}]})
        contents.append({"role": "model", "parts": [{"text": "Ok, jag förstår. Låt oss börja."}]}) # OK, I understand. Let's begin.
    
    for msg in chat_history:
        if isinstance(msg, ChatMessage) and msg.content and msg.content.strip():
            role = "model" if msg.role == MessageRole.AI else "user"
            contents.append({"role": role, "parts": [{"text": msg.content}]})

    final_generation_config = {
        "temperature": 0.8, "topP": 0.95, "maxOutputTokens": 2048,
    }
    if generation_config:
        final_generation_config.update(generation_config)

    payload = {"contents": contents, "generationConfig": final_generation_config}

    try:
        api_call_start_time = time.time()
        response = requests.post(api_url, headers=headers, json=payload, timeout=60)
        timing_log["api_call_time"] = time.time() - api_call_start_time
        response.raise_for_status()
        response_json = response.json()

        if 'candidates' not in response_json or not response_json['candidates']:
            feedback = response_json.get('promptFeedback', {})
            block_reason = feedback.get('blockReason', 'Unknown reason')
            raise ValueError(f"Response blocked by Gemini API. Reason: {block_reason}")

        model_response = response_json['candidates'][0]['content']['parts'][0]['text']
        timing_log["total_response_time"] = time.time() - total_start_time
        
        logger.info(f"Generated AI response successfully with Gemini (fallback) in {timing_log['total_response_time']:.2f}s.")
        return model_response, timing_log
    except Exception as e:
        logger.error(f"Gemini fallback API request failed: {e}", exc_info=True)
        raise

def generate_response(
    scenario_prompt: str,
    chat_history: List[ChatMessage],
    generation_config: Optional[Dict[str, Any]] = None
) -> Tuple[str, Dict[str, float]]:
    """
    Intelligent dispatcher for generating AI responses.
    It first tries the primary API (DeepSeek) and falls back to the secondary API (Gemini) on failure.
    """
    try:
        # Step 1: Attempt the primary API (DeepSeek)
        return _call_deepseek_primary(scenario_prompt, chat_history, generation_config)
    except Exception as e:
        logger.warning(f"Primary API (DeepSeek) failed: {e}. Falling back to Gemini.")
        
        try:
            # Step 2: Attempt the fallback API (Gemini)
            return _call_gemini_fallback(scenario_prompt, chat_history, generation_config)
        except Exception as fallback_e:
            logger.critical(f"Fallback API (Gemini) also failed: {fallback_e}. No API available to generate response.")
            # Raise the final exception when both APIs fail
            raise RuntimeError(f"Both primary and fallback APIs failed. Last error: {fallback_e}")


async def generate_response_async(
    scenario_prompt: str,
    chat_history: List[ChatMessage],
    generation_config: Optional[Dict[str, Any]] = None
) -> Tuple[str, Dict[str, float]]:
    """Asynchronously executes the AI response generation dispatch."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        model_manager._executor,
        generate_response,
        scenario_prompt,
        chat_history,
        generation_config
    )

def generate_audio(text: str) -> Tuple[bytes, Dict[str, float]]:
    """
    Generates MP3 audio from text using the TTS model.
    Checks for cached audio before generating.
    """
    timing_log = {}
    total_start_time = time.time()
    
    cached_audio = model_manager.get_cached_audio(text)
    if cached_audio:
        timing_log["cache_hit"] = True
        timing_log["total_audio_gen_time"] = time.time() - total_start_time
        return cached_audio, timing_log
        
    try:
        tts_components = model_manager.get_tts_model()
        model, tokenizer = tts_components['model'], tts_components['tokenizer']
        
        text_clean = text.strip() or " " # Ensure input is not empty
        inputs = tokenizer(text_clean, return_tensors="pt").to(model_manager.device)
        
        if 'input_ids' in inputs and inputs['input_ids'].dtype != torch.long:
            inputs['input_ids'] = inputs['input_ids'].long()
            
        with torch.no_grad():
            output = model(**inputs).waveform
            
        waveform = output.squeeze().cpu().numpy()
        waveform_int16 = (waveform * 32767).astype(np.int16)
        
        audio_segment = AudioSegment(
            waveform_int16.tobytes(), frame_rate=model.config.sampling_rate,
            sample_width=waveform_int16.dtype.itemsize, channels=1
        )

        # Normalize boosts the volume to a peak level without distortion.
        normalized_segment = normalize(audio_segment)

        # Optionally, increase the volume by an additional 6 dB.
        # Adjust this value carefully to avoid clipping distortion.
        louder_segment = normalized_segment + 6 

        buffer = io.BytesIO()
        louder_segment.export(buffer, format="mp3", bitrate="128k")
        buffer.seek(0)
        
        audio_data = buffer.read()
        model_manager.cache_audio(text, audio_data)
        
        timing_log["cache_hit"] = False
        timing_log["total_audio_gen_time"] = time.time() - total_start_time
        logger.info(f"Generated MP3 audio in {timing_log['total_audio_gen_time']:.2f}s.")
        
        return audio_data, timing_log
    except Exception as e:
        logger.error(f"Audio generation failed: {e}", exc_info=True)
        raise RuntimeError(f"Audio generation failed: {e}")


async def generate_audio_async(text: str) -> Tuple[bytes, Dict[str, float]]:
    """Asynchronously generates audio."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(model_manager._executor, generate_audio, text)


def generate_example_dialogue(
    context_prompt: str,
) -> Tuple[str, List[str], Dict[str, float]]:
    """
    Generates an example dialogue and extracts key phrases.
    """
    start_time = time.time()
    raw_text, timing_log = generate_response(
        scenario_prompt=context_prompt,
        chat_history=[]
    )
    
    dialog_text = raw_text
    key_phrases = []
    
    # Extract key phrases section from the raw text
    key_phrases_match = re.search(r'\*\*Key Expressions:\*\*(.*)', raw_text, re.DOTALL | re.IGNORECASE)
    if key_phrases_match:
        phrases_section = key_phrases_match.group(1).strip()
        key_phrases = [line.strip().lstrip('- ') for line in phrases_section.split('\n') if line.strip()]
        dialog_text = raw_text[:key_phrases_match.start()].strip()
        
    timing_log["total_generation_time"] = time.time() - start_time
    return dialog_text, key_phrases, timing_log


def _parse_review_text(review_text: str) -> dict:
    """Parses the structured review text from the LLM response."""
    strengths = re.findall(r'-\s*(.*)', review_text.split("Strengths:")[-1].split("Areas for Improvement:")[0])
    improvements = re.findall(r'-\s*(.*)', review_text.split("Areas for Improvement:")[-1].split("Score:")[0])
    score_match = re.search(r'Score:\s*(\d+)\s*/\s*5', review_text)
    score = int(score_match.group(1)) if score_match else 0
    return {"strengths": [s.strip() for s in strengths], "improvements": [i.strip() for i in improvements], "score": score}


def generate_review(
    conversation_history: List[dict],
    level: str,
    scenario_context: str,
) -> Tuple[str, List[str], List[str], int, Dict[str, float]]:
    """
    Generates a performance review for a conversation.
    """
    start_time = time.time()
    formatted_conversation = format_dialog_for_display(conversation_history)
    prompt = pm.get_prompt(
        name="review",
        variables={"context": scenario_context, "conversation": formatted_conversation, "CEFR_Level": level}
    )
    
    raw_review_text, timing_log = generate_response(
        scenario_prompt=prompt,
        chat_history=[]
    )
    
    parsed_data = _parse_review_text(raw_review_text)
    timing_log["generation_time"] = time.time() - start_time
    return (raw_review_text, parsed_data["strengths"], parsed_data["improvements"], parsed_data["score"], timing_log)

async def start_background_tasks():
    """Initializes background tasks for the application."""
    logger.info("Starting background tasks...")
    asyncio.create_task(model_manager.cleanup_cache())
