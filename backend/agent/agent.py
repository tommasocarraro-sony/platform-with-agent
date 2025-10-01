from typing import Annotated
from langchain_core.messages.utils import count_tokens_approximately, trim_messages
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph.message import add_messages
import os
from langchain.chat_models import init_chat_model
from dotenv import load_dotenv
import json
from langchain_core.messages import ToolMessage
from backend.agent.tools.get_top_k_recommendations import get_top_k_recommendations_tool
from backend.movielens.create_db import create_ml100k_db
from backend.agent.utils import create_vector_store, ensure_qdrant_running
from backend.agent.tools.item_filter import item_filter_tool
from backend.agent.tools.get_user_metadata import get_user_metadata_tool
from backend.agent.tools.get_item_metadata import get_item_metadata_tool
from backend.agent.tools.get_interacted_items import get_interacted_items_tool
from backend.agent.tools.get_popular_items import get_popular_items_tool
from backend.agent.tools.vector_store_search import vector_store_search_tool
from backend.agent.tools.utils import create_lists_for_fuzzy_matching
from constants import SYSTEM_MESSAGE_ENHANCED
load_dotenv()


class State(TypedDict):
    messages: Annotated[list, add_messages]


class BasicToolNode:

    def __init__(self, tools: list) -> None:
        self.tools_by_name = {tool.name: tool for tool in tools}

    def __call__(self, inputs: dict):
        if messages := inputs.get("messages", []):
            message = messages[-1]
        else:
            raise ValueError("No message found in input")
        outputs = []
        for tool_call in message.tool_calls:
            tool_result = self.tools_by_name[tool_call["name"]].invoke(
                tool_call["args"]
            )
            outputs.append(
                ToolMessage(
                    content=json.dumps(tool_result),
                    name=tool_call["name"],
                    tool_call_id=tool_call["id"],
                )
            )
        return {"messages": outputs}


def route_tools(
    state: State,
):
    """
    Use in the conditional_edge to route to the ToolNode if the last message
    has tool calls. Otherwise, route to the end.
    """
    if isinstance(state, list):
        ai_message = state[-1]
    elif messages := state.get("messages", []):
        ai_message = messages[-1]
    else:
        raise ValueError(f"No messages found in input state to tool_edge: {state}")
    if hasattr(ai_message, "tool_calls") and len(ai_message.tool_calls) > 0:
        return "tools"
    return END


def create_agent():
    memory = MemorySaver()

    # create database
    create_ml100k_db()
    create_lists_for_fuzzy_matching()
    ensure_qdrant_running()
    create_vector_store()

    tools = [item_filter_tool, get_user_metadata_tool, get_item_metadata_tool, get_interacted_items_tool,
             get_top_k_recommendations_tool, get_popular_items_tool, vector_store_search_tool]

    graph_builder = StateGraph(State)

    api_key = os.getenv("OPENAI_API_KEY")

    llm = init_chat_model("openai:gpt-4.1", api_key=api_key)

    llm_with_tools = llm.bind_tools(tools)

    def chatbot(state: State):
        messages = trim_messages(
            state["messages"],
            strategy="last",
            token_counter=count_tokens_approximately,
            max_tokens=20000,
            start_on="human",
            end_on=("human", "tool"),
            include_system=True,
        )
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    graph_builder.add_node("chatbot", chatbot)

    tool_node = BasicToolNode(tools=tools)

    graph_builder.add_node("tools", tool_node)

    graph_builder.add_conditional_edges(
        "chatbot",
        route_tools,
        {"tools": "tools", END: END},
    )

    graph_builder.add_edge("tools", "chatbot")
    graph_builder.add_edge(START, "chatbot")
    graph = graph_builder.compile(checkpointer=memory)

    return graph

conversation_started = False

def stream_graph_updates(graph, user_input):
    global conversation_started
    messages = []

    if not conversation_started:
        messages.extend(SYSTEM_MESSAGE_ENHANCED)
        conversation_started = True

    messages.append({"role": "user", "content": user_input})

    return graph.invoke({"messages": messages}, config={"configurable": {"thread_id": "1"}})
