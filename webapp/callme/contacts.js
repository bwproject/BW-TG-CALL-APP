const tg = Telegram.WebApp;

// Ждём полной инициализации Telegram WebApp
tg.ready();
tg.expand();

// Рендер текущего пользователя в верхнем блоке
function renderCurrentUser(me) {
    const meName = me.first_name || "Пользователь";
    const meId = me.id || 0;
    const meAvatar = me.photo_url || "https://via.placeholder.com/80/333333/ffffff?text=?";

    document.getElementById("me-name").innerText = meName;
    document.getElementById("me-id").innerText = meId;
    document.getElementById("me-avatar").src = meAvatar;
}

// Загружаем контакты с сервера
async function loadContacts() {
    const res = await fetch("/api/callme/users");
    const users = await res.json();
    const meId = tg.initDataUnsafe?.user?.id;

    // Рендерим верхний контейнер
    const meUser = users.find(u => u.id === meId);
    if (meUser) {
        renderCurrentUser(meUser);
    } else if (tg.initDataUnsafe?.user) {
        renderCurrentUser(tg.initDataUnsafe.user);
    }

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

            setTimeout(() => el.classList.add("show"), i * 100);
        });
}

// Запускаем
loadContacts();