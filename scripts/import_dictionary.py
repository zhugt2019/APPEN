# scripts/import_dictionary.py
import xml.etree.ElementTree as ET
import sqlite3
import os
import sys

# Add the parent directory to the Python path to allow importing from 'backend'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.database import DATABASE_URL

# --- Configuration ---
# The path to the SQLite database file, extracted from the DATABASE_URL.
DB_PATH = DATABASE_URL.replace("sqlite:///", "") 
TABLE_NAME = "dictionary"

def parse_and_insert(xml_file_path):
    """
    Parses the en-sv XML dictionary and inserts sv-en mappings into the SQLite database.
    """
    if not os.path.exists(xml_file_path):
        print(f"Error: XML file not found at '{xml_file_path}'")
        return

    # Connect to the SQLite database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Ensure the table is clean before inserting new data
    print(f"Clearing existing data from '{TABLE_NAME}' table...")
    cursor.execute(f"DELETE FROM {TABLE_NAME};")
    conn.commit()
    
    print(f"Starting to parse '{os.path.basename(xml_file_path)}'...")
    
    # Use iterparse for memory efficiency with large XML files
    context = ET.iterparse(xml_file_path, events=('end',))
    
    entries_to_insert = []
    count = 0

    for event, elem in context:
        # Process each 'word' element once it's fully read
        if elem.tag == 'word':
            english_word = elem.get('value')
            pos = elem.get('class', '')  # part of speech

            if not english_word:
                continue
                
            # Find all direct 'translation' children
            for translation in elem.findall('translation'):
                swedish_word = translation.get('value')
                if swedish_word:
                    # Create the reverse mapping (sv -> en)
                    entry = (swedish_word.strip(), pos, english_word.strip())
                    entries_to_insert.append(entry)
                    count += 1

            # Insert in batches to improve performance
            if len(entries_to_insert) >= 1000:
                cursor.executemany(
                    f"INSERT INTO {TABLE_NAME} (swedish_word, word_class, english_def) VALUES (?, ?, ?)",
                    entries_to_insert
                )
                conn.commit()
                print(f"Inserted {count} entries...")
                entries_to_insert = []

            # Free up memory
            elem.clear()

    # Insert any remaining entries
    if entries_to_insert:
        cursor.executemany(
            f"INSERT INTO {TABLE_NAME} (swedish_word, word_class, english_def) VALUES (?, ?, ?)",
            entries_to_insert
        )
        conn.commit()

    print(f"Parsing complete. Total entries inserted: {count}")
    
    # Create an index for faster lookups
    print("Creating index on 'swedish_word' column for faster searches...")
    cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_swedish_word ON {TABLE_NAME} (swedish_word);")
    conn.commit()
    print("Index created successfully.")

    # Close the database connection
    conn.close()

if __name__ == "__main__":
    # This makes the script runnable from the command line.
    # Example usage: python scripts/import_dictionary.py /path/to/your/en-sv.xml
    
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_dictionary.py <path_to_xml_file>")
        sys.exit(1)
        
    xml_path = sys.argv[1]
    
    # Initialize the database (creates tables if they don't exist)
    from backend.database import init_db
    print("Initializing database...")
    init_db()
    
    parse_and_insert(xml_path)