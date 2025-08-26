# scripts/populate_dictionary.py
import xml.etree.ElementTree as ET
import os
import sys
import spacy
from sqlalchemy.orm import Session

# Add project root to Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

# Import dictionary-specific database components
from backend.database import (
    dictionary_engine, 
    Dictionary, 
    Example, 
    DictionaryBase, 
    DictionarySessionLocal
)

# Load spaCy models
try:
    nlp_sv = spacy.load("sv_core_news_sm")
    nlp_en = spacy.load("en_core_web_sm")
    print("spaCy models loaded successfully.")
except OSError:
    print("spaCy models not found. Please run:")
    print("python -m spacy download sv_core_news_sm")
    print("python -m spacy download en_core_web_sm")
    sys.exit(1)

def get_lemma(text, nlp):
    """Helper function to get the lemmas of all words in a phrase."""
    if not text:
        return ""
    # Process the entire text and join the lemma of each token
    doc = nlp(text.lower())
    return " ".join([token.lemma_ for token in doc])

def parse_sv_en(session: Session, xml_file_path: str):
    print(f"Parsing Swedish-English XML: {xml_file_path}")
    tree = ET.parse(xml_file_path)
    root = tree.getroot()
    
    entries = []
    for word_elem in root.findall('.//word[@lang="sv"]'):
        swedish_word = word_elem.get('value')
        word_class = word_elem.get('class')
        translation_elem = word_elem.find('translation')
        if not swedish_word or translation_elem is None:
            continue
        english_def = translation_elem.get('value')

        dict_entry = Dictionary(
            swedish_word=swedish_word,
            english_def=english_def,
            word_class=word_class,
            swedish_lemma=get_lemma(swedish_word, nlp_sv),
            english_lemma=get_lemma(english_def, nlp_en)
        )
        
        examples = [
            Example(
                swedish_sentence=ex.get('value'),
                english_sentence=ex.find('translation').get('value')
            )
            for ex in word_elem.findall('example') 
            if ex.get('value') and ex.find('translation') is not None
        ]
        dict_entry.examples = examples
        entries.append(dict_entry)
        
    session.add_all(entries)
    session.commit()
    print(f"Added {len(entries)} entries from Swedish-English dictionary.")

def parse_en_sv(session: Session, xml_file_path: str):
    print(f"Parsing English-Swedish XML: {xml_file_path}")
    tree = ET.parse(xml_file_path)
    root = tree.getroot()

    entries = []
    for word_elem in root.findall('.//word[@lang="en"]'):
        english_word = word_elem.get('value')
        word_class = word_elem.get('class')
        english_lemma = get_lemma(english_word, nlp_en)

        for translation_elem in word_elem.findall('translation'):
            swedish_trans = translation_elem.get('value')
            if not english_word or not swedish_trans:
                continue

            dict_entry = Dictionary(
                swedish_word=swedish_trans,
                english_def=english_word,
                word_class=word_class,
                swedish_lemma=get_lemma(swedish_trans, nlp_sv),
                english_lemma=english_lemma
            )
            
            examples = [
                Example(
                    swedish_sentence=ex.find('translation').get('value'),
                    english_sentence=ex.get('value')
                )
                for ex in word_elem.findall('example')
                if ex.get('value') and ex.find('translation') is not None
            ]
            dict_entry.examples = examples
            entries.append(dict_entry)
            
    session.add_all(entries)
    session.commit()
    print(f"Added {len(entries)} entries from English-Swedish dictionary.")

if __name__ == "__main__":
    sv_en_xml_path = os.path.join(project_root, 'scripts', 'dict', 'folkets_sv_en_public.xml')
    en_sv_xml_path = os.path.join(project_root, 'scripts', 'dict', 'folkets_en_sv_public.xml')

    print("Initializing dictionary database...")
    DictionaryBase.metadata.drop_all(bind=dictionary_engine)
    DictionaryBase.metadata.create_all(bind=dictionary_engine)
    
    db_session = DictionarySessionLocal()
    try:
        parse_sv_en(db_session, sv_en_xml_path)
        parse_en_sv(db_session, en_sv_xml_path)
        print("Database population complete from both dictionaries.")
    except Exception as e:
        print(f"An error occurred: {e}")
        db_session.rollback()
    finally:
        db_session.close()