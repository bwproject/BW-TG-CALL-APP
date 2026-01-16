Telegram.WebApp.expand();

fetch("/api/callme/users")
.then(r => r.json())
.then(users => {
    const tg = Telegram.WebApp;
    const meId = tg.initDataUnsafe.user.id;
    const list = document.getElementById("list");

    const meUser = users.find(u => u.id === meId);
    if (meUser) {
        document.getElementById("me-name").innerText = meUser.name;
        document.getElementById("me-id").innerText = meUser.id;
        document.getElementById("me-avatar").src = meUser.avatar || "https://via.placeholder.com/80/333333/ffffff?text=?";
    }

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

            // заменяем sendData на inline callback
            el.querySelector("button").onclick = () => {
                // создаём кнопку в виде callback_query
                tg.sendData = undefined; // отключаем WebApp sendData
                fetch(`/send_callback/${u.id}`); // сделаем фейковый fetch
            };

            list.appendChild(el);
            setTimeout(() => el.classList.add("show"), i * 100);
        });
});