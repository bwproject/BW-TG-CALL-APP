Telegram.WebApp.expand();
const tg = Telegram.WebApp;
const meId = tg.initDataUnsafe.user.id; // текущий пользователь по tgID

/* ─── Load all users from API ─── */
fetch("/api/callme/users")
.then(r => r.json())
.then(users => {
    // Найти текущего пользователя
    const meUser = users.find(u => u.id === meId);

    // Заполнить верхний блок "Я"
    if (meUser) {
        document.getElementById("me-name").innerText = meUser.name || "Пользователь";
        document.getElementById("me-id").innerText = meUser.id;
        document.getElementById("me-avatar").src = meUser.avatar || "https://via.placeholder.com/80/333333/ffffff?text=?";
    }

    // Рендер остальных контактов
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

            el.querySelector("button").onclick = () => {
                tg.sendData(`/callme ${u.id}`);
                tg.close();
            };

            list.appendChild(el);

            // Анимация появления
            setTimeout(() => el.classList.add("show"), i * 100);
        });
});