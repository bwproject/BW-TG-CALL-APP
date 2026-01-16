const tg = Telegram.WebApp;
tg.expand();

let BOT_USERNAME = "ProjectBWDL_bot"; // запасной вариант

// Получаем имя бота из API
fetch("/api/callme/botusername")
    .then(r => r.json())
    .then(data => {
        if (data.bot_username) BOT_USERNAME = data.bot_username;
        console.log("📌 Используемый бот:", BOT_USERNAME);
        initContacts(); // вызываем функцию, которая строит список контактов
    })
    .catch(err => {
        console.error("❌ Не удалось получить BOT_USERNAME:", err);
        initContacts();
    });

// ─── Функция инициализации списка контактов ─────────────────────
function initContacts() {
    const meData = tg.initDataUnsafe?.user;
    console.log("⚡ WebApp init, user:", meData);

    if (!meData) {
        alert("❌ WebApp запущен вне Telegram");
        return;
    }

    document.getElementById("me-name").innerText = meData.first_name || "Пользователь";
    document.getElementById("me-id").innerText = meData.id;
    document.getElementById("me-avatar").src = "https://via.placeholder.com/80/333333/ffffff?text=?";

    fetch("/api/callme/users")
        .then(r => r.json())
        .then(users => {
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
        })
        .catch(err => {
            console.error("❌ Ошибка загрузки контактов:", err);
            alert("Не удалось загрузить список контактов");
        });
}