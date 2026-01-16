const tg = Telegram.WebApp;
tg.expand();

let meData = tg.initDataUnsafe.user;
console.log("⚡ Инициализация WebApp, текущий пользователь:", meData);

// Отображаем текущего пользователя
document.getElementById("me-name").innerText = meData.first_name || "Пользователь";
document.getElementById("me-id").innerText = meData.id;
document.getElementById("me-avatar").src = "https://via.placeholder.com/80/333333/ffffff?text=?";

// Получаем всех пользователей из API
fetch("/api/callme/users")
    .then(r => r.json())
    .then(users => {
        console.log("📇 Загружены пользователи:", users);
        const list = document.getElementById("list");

        // Найдём текущего пользователя из файла
        const me = users.find(u => u.id === meData.id);
        if (me && me.avatar) {
            document.getElementById("me-avatar").src = me.avatar;
        }

        // Отображаем остальных пользователей
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
                    console.log(`📨 Отправка запроса на звонок ${meData.id} -> ${u.id}`);
                    fetch("/api/callme/call", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: meData.id, tg_id: u.id })
                    })
                    .then(r => r.json())
                    .then(resp => {
                        console.log("Ответ API звонка:", resp);
                        if (resp.ok) {
                            const callId = `${meData.id}_${u.id}`;
                            console.log("🌐 Подключение к WebSocket:", callId);
                            const ws = new WebSocket(`wss://${location.host}/api/callme/ws/${callId}`);

                            ws.onmessage = msg => {
                                const data = JSON.parse(msg.data);
                                console.log("Получено через WS:", data);

                                if (data.type === "call_url") {
                                    window.open(data.url, "_blank");
                                } else if (data.type === "call_denied") {
                                    alert("❌ Пользователь отклонил звонок");
                                }
                            };

                            alert("✅ Запрос на звонок отправлен");
                        } else {
                            alert(`❌ Ошибка при отправке запроса: ${resp.error || "Неизвестная ошибка"}`);
                        }
                    })
                    .catch(err => {
                        console.error("❌ Ошибка при POST /call:", err);
                        alert("❌ Ошибка при отправке запроса на сервер");
                    });
                };

                list.appendChild(el);
                setTimeout(() => el.classList.add("show"), i * 100);
            });
    })
    .catch(err => {
        console.error("❌ Ошибка при загрузке пользователей:", err);
    });