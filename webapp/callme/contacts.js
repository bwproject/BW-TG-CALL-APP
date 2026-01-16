/* ─────────────────────────────────────────────
   CallMe Contacts WebApp
   Логика: при нажатии "Позвонить"
   → копирует команду /callme TGID
   → открывает чат с ботом
   → закрывает WebApp
   ───────────────────────────────────────────── */

const tg = Telegram.WebApp;
tg.expand();

// ─── Получаем имя бота из API ─────────────────
async function getBotUsername() {
    const res = await fetch("/api/callme/botusername");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!data.bot_username) throw new Error("BOT_USERNAME не найден в API");
    return data.bot_username;
}

// ─── Функция инициализации списка контактов ─────────────────────
async function initContacts(BOT_USERNAME) {
    const meData = tg.initDataUnsafe?.user;
    console.log("⚡ WebApp init, user:", meData);

    if (!meData) {
        alert("❌ WebApp запущен вне Telegram");
        return;
    }

    document.getElementById("me-name").innerText = meData.first_name || "Пользователь";
    document.getElementById("me-id").innerText = meData.id;
    document.getElementById("me-avatar").src = "https://via.placeholder.com/80/333333/ffffff?text=?";

    try {
        const res = await fetch("/api/callme/users");
        const users = await res.json();
        console.log("📇 CallMe users:", users);

        const list = document.getElementById("list");

        const me = users.find(u => u.id === meData.id);
        if (me?.avatar) document.getElementById("me-avatar").src = me.avatar;

        users.filter(u => u.id !== meData.id).forEach((u, i) => {
            const el = document.createElement("div");
            el.className = "card p-2 d-flex flex-column align-items-center gap-2";

            const avatar = u.avatar || "https://via.placeholder.com/70/333333/ffffff?text=?";
            el.innerHTML = `
                <img src="${avatar}" class="rounded-circle" width="70" height="70">
                <div class="name fw-semibold">${u.name}</div>
                <div class="text-white small">TGID: ${u.id}</div>
                <button class="btn btn-success btn-sm mt-2 call">
                    <i class="fa-solid fa-phone"></i> Позвонить
                </button>
            `;

            el.querySelector(".call").onclick = () => {
                const cmd = `/callme ${u.id}`;

                navigator.clipboard.writeText(cmd).then(() => {
                    alert(`✅ Команда скопирована!\n\nНажмите "OK", чтобы открыть чат с ботом @${BOT_USERNAME}`);
                    window.open(`https://t.me/${BOT_USERNAME}`, "_blank");
                    tg.close();
                }).catch(err => {
                    console.error("❌ Ошибка копирования команды:", err);
                    alert("❌ Не удалось скопировать команду");
                });
            };

            list.appendChild(el);
            setTimeout(() => el.classList.add("show"), i * 80);
        });
    } catch (err) {
        console.error("❌ Ошибка загрузки контактов:", err);
        alert("Не удалось загрузить список контактов");
    }
}

// ─── Основной запуск ─────────────────────────
(async () => {
    try {
        const BOT_USERNAME = await getBotUsername();
        console.log("📌 Используемый бот:", BOT_USERNAME);
        await initContacts(BOT_USERNAME);
    } catch (err) {
        console.error("❌ Ошибка при инициализации WebApp:", err);
        alert("❌ Не удалось получить имя бота из API");
    }
})();