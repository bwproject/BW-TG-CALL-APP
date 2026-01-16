const tg = Telegram.WebApp;
tg.expand();

// ─── Load all users from bot API ───
fetch("/api/callme/users")
.then(r => r.json())
.then(users => {
    const list = document.getElementById("list");
    const meId = tg.initDataUnsafe?.user?.id || 0;

    // ─── Find current user in the list ───
    const meUser = users.find(u => u.id === meId);

    // Render current user
    if (meUser) {
        document.getElementById("me-name").innerText = meUser.name;
        document.getElementById("me-id").innerText = meUser.id;
        const meAvatar = document.getElementById("me-avatar");
        meAvatar.src = meUser.avatar || "https://via.placeholder.com/80/333333/ffffff?text=?";
    } else {
        // fallback если нет в базе
        document.getElementById("me-name").innerText = "Пользователь";
        document.getElementById("me-id").innerText = meId;
        document.getElementById("me-avatar").src = "https://via.placeholder.com/80/333333/ffffff?text=?";
    }

    // ─── Render other contacts ───
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
                // Отправляем команду /callme TGID боту
                tg.sendData(`/callme ${u.id}`);
                tg.close();
            };

            list.appendChild(el);

            // Анимация появления с задержкой
            setTimeout(() => el.classList.add("show"), i * 100);
        });
});