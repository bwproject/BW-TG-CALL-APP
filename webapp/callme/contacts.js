const API_URL = "/api/callme/users";
const CALL_API = "/api/callme/call";

async function fetchUsers() {
    const res = await fetch(API_URL);
    const users = await res.json();
    return users;
}

function renderCurrentUser(user) {
    document.getElementById("current-name").textContent = user.name;
    document.getElementById("current-tgid").textContent = "TGID: " + user.id;
    document.getElementById("current-avatar").src = user.avatar || "/callme/avatar/default.jpg";
}

function renderContacts(users, currentUserId) {
    const container = document.getElementById("contacts");
    container.innerHTML = "";

    users.forEach(user => {
        if (user.id === currentUserId) return;

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
            await fetch(CALL_API, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    user_id: currentUserId,
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

async function init() {
    const users = await fetchUsers();
    const currentUser = users[users.length - 1]; // считаем последним вошедшим
    renderCurrentUser(currentUser);
    renderContacts(users, currentUser.id);
}

init();