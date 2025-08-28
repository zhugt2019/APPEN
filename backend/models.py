# backend/models.py
"""
This module defines all Pydantic models used for API request validation,
response serialization, and data structures throughout the application.
"""

from pydantic import BaseModel, Field, ConfigDict, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

class CEFRLevel(str, Enum):
    """Defines the Common European Framework of Reference for Languages (CEFR) levels."""
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"

class MessageRole(str, Enum):
    """Defines the role of the sender in a chat message."""
    USER = "user"
    AI = "ai"
    SYSTEM = "system"

class ScenarioType(str, Enum):
    """Defines the type of scenario generated."""
    RANDOM = "random"
    CUSTOM = "custom"

# --- Request Models ---

class ScenarioRequest(BaseModel):
    """Request model for generating a new scenario."""
    level: CEFRLevel = Field(default=CEFRLevel.A2, description="Language proficiency level (CEFR).")
    situation: Optional[str] = Field(None, max_length=2000, description="Optional custom situation description.")
    
    @validator('situation')
    def validate_situation(cls, v):
        if v and len(v.strip()) < 3:
            raise ValueError("Situation description is too short.")
        return v

class ChatMessage(BaseModel):
    """Represents a single message in a chat conversation."""
    role: MessageRole
    content: str = Field(..., min_length=1)
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)
    audio_url: Optional[str] = None
    
    class Config:
        use_enum_values = True

class AIResponseRequest(BaseModel):
    """Request model for the endpoint that gets an AI text and audio response."""
    text: str = Field(..., description="User's transcribed text.")
    history: List[ChatMessage] = Field(default_factory=list)
    scenario: str
    level: CEFRLevel

class ReviewRequest(BaseModel):
    """Request model for generating a performance review."""
    messages: List[ChatMessage] = Field(..., min_items=1, description="The list of messages in the conversation.")
    scenario: str
    level: CEFRLevel = Field(default=CEFRLevel.A2)

# --- Response Models ---

class TranscriptionResponse(BaseModel):
    """Response model for the transcription-only endpoint."""
    transcription: str

class AIResponseResponse(BaseModel):
    """Response model for the AI response and audio endpoint."""
    response: str
    audioUrl: Optional[str] = None

class ScenarioResponse(BaseModel):
    """Response model for a generated scenario."""
    scenario: str = Field(..., description="The generated scenario text.")
    level: CEFRLevel
    type: ScenarioType
    situation: Optional[str] = None
    generated_at: datetime = Field(default_factory=datetime.now)

class ChatResponse(BaseModel):
    """Response model for the main chat processing endpoint."""
    transcription: str = Field(..., description="Transcribed text of the user's speech.")
    response: str = Field(..., description="The AI's text response.")
    audioUrl: Optional[str] = Field(None, description="URL to the AI's generated audio response.")
    level: CEFRLevel
    scenario: str
    processing_time: Optional[Dict[str, float]] = None

class ExampleDialogResponse(BaseModel):
    """Response model for an example dialogue."""
    dialog: str = Field(..., description="The example dialogue text.")
    audio_url: Optional[str] = Field(None, description="URL to the audio for the example dialogue.")
    level: CEFRLevel
    key_phrases: Optional[List[str]] = None
    generation_time: Optional[float] = None

class ReviewResponse(BaseModel):
    """Response model for a performance review."""
    review: str = Field(..., description="The full performance review text.")
    level: CEFRLevel
    message_count: int
    strengths: Optional[List[str]] = None
    improvements: Optional[List[str]] = None
    score: Optional[int] = None

class HealthCheckResponse(BaseModel):
    """Response model for the health check endpoint."""
    status: str = "ok"
    service: str = "Svenska AI Practice Backend"
    version: str = "1.0.0"
    timestamp: datetime = Field(default_factory=datetime.now)

# --- Utility Functions ---

def format_dialog_for_display(messages: Union[List[ChatMessage], List[Dict[str, Any]]]) -> str:
    """
    Formats a list of chat messages into a single string for display or use in prompts.

    Args:
        messages: A list of ChatMessage objects or dictionaries.

    Returns:
        A formatted string representing the conversation.
    """
    formatted_lines = []
    
    for message in messages:
        if isinstance(message, ChatMessage):
            role = message.role
            content = message.content
        elif isinstance(message, dict):
            role = message.get('role', 'user')
            content = message.get('content', '')
        else:
            continue
        
        # Use "Jag" (I) for the user and "Du" (You) for the AI.
        speaker = "Jag" if role == MessageRole.USER else "Du"
        formatted_lines.append(f"{speaker}: {content}")
    
    return '\n'.join(formatted_lines)

# --- User & Authentication Models ---

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

# ADDED: Pydantic model for an example sentence
class Example(BaseModel):
    swedish_sentence: str
    english_sentence: str
    model_config = ConfigDict(from_attributes=True)

# --- Wordbook Models ---

class WordbookEntryBase(BaseModel):
    word: str
    definition: str

class WordbookEntryCreate(WordbookEntryBase):
    pass

class WordbookEntry(WordbookEntryBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

# ADDED: A model for results found inside example sentences
class ExampleSearchResult(BaseModel):
    swedish_sentence: str
    english_sentence: str
    parent_word: str # The word this example belongs to
    model_config = ConfigDict(from_attributes=True)

# --- ADDED START: A Pydantic model for a single Idiom ---
class Idiom(BaseModel):
    swedish_idiom: str
    english_idiom: str
    model_config = ConfigDict(from_attributes=True)
# --- ADDED END ---

class WordSearchResult(BaseModel):
    id: int
    swedish_word: str
    word_class: Optional[str] = None
    english_def: str
    
    # --- ADDED/MODIFIED START: 添加所有缺失的详细信息字段 ---
    swedish_lemma: Optional[str] = None
    english_lemma: Optional[str] = None
    swedish_definition: Optional[str] = None
    english_definition: Optional[str] = None
    swedish_explanation: Optional[str] = None
    english_explanation: Optional[str] = None
    grammar_notes: Optional[str] = None
    antonyms: Optional[str] = None
    # --- ADDED/MODIFIED END ---
    
    # 确保 examples 和 idioms 字段也存在
    examples: List[Example] = []
    idioms: List[Idiom] = []

    model_config = ConfigDict(from_attributes=True)

class PaginatedWordSearchResult(BaseModel):
    total_items: int
    total_pages: int
    current_page: int
    items: List[WordSearchResult]
    # ADDED: A list for results found in examples
    examples_found: List[ExampleSearchResult] = []

# 用于单词报告功能的请求模型
class WordReportRequest(BaseModel):
    swedish_word: str = Field(..., description="The Swedish word to analyze.")
    word_class: str = Field(..., description="The part of speech of the word (e.g., Noun, Verb).")
    target_language: str = Field(..., description="The target language code (e.g., 'zh', 'ko').")

# 用于单词报告功能的响应模型 (结构化数据)
class WordReportResponse(BaseModel):
    definition: str
    part_of_speech: str
    inflections: str
    example_sentences: List[str]
    synonyms: Optional[List[str]] = None
    antonyms: Optional[List[str]] = None