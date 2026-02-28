"""Composio tool re-export for CrewAI agents.

These tools provide Slack messaging and GitHub issue creation via Composio.
Requires COMPOSIO_API_KEY to be set and integrations connected.
"""
from integrations.composio_client import get_composio_tools
