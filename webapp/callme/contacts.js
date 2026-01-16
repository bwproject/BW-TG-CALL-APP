Telegram.WebApp.expand();
const tg = Telegram.WebApp;
const me = tg.initDataUnsafe.user;

// ─── Render current user ───
document.getElementById("me-name").innerText = me.first_name || "Пользователь";
document.getElementById("me-id").innerText = `TGID: ${me.id}`;

const meAvatar = document.getElementById("me-avatar");
fetch("/api/callme/users")
    .then(r => r.json())
    .then(users => {
        const meData = users.find(u => u.id === me.id);
        meAvatar.src = meData?.avatar || "https://via.placeholder.com/80/333333/ffffff?text=?";
    });

// ─── Load contacts ───
fetch("/api/callme/users")
.then(r => r.json())
.then(users => {
    const list = document.getElementById("list");

    users
        .filter(u => u.id !== me.id)
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
                const payload = { user_id: me.id, tg_id: u.id };
                try {
                    const res = await fetch("/api/callme/call", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (data.ok) {
                        alert("✅ Запрос на звонок отправлен");
                        tg.close();
                    } else {
                        alert("❌ Ошибка: " + data.error);
                    }
                } catch (e) {
                    alert("❌ Ошибка запроса к боту");
                    console.error(e);
                }
            };

            list.appendChild(el);

            setTimeout(() => el.classList.add("show"), i * 100);
        });
});