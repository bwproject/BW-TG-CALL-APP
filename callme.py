# callme.py

import os
import time
import json
import hashlib
import logging
import aiohttp
from typing import Dict, List, Optional

from aiogram import Router, types
from aiogram.filters import Command
from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    CallbackQuery
)
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

# ─── Paths ──────────────────────────────
CALLME_JSON = "webapp/callme/callme.json"
AVATAR_DIR = "webapp/callme/avatar"

os.makedirs(AVATAR_DIR, exist_ok=True)

# ─── Routers ─────────────────────────────
callme_router = Router()
callme_api_router = APIRouter()

# ─── Хранилища ──────────────────────────
pending_calls: Dict[int, int] = {}
active_ws: Dict[str, List[WebSocket]] = {}

# ─── Utils ──────────────────────────────
def generate_call_id(tg1: int, tg2: int) -> str:
    raw = f"{tg1}:{tg2}:{time.time()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def make_webapp_kb(call_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(
                text="📞 Открыть звонок",
                web_app=WebAppInfo(url=call_url)
            )
        ]]
    )


def incoming_call_kb(from_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(text="✅ Принять", callback_data=f"callme_accept:{from_id}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"callme_deny:{from_id}")
        ]]
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


# ─── Avatar ─────────────────────────────
async def download_avatar(bot, user_id: int) -> Optional[str]:
    photos = await bot.get_user_profile_photos(user_id, limit=1)
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

    # путь, доступный WebApp
    return f"/callme/avatar/{user_id}.jpg"


async def save_callme_user(message: types.Message):
    users = load_callme_users()
    user = message.from_user

    avatar = await download_avatar(message.bot, user.id)

    users[str(user.id)] = {
        "id": user.id,
        "name": user.first_name,
        "username": user.username,
        "avatar": avatar,
        "updated_at": int(time.time())
    }

    save_callme_users(users)


# ─── /callmeinfo ─────────────────────────
@callme_router.message(Command("callmeinfo"))
async def callmeinfo_cmd(message: types.Message):
    await message.answer(
        "📞 <b>CallMe</b>\n\n"
        "Это встроенные видеозвонки через Telegram WebApp.\n\n"
        "🔹 Видео и аудио через WebRTC\n"
        "🔹 Работает на iOS и Android\n"
        "🔹 Камера и микрофон — только по кнопке\n"
        "🔹 Громкая связь зависит от ОС\n\n"
        "Чтобы позвонить:\n"
        "<code>/callme TGID</code>"
    )


# ─── /callme ─────────────────────────────
@callme_router.message(Command("callme"))
async def callme_cmd(message: types.Message):
    # сохраняем пользователя и аватар
    await save_callme_user(message)

    args = message.text.split()
    if len(args) == 1:
        await message.answer(
            f"Привет, {message.from_user.first_name} 👋\n\n"
            f"📞 <b>CallMe — видеозвонки</b>\n\n"
            f"Твой TGID:\n<code>{message.from_user.id}</code>\n\n"
            f"Чтобы позвонить:\n"
            f"<code>/callme TGID</code>\n\n"
            f"ℹ️ Подробнее:\n"
            f"<code>/callmeinfo</code>"
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

    pending_calls[target_id] = message.from_user.id

    await message.bot.send_message(
        target_id,
        f"📞 <b>Входящий звонок</b>\n\n"
        f"От: {message.from_user.first_name}\n"
        f"TGID: <code>{message.from_user.id}</code>",
        reply_markup=incoming_call_kb(message.from_user.id)
    )

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

    call_url = f"https://webapp.projectbw.ru/callme/index.html?{from_id}_{to_id}_{call_id}"
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
    logger.info(f"🌐 WS соединение открыто: call_id={call_id}")

    try:
        while True:
            data = await ws.receive_text()
            for client in active_ws[call_id]:
                if client != ws:
                    await client.send_text(data)
    except WebSocketDisconnect:
        active_ws[call_id].remove(ws)
        logger.info(f"❌ WS соединение закрыто call_id={call_id}")


# ─── TURN/STUN endpoint ──────────────────
@callme_api_router.get("/turn")
async def get_turn_config():
    return {
        "iceServers": [
            {"urls": f"stun:{os.getenv('TURNIP')}"},
            {"urls": "stun:stun.l.google.com:19302"},
            {
                "urls": f"turn:{os.getenv('TURNIP')}",
                "username": os.getenv("TURNLOGIN"),
                "credential": os.getenv("TURNPASSWORD")
            }
        ]
    }