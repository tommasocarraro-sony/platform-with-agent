import os
from backend.recsys.recbole_env import recbole_env
from fastapi import FastAPI, Query
from sqlalchemy import create_engine, text
from fastapi.middleware.cors import CORSMiddleware
from backend.agent.agent import create_agent, stream_graph_updates
from backend.agent.tools.get_top_k_recommendations import recommend_given_items
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = "sqlite:///backend/db/movielens-100k.db"

# Connect to SQLite
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# create the agent
agent = create_agent()

app = FastAPI()

# Allow React frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/movies")
def get_movies(ids: str = Query(..., description="Comma-separated IDs"),
               user_id: int = Query(..., description="User ID for personalized results")):
    id_list = [int(x) for x in ids.split(",")]
    # pass user id and item ids to the recsys model to get a personalized ranking to be displayed
    if not recbole_env.is_initialized:
        recbole_env.initialize(os.getenv("RECSYS_MODEL_PATH"))
    _, _, dataset, _, _, _ = recbole_env.get_environment()
    uid_series = dataset.token2id(dataset.uid_field, [str(user_id)])
    id_list = recommend_given_items(uid_series, id_list, k=len(id_list))

    with engine.connect() as conn:
        placeholders = ", ".join([":" + f"id_{i}" for i in range(len(id_list))])
        query = text(f"SELECT * FROM items WHERE item_id IN ({placeholders})")

        params = {f"id_{i}": id_val for i, id_val in enumerate(id_list)}

        result = conn.execute(query, params)
        rows = result.fetchall()
        return [dict(row._mapping) for row in rows]

@app.get("/movies/{movie_id}")
def get_movie(movie_id: int):
    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM items WHERE item_id = :id"), {"id": movie_id})
        row = result.fetchone()
        return dict(row._mapping) if row else {}

@app.post("/recommend")
def recommend(query: str = Query(...)):
    return stream_graph_updates(agent, query)
