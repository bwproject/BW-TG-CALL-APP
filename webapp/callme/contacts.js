Telegram.WebApp.expand();

const tg = Telegram.WebApp;
const me = tg.initDataUnsafe.user;

/* ─── Render current user ─── */
document.getElementById("me-name").innerText = me.first_name || "Пользователь";
document.getElementById("me-id").innerText = me.id;

if (me.photo_url) {
    document.getElementById("me-avatar").src = me.photo_url;
} else {
    document.getElementById("me-avatar").style.display = "none";
}

/* ─── Load contacts ─── */
fetch("/api/callme/users")
.then(r => r.json())
.then(users => {
    const list = document.getElementById("list");

    users
        .filter(u => u.id !== me.id)
        .forEach(u => {
            const el = document.createElement("div");
            el.className = "card p-2 d-flex flex-row align-items-center gap-2";

            el.innerHTML = `
                <img src="${u.avatar || ''}" class="rounded-circle" width="48" height="48"
                     onerror="this.style.display='none'">

                <div class="flex-grow-1">
                    <div class="fw-semibold">${u.name}</div>
                    <div class="text-muted small">TGID: ${u.id}</div>
                </div>

                <button class="btn btn-success btn-sm">
                    <i class="fa-solid fa-phone"></i>
                </button>
            `;

            el.querySelector("button").onclick = () => {
                tg.sendData(`/callme ${u.id}`);
                tg.close();
            };

            list.appendChild(el);
        });
});