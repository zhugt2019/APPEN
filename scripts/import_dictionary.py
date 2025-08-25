# scripts/import_dictionary.py
import xml.etree.ElementTree as ET
import os
import sys

# Add the project root to the Python path to allow importing backend modules
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

# MODIFIED: Import dictionary-specific database components
from backend.database import (
    dictionary_engine, 
    Dictionary, 
    Example, 
    DictionaryBase, 
    DictionarySessionLocal
)

def populate_database(session, xml_file_path):
    """Parses the XML and populates the database with words and examples."""
    print(f"Parsing XML file: {xml_file_path}")
    
    try:
        tree = ET.parse(xml_file_path)
        root = tree.getroot()
    except ET.ParseError as e:
        print(f"Error parsing XML file: {e}")
        return
        
    word_count = 0
    example_count = 0
    
    # Batch processing setup
    batch_size = 1000
    batch = []

    for word_elem in root.findall('.//word[@lang="en"]'):
        swedish_translation_elem = word_elem.find('translation')
        if swedish_translation_elem is not None:
            swedish_word = swedish_translation_elem.get('value')
            english_word = word_elem.get('value')
            word_class = word_elem.get('class')

            if not all([swedish_word, english_word]):
                continue

            dict_entry = Dictionary(
                swedish_word=swedish_word,
                english_def=english_word,
                word_class=word_class
            )
            
            examples = []
            for example_elem in word_elem.findall('example'):
                english_example = example_elem.get('value')
                swedish_example_elem = example_elem.find('translation')
                
                if swedish_example_elem is not None:
                    swedish_example = swedish_example_elem.get('value')
                    if english_example and swedish_example:
                        example_entry = Example(
                            swedish_sentence=swedish_example,
                            english_sentence=english_example
                        )
                        examples.append(example_entry)
                        example_count += 1
            
            dict_entry.examples = examples
            batch.append(dict_entry)
            word_count += 1

            if len(batch) >= batch_size:
                session.add_all(batch)
                session.commit()
                print(f"Committed batch of {len(batch)} words.")
                batch = []

    if batch:
        session.add_all(batch)
        session.commit()
        print(f"Committed final batch of {len(batch)} words.")

    print(f"Total words processed: {word_count}, Total examples: {example_count}")
    print("Database population complete.")


if __name__ == "__main__":
    xml_path = os.path.join(project_root, 'scripts', 'dict', 'folkets_en_sv_public.xml')
    
    if not os.path.exists(xml_path):
        print(f"Error: XML file not found at {xml_path}")
        sys.exit(1)

    print("Initializing dictionary database...")
    # MODIFIED: Create tables using the dictionary-specific base and engine
    DictionaryBase.metadata.create_all(bind=dictionary_engine)
    
    # MODIFIED: Get a new session from the dictionary-specific session maker
    db_session = DictionarySessionLocal()
    
    try:
        if db_session.query(Dictionary).first():
            print("Dictionary table already contains data. Skipping population.")
        else:
            populate_database(db_session, xml_path)
    finally:
        db_session.close()