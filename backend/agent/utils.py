import time
import pandas as pd
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer
import docker
from docker.errors import ImageNotFound, NotFound
import uuid
import os

from constants import COLLECTION_NAME


def get_time():
    """
    Return current time. Good for logging.
    :return: current time
    """
    # Get current timestamp
    timestamp = time.time()

    # Convert to local time
    local_time = time.localtime(timestamp)

    # Format to hh:mm:ss - dd-mm-yyyy
    return time.strftime("%H:%M:%S - %d-%m-%Y", local_time)


def read_ml100k_ratings():
    user_interactions = []
    with open('./backend/movielens/data/ml-100k.inter', 'r') as f:
        first_line = True
        for line in f:
            if first_line:
                first_line = False
                continue
            user_id, item_id, rating, timestamp = line.strip().split('\t')
            user_interactions.append((int(user_id), int(item_id), int(timestamp)))
    return user_interactions


def create_vector_store():
    """
    It creates a local Qdrant vector store with MovieLens movies descriptions.
    """
    # Load your movie dataset
    movies = pd.read_csv(
        "./backend/movielens/data/final_ml-100k.csv",
        sep="\t",
        encoding="latin-1"
    )

    # SentenceTransformer model
    model = SentenceTransformer("paraphrase-MiniLM-L6-v2")

    # Qdrant local client (ensure Qdrant is running locally on this port)
    qdrant = QdrantClient(url="http://localhost:6333")

    collection_name = COLLECTION_NAME

    existing_collections = qdrant.get_collections().collections
    existing_names = {col.name for col in existing_collections}

    if collection_name in existing_names:
        print(f"⚠️ Collection '{collection_name}' already exists. Skipping creation.")
        return

    # Create Qdrant collection
    qdrant.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(
            size=model.get_sentence_embedding_dimension(),
            distance=Distance.COSINE,
        )
    )

    # Helper to build movie description
    def build_embedding_text(mv: pd.Series) -> str:
        fields = [f"Title: {mv['title']}"]

        if mv["genres"] != "unknown":
            fields.append(f"Genres: {mv['genres']}")

        if mv["storyline"] != "unknown":
            fields.append(f"Storyline: {mv['storyline']}")

        return ". \n".join(fields) + "."

    # Prepare data for insertion
    points = []
    for _, mv in movies.iterrows():
        if mv["title"] != "unknown":
            text = build_embedding_text(mv)
            vec = model.encode(
                text,
                normalize_embeddings=True,
                convert_to_numpy=True,
            ).tolist()

            metadata = {
                "item_id": int(mv["item_id"]),
                "storyline": None if mv["storyline"] == "unknown" else mv["storyline"]
            }

            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),  # unique identifier
                    vector=vec,
                    payload=metadata
                )
            )

    # Upload data to Qdrant
    qdrant.upsert(
        collection_name=collection_name,
        points=points
    )

    print(f"✅ Ingested {len(points)} movie descriptions into Qdrant collection '{collection_name}'.")


def ensure_qdrant_running():
    client = docker.from_env()
    image_name = "qdrant/qdrant"
    container_name = "qdrant_local"

    # Pull image if not available
    try:
        client.images.get(image_name)
        print("✅ Qdrant image already exists.")
    except ImageNotFound:
        print("📦 Pulling Qdrant image...")
        client.images.pull(image_name)

    # Check if container exists
    try:
        container = client.containers.get(container_name)
        if container.status != "running":
            print("▶️ Starting existing Qdrant container...")
            container.start()
        else:
            print("✅ Qdrant container already running.")
    except NotFound:
        # Run the container
        print("🚀 Creating and starting Qdrant container...")
        qdrant_storage_path = os.path.abspath("qdrant_storage")
        os.makedirs(qdrant_storage_path, exist_ok=True)

        client.containers.run(
            image_name,
            name=container_name,
            ports={"6333/tcp": 6333, "6334/tcp": 6334},
            volumes={
                qdrant_storage_path: {
                    "bind": "/qdrant/storage",
                    "mode": "z"
                }
            },
            detach=True
        )
        print("✅ Qdrant container started.")
