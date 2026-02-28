"""Composio integration for Slack and GitHub actions."""
from composio_crewai import ComposioToolSet, Action


def get_composio_tools():
    """Get Composio tools for CrewAI agents.

    Returns a list of CrewAI-compatible tools for:
    - Slack: send messages
    - GitHub: create issues

    Must have COMPOSIO_API_KEY set and integrations connected.
    """
    toolset = ComposioToolSet()
    tools = toolset.get_tools(
        actions=[
            Action.SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL,
            Action.GITHUB_CREATE_AN_ISSUE,
        ]
    )
    return tools
