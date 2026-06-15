import {
  db,
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  push,
  runTransaction,
  serverTimestamp,
  off,
} from "./firebase-config.js";
import { initSession } from "./session.js";

const COINS_PER_MINUTE = 2;
const DEDUCT_INTERVAL_MS = 60 * 1000;

const remoteVideo = document.getElementById("remoteVideo");
const localVideo = document.getElementById("localVideo");
const callTimer = document.getElementById("callTimer");
const callCoins = document.getElementById("callCoins");
const muteBtn = document.getElementById("muteBtn");
const videoBtn = document.getElementById("videoBtn");
const chatToggleBtn = document.getElementById("chatToggleBtn");
const chatOverlay = document.getElementById("chatOverlay");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const endCallBtn = document.getElementById("endCallBtn");
const toast = document.getElementById("toast");

const params = new URLSearchParams(window.location.search);
const callId = params.get("callId");
const role = params.get("role"); // "caller" or "callee"

if (!callId || !role) {
  window.location.href = "match.html";
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

let pc = null;
let localStream = null;
let uid = null;
let coins = 0;
let secondsElapsed = 0;
let timerInterval = null;
let deductInterval = null;
let callActive = true;
let micOn = true;
let camOn = true;

const callRef = ref(db, `calls/${callId}`);

function showToast(message, ms = 3500) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), ms);
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function appendChatMessage(text, mine) {
  const div = document.createElement("div");
  div.className = `chat-msg ${mine ? "mine" : "theirs"}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function getUserCoins(theUid) {
  const snap = await get(ref(db, `users/${theUid}/coins`));
  return snap.val() ?? 0;
}

async function deductCoins() {
  const userCoinsRef = ref(db, `users/${uid}/coins`);
  const result = await runTransaction(userCoinsRef, (current) => {
    const balance = current || 0;
    return Math.max(0, balance - COINS_PER_MINUTE);
  });
  const newBalance = result.snapshot.val() ?? 0;
  coins = newBalance;
  callCoins.textContent = coins;
  if (newBalance <= 0) {
    showToast("Insufficient coins — call ending.");
    endCall(true);
  }
}

function startTimers() {
  timerInterval = setInterval(() => {
    secondsElapsed += 1;
    callTimer.textContent = formatTime(secondsElapsed);
  }, 1000);

  deductInterval = setInterval(() => {
    deductCoins();
  }, DEDUCT_INTERVAL_MS);
}

function stopTimers() {
  clearInterval(timerInterval);
  clearInterval(deductInterval);
}

async function setupMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
  } catch (err) {
    showToast("Could not access camera/microphone. Please check permissions.");
    throw err;
  }
}

function createPeerConnection() {
  pc = new RTCPeerConnection(ICE_SERVERS);

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = (event) => {
    if (remoteVideo.srcObject !== event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  const myCandidatesPath = role === "caller" ? "callerCandidates" : "calleeCandidates";

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidatesRef = ref(db, `calls/${callId}/${myCandidatesPath}`);
      push(candidatesRef, event.candidate.toJSON());
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
      if (callActive) {
        showToast("Connection lost.");
        endCall(false);
      }
    }
  };
}

async function startAsCaller() {
  createPeerConnection();

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await update(callRef, {
    offer: { type: offer.type, sdp: offer.sdp },
    status: "ringing",
  });

  // Listen for answer
  onValue(callRef, async (snap) => {
    const data = snap.val();
    if (!data) return;
    if (data.answer && pc.signalingState !== "stable" && !pc.currentRemoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });

  // Listen for callee's ICE candidates
  const calleeCandidatesRef = ref(db, `calls/${callId}/calleeCandidates`);
  onValue(calleeCandidatesRef, (snap) => {
    const data = snap.val();
    if (!data) return;
    Object.values(data).forEach((candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });
  });
}

async function startAsCallee() {
  createPeerConnection();

  // Get the offer
  const snap = await get(callRef);
  const data = snap.val();
  if (!data || !data.offer) {
    showToast("This call is no longer available.");
    setTimeout(() => (window.location.href = "match.html"), 1500);
    return;
  }

  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await update(callRef, {
    answer: { type: answer.type, sdp: answer.sdp },
    status: "active",
  });

  // Listen for caller's ICE candidates
  const callerCandidatesRef = ref(db, `calls/${callId}/callerCandidates`);
  onValue(callerCandidatesRef, (snap) => {
    const data = snap.val();
    if (!data) return;
    Object.values(data).forEach((candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });
  });
}

function listenForCallEnd() {
  onValue(callRef, (snap) => {
    const data = snap.val();
    if (!data) return;
    if (data.status === "ended" && callActive) {
      showToast("The other person ended the call.");
      endCall(false, true);
    }
  });
}

function listenForChat() {
  const chatRef = ref(db, `calls/${callId}/chat`);
  onValue(chatRef, (snap) => {
    const data = snap.val();
    chatMessages.innerHTML = "";
    if (!data) return;
    Object.values(data)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .forEach((msg) => {
        appendChatMessage(msg.text, msg.senderId === uid);
      });
  });
}

async function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  const chatRef = ref(db, `calls/${callId}/chat`);
  await push(chatRef, {
    senderId: uid,
    text,
    timestamp: Date.now(),
  });
  chatInput.value = "";
}

async function endCall(insufficientCoins = false, remoteEnded = false) {
  if (!callActive) return;
  callActive = false;
  stopTimers();

  if (pc) {
    pc.close();
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
  }

  if (!remoteEnded) {
    await update(callRef, { status: "ended" }).catch(() => {});
  }

  // Clean up signaling data after a short delay so the other peer can read "ended"
  setTimeout(() => {
    remove(callRef).catch(() => {});
  }, 4000);

  if (insufficientCoins) {
    showToast("Insufficient coins. Returning to home…");
    setTimeout(() => (window.location.href = "home.html"), 2000);
  } else {
    window.location.href = "home.html";
  }
}

// Controls
muteBtn.addEventListener("click", () => {
  if (!localStream) return;
  micOn = !micOn;
  localStream.getAudioTracks().forEach((t) => (t.enabled = micOn));
  muteBtn.classList.toggle("muted", !micOn);
});

videoBtn.addEventListener("click", () => {
  if (!localStream) return;
  camOn = !camOn;
  localStream.getVideoTracks().forEach((t) => (t.enabled = camOn));
  videoBtn.classList.toggle("muted", !camOn);
});

chatToggleBtn.addEventListener("click", () => {
  chatOverlay.classList.toggle("open");
  chatToggleBtn.classList.toggle("active-toggle");
});

chatSendBtn.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendChatMessage();
  }
});

endCallBtn.addEventListener("click", () => endCall(false));

window.addEventListener("beforeunload", () => {
  if (callActive) {
    update(callRef, { status: "ended" }).catch(() => {});
  }
});

// Init
(async function init() {
  const session = await initSession();
  uid = session.uid;
  coins = await getUserCoins(uid);
  callCoins.textContent = coins;

  if (coins < COINS_PER_MINUTE) {
    showToast("You need at least 2 coins to start a call.");
    setTimeout(() => (window.location.href = "home.html"), 1500);
    return;
  }

  try {
    await setupMedia();
  } catch {
    setTimeout(() => (window.location.href = "match.html"), 1500);
    return;
  }

  listenForCallEnd();
  listenForChat();
  startTimers();

  if (role === "caller") {
    await startAsCaller();
  } else {
    await startAsCallee();
  }
})();
