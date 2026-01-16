Telegram.WebApp.expand();
const tg = Telegram.WebApp;

async function fetchUsers() {
    const res = await fetch("/api/callme/users");
    return await res.json();
}

async function init() {
    const users = await fetchUsers();
    const meData = users[0]; // текущий пользователь берём первый или по tg.initDataUnsafe.user.id

    // Верхний блок
    document.getElementById("me-name").textContent = meData.name;
    document.getElementById("me-id").textContent = meData.id;
    document.getElementById("me-avatar").src = meData.avatar || "https://via.placeholder.com/80/333333/ffffff?text=?";

    // Список контактов
    const list = document.getElementById("list");
    list.innerHTML = "";

    users.forEach(u => {
        if (u.id === meData.id) return;

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

        el.querySelector("button").onclick = async () => {
            try {
                await fetch("/api/callme/call", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: meData.id, tg_id: u.id })
                });
                alert("✅ Запрос на звонок отправлен");
            } catch (err) {
                alert("❌ Не удалось отправить звонок");
                console.error(err);
            }
        };

        list.appendChild(el);
    });
}

init();