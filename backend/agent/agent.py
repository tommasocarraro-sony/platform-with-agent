from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent
import os
from langchain.chat_models import init_chat_model
from dotenv import load_dotenv
from backend.agent.tools.get_top_k_recommendations import get_top_k_recommendations_tool
from backend.agent.tools.item_filter import item_filter_tool
from backend.agent.tools.get_user_metadata import get_user_metadata_tool
from backend.agent.tools.get_item_metadata import get_item_metadata_tool
from backend.agent.tools.get_interacted_items import get_interacted_items_tool
from backend.agent.tools.get_popular_items import get_popular_items_tool
from backend.agent.tools.utils import create_lists_for_fuzzy_matching
from backend.agent.tools.vector_store_search import vector_store_search_tool
from backend.agent.utils import ensure_qdrant_running, create_vector_store
from backend.movielens.create_db import create_ml100k_db
from constants import SYSTEM_MESSAGE_ENHANCED
load_dotenv()


def create_agent_env():
    create_ml100k_db()
    create_lists_for_fuzzy_matching()
    ensure_qdrant_running()
    create_vector_store()


def create_agent():
    checkpointer = MemorySaver()

    api_key = os.getenv("OPENAI_API_KEY")
    llm = init_chat_model("openai:gpt-4.1", api_key=api_key)

    agent = create_react_agent(
        model=llm,
        tools=[get_item_metadata_tool, get_interacted_items_tool, get_top_k_recommendations_tool,
               get_popular_items_tool, get_user_metadata_tool, item_filter_tool, vector_store_search_tool,
               get_user_metadata_tool],
        prompt=SYSTEM_MESSAGE_ENHANCED,
        checkpointer=checkpointer
    )

    return agent


# define agent object
class Agent:
    def __init__(self):
        self.agent = None

    def init_agent(self):
        self.agent = create_agent()

    def invoke_agent(self, user_input):
        return self.agent.invoke({"messages": [{"role": "user", "content": user_input}]},
                          config={"configurable": {"thread_id": "1"}})
