# main.py

import os
import asyncio
import logging
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, types
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import uvicorn

# 🆕 CALLME
from callme import callme_router, callme_api_router

# ─── Загрузка .env ─────────────────────────
load_dotenv()
API_TOKEN = os.getenv("TOKEN")
WEBAPP_PORT = int(os.getenv("WEBAPP_PORT", "22869"))
WEBAPP_HOST = os.getenv("WEBAPP_HOST", "https://webapp.projectbw.ru")
WEBAPP_FOLDER = "webapp"
API_PORT = int(os.getenv("API_PORT", "22870"))

if not API_TOKEN:
    raise ValueError("❌ TOKEN не найден в .env файле")

# ─── Логирование ─────────────────────────
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

# ─── Создание бота ─────────────────────────
async def create_bot():
    session = AiohttpSession()
    bot = Bot(
        token=API_TOKEN,
        session=session,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )
    logger.info("🤖 Бот создан")
    return bot

# ─── Инициализация Dispatcher ─────────────
storage = MemoryStorage()
dp = Dispatcher(storage=storage)

# ─── Подключаем CallMe роутер ─────────────
dp.include_router(callme_router)

# ─── FastAPI ──────────────────────────────
app = FastAPI()
app.mount("/webapp/callme", StaticFiles(directory="webapp/callme", html=True), name="callme_webapp")
app.include_router(callme_api_router, prefix="/api/callme")

# ─── Запуск бота ─────────────────────────
async def run_bot():
    bot = await create_bot()

    await bot.set_my_commands([
        types.BotCommand(command="callme", description="Голосовой / видео звонок"),
        types.BotCommand(command="callmeinfo", description="Информация о CallMe")
    ])

    await bot.delete_webhook(drop_pending_updates=True)

    logger.info("🤖 Бот запущен")
    await dp.start_polling(bot)

# ─── FastAPI сервер ───────────────────────
async def start_api_server():
    config = uvicorn.Config(app, host="0.0.0.0", port=API_PORT, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()

# ─── Главная функция ──────────────────────
async def main():
    api_task = asyncio.create_task(start_api_server())
    try:
        await run_bot()
    finally:
        api_task.cancel()
        try:
            await api_task
        except asyncio.CancelledError:
            logger.info("🌐 API сервер остановлен")

if __name__ == "__main__":
    asyncio.run(main())