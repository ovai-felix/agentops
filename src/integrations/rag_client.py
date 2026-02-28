"""HTTP client for the RAG system API."""
import httpx
from config import settings


class RAGClient:
    def __init__(self):
        self._token: str | None = None
        self._client = httpx.Client(base_url=settings.ragsystem_url, timeout=120.0)

    def _ensure_auth(self):
        if self._token:
            return
        # Register user (ignore if already exists)
        self._client.post("/auth/register", json={
            "username": settings.rag_username,
            "password": settings.rag_password,
        })
        # Get token
        resp = self._client.post("/auth/token", json={
            "username": settings.rag_username,
            "password": settings.rag_password,
        })
        resp.raise_for_status()
        self._token = resp.json()["access_token"]

    def _headers(self) -> dict:
        self._ensure_auth()
        return {"Authorization": f"Bearer {self._token}"}

    def query(self, question: str, top_k: int = 5, filters: dict | None = None) -> dict:
        """Send a RAG query. Returns {answer, citations, retrieved_chunks, timings}."""
        body = {"query": question, "top_k": top_k}
        if filters:
            body["filters"] = filters
        resp = self._client.post("/query", json=body, headers=self._headers())
        resp.raise_for_status()
        return resp.json()

    def search_runbooks(self, question: str) -> str:
        """Search runbooks and return the answer with citations."""
        result = self.query(question, top_k=5)
        citations = ""
        if result.get("citations"):
            citations = "\n\nSources:\n" + "\n".join(
                f"- {c.get('source_path', 'unknown')}" for c in result["citations"]
            )
        return result.get("answer", "No relevant information found.") + citations

    def search_incidents(self, question: str) -> str:
        """Search historical incidents and return the answer with citations."""
        result = self.query(question, top_k=5)
        citations = ""
        if result.get("citations"):
            citations = "\n\nSources:\n" + "\n".join(
                f"- {c.get('source_path', 'unknown')}" for c in result["citations"]
            )
        return result.get("answer", "No relevant incidents found.") + citations

    def ingest_file(self, file_path: str) -> dict:
        """Upload a document for ingestion."""
        with open(file_path, "rb") as f:
            resp = self._client.post(
                "/ingest",
                files={"file": (file_path.split("/")[-1], f)},
                headers=self._headers(),
            )
        resp.raise_for_status()
        return resp.json()

    def health(self) -> dict:
        resp = self._client.get("/health")
        return resp.json()
