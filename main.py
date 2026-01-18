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

# ── CORS для WebApp
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # на продакшене лучше домен
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Статика WebApps
app.mount("/webapp", StaticFiles(directory=WEBAPP_FOLDER, html=True), name="webapp_root")

# ── 🆕 CALLME WebApp
app.mount("/webapp/callme", StaticFiles(directory="webapp/callme", html=True), name="callme_webapp")

# ── 🆕 CALLME API
app.include_router(callme_api_router, prefix="/api/callme")

# ─── Fallback HTTP сервер ────────────────────
def start_python_web_server():
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=WEBAPP_FOLDER, **kwargs)

    with socketserver.TCPServer(("", WEBAPP_PORT), Handler) as httpd:
        logger.info(f"✅ Python сервер (fallback) запущен на порту {WEBAPP_PORT}")
        httpd.serve_forever()

async def start_php_server():
    php_binary = shutil.which("php")
    if not php_binary:
        logger.warning("⚠ PHP не найден. Использую Python HTTP сервер.")
        threading.Thread(target=start_python_web_server, daemon=True).start()
        return None

    try:
        process = await asyncio.create_subprocess_exec(
            php_binary,
            "-S", f"0.0.0.0:{WEBAPP_PORT}",
            "-t", WEBAPP_FOLDER,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )
        logger.info(f"✅ PHP сервер запущен на порту {WEBAPP_PORT}")
        return process
    except Exception as e:
        logger.error(f"❌ Ошибка запуска PHP сервера: {e}")
        threading.Thread(target=start_python_web_server, daemon=True).start()
        return None

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