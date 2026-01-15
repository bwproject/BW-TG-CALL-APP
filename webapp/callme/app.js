// app.js

// ================== ELEMENTS ==================
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const startBtn = document.getElementById("startBtn");
const endBtn = document.getElementById("endBtn");

const toggleVideoBtn = document.getElementById("toggleVideoBtn");
const muteMicBtn = document.getElementById("muteMicBtn");
const switchCameraBtn = document.getElementById("switchCameraBtn");

const speakerBtn = document.getElementById("speakerBtn");
const speakerMenu = document.getElementById("speakerMenu");

const statusTextEl = document.getElementById("statusText");
const callHeader = document.getElementById("callHeader");

const preCallOverlay = document.getElementById("preCallOverlay");
const controls = document.getElementById("controls");

const attentionBtn = document.getElementById("attentionBtn");
const attentionModal = document.getElementById("attentionModal");
const closeAttentionBtn = document.getElementById("closeAttentionBtn");

const localAvatar = document.getElementById("avatar");
const remoteAvatar = document.getElementById("remoteAvatar");

// ================== STATE ==================
let pc = null;
let localStream = null;
let remoteStream = null;

let videoEnabled = true;
let audioEnabled = true;
let currentFacingMode = "user";
let statusTimeout = null;
let rtcConfig = null;

// ================== TELEGRAM ==================
if (window.Telegram?.WebApp) Telegram.WebApp.expand();
const tgUser = Telegram.WebApp?.initDataUnsafe?.user;

// ================== HELPERS ==================
async function loadUserInfo(tgid) {
    try {
        const res = await fetch(`/api/callme/user/${tgid}`);
        if (!res.ok) throw new Error("user not found");
        return await res.json();
    } catch {
        return null;
    }
}

function setRemoteAvatar(user) {
    if (user?.avatar) {
        remoteAvatar.innerHTML =
            `<img src="${user.avatar}" class="avatar-img">`;
    } else {
        remoteAvatar.textContent = "👤";
    }
    remoteAvatar.style.display = "flex";
}

// ================== WEBSOCKET ==================
const callId = location.search.substring(1);
const wsProtocol = location.protocol === "https:" ? "wss://" : "ws://";
const ws = new WebSocket(`${wsProtocol}${location.host}/api/callme/ws/${callId}`);

ws.onopen = () => showStatus("WS подключен ✅");
ws.onclose = () => showStatus("WS закрыт ❌");
ws.onerror = () => showStatus("Ошибка WS ⚠️");

ws.onmessage = async e => {
    const data = JSON.parse(e.data);

    // --- информация о собеседнике ---
    if (data.type === "peer-info" && data.user_id) {
        const user = await loadUserInfo(data.user_id);

        callHeader.textContent =
            `📞 Звонок с ${user?.name || "Пользователь"}`;

        setRemoteAvatar(user);
    }

    // --- WebRTC ---
    if (data.offer) {
        await pc.setRemoteDescription(data.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ answer }));
    }

    if (data.answer) {
        await pc.setRemoteDescription(data.answer);
    }

    if (data.ice) {
        await pc.addIceCandidate(data.ice);
    }
};

// ================== TURN/STUN ==================
async function loadTurnConfig() {
    const res = await fetch("/api/callme/turn");
    const data = await res.json();
    rtcConfig = data.iceServers;
}

// ================== WEBRTC ==================
function createPeerConnection() {
    pc = new RTCPeerConnection({
        iceServers: rtcConfig,
        iceCandidatePoolSize: 10
    });

    pc.ontrack = e => {
        if (!remoteStream) remoteStream = new MediaStream();
        remoteStream.addTrack(e.track);

        if (e.track.kind === "video") {
            remoteVideo.srcObject = remoteStream;
            remoteVideo.style.display = "block";
            remoteAvatar.style.display = "none";
            remoteVideo.play().catch(() => {});
        }
    };

    pc.onicecandidate = e => {
        if (e.candidate) ws.send(JSON.stringify({ ice: e.candidate }));
    };
}

// ================== CALL ==================
async function startCall() {
    try {
        if (!rtcConfig) await loadTurnConfig();
        createPeerConnection();

        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { facingMode: currentFacingMode }
        });

        localStream.getTracks().forEach(t =>
            pc.addTrack(t, localStream)
        );

        localVideo.srcObject = localStream;
        localVideo.style.display = "block";
        localAvatar.style.display = "none";

        const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });

        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ offer }));

        preCallOverlay.style.display = "none";
        controls.style.display = "flex";

        updateButtons();
        showStatus("Звонок начат ✅");

    } catch (err) {
        console.error(err);
        alert("❌ Ошибка инициализации звонка");
    }
}

// ================== CONTROLS ==================
function toggleVideo() {
    if (!localStream) return;
    videoEnabled = !videoEnabled;
    localStream.getVideoTracks().forEach(t => t.enabled = videoEnabled);
    localVideo.style.display = videoEnabled ? "block" : "none";
    localAvatar.style.display = videoEnabled ? "none" : "flex";
    updateButtons();
}

function toggleMic() {
    if (!localStream) return;
    audioEnabled = !audioEnabled;
    localStream.getAudioTracks().forEach(t => t.enabled = audioEnabled);
    updateButtons();
}

async function switchCamera() {
    if (!localStream || !videoEnabled) return;
    currentFacingMode =
        currentFacingMode === "user" ? "environment" : "user";

    const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode }
    });

    const newTrack = newStream.getVideoTracks()[0];
    const sender = pc.getSenders().find(s => s.track?.kind === "video");
    if (sender) await sender.replaceTrack(newTrack);

    localStream.getVideoTracks().forEach(t => t.stop());
    localStream.addTrack(newTrack);
    localVideo.srcObject = localStream;
}

// ================== END ==================
function endCall() {
    pc?.close();
    ws.close();
    localStream?.getTracks().forEach(t => t.stop());

    localVideo.style.display = "none";
    remoteVideo.style.display = "none";

    localAvatar.style.display = "flex";
    remoteAvatar.style.display = "flex";

    controls.style.display = "none";
    preCallOverlay.style.display = "flex";

    showStatus("Звонок завершён ❌");
}

// ================== UI ==================
function updateButtons() {
    toggleVideoBtn.classList.toggle("active", videoEnabled);
    toggleVideoBtn.classList.toggle("inactive", !videoEnabled);
    muteMicBtn.classList.toggle("active", audioEnabled);
    muteMicBtn.classList.toggle("inactive", !audioEnabled);
}

function showStatus(text) {
    statusTextEl.textContent = text;
}

// ================== EVENTS ==================
startBtn.onclick = startCall;
endBtn.onclick = endCall;
toggleVideoBtn.onclick = toggleVideo;
muteMicBtn.onclick = toggleMic;
switchCameraBtn.onclick = switchCamera;