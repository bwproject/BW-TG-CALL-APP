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

# ─── Импорт роутеров ─────────────────────────────

# 🆕 CALLME
from callme import callme_router, callme_api_router, register_callme_api

# ─── Загрузка .env ─────────────────────────────
load_dotenv()
API_TOKEN = os.getenv("TOKEN")
GROUP_CHAT_ID = int(os.getenv("GROUP_CHAT_ID", "-1001811880246"))
WEBAPP_PORT = int(os.getenv("WEBAPP_PORT", "22869"))
WEBAPP_FOLDER = "webapp"
WEBAPP_URL1 = os.getenv("WEBAPP_URL1", "https://webapp.projectbw.ru/tictactoe/index.html")
API_PORT = int(os.getenv("API_PORT", "22870"))

if not API_TOKEN:
    raise ValueError("❌ TOKEN не найден в .env файле")

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
dp.include_router(module_router)
dp.include_router(router)
dp.include_router(dr_router)
dp.include_router(game_router)
dp.include_router(battleship_router)
dp.include_router(game_webapp_router)
dp.include_router(flappy_router)
dp.include_router(boltalka_router)
dp.include_router(sora2test_router)

# 🆕 CALLME router
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

# ── Статика WebApps
app.mount("/webapp", StaticFiles(directory=WEBAPP_FOLDER, html=True), name="webapp_root")

# ── Старые WebApps
app.include_router(webapp_router, prefix="/webapp/tictactoe")
app.include_router(api_router, prefix="/api")

# ── 🆕 CALLME WebApp
app.mount("/webapp/callme", StaticFiles(directory="webapp/callme", html=True), name="callme_webapp")

# ── 🆕 CALLME API
app.include_router(callme_api_router, prefix="/api/callme")

# ── Flappy как root
app.mount("/", flappy_app)

# ─── Планировщик ─────────────────────────────
scheduler.add_job(send_daily_meme, "cron", hour=10, minute=0)

# ─── Генерация config.js ─────────────────────
def generate_webapp_config():
    try:
        tictactoe_path = os.path.join(WEBAPP_FOLDER, "tictactoe")
        os.makedirs(tictactoe_path, exist_ok=True)
        config_path = os.path.join(tictactoe_path, "config.js")
        with open(config_path, "w", encoding="utf-8") as f:
            f.write(
                f"window.API_PORT='{API_PORT}';\n"
                f"window.WEBAPP_URL1='{WEBAPP_URL1}';\n"
            )
        logger.info(f"✅ config.js сгенерирован: {config_path}")
    except Exception as e:
        logger.error(f"❌ Ошибка генерации config.js: {e}")

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

# ─── Запуск бота ─────────────────────────────
async def run_bot():
    bot = await create_bot()

    # 🆕 Регистрация CallMe API с реальным ботом
    register_callme_api(bot)

    # 🆕 Запуск авто-проверки PIPSA в 00:01
    asyncio.create_task(daily_check(bot))

    scheduler.start()
    logger.info("🤖 Бот запущен")

    await bot.set_my_commands([
        types.BotCommand(command="start", description="Начать"),
        types.BotCommand(command="help", description="Помощь"),
        types.BotCommand(command="setting", description="Настройки"),
        types.BotCommand(command="supported_links", description="Поддерживаемые ссылки"),

        types.BotCommand(command="spasibo", description="Мем 'спасибо'"),
        types.BotCommand(command="meme", description="Случайный мем"),
        types.BotCommand(command="memeadd", description="Добавить мем"),
        types.BotCommand(command="ytro", description="Мем 'утро'"),

        types.BotCommand(command="pidor_roll", description="Проверка 😄"),

        types.BotCommand(command="krestiki", description="Крестики-нолики"),
        types.BotCommand(command="toptictactoe", description="Топ по крестикам"),

        types.BotCommand(command="flappybirdweb", description="Flappy Bird WebApp"),
        types.BotCommand(command="flappybirdtop", description="Топ Flappy Bird"),

        types.BotCommand(command="pogovorim", description="Включить болталку"),
        types.BotCommand(command="hvatit", description="Выключить болталку"),
        types.BotCommand(command="chatmodel", description="Выбрать модель"),

        # 🆕 PIPSA / SISI
        types.BotCommand(command="pipsa", description="🍆 Играть в PIPSA"),
        types.BotCommand(command="pipsame", description="🍆 Мой писюн"),
        types.BotCommand(command="pipsatop", description="🍆 Топ PIPSA"),
        types.BotCommand(command="pipsainfo", description="🍆 Информация об игре"),
        types.BotCommand(command="pipsapol", description="🍆 Мужской режим"),

        types.BotCommand(command="sisi", description="🍒 Играть в SISI"),
        types.BotCommand(command="sisime", description="🍒 Мои сиси"),
        types.BotCommand(command="sisitop", description="🍒 Топ SISI"),
        types.BotCommand(command="sisiinfo", description="🍒 Информация об игре"),
        types.BotCommand(command="sisipol", description="🍒 Женский режим"),

        # 🆕 CALLME
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