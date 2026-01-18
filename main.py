# main.py
from dotenv import load_dotenv
load_dotenv()  # ВАЖНО: до импортов callme

import asyncio
import os
import logging

from aiogram import Bot, Dispatcher, types
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ─── ENV ─────────────────────────────────────
API_TOKEN = os.getenv("TOKEN")
API_PORT = int(os.getenv("API_PORT", "22870"))
WEBAPP_FOLDER = "webapp"

if not API_TOKEN:
    raise RuntimeError("❌ TOKEN не найден в .env")

# ─── CALLME ──────────────────────────────────
from callme import callme_router, callme_api_router, register_callme_api

# ─── Логирование ─────────────────────────────
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[
        logging.FileHandler("logs/bot.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ─── Aiogram ─────────────────────────────────
storage = MemoryStorage()
dp = Dispatcher(storage=storage)
dp.include_router(callme_router)

async def create_bot() -> Bot:
    session = AiohttpSession()
    bot = Bot(
        token=API_TOKEN,
        session=session,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )
    logger.info("🤖 Bot created")
    return bot

async def run_bot():
    bot = await create_bot()

    # регистрируем CallMe API с живым ботом
    register_callme_api(bot)

    await bot.set_my_commands([
        types.BotCommand(command="callme", description="Голосовой / видео звонок"),
        types.BotCommand(command="callmeinfo", description="Информация о звонках"),
    ])

    await bot.delete_webhook(drop_pending_updates=True)

    logger.info("🤖 Bot polling started")
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()
        logger.info("🛑 Bot stopped")

# ─── FastAPI ─────────────────────────────────
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebApp статика
app.mount(
    "/webapp",
    StaticFiles(directory=WEBAPP_FOLDER, html=True),
    name="webapp"
)

# CallMe WebApp
app.mount(
    "/webapp/callme",
    StaticFiles(directory="webapp/callme", html=True),
    name="callme_webapp"
)

# CallMe API
app.include_router(callme_api_router, prefix="/api/callme")

async def start_api():
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=API_PORT,
        log_level="info"
    )
    server = uvicorn.Server(config)
    logger.info(f"🌐 FastAPI started on :{API_PORT}")
    await server.serve()

# ─── Main ────────────────────────────────────
async def main():
    api_task = asyncio.create_task(start_api())
    try:
        await run_bot()
    finally:
        api_task.cancel()
        logger.info("🌐 FastAPI stopped")

if __name__ == "__main__":
    asyncio.run(main())