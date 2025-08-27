# scripts/import_dictionary.py (FINAL ROBUST MERGE VERSION)
import xml.etree.ElementTree as ET
import os
import sys
import json
from sqlalchemy.orm import Session
import spacy

# Add project root to Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

# Import dictionary-specific database components
from backend.database import (
    dictionary_engine, 
    Dictionary, 
    Example, 
    Idiom,
    DictionaryBase, 
    DictionarySessionLocal
)

# --- ADDED: Part of Speech mapping ---
POS_MAP = {
    'ab': 'Adverb', 'abbrev': 'Abbreviation', 'article': 'Article',
    'interj': 'Interjection', 'jj': 'Adjective', 'kn': 'Conjunction',
    'nn': 'Noun', 'pn': 'Pronoun', 'pp': 'Preposition',
    'prefix': 'Prefix', 'suffix': 'Suffix', 'vb': 'Verb',
    'rg': 'Numeral', 'ro': 'Numeral'
}

# Load spaCy models for lemmatization
try:
    nlp_sv = spacy.load("sv_core_news_sm")
    nlp_en = spacy.load("en_core_web_sm")
    print("spaCy models loaded successfully.")
except OSError:
    print("spaCy models not found. Please run necessary downloads.")
    sys.exit(1)

def get_lemma(text, nlp):
    """
    Helper function to get the lemmas of all words in a phrase.
    FIXED: It now handles compound words correctly by not inserting spaces.
    """
    if not text: return ""
    
    original_text = str(text)
    doc = nlp(original_text.lower())
    lemmas = [token.lemma_ for token in doc]
    
    # If the original text was a single word (no spaces), join lemmas without a space.
    if " " not in original_text.strip():
        return "".join(lemmas)
    # Otherwise (for multi-word phrases), preserve spaces between words.
    else:
        return " ".join(lemmas)


def process_sv_en_pass(temp_db: dict, xml_file_path: str):
    """
    PASS 1: Process the Swedish-to-English dictionary.
    """
    print(f"PASS 1: Parsing Swedish-English XML to create base entries: {xml_file_path}")
    tree = ET.parse(xml_file_path)
    root = tree.getroot()
    
    for word_elem in root.findall('.//word[@lang="sv"]'):
        raw_swedish_word = word_elem.get('value')
        trans_elem = word_elem.find('translation')
        
        if not raw_swedish_word or trans_elem is None or not trans_elem.get('value'):
            continue

        # --- FIXED [Problem 1]: Handle '|' in words ---
        swedish_word = raw_swedish_word.replace('|', '')
        entry_key = swedish_word.lower()

        # --- MODIFIED: Map Part of Speech abbreviation to full name ---
        word_class_abbr = word_elem.get('class')
        word_class_full = POS_MAP.get(word_class_abbr, word_class_abbr)
        
        if entry_key not in temp_db:
            dict_entry = Dictionary(
                swedish_word=swedish_word, 
                english_def=trans_elem.get('value'),
                word_class=word_class_full # Store the full name
            )
            temp_db[entry_key] = dict_entry
        
        # --- FIXED [Problem 2]: Ensure swedish_definition is always saved ---
        def_elem = word_elem.find('definition')
        if def_elem is not None and def_elem.get('value'):
            temp_db[entry_key].swedish_definition = def_elem.get('value')
            if def_elem.find('translation') is not None:
                temp_db[entry_key].english_definition = def_elem.find('translation').get('value')

        expl_elem = word_elem.find('explanation')
        if expl_elem is not None:
            temp_db[entry_key].swedish_explanation = expl_elem.get('value')
            if expl_elem.find('translation') is not None:
                temp_db[entry_key].english_explanation = expl_elem.find('translation').get('value')

        # --- ADDED: Parse new fields (grammar, antonyms) ---
        grammar_notes = [g.get('value') for g in word_elem.findall('grammar') if g.get('value')]
        if grammar_notes:
            temp_db[entry_key].grammar_notes = "\n".join(grammar_notes)
            
        antonyms = [r.get('value') for r in word_elem.findall('.//related[@type="antonym"]') if r.get('value')]
        if antonyms:
            temp_db[entry_key].antonyms = ", ".join(antonyms)
            
        # --- ADDED [Problem 1 enhancement]: Handle <variant> tags for better search ---
        variants = [v.get('value') for v in word_elem.findall('variant') if v.get('value')]
        if variants:
             # Store variants in a temporary attribute to be processed during lemmatization
            if not hasattr(temp_db[entry_key], '_variants'):
                temp_db[entry_key]._variants = []
            temp_db[entry_key]._variants.extend(variants)

        for ex in word_elem.findall('example'):
            if ex.get('value') and ex.find('translation') is not None:
                temp_db[entry_key].examples.append(Example(swedish_sentence=ex.get('value'), english_sentence=ex.find('translation').get('value')))
        
        for idiom in word_elem.findall('idiom'):
            if idiom.get('value') and idiom.find('translation') is not None:
                temp_db[entry_key].idioms.append(Idiom(swedish_idiom=idiom.get('value'), english_idiom=idiom.find('translation').get('value')))

def process_en_sv_pass(temp_db: dict, xml_file_path: str):
    # This function remains largely the same as it supplements data, but we'll ensure it handles new fields
    print(f"PASS 2: Parsing English-Swedish XML to supplement and merge data: {xml_file_path}")
    tree = ET.parse(xml_file_path)
    root = tree.getroot()

    for word_elem in root.findall('.//word[@lang="en"]'):
        english_word = word_elem.get('value')
        if not english_word: continue

        # Gather all supplemental info
        parent_explanation, parent_idioms, parent_examples, parent_grammar = None, [], [], []

        expl_elem = word_elem.find('explanation')
        if expl_elem is not None:
            parent_explanation = (expl_elem.get('value'), word_elem.find('explanation/translation').get('value') if word_elem.find('explanation/translation') else None)

        parent_grammar = [g.get('value') for g in word_elem.findall('grammar') if g.get('value')]

        parent_idioms = [
            Idiom(swedish_idiom=idiom.find('translation').get('value'), english_idiom=idiom.get('value'))
            for idiom in word_elem.findall('idiom') if idiom.get('value') and idiom.find('translation') is not None
        ]
        
        parent_examples = [
            Example(swedish_sentence=ex.find('translation').get('value'), english_sentence=ex.get('value'))
            for ex in word_elem.findall('example') if ex.get('value') and ex.find('translation') is not None
        ]

        for trans_elem in word_elem.findall('translation'):
            swedish_trans = trans_elem.get('value')
            if not swedish_trans: continue
            
            entry_key = swedish_trans.replace('|', '').lower()
            
            if entry_key in temp_db:
                dict_entry = temp_db[entry_key]
                if not dict_entry.swedish_explanation and parent_explanation:
                    dict_entry.swedish_explanation, dict_entry.english_explanation = parent_explanation
                if not dict_entry.grammar_notes and parent_grammar:
                    dict_entry.grammar_notes = "\n".join(parent_grammar)
            else:
                word_class_abbr = word_elem.get('class')
                word_class_full = POS_MAP.get(word_class_abbr, word_class_abbr)
                dict_entry = Dictionary(
                    swedish_word=swedish_trans.replace('|', ''), 
                    english_def=english_word,
                    word_class=word_class_full
                )
                if parent_explanation:
                    dict_entry.swedish_explanation, dict_entry.english_explanation = parent_explanation
                if parent_grammar:
                    dict_entry.grammar_notes = "\n".join(parent_grammar)
                temp_db[entry_key] = dict_entry
            
            # Add idioms and examples, avoiding duplicates
            existing_idioms = {idiom.swedish_idiom for idiom in dict_entry.idioms}
            for idiom in parent_idioms:
                if idiom.swedish_idiom not in existing_idioms:
                    dict_entry.idioms.append(idiom)

            existing_examples = {ex.swedish_sentence for ex in dict_entry.examples}
            for ex in parent_examples:
                if ex.swedish_sentence not in existing_examples:
                    dict_entry.examples.append(ex)

def save_to_database(session: Session, temp_db: dict):
    """Saves the completed entries from the in-memory dict to the actual database."""
    print("Applying lemmatization and saving merged data to the database...")
    
    DictionaryBase.metadata.drop_all(bind=dictionary_engine)
    DictionaryBase.metadata.create_all(bind=dictionary_engine)

    print(f"Calculating lemmas for {len(temp_db)} entries...")
    for entry in temp_db.values():
        # --- MODIFIED [Problem 1 enhancement]: Include variants in lemma for search ---
        all_swedish_forms = [entry.swedish_word]
        if hasattr(entry, '_variants'):
            all_swedish_forms.extend(entry._variants)
        
        swedish_lemmas = " ".join(set([get_lemma(form, nlp_sv) for form in all_swedish_forms]))
        entry.swedish_lemma = swedish_lemmas
        
        if entry.english_def: entry.english_lemma = get_lemma(entry.english_def, nlp_en)

    session.add_all(temp_db.values())
    session.commit()
    print(f"Successfully saved {len(temp_db)} unique and merged entries to the database.")


if __name__ == "__main__":
    sv_en_xml_path = os.path.join(project_root, 'scripts', 'dict', 'folkets_sv_en_public.xml')
    en_sv_xml_path = os.path.join(project_root, 'scripts', 'dict', 'folkets_en_sv_public.xml')

    temp_dictionary_db = {}
    db_session = DictionarySessionLocal()
    
    try:
        process_sv_en_pass(temp_dictionary_db, sv_en_xml_path)
        process_en_sv_pass(temp_dictionary_db, en_sv_xml_path)
        save_to_database(db_session, temp_dictionary_db)
        print("\nDatabase population complete!")
    except Exception as e:
        print(f"\nAn error occurred: {e}")
        db_session.rollback()
    finally:
        db_session.close()