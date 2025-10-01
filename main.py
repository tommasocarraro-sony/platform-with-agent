from fastapi import FastAPI, Query
from sqlalchemy import create_engine, text
from fastapi.middleware.cors import CORSMiddleware
from backend.agent.agent import create_agent, stream_graph_updates

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
def get_movies(ids: str = Query(..., description="Comma-separated IDs")):
    id_list = [int(x) for x in ids.split(",")]
    print(f"\n\n{id_list}\n\n")

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
