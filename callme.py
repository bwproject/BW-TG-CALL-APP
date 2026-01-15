# callme.py

import os
import time
import json
import hashlib
import logging
from typing import Dict, List, Optional

import aiohttp
from aiogram import Router, types
from aiogram.filters import Command
from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    CallbackQuery,
)
from aiogram.exceptions import TelegramForbiddenError, TelegramBadRequest

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

# ─── ENV ─────────────────────────────────
WEBAPP_HOST = os.getenv("WEBAPP_HOST")
if not WEBAPP_HOST:
    raise RuntimeError("❌ WEBAPP_HOST не задан в .env")
WEBAPP_HOST = WEBAPP_HOST.rstrip("/")

# ─── Paths ───────────────────────────────
CALLME_JSON = "webapp/callme/callme.json"
AVATAR_DIR = "webapp/callme/avatar"
os.makedirs(AVATAR_DIR, exist_ok=True)

# ─── Routers ─────────────────────────────
callme_router = Router()
callme_api_router = APIRouter()

# ─── Хранилища ───────────────────────────
pending_calls: Dict[int, int] = {}
active_ws: Dict[str, List[WebSocket]] = {}

# ─── Utils ───────────────────────────────
def generate_call_id(tg1: int, tg2: int) -> str:
    raw = f"{tg1}:{tg2}:{time.time()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]

def make_webapp_kb(call_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📞 Открыть звонок", web_app=WebAppInfo(url=call_url))]
        ]
    )

def incoming_call_kb(from_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Принять", callback_data=f"callme_accept:{from_id}"),
                InlineKeyboardButton(text="❌ Отклонить", callback_data=f"callme_deny:{from_id}"),
            ]
        ]
    )

# ─── callme.json helpers ─────────────────
def load_callme_users() -> dict:
    if not os.path.exists(CALLME_JSON):
        return {}
    with open(CALLME_JSON, "r", encoding="utf-8") as f:
        return json.load(f)

def save_callme_users(data: dict):
    with open(CALLME_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ─── Avatar ──────────────────────────────
async def download_avatar(bot, user_id: int) -> Optional[str]:
    try:
        photos = await bot.get_user_profile_photos(user_id, limit=1)
    except TelegramBadRequest:
        return None
    if not photos.photos:
        return None
    photo = photos.photos[0][-1]
    file = await bot.get_file(photo.file_id)
    avatar_path = f"{AVATAR_DIR}/{user_id}.jpg"
    avatar_url = f"https://api.telegram.org/file/bot{bot.token}/{file.file_path}"
    async with aiohttp.ClientSession() as session:
        async with session.get(avatar_url) as resp:
            if resp.status == 200:
                with open(avatar_path, "wb") as f:
                    f.write(await resp.read())
    return f"/callme/avatar/{user_id}.jpg"

async def save_callme_user(message: types.Message):
    users = load_callme_users()
    user = message.from_user
    avatar = await download_avatar(message.bot, user.id)
    users[str(user.id)] = {
        "id": user.id,
        "name": user.first_name or "Пользователь",
        "username": user.username or "",
        "avatar": avatar,
        "updated_at": int(time.time()),
    }
    save_callme_users(users)

# ─── /callmeinfo ─────────────────────────
@callme_router.message(Command("callmeinfo"))
async def callmeinfo_cmd(message: types.Message):
    await message.answer(
        "📞 <b>BW CallMe</b>\n\n"
        "Встроенные аудио и видеозвонки прямо внутри Telegram через WebApp.\n\n"
        "🔹 WebRTC (видео и аудио)\n"
        "🔹 Поддержка iOS и Android\n"
        "🔹 Камера и микрофон — только по действию пользователя\n"
        "🔹 Громкая связь зависит от ОС\n\n"
        "▶️ <b>Как позвонить</b>\n"
        "<code>/callme TGID</code>\n\n"
        "💡 Код модуля вынесен в отдельный репозиторий:\n"
        "https://github.com/bwproject/BW-TG-CALL-APP\n"
        "⭐️ Отдельный бот только с Mini App @BWCallMeBot\n\n"
        "🤫 И да… не показывайте это одной конторе из трёх букв 😉"
    )

# ─── /callme ─────────────────────────────
@callme_router.message(Command("callme"))
async def callme_cmd(message: types.Message):
    await save_callme_user(message)
    args = message.text.split()
    if len(args) == 1:
        await message.answer(
            f"Привет, {message.from_user.first_name} 👋\n\n"
            f"📞 <b>CallMe — аудио/видеозвонки</b>\n\n"
            f"Твой TGID:\n<code>{message.from_user.id}</code> - Нажми и он скопируется\n\n"
            f"Чтобы позвонить:\n<code>/callme TGID</code>\n\n"
            f"ℹ️ Подробнее о Mini App: /callmeinfo"
        )
        return

    try:
        target_id = int(args[1])
    except ValueError:
        await message.answer("❌ Некорректный TGID")
        return

    if target_id == message.from_user.id:
        await message.answer("❌ Нельзя позвонить самому себе")
        return

    try:
        pending_calls[target_id] = message.from_user.id
        await message.bot.send_message(
            target_id,
            f"📞 <b>Входящий звонок</b>\n\n"
            f"От: {message.from_user.first_name}\n"
            f"TGID: <code>{message.from_user.id}</code>",
            reply_markup=incoming_call_kb(message.from_user.id),
        )
    except (TelegramForbiddenError, TelegramBadRequest):
        pending_calls.pop(target_id, None)
        await message.answer(
            f"❌ Невозможно отправить сообщение пользователю <code>{target_id}</code>\n"
            "Он ещё ни разу не запускал бота."
        )
        return

    await message.answer("📨 Запрос на звонок отправлен")

# ─── Callback: принять ───────────────────
@callme_router.callback_query(lambda c: c.data.startswith("callme_accept:"))
async def callme_accept_cb(callback: CallbackQuery):
    from_id = int(callback.data.split(":")[1])
    to_id = callback.from_user.id
    if pending_calls.get(to_id) != from_id:
        await callback.answer("❌ Вызов неактивен", show_alert=True)
        return

    call_id = generate_call_id(from_id, to_id)
    del pending_calls[to_id]

    call_url = f"{WEBAPP_HOST}/callme/index.html?{from_id}_{to_id}_{call_id}"
    kb = make_webapp_kb(call_url)

    for uid in (from_id, to_id):
        await callback.bot.send_message(uid, "✅ Соединение установлено", reply_markup=kb)

    await callback.message.edit_text("✅ Звонок принят")
    await callback.answer()

# ─── Callback: отклонить ─────────────────
@callme_router.callback_query(lambda c: c.data.startswith("callme_deny:"))
async def callme_deny_cb(callback: CallbackQuery):
    from_id = int(callback.data.split(":")[1])
    to_id = callback.from_user.id
    if pending_calls.get(to_id) == from_id:
        del pending_calls[to_id]
    await callback.bot.send_message(from_id, "❌ Пользователь отклонил звонок")
    await callback.message.edit_text("❌ Звонок отклонён")
    await callback.answer()

# ─── WebSocket signaling ─────────────────
@callme_api_router.websocket("/ws/{call_id}")
async def callme_ws(ws: WebSocket, call_id: str):
    await ws.accept()
    active_ws.setdefault(call_id, []).append(ws)
    logger.info(f"🌐 WS подключён: call_id={call_id}")

    try:
        while True:
            data = await ws.receive_json()
            if data.get("type") == "peer-info":
                users = load_callme_users()
                uid = str(data.get("id"))
                user = users.get(uid, {})
                data["user"] = {
                    "id": uid,
                    "name": user.get("name") or "Пользователь",
                    "avatar": user.get("avatar") or None,
                }
            for client in active_ws[call_id]:
                if client is not ws:
                    await client.send_json(data)
    except WebSocketDisconnect:
        active_ws[call_id].remove(ws)
        logger.info(f"❌ WS отключён: call_id={call_id}")

# ─── TURN / STUN ─────────────────────────
@callme_api_router.get("/turn")
async def get_turn_config():
    return {
        "iceServers": [
            {"urls": f"stun:{os.getenv('TURNIP')}"},
            {"urls": "stun:stun.l.google.com:19302"},
            {
                "urls": f"turn:{os.getenv('TURNIP')}",
                "username": os.getenv("TURNLOGIN"),
                "credential": os.getenv("TURNPASSWORD"),
            },
        ]
    }