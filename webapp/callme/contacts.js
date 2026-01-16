const tg = Telegram.WebApp;
tg.expand();

console.log("🔹 Telegram WebApp initialized");

let meData = tg.initDataUnsafe.user;
console.log("🆔 Current user:", meData);

// Отображаем текущего пользователя
document.getElementById("me-name").innerText = meData.first_name || "Пользователь";
document.getElementById("me-id").innerText = meData.id;
document.getElementById("me-avatar").src = "https://via.placeholder.com/80/333333/ffffff?text=?";

// Получаем список пользователей
fetch("/api/callme/users")
.then(r => r.json())
.then(users => {
    console.log("📋 Users loaded:", users);

    const list = document.getElementById("list");

    // Найдём текущего пользователя из файла
    const me = users.find(u => u.id === meData.id);
    if(me && me.avatar) {
        document.getElementById("me-avatar").src = me.avatar;
        console.log("✅ Avatar loaded for current user");
    }

    users
        .filter(u => u.id !== meData.id)
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
                console.log(`📞 Sending call request from ${meData.id} to ${u.id}`);
                fetch("/api/callme/call", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: meData.id, tg_id: u.id })
                })
                .then(r => r.json())
                .then(resp => {
                    console.log("📤 Call API response:", resp);

                    if(resp.ok) {
                        const callId = `${meData.id}_${u.id}`;
                        console.log("🔌 Opening WebSocket:", callId);

                        const ws = new WebSocket(`wss://${location.host}/api/callme/ws/${callId}`);

                        ws.onopen = () => console.log("✅ WebSocket connected");
                        ws.onclose = () => console.log("⚠ WebSocket closed");
                        ws.onerror = e => console.error("❌ WebSocket error:", e);

                        ws.onmessage = msg => {
                            const data = JSON.parse(msg.data);
                            console.log("📨 WebSocket message:", data);

                            if(data.type === "call_url") {
                                console.log("🌐 Opening call URL:", data.url);
                                window.open(data.url);
                            } else if(data.type === "call_denied") {
                                console.warn("❌ Call denied by user");
                                alert("Пользователь отклонил звонок");
                            } else if(data.type === "peer-info") {
                                console.log("ℹ Peer info received:", data.user);
                            }
                        };

                        alert("✅ Запрос на звонок отправлен");
                    } else {
                        console.error("❌ Call request failed:", resp.error);
                        alert("❌ Ошибка при отправке запроса: " + (resp.error || "неизвестная"));
                    }
                })
                .catch(err => {
                    console.error("❌ Fetch error:", err);
                    alert("❌ Ошибка при отправке запроса");
                });
            };

            list.appendChild(el);
            setTimeout(() => el.classList.add("show"), i*100);
        });
})
.catch(err => {
    console.error("❌ Failed to load users:", err);
});