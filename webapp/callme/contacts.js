/* ─────────────────────────────────────────────
   CallMe Contacts WebApp
   Логика: при нажатии "Позвонить"
   → команда копируется в буфер
   → показывается подсказка
   → после нажатия "ОК" открывается чат с ботом
───────────────────────────────────────────── */

const tg = Telegram.WebApp;
tg.expand();

const BOT_USERNAME = "ProjectBWDL_bot"; // ❗ БЕЗ @

/* ─── Текущий пользователь ───────────────── */
const meData = tg.initDataUnsafe?.user;
console.log("⚡ WebApp init, user:", meData);

if (!meData) {
    alert("❌ WebApp запущен вне Telegram");
}

/* ─── Отображение текущего пользователя ───── */
document.getElementById("me-name").innerText =
    meData.first_name || "Пользователь";

document.getElementById("me-id").innerText = meData.id;

document.getElementById("me-avatar").src =
    "https://via.placeholder.com/80/333333/ffffff?text=?";

/* ─── Загрузка контактов ─────────────────── */
fetch("/api/callme/users")
    .then(r => r.json())
    .then(users => {
        console.log("📇 CallMe users:", users);

        const list = document.getElementById("list");

        // ── Аватар текущего пользователя ──
        const me = users.find(u => u.id === meData.id);
        if (me?.avatar) {
            document.getElementById("me-avatar").src = me.avatar;
        }

        // ── Остальные пользователи ──
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
                el.querySelector(".call").onclick = async () => {
                    const cmd = `/callme ${u.id}`;
                    console.log("📞 Копируем команду:", cmd);

                    try {
                        // 1️⃣ Копируем команду в буфер
                        await navigator.clipboard.writeText(cmd);

                        // 2️⃣ Показываем подсказку
                        alert(`✅ Команда скопирована!\n\nНажмите "ОК", чтобы открыть чат с ботом @${BOT_USERNAME}`);

                        // 3️⃣ После нажатия ОК открываем чат
                        tg.openTelegramLink(`https://t.me/${BOT_USERNAME}`);
                    } catch (err) {
                        console.error("❌ Не удалось скопировать команду:", err);
                        alert(
                            `❌ Не удалось скопировать команду.\nСкопируйте вручную: ${cmd}\n\nНажмите "ОК", чтобы открыть чат с ботом @${BOT_USERNAME}`
                        );
                        tg.openTelegramLink(`https://t.me/${BOT_USERNAME}`);
                    }
                };

                list.appendChild(el);

                // простая анимация
                setTimeout(() => el.classList.add("show"), i * 80);
            });
    })
    .catch(err => {
        console.error("❌ Ошибка загрузки контактов:", err);
        alert("Не удалось загрузить список контактов");
    });
