import os

from starlette import status

from backend.recsys.recbole_env import recbole_env
from fastapi import FastAPI, Query
from sqlalchemy import create_engine, text
from fastapi.middleware.cors import CORSMiddleware
from backend.agent.agent import Agent, create_agent_env
from backend.agent.tools.get_top_k_recommendations import recommend_given_items
from dotenv import load_dotenv
from backend.agent.tools.utils import execute_sql_query
load_dotenv()

DATABASE_URL = "sqlite:///backend/db/movielens-100k.db"

# Connect to SQLite
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# create the agent environment
create_agent_env()

app = FastAPI()

# Allow React frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def generate_carousels(user_id: int):
    carousels_config = {
        "horror": {
            "name": "Horror Movies",
            "query": "SELECT item_id FROM items WHERE genres LIKE '%Horror%'"
        },
        "tom_cruise": {
            "name": "Tom Cruise Movies",
            "query": "SELECT item_id FROM items WHERE actors LIKE '%Tom Cruise%'"
        },
        "top_rated": {
            "name": "Top Rated",
            "query": "SELECT item_id FROM items WHERE imdb_rating >= 8.0"
        }
    }

    carousels = {}
    for key, config in carousels_config.items():
        movie_ids = execute_sql_query(config["query"])
        movies = get_movies(",".join([str(i[0]) for i in movie_ids]), user_id)

        carousels[key] = {
            "name": config["name"],
            "movies": movies
        }

    return carousels

agent = Agent()

@app.get("/carousels")
def get_carousels(user_id: int = Query(...)):
    return generate_carousels(user_id)


@app.get("/movies")
def get_movies(ids: str = Query(..., description="Comma-separated IDs"),
               user_id: int = Query(..., description="User ID for personalized results")):
    id_list = [int(x) for x in ids.split(",")]

    # Get personalized ranking from recommendation model
    if not recbole_env.is_initialized:
        recbole_env.initialize(os.getenv("RECSYS_MODEL_PATH"))
    _, _, dataset, _, _, _ = recbole_env.get_environment()
    uid_series = dataset.token2id(dataset.uid_field, [str(user_id)])
    ordered_ids = recommend_given_items(uid_series, id_list, k=len(id_list))

    with engine.connect() as conn:
        placeholders = ", ".join([":" + f"id_{i}" for i in range(len(ordered_ids))])
        query = text(f"SELECT * FROM items WHERE item_id IN ({placeholders})")

        params = {f"id_{i}": id_val for i, id_val in enumerate(ordered_ids)}

        result = conn.execute(query, params)
        rows = result.fetchall()

        # Create a mapping of item_id to movie data for quick lookup
        movie_dict = {row.item_id: dict(row._mapping) for row in rows}

        # Reorder the results to match the personalized order
        ordered_movies = []
        for item_id in ordered_ids:
            if int(item_id) in movie_dict:
                ordered_movies.append(movie_dict[int(item_id)])

        return ordered_movies

@app.get("/movies/{movie_id}")
def get_movie(movie_id: int):
    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM items WHERE item_id = :id"), {"id": movie_id})
        row = result.fetchone()
        return dict(row._mapping) if row else {}


@app.post("/initialize", status_code=status.HTTP_204_NO_CONTENT)
def initialize():
    """
    Initialize the agent. This is useful to reinitialize the chat history at every logout.
    """
    agent.init_agent()

@app.post("/recommend")
def recommend(query: str = Query(...)):
    return agent.invoke_agent(query)
