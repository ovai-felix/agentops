"""AgentOps configuration — all settings from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Snowflake
    snowflake_account: str = ""
    snowflake_user: str = ""
    snowflake_password: str = ""
    snowflake_database: str = "AGENTOPS"
    snowflake_schema: str = "PUBLIC"
    snowflake_warehouse: str = "DEFAULT_WH"

    # Sibling services
    mlmonitoring_url: str = "http://localhost:8000"
    ragsystem_url: str = "http://localhost:8003"
    rag_username: str = "agentops"
    rag_password: str = "agentops123"

    # LLM
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    llm_provider: str = "openai"  # "openai" or "anthropic"

    # Composio (Slack)
    composio_api_key: str = ""
    composio_slack_connection_id: str = ""
    slack_channel: str = "#ml-alerts"

    # GitHub
    github_repo: str = ""
    github_token: str = ""

    # Agent behavior
    monitor_poll_interval_sec: int = 30
    drift_threshold: float = 0.3
    accuracy_drop_threshold: float = 0.05
    approval_timeout_sec: int = 300

    # Demo mode
    demo_mode: bool = False

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
