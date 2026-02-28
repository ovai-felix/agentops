"""CrewAI tools for searching runbooks and historical incidents via RAG."""
from crewai.tools import tool
from integrations.rag_client import RAGClient

_rag = RAGClient()


@tool("Search Runbooks")
def search_runbooks(question: str) -> str:
    """Search operational runbooks for procedures related to ML model issues.

    Covers runbooks for: model drift, data quality, latency spikes,
    retraining procedures, rollback procedures, and incident response.
    Returns an answer with source citations.
    """
    return _rag.search_runbooks(question)


@tool("Search Incidents")
def search_incidents(question: str) -> str:
    """Search historical incident reports for similar past ML system issues.

    Contains reports on: feature drift events, null spikes, latency incidents,
    accuracy drops, false positive spikes, schema changes, anomaly spikes,
    and retraining failures. Returns an answer with source citations.
    """
    return _rag.search_incidents(question)
