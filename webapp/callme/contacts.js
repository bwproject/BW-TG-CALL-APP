Telegram.WebApp.expand();
const tg = Telegram.WebApp;
const meId = tg.initDataUnsafe.user.id;

/* ─── Load all users from API ─── */
fetch("/api/callme/users")
.then(r => r.json())
.then(users => {
    const meUser = users.find(u => u.id === meId);

    // Верхний блок "Я"
    if (meUser) {
        document.getElementById("me-name").innerText = meUser.name || "Пользователь";
        document.getElementById("me-id").innerText = meUser.id;
        document.getElementById("me-avatar").src = meUser.avatar || "https://via.placeholder.com/80/333333/ffffff?text=?";
    }

    // Контакты
    const list = document.getElementById("list");
    users
        .filter(u => u.id !== meId)
        .forEach((u, i) => {
            const el = document.createElement("div");
            el.className = "card p-2 d-flex flex-column align-items-center gap-2";

            const avatar = u.avatar || "https://via.placeholder.com/70/333333/ffffff?text=?";
            el.innerHTML = `
                <img src="${avatar}" class="rounded-circle" width="70" height="70">
                <div class="name fw-semibold">${u.name}</div>
                <div class="text-white small">TGID: ${u.id}</div>
                <button class="call btn btn-success btn-sm mt-2">
                    <i class="fa-solid fa-phone"></i> Позвонить
                </button>
            `;

            const btn = el.querySelector("button");
            btn.onclick = async () => {
                try {
                    await tg.sendData(`/callme ${u.id}`);
                    tg.close();
                } catch (err) {
                    console.error("Ошибка при отправке данных в бот:", err);
                }
            };

            list.appendChild(el);

            // Анимация появления
            setTimeout(() => el.classList.add("show"), i * 100);
        });
});