from fastapi import APIRouter

from app.api.v1 import agent, auth, chat, chat_sessions, contract, contract_download, health, legal_search

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(health.router)
api_router.include_router(agent.router)
api_router.include_router(chat.router)
api_router.include_router(chat_sessions.router)
api_router.include_router(legal_search.router)
api_router.include_router(contract.router)
api_router.include_router(contract_download.router)

