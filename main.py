# main.py
# ─────────────────────────────────────────────
# BW Project — Main entrypoint
# ─────────────────────────────────────────────

import os
import asyncio
import logging
import shutil
import threading
import http.server
import socketserver

from dotenv import load_dotenv

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

# ─────────────────────────────────────────────
# 📜 ЛОГИРОВАНИЕ
# ─────────────────────────────────────────────

os.makedirs("logs", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[
        logging.FileHandler("logs/bot.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("main")

logger.info("✅ .env загружен успешно")
logger.info(f"🌐 WEBAPP_HOST = {WEBAPP_HOST}")
logger.info(f"🤖 CALLME_BOT_USERNAME = @{CALLME_BOT_USERNAME}")

# ─────────────────────────────────────────────
# 🤖 AIROGRAM
# ─────────────────────────────────────────────

from aiogram import Bot, Dispatcher, types
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession

# ─────────────────────────────────────────────
# 🌐 FASTAPI
# ─────────────────────────────────────────────

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ─────────────────────────────────────────────
# 📦 ИМПОРТ МОДУЛЕЙ (ПОСЛЕ .env!)
# ─────────────────────────────────────────────

from callme import (
    callme_router,
    callme_api_router,
    register_callme_api
)

# если позже будешь добавлять другие модули — сюда

# ─────────────────────────────────────────────
# 🤖 СОЗДАНИЕ БОТА
# ─────────────────────────────────────────────

async def create_bot() -> Bot:
    session = AiohttpSession()
    bot = Bot(
        token=TOKEN,
        session=session,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )
    return bot

# ─────────────────────────────────────────────
# 🤖 DISPATCHER
# ─────────────────────────────────────────────

storage = MemoryStorage()
dp = Dispatcher(storage=storage)

dp.include_router(callme_router)

# ─────────────────────────────────────────────
# 🌐 FASTAPI APP
# ─────────────────────────────────────────────

app = FastAPI(title="BW CallMe API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── WebApp статика
app.mount(
    "/webapp/callme",
    StaticFiles(directory="webapp/callme", html=True),
    name="callme_webapp"
)

# ── CallMe API
app.include_router(callme_api_router, prefix="/api/callme")

# ─────────────────────────────────────────────
# 🌐 FALLBACK HTTP SERVER
# ─────────────────────────────────────────────

def start_python_web_server():
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory="webapp", **kwargs)

    with socketserver.TCPServer(("", WEBAPP_PORT), Handler) as httpd:
        logger.info(f"🌐 Python WebServer запущен :{WEBAPP_PORT}")
        httpd.serve_forever()

async def start_php_server():
    php = shutil.which("php")
    if not php:
        threading.Thread(target=start_python_web_server, daemon=True).start()
        return None

    try:
        proc = await asyncio.create_subprocess_exec(
            php,
            "-S", f"0.0.0.0:{WEBAPP_PORT}",
            "-t", "webapp",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )
        logger.info(f"🐘 PHP WebServer запущен :{WEBAPP_PORT}")
        return proc
    except Exception as e:
        logger.error(f"❌ PHP server error: {e}")
        threading.Thread(target=start_python_web_server, daemon=True).start()
        return None

# ─────────────────────────────────────────────
# 🤖 RUN BOT
# ─────────────────────────────────────────────

async def run_bot():
    bot = await create_bot()

    # регистрируем API с живым ботом
    register_callme_api(bot)

    await bot.set_my_commands([
        types.BotCommand("callme", "📞 Аудио / Видео звонок"),
        types.BotCommand("callmeinfo", "ℹ️ Информация CallMe"),
    ])

    await bot.delete_webhook(drop_pending_updates=True)
    logger.info("🤖 CallMe бот запущен")

    await dp.start_polling(bot)

# ─────────────────────────────────────────────
# 🌐 FASTAPI SERVER
# ─────────────────────────────────────────────

async def start_api():
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=API_PORT,
        log_level="info"
    )
    server = uvicorn.Server(config)
    await server.serve()

# ─────────────────────────────────────────────
# 🚀 MAIN
# ─────────────────────────────────────────────

async def main():
    php_process = await start_php_server()

    api_task = asyncio.create_task(start_api())
    bot_task = asyncio.create_task(run_bot())

    try:
        await asyncio.gather(api_task, bot_task)
    finally:
        if php_process:
            php_process.terminate()
            logger.info("🛑 PHP сервер остановлен")

if __name__ == "__main__":
    asyncio.run(main())