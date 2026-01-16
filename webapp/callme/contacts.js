const tg = Telegram.WebApp;
tg.expand();

// Текущий пользователь из Telegram WebApp
const meTG = tg.initDataUnsafe?.user;
const meId = meTG?.id || 0;
const meName = meTG?.first_name || "Пользователь";
const meAvatarUrl = meTG?.photo_url || "https://via.placeholder.com/80/333333/ffffff?text=?";

// Рендерим верхний контейнер с текущим пользователем
document.getElementById("me-name").innerText = meName;
document.getElementById("me-id").innerText = meId;
document.getElementById("me-avatar").src = meAvatarUrl;

// ─── Load contacts from bot API ───
fetch("/api/callme/users")
.then(r => r.json())
.then(users => {
    const list = document.getElementById("list");

    users
        .filter(u => u.id !== meId) // исключаем себя
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

            // Кнопка позвонить
            el.querySelector("button").onclick = () => {
                tg.sendData(`/callme ${u.id}`);
                tg.close();
            };

            list.appendChild(el);

            // Анимация появления с задержкой
            setTimeout(() => el.classList.add("show"), i * 100);
        });
});