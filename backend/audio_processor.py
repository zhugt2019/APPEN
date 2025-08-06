# backend/audio_processor.py
"""
This module contains the AudioProcessor class, which handles various
audio processing tasks like format conversion and concatenation.
"""

import io
import os
import logging
import asyncio
from typing import List
from concurrent.futures import ThreadPoolExecutor
import tempfile

from pydub import AudioSegment
from pydub.effects import normalize

logger = logging.getLogger(__name__)

class AudioProcessor:
    """
    A utility class for handling audio processing, optimized for stability.
    """
    def __init__(self):
        # Target sample rate for speech recognition models (typically 16kHz).
        self.target_sample_rate = 16000
        self.executor = ThreadPoolExecutor(max_workers=os.cpu_count() or 2)
        logger.info("AudioProcessor initialized.")

    def convert_to_wav(self, audio_data: bytes, input_format: str = 'webm') -> bytes:
        """
        Converts any supported audio format to a standard WAV format.
        This version improves stability by saving to a temporary file before processing.

        Args:
            audio_data (bytes): The raw audio data.
            input_format (str): The format of the input audio (e.g., 'webm', 'mp3').

        Returns:
            bytes: The audio data in WAV format.
        """
        if not audio_data:
            raise ValueError("Input audio data is empty.")

        # Create a temporary file with the correct extension to save the uploaded audio.
        temp_input_file = tempfile.NamedTemporaryFile(
            delete=False, 
            suffix=f".{input_format or 'webm'}"
        )
        temp_input_path = temp_input_file.name

        try:
            # Write the uploaded audio data to the temporary file.
            temp_input_file.write(audio_data)
            temp_input_file.close()

            # Let pydub read from a stable file path instead of memory.
            audio = AudioSegment.from_file(temp_input_path, format=input_format)

            # Standard processing: mono channel, target sample rate, and normalization.
            audio = audio.set_channels(1)
            audio = audio.set_frame_rate(self.target_sample_rate)
            audio = normalize(audio, headroom=0.1)

            # Export to WAV format in an in-memory buffer.
            output_buffer = io.BytesIO()
            audio.export(output_buffer, format='wav')
            output_buffer.seek(0)
            return output_buffer.read()

        except Exception as e:
            logger.error(f"Failed to convert audio to WAV: {e}", exc_info=True)
            # Include ffmpeg output in the error for easier debugging.
            if "pydub" in str(e) or "ffmpeg" in str(e):
                raise RuntimeError(f"Audio processing failed, likely due to a corrupt input file from the browser. FFmpeg error: {e}")
            raise RuntimeError(f"Audio processing failed: {e}")
        finally:
            # Ensure the temporary input file is cleaned up.
            if os.path.exists(temp_input_path):
                os.remove(temp_input_path)

    async def convert_to_wav_async(self, audio_data: bytes, input_format: str = None) -> bytes:
        """Asynchronous version of convert_to_wav."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor, self.convert_to_wav, audio_data, input_format
        )
    
    def cleanup(self):
        """Shuts down the thread pool executor."""
        if self.executor:
            self.executor.shutdown(wait=True)

def concatenate_audios_sync(segments: List[bytes], gap_ms: int = 600) -> bytes:
    """
    Synchronously concatenates multiple WAV audio segments into a single audio file.

    Args:
        segments (List[bytes]): A list of audio segments in WAV format.
        gap_ms (int): The duration of silence in milliseconds to add between segments.

    Returns:
        bytes: The concatenated audio data in WAV format.
    """
    if not segments:
        raise ValueError("No audio segments provided for concatenation.")

    # Filter out any empty or invalid audio segments. A WAV header is at least 44 bytes.
    valid_segments = [seg for seg in segments if seg and len(seg) > 44]
    if not valid_segments:
        raise ValueError("No valid audio segments found.")

    try:
        silence = AudioSegment.silent(duration=gap_ms)
        
        # Load the first segment.
        combined = AudioSegment.from_wav(io.BytesIO(valid_segments[0]))

        # Append subsequent segments with silence in between.
        for segment_data in valid_segments[1:]:
            try:
                audio_segment = AudioSegment.from_wav(io.BytesIO(segment_data))
                combined += silence + audio_segment
            except Exception as e:
                logger.warning(f"Skipping invalid audio segment during concatenation: {e}")
                continue
        
        # Normalize the final combined audio.
        combined = normalize(combined, headroom=0.1)

        output_buffer = io.BytesIO()
        combined.export(output_buffer, format='wav')
        output_buffer.seek(0)
        
        return output_buffer.read()

    except Exception as e:
        logger.error(f"Failed to concatenate audio: {e}", exc_info=True)
        raise RuntimeError(f"Audio concatenation failed: {e}")
