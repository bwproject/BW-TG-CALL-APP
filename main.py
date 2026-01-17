# main.py

import asyncio
import os
import logging
import shutil
import threading
import http.server
import socketserver
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


# ─────────────────────────────────────────────
# 🔐 ЗАГРУЗКА .ENV — САМОЕ ПЕРВОЕ
# ─────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

if not os.path.exists(ENV_PATH):
    raise RuntimeError(f"❌ .env файл не найден: {ENV_PATH}")

load_dotenv(ENV_PATH, override=True)

def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"❌ ENV переменная {name} не задана")
    return value

# ─────────────────────────────────────────────
# 🔐 ENV ПЕРЕМЕННЫЕ
# ─────────────────────────────────────────────

TOKEN = require_env("TOKEN")
CALLME_BOT_USERNAME = require_env("CALLME_BOT_USERNAME")
WEBAPP_HOST = require_env("WEBAPP_HOST")

API_PORT = int(os.getenv("API_PORT", "22870"))
WEBAPP_PORT = int(os.getenv("WEBAPP_PORT", "22869"))

TURNIP = os.getenv("TURNIP")
TURNLOGIN = os.getenv("TURNLOGIN")
TURNPASSWORD = os.getenv("TURNPASSWORD")

# ─── Импорт роутеров ─────────────────────────────
from callme import callme_router, callme_api_router, register_callme_api

# ─── Логирование ────────────────────────────────
os.makedirs("logs", exist_ok=True)
log_file_path = os.path.join("logs", "bot.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[
        logging.FileHandler(log_file_path, encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ─── Создание бота ─────────────────────────────
async def create_bot():
    try:
        session = AiohttpSession()
        bot_instance = Bot(
            token=API_TOKEN,
            session=session,
            default=DefaultBotProperties(parse_mode=ParseMode.HTML)
        )
        logger.info("🤖 Бот создан без прокси (локальный IP)")
        return bot_instance
    except Exception as e:
        logger.error(f"Ошибка при создании Bot: {e}")
        session = AiohttpSession()
        return Bot(token=API_TOKEN, session=session)

# ─── Инициализация ─────────────────────────────
storage = MemoryStorage()
dp = Dispatcher(storage=storage)

# ─── Подключаем aiogram роутеры ────────────────
dp.include_router(callme_router)

# ─── FastAPI ─────────────────────────────────
app = FastAPI()

# ── CORS для WebApp
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # на продакшене лучше домен
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 🆕 CALLME WebApp
app.mount("/webapp/callme", StaticFiles(directory="webapp/callme", html=True), name="callme_webapp")

# ── 🆕 CALLME API
app.include_router(callme_api_router, prefix="/api/callme")

# ─── Запуск бота ─────────────────────────────
async def run_bot():
    bot = await create_bot()
    register_callme_api(bot)
    scheduler.start()
    logger.info("🤖 Бот запущен")

    await bot.set_my_commands([
        types.BotCommand(command="start", description="Начать"),
        types.BotCommand(command="callme", description="Голосовой / видео звонок"),
        types.BotCommand(command="callmeinfo", description="Информация о звонках"),
    ])

    await bot.delete_webhook(drop_pending_updates=True)

    try:
        await dp.start_polling(bot)
    finally:
        scheduler.shutdown()
        await bot.session.close()
        logger.info("🛑 Бот остановлен")

# ─── FastAPI сервер ─────────────────────────
async def start_api_server():
    config = uvicorn.Config(app, host="0.0.0.0", port=API_PORT, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()

# ─── Главная функция ─────────────────────────
async def main():
    generate_webapp_config()
    php_process = await start_php_server()

    start_model_watcher()
    asyncio.create_task(watch_models_file())

    api_task = asyncio.create_task(start_api_server())

    try:
        await run_bot()
    finally:
        api_task.cancel()
        try:
            await api_task
        except asyncio.CancelledError:
            logger.info("🌐 API сервер остановлен")

        if php_process:
            php_process.terminate()
            logger.info("PHP сервер остановлен")

if __name__ == "__main__":
    asyncio.run(main())