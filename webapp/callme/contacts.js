Telegram.WebApp.expand();

fetch("/api/callme/users")
.then(r => r.json())
.then(users => {
    const list = document.getElementById("list");
    users.forEach(u => {
        const el = document.createElement("div");
        el.className = "card";
        el.innerHTML = `
            <img src="${u.avatar || ''}" onerror="this.style.display='none'">
            <div class="name">${u.name}</div>
            <button class="call">📞 Позвонить</button>
        `;
        el.querySelector(".call").onclick = () => {
            Telegram.WebApp.close();
            Telegram.WebApp.sendData(
                JSON.stringify({ action:"call", user_id:u.id })
            );
        };
        list.appendChild(el);
    });
});
