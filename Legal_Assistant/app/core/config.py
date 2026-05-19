from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "legal-assistant-api"
    debug: bool = False
    log_level: str = "INFO"

    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    yuanqi_base_url: str = "https://yuanqi.tencent.com/openapi/v1/agent/chat/completions"
    yuanqi_api_key: str = ""
    yuanqi_contract_review_base_url: str = "https://yuanqi.tencent.com/openapi/v1/agent/chat/completions"
    yuanqi_contract_review_api_key: str = ""
    yuanqi_assistant_id: str = ""
    yuanqi_assistant_chat: str = ""
    yuanqi_assistant_contract_review: str = ""
    yuanqi_assistant_clause_search: str = ""
    yuanqi_assistant_contract_generate: str = ""

    yuanqi_contract_generate_api_key: str= ""

    hunyuan_base_url: str = "https://open.hunyuan.tencent.com/openapi/v1/agent/chat/completions"
    hunyuan_api_key: str = ""
    hunyuan_assistant_id: str = ""
    hunyuan_assistant_clause_search: str = ""

    yuanqi_timeout_seconds: float = 120.0
    yuanqi_http2: bool = False

    database_url: str = "mysql+asyncmy://root:password@127.0.0.1:3306/luzhi_assistant?charset=utf8mb4"

    api_key: str = ""
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"

    max_upload_bytes: int = 20 * 1024 * 1024

    # 未登录或 anonymous 时落库使用的占位用户 UUID（需存在于 users 表，或由应用首次创建）
    anonymous_user_id: str = "00000000-0000-0000-0000-000000000099"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def assistant_id_for(self, scene: str) -> str:
        mapping = {
            "chat": self.yuanqi_assistant_chat,
            "contract_review": self.yuanqi_assistant_contract_review,
            "clause_search": self.yuanqi_assistant_clause_search,
            "contract_generate": self.yuanqi_assistant_contract_generate,
        }
        specific = mapping.get(scene, "")
        return specific or self.yuanqi_assistant_id

    def yuanqi_base_url_for(self, scene: str) -> str:
        if scene == "contract_review":
            return self.yuanqi_contract_review_base_url or self.yuanqi_base_url
        return self.yuanqi_base_url

    def yuanqi_api_key_for(self, scene: str) -> str | None:
        if scene == "contract_review":
            return self.yuanqi_contract_review_api_key or self.yuanqi_api_key
        if scene == "contract_generate":
            return self.yuanqi_contract_generate_api_key or self.yuanqi_api_key
        return self.yuanqi_api_key

    def hunyuan_assistant_id_for(self, scene: str) -> str:
        mapping = {
            "clause_search": self.hunyuan_assistant_clause_search,
        }
        specific = mapping.get(scene, "")
        return specific or self.hunyuan_assistant_id

    @field_validator("log_level", mode="before")
    @classmethod
    def uppercase_log_level(cls, v: str) -> str:
        return str(v).upper() if v else "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
