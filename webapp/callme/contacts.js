Telegram.WebApp.expand();
const tg = Telegram.WebApp;

// ─── Load current user & contacts from CallMe API ───
fetch("/api/callme/users")
.then(r => r.json())
.then(users => {
    const meUser = users.find(u => u.id === tg.initDataUnsafe.user.id);

    if (meUser) {
        // Верхний блок — текущий пользователь
        document.getElementById("me-name").innerText = meUser.name || "Пользователь";
        document.getElementById("me-id").innerText = meUser.id;
        document.getElementById("me-avatar").src = meUser.avatar || "https://via.placeholder.com/80/333333/ffffff?text=?";
    } else {
        // Fallback
        document.getElementById("me-name").innerText = tg.initDataUnsafe.user.first_name || "Пользователь";
        document.getElementById("me-id").innerText = tg.initDataUnsafe.user.id;
        document.getElementById("me-avatar").src = tg.initDataUnsafe.user.photo_url || "https://via.placeholder.com/80/333333/ffffff?text=?";
    }

    const list = document.getElementById("list");

    users
        .filter(u => u.id !== tg.initDataUnsafe.user.id)
        .forEach((u, i) => {
            const el = document.createElement("div");
            el.className = "card p-2 d-flex flex-column align-items-center gap-2";

            const avatar = u.avatar || "https://via.placeholder.com/70/333333/ffffff?text=?";
            el.innerHTML = `
                <img src="${avatar}" class="rounded-circle" width="70" height="70">
                <div class="name fw-semibold">${u.name}</div>
                <div>TGID: ${u.id}</div>
                <button class="call btn btn-success btn-sm mt-2">
                    <i class="fa-solid fa-phone"></i> Позвонить
                </button>
            `;

            el.querySelector("button").onclick = async () => {
                const resp = await fetch("/api/callme/call", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        user_id: tg.initDataUnsafe.user.id,
                        tg_id: u.id
                    })
                });

                const result = await resp.json();
                if (result.ok) {
                    tg.showAlert("✅ Запрос на звонок отправлен");
                    tg.close();
                } else {
                    tg.showAlert("❌ Ошибка: " + result.error);
                }
            };

            list.appendChild(el);
            setTimeout(() => el.classList.add("show"), i * 100);
        });
});