# backend/database.py

import os
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from datetime import datetime
from passlib.context import CryptContext

# --- MODIFIED: Configuration for two separate databases ---
# Database for dynamic user data (users, wordbooks)
USER_DATA_DB_URL = "sqlite:///./user_data.sqlite3"
# Database for static dictionary data
DICTIONARY_DB_URL = "sqlite:///./dictionary.sqlite3"

# --- MODIFIED: Create two separate declarative bases ---
UserDataBase = declarative_base()
DictionaryBase = declarative_base()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- User Data Models (associated with UserDataBase) ---

class User(UserDataBase):
    """Represents a user in the 'users' table."""
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)

    wordbook_entries = relationship("WordbookEntry", back_populates="owner", cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = pwd_context.hash(password)

    def verify_password(self, password):
        return pwd_context.verify(password, self.password_hash)

class WordbookEntry(UserDataBase):
    """Represents an entry in a user's personal wordbook."""
    __tablename__ = "wordbook_entries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    word = Column(String, nullable=False)
    definition = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    owner = relationship("User", back_populates="wordbook_entries")

# --- Dictionary Data Models (associated with DictionaryBase) ---

class Idiom(DictionaryBase):
    """Represents an idiom related to a dictionary entry."""
    __tablename__ = "idioms"
    id = Column(Integer, primary_key=True, index=True)
    swedish_idiom = Column(Text, nullable=False)
    english_idiom = Column(Text, nullable=False)
    dictionary_id = Column(Integer, ForeignKey("dictionary.id"), nullable=False)

    word_entry = relationship("Dictionary", back_populates="idioms")

class Dictionary(DictionaryBase):
    """Represents a Swedish-to-English dictionary entry."""
    __tablename__ = "dictionary"
    id = Column(Integer, primary_key=True, index=True)
    swedish_word = Column(String, nullable=False, index=True)
    word_class = Column(String)
    english_def = Column(String, nullable=False)

    # --- ADDED: Columns for lemmatization ---
    swedish_lemma = Column(String, index=True)
    english_lemma = Column(String, index=True)
    # --- END ADDED ---
    
    # --- ADDED START: Columns for definitions and explanations ---
    # Using Text instead of String for potentially longer content
    swedish_definition = Column(Text, nullable=True)
    english_definition = Column(Text, nullable=True)
    swedish_explanation = Column(Text, nullable=True)
    english_explanation = Column(Text, nullable=True)
    # --- ADDED END ---

    # --- ADDED START: New fields for grammar and related words ---
    grammar_notes = Column(Text, nullable=True)
    antonyms = Column(Text, nullable=True) # Storing as a simple comma-separated string for now
    # --- ADDED END ---

    examples = relationship("Example", back_populates="word_entry", cascade="all, delete-orphan")
    idioms = relationship("Idiom", back_populates="word_entry", cascade="all, delete-orphan")


class Example(DictionaryBase):
    """Represents an example sentence for a dictionary entry."""
    __tablename__ = "examples"
    id = Column(Integer, primary_key=True, index=True)
    swedish_sentence = Column(Text, nullable=False)
    english_sentence = Column(Text, nullable=False)
    dictionary_id = Column(Integer, ForeignKey("dictionary.id"), nullable=False)
    
    word_entry = relationship("Dictionary", back_populates="examples")

# --- MODIFIED: Database Engines and Sessions for both databases ---
user_engine = create_engine(USER_DATA_DB_URL, connect_args={"check_same_thread": False})
dictionary_engine = create_engine(DICTIONARY_DB_URL, connect_args={"check_same_thread": False})

UserSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=user_engine)
DictionarySessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=dictionary_engine)

def init_db():
    """Initializes both databases by creating all tables."""
    try:
        print("Creating user data tables...")
        UserDataBase.metadata.create_all(bind=user_engine)
        print("Creating dictionary tables...")
        DictionaryBase.metadata.create_all(bind=dictionary_engine)
        print("Database tables created successfully.")
    except Exception as e:
        print(f"Error creating database tables: {e}")

# --- MODIFIED: Dependency functions to get specific database sessions ---
def get_user_db():
    """Dependency function to get a user database session."""
    db = UserSessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_dictionary_db():
    """Dependency function to get a dictionary database session."""
    db = DictionarySessionLocal()
    try:
        yield db
    finally:
        db.close()