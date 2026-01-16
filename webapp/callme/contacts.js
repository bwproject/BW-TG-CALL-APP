const API_USERS = "/api/callme/users";
const API_CALL = "/api/callme/call";

let currentUser = null;

// Получаем текущего пользователя через Telegram WebApp
function initWebApp() {
    if (window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        currentUser = {
            id: tg.initDataUnsafe.user.id,
            name: tg.initDataUnsafe.user.first_name || "Пользователь",
            avatar: tg.initDataUnsafe.user.photo_url || "/callme/avatar/default.jpg",
        };
        renderCurrentUser(currentUser);
    } else {
        console.warn("⚠ Telegram WebApp API недоступно");
        currentUser = {id: 0, name: "Гость", avatar: "/callme/avatar/default.jpg"};
        renderCurrentUser(currentUser);
    }
}

// Отрисовка верхнего блока "Я"
function renderCurrentUser(user) {
    document.getElementById("current-name").textContent = user.name;
    document.getElementById("current-tgid").textContent = "TGID: " + user.id;
    document.getElementById("current-avatar").src = user.avatar;
}

// Получение всех пользователей
async function fetchUsers() {
    const res = await fetch(API_USERS);
    const users = await res.json();
    return users;
}

// Отрисовка списка контактов
function renderContacts(users, currentId) {
    const container = document.getElementById("contacts");
    container.innerHTML = "";

    users.forEach(user => {
        if (user.id === currentId) return;

        const div = document.createElement("div");
        div.className = "contact";

        const img = document.createElement("img");
        img.src = user.avatar || "/callme/avatar/default.jpg";
        div.appendChild(img);

        const info = document.createElement("div");
        info.innerHTML = `<div>${user.name}</div><div>TGID: ${user.id}</div>`;
        div.appendChild(info);

        const btn = document.createElement("button");
        btn.textContent = "📞 Позвонить";
        btn.onclick = async () => {
            await fetch(API_CALL, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    user_id: currentId,
                    tg_id: user.id
                })
            });
            btn.textContent = "✅ Запрос отправлен";
            btn.disabled = true;
        };
        div.appendChild(btn);

        container.appendChild(div);
    });
}

// Инициализация страницы
async function init() {
    initWebApp();
    const users = await fetchUsers();
    renderContacts(users, currentUser.id);
}

init();