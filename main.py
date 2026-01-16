# main.py

import asyncio
import os
import logging
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, types
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 🆕 CallMe
from callme import callme_router, callme_api_router, register_callme_api

# ─── ENV ──────────────────────────────────
load_dotenv()

TOKEN = os.getenv("TOKEN")
API_PORT = int(os.getenv("API_PORT", "22870"))
WEBAPP_FOLDER = "webapp"

if not TOKEN:
    raise RuntimeError("❌ TOKEN не задан в .env")

# ─── Логи ─────────────────────────────────
os.makedirs("logs", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[
        logging.FileHandler("logs/callme-bot.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("callme-bot")

# ─── BOT ──────────────────────────────────
async def create_bot() -> Bot:
    session = AiohttpSession()
    return Bot(
        token=TOKEN,
        session=session,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )

# ─── DISPATCHER ───────────────────────────
dp = Dispatcher(storage=MemoryStorage())
dp.include_router(callme_router)

# ─── FASTAPI ──────────────────────────────
app = FastAPI(title="CallMe API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebApp (Mini App)
app.mount(
    "/callme",
    StaticFiles(directory="webapp/callme", html=True),
    name="callme_webapp"
)

# API
app.include_router(callme_api_router, prefix="/api/callme")

# ─── RUN BOT ──────────────────────────────
async def run_bot():
    bot = await create_bot()

    # регистрируем API с реальным ботом
    register_callme_api(bot)

    await bot.set_my_commands([
        types.BotCommand(command="callme", description="📞 Позвонить"),
        types.BotCommand(command="callmeinfo", description="ℹ️ О CallMe"),
    ])

    await bot.delete_webhook(drop_pending_updates=True)

    logger.info("🤖 CallMe бот запущен")
    await dp.start_polling(bot)

# ─── RUN API ──────────────────────────────
async def run_api():
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=API_PORT,
        log_level="info"
    )
    server = uvicorn.Server(config)
    await server.serve()

# ─── MAIN ─────────────────────────────────
async def main():
    await asyncio.gather(
        run_bot(),
        run_api()
    )

if __name__ == "__main__":
    asyncio.run(main())