import sqlite3
import re

from backend.agent.utils import read_ml100k_ratings
from backend.movielens.utils import convert_age_to_string
from constants import DATABASE_NAME


def create_ml100k_db():
    """
    This function creates the database and tables needed for MovieLens-100k dataset. The metadata
    table contains item metadata (title, release date, and genres). The name of the table is 'items'.
    The interaction table contains user historical interactions (list of item IDs for each user
    of the dataset). The name of the table is 'interactions'. These tables are both used in the app.
    """
    conn = sqlite3.connect(f'./backend/db/{DATABASE_NAME}.db')
    cursor = conn.cursor()

    cursor.execute('''CREATE TABLE IF NOT EXISTS items (
                    item_id INTEGER PRIMARY KEY,
                    title TEXT,
                    genres TEXT,
                    director TEXT,
                    producer TEXT,
                    actors TEXT,
                    release_date INTEGER,
                    release_month INTEGER,
                    country TEXT,
                    duration INTEGER,
                    age_rating TEXT,
                    imdb_rating FLOAT,
                    imdb_num_reviews INTEGER,
                    n_ratings INTEGER,
                    n_ratings_kid INTEGER,
                    n_ratings_teenager INTEGER,
                    n_ratings_young_adult INTEGER,
                    n_ratings_adult INTEGER,
                    n_ratings_senior INTEGER,
                    n_ratings_male INTEGER,
                    n_ratings_female INTEGER,
                    description TEXT,
                    storyline TEXT,
                    poster_url TEXT,
                    movie_url TEXT)''')

    # load data
    with open('./backend/movielens/data/final_ml-100k.csv', 'r', encoding='utf-8') as f:
        first_line = True
        for line in f:
            if first_line:
                first_line = False
                continue
            parts = line.strip().split('\t')
            if len(parts) < 16:
                continue  # skip lines with missing data

            item_id = int(parts[0])
            movie_title = parts[1] if parts[1] != 'unknown' else None
            genres = parts[2] if parts[2] != 'unknown' else None
            director = parts[3] if parts[3] != 'unknown' else None
            producer = parts[4] if parts[4] != 'unknown' else None
            actors = parts[5] if parts[5] != 'unknown' else None
            release_date = int(parts[6]) if parts[6] != 'unknown' and parts[6].isdigit() else None
            release_month = int(parts[7]) if parts[7] != 'unknown' else None
            country = parts[8] if parts[8] != 'unknown' else None
            duration = convert_duration(parts[9]) if parts[9] != 'unknown' else None
            age_rating = parts[10] if parts[10] != 'unknown' else None
            imdb_rating = float(parts[11]) if parts[11] != 'unknown' else None
            imdb_num_reviews = convert_num_reviews(parts[12]) if parts[12] != 'unknown' else None
            n_ratings = int(parts[13])
            description = parts[14] if parts[14] != 'unknown' else None
            n_ratings_kid = int(parts[15])
            n_ratings_teenager = int(parts[16])
            n_ratings_young_adult = int(parts[17])
            n_ratings_adult = int(parts[18])
            n_ratings_senior = int(parts[19])
            n_ratings_male = int(parts[20])
            n_ratings_female = int(parts[21])
            storyline = parts[22] if parts[22] != 'unknown' else None
            poster_url = parts[23] if parts[23] != 'unknown' else None
            movie_url = parts[24] if parts[24] != 'unknown' else None

            # Insert into the table
            cursor.execute('INSERT OR IGNORE INTO items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                           (item_id, movie_title, genres, director, producer, actors,
                            release_date, release_month, country, duration, age_rating, imdb_rating,
                            imdb_num_reviews,
                            n_ratings, n_ratings_kid, n_ratings_teenager, n_ratings_young_adult,
                            n_ratings_adult, n_ratings_senior, n_ratings_male, n_ratings_female,
                            description, storyline, poster_url, movie_url))

    cursor.execute('''CREATE TABLE IF NOT EXISTS interactions (user_id INTEGER PRIMARY KEY, items TEXT)''')

    # Read the file and build the dictionary
    user_interactions = read_ml100k_ratings()

    # Sort by timestamp
    user_interactions.sort(key=lambda x: x[2])

    # Build dictionary with timestamp-ordered items
    user_interactions_dict = {}
    for user_id, item_id, _ in user_interactions:
        if user_id not in user_interactions_dict:
            user_interactions_dict[user_id] = []
        user_interactions_dict[user_id].append(item_id)

    # Insert data into the table
    for user_id, items in user_interactions_dict.items():
        items_str = ','.join(map(str, items))
        cursor.execute('INSERT OR REPLACE INTO interactions (user_id, items) VALUES (?, ?)',
                       (user_id, items_str))

    # create user table
    cursor.execute('''CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY, age_category TEXT, gender TEXT)''')

    with open('./backend/movielens/data/ml-100k.user', 'r') as f:
        first_line = True
        for line in f:
            if first_line:
                first_line = False
                continue
            user_id, age, gender, occupation, location = line.strip().split('\t')
            cursor.execute('INSERT OR REPLACE INTO users (user_id, age_category, gender) VALUES (?, ?, ?)',
                           (user_id, convert_age_to_string(int(age)), gender))

    conn.commit()
    conn.close()


def convert_duration(duration_str):
    # Regular expressions to extract hours and minutes
    hours_match = re.search(r'(\d+)\s*h', duration_str)
    minutes_match = re.search(r'(\d+)\s*min', duration_str)

    # Convert found values to integers, default to 0 if not found
    hours = int(hours_match.group(1)) if hours_match else 0
    minutes = int(minutes_match.group(1)) if minutes_match else 0

    return hours * 60 + minutes


def convert_num_reviews(view_str):
    view_str = view_str.strip().upper()
    multipliers = {'K': 1_000, 'M': 1_000_000, 'B': 1_000_000_000}

    if view_str[-1] in multipliers:
        num = float(view_str[:-1])
        return int(num * multipliers[view_str[-1]])
    else:
        return int(view_str)

create_ml100k_db()
