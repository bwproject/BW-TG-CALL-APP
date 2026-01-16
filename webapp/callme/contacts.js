Telegram.WebApp.expand();

const tg = Telegram.WebApp;
const me = tg.initDataUnsafe.user;

/* ─── Render current user ─── */
document.getElementById("me-name").innerText = me.first_name || "Пользователь";
document.getElementById("me-id").innerText = me.id;

const meAvatar = document.getElementById("me-avatar");
if (me.photo_url) {
    meAvatar.src = me.photo_url;
} else {
    meAvatar.src = "https://via.placeholder.com/80/333333/ffffff?text=?"; // fallback
}

/* ─── Load contacts ─── */
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

            el.querySelector("button").onclick = () => {
                tg.sendData(`/callme ${u.id}`);
                tg.close();
            };

            list.appendChild(el);

            // Анимация появления с задержкой
            setTimeout(() => el.classList.add("show"), i * 100);
        });
});