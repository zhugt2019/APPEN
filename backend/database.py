# backend/database.py
import os
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from datetime import datetime
from passlib.context import CryptContext

# --- Configuration ---
DATABASE_URL = "sqlite:///./database.sqlite3"
Base = declarative_base()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Database Models (SQLAlchemy ORM) ---

class User(Base):
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

class WordbookEntry(Base):
    """Represents an entry in a user's personal wordbook."""
    __tablename__ = "wordbook_entries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    word = Column(String, nullable=False)
    definition = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    owner = relationship("User", back_populates="wordbook_entries")

class Dictionary(Base):
    """Represents a Swedish-to-English dictionary entry."""
    __tablename__ = "dictionary"
    id = Column(Integer, primary_key=True, index=True)
    swedish_word = Column(String, nullable=False, index=True)
    word_class = Column(String)
    english_def = Column(String, nullable=False)


# --- Database Engine and Session ---
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """
    Initializes the database by creating all tables.
    This should be called once at application startup.
    """
    try:
        # Create a 'scripts' directory if it doesn't exist
        scripts_dir = os.path.join(os.path.dirname(__file__), '..', 'scripts')
        os.makedirs(scripts_dir, exist_ok=True)
        
        # Create all database tables
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully.")
    except Exception as e:
        print(f"Error creating database tables: {e}")

def get_db():
    """
    Dependency function to get a database session for API endpoints.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()