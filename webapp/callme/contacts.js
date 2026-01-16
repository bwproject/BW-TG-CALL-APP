Telegram.WebApp.expand();
const tg = Telegram.WebApp;
const meId = tg.initDataUnsafe.user.id;

async function fetchUsers() {
    const res = await fetch("/api/callme/users");
    const data = await res.json();
    // Преобразуем объект в массив
    return Object.values(data);
}

async function init() {
    const users = await fetchUsers();

    // Найдём текущего пользователя
    const meData = users.find(u => u.id === meId);
    if (!meData) {
        console.error("❌ Текущий пользователь не найден в callme.json");
        return;
    }

    // Верхний блок
    document.getElementById("me-name").textContent = meData.name;
    document.getElementById("me-id").textContent = meData.id;
    document.getElementById("me-avatar").src = meData.avatar || "https://via.placeholder.com/80/333333/ffffff?text=?";

    // Список контактов (кроме текущего пользователя)
    const list = document.getElementById("list");
    list.innerHTML = "";

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

            el.querySelector("button").onclick = async () => {
                try {
                    await fetch("/api/callme/call", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: meId, tg_id: u.id })
                    });
                    alert("✅ Запрос на звонок отправлен");
                } catch (err) {
                    alert("❌ Не удалось отправить звонок");
                    console.error(err);
                }
            };

            // Анимация появления с задержкой
            setTimeout(() => el.classList.add("show"), i * 100);

            list.appendChild(el);
        });
}

init();