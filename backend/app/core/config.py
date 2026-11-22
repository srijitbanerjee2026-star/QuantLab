from pathlib import Path

from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "QuantLab API"
    
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "quantlab"
    DATABASE_URL: str | None = None

    # Beginner assistant (LLM). The key is read from backend/.env only and never sent to the browser.
    ANTHROPIC_API_KEY: str | None = None
    ASSISTANT_MODEL: str = "claude-opus-5-5"  # set e.g. claude-haiku-5-5 in .env for much lower cost
    ASSISTANT_DAILY_TOKEN_CAP: int = 400_000  # input+output tokens per UTC day across all users; 0 disables the assistant
    ASSISTANT_REQUESTS_PER_MINUTE: int = 12  # per client IP
    # "auto" = Claude if ANTHROPIC_API_KEY is set, otherwise the free local model via Ollama.
    ASSISTANT_PROVIDER: str = "auto"  # auto | anthropic | ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b"

    # Resolve .env next to the backend package so it loads no matter where the server is started from.
    model_config = ConfigDict(env_file=str(Path(__file__).resolve().parents[2] / ".env"), extra="ignore")

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()