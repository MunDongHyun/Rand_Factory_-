from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_PATH), env_file_encoding="utf-8")

    # OpenAI
    openai_api_key: str
    ai_model: str = "gpt-5.4-mini"

    # MySQL
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str
    db_name: str = "landfactory"

    # App
    app_env: str = "development"
    secret_key: str

    # RAG
    chroma_persist_dir: str = "./chroma_db"

    # SMTP (이메일 발송)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from_name: str = "ArtiCulum"

    # Cloudflare R2 attachment storage
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_name: str | None = None
    r2_endpoint_url: str | None = None
    r2_region: str = "auto"

    # CORS allow_origins (쉼표 구분). 비면 dev 기본값
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # 벡터 검색 거리 임계값 (Chroma cosine distance, 작을수록 유사)
    # rag_service: 단일 쿼리 벡터 검색 컷오프
    # article_search: BM25+벡터 하이브리드 결과 컷오프 (별도 튜닝됨)
    rag_distance_threshold: float = 0.355
    article_search_distance_threshold: float = 0.35

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
