"""Ingest runbooks and incidents into the RAG system."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from integrations.rag_client import RAGClient
from pathlib import Path


def main():
    client = RAGClient()

    # Check health
    health = client.health()
    print(f"RAG health: {health}")

    # Ingest runbooks
    runbooks_dir = Path(__file__).parent.parent / "runbooks"
    for f in sorted(runbooks_dir.glob("*.md")):
        print(f"Ingesting runbook: {f.name}...")
        result = client.ingest_file(str(f))
        print(f"  → {result}")

    # Ingest incidents
    incidents_dir = Path(__file__).parent.parent / "incidents"
    for f in sorted(incidents_dir.glob("*.md")):
        print(f"Ingesting incident: {f.name}...")
        result = client.ingest_file(str(f))
        print(f"  → {result}")

    # Verify with test queries
    print("\n--- Verification Queries ---")

    r1 = client.search_runbooks("What should I do when model drift is detected?")
    print(f"\nRunbook query result:\n{r1[:300]}...")

    r2 = client.search_incidents("Has V14 drift happened before?")
    print(f"\nIncident query result:\n{r2[:300]}...")


if __name__ == "__main__":
    main()
