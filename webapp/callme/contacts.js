/* ─────────────────────────────────────────────
   CallMe Contacts WebApp
   Логика: при нажатии "Позвонить"
   → открывается чат с ботом
   → вставляется команда /callme TGID
   ───────────────────────────────────────────── */

const tg = Telegram.WebApp;
tg.expand();

const BOT_USERNAME = "ProjectBWDL_bot"; // ❗ БЕЗ @

/* ─── Текущий пользователь ───────────────── */
const meData = tg.initDataUnsafe?.user;
console.log("⚡ WebApp init, user:", meData);

if (!meData) {
    alert("❌ WebApp запущен вне Telegram");
    throw new Error("WebApp запущен вне Telegram");
}

/* ─── Отображение текущего пользователя ───── */
document.getElementById("me-name").innerText =
    meData.first_name || "Пользователь";

document.getElementById("me-id").innerText = meData.id;

document.getElementById("me-avatar").src =
    "https://via.placeholder.com/80/333333/ffffff?text=?";

/* ─── Загрузка контактов ─────────────────── */
fetch("/api/callme/users")
    .then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
    })
    .then(users => {
        console.log("📇 CallMe users:", users);

        const list = document.getElementById("list");

        /* ── Аватар текущего пользователя ── */
        const me = users.find(u => u.id === meData.id);
        if (me?.avatar) {
            document.getElementById("me-avatar").src = me.avatar;
        }

        /* ── Остальные пользователи ── */
        users
            .filter(u => u.id !== meData.id)
            .forEach((u, i) => {
                const el = document.createElement("div");
                el.className = "card p-2 d-flex flex-column align-items-center gap-2";

                const avatar =
                    u.avatar ||
                    "https://via.placeholder.com/70/333333/ffffff?text=?";

                el.innerHTML = `
                    <img src="${avatar}" class="rounded-circle" width="70" height="70">
                    <div class="name fw-semibold">${u.name}</div>
                    <div class="text-white small">TGID: ${u.id}</div>

                    <button class="btn btn-success btn-sm mt-2 call">
                        <i class="fa-solid fa-phone"></i> Позвонить
                    </button>
                `;

                /* ─── КНОПКА ЗВОНКА ───────────── */
                el.querySelector(".call").onclick = () => {
                    const cmd = `/callme ${u.id}`;
                    console.log("📞 Открываем бот с командой:", cmd);

                    // Открыть чат с ботом и вставить команду
                    tg.openTelegramLink(
                        `https://t.me/${BOT_USERNAME}?text=${encodeURIComponent(cmd)}`
                    );

                    // Закрыть WebApp через 600ms, чтобы чат успел открыться
                    setTimeout(() => tg.close(), 1600);
                };

                list.appendChild(el);

                // Простая анимация появления
                setTimeout(() => el.classList.add("show"), i * 80);
            });
    })
    .catch(err => {
        console.error("❌ Ошибка загрузки контактов:", err);
        alert("Не удалось загрузить список контактов");
    });