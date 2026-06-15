import {
  db,
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  push,
  serverTimestamp,
  off,
} from "./firebase-config.js";
import { initSession, watchProfile } from "./session.js";

const matchBtn = document.getElementById("matchBtn");
const matchRings = document.getElementById("matchRings");
const matchTitle = document.getElementById("matchTitle");
const matchSubtitle = document.getElementById("matchSubtitle");
const coinBalance = document.getElementById("coinBalance");
const toast = document.getElementById("toast");

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    if (page === "match") return;
    cleanupMatchmaking();
    if (page === "home") window.location.href = "home.html";
    if (page === "profile") window.location.href = "profile.html";
  });
});

let uid = null;
let searching = false;
let waitingRef = null; // ref to my own waiting ticket
let waitingListener = null; // listens for someone claiming my ticket
let queueListener = null; // listens to the whole queue while searching

function showToast(message, ms = 3000) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), ms);
}

async function cleanupMatchmaking() {
  searching = false;
  if (waitingListener) {
    off(waitingRef, "value", waitingListener);
    waitingListener = null;
  }
  if (queueListener) {
    off(ref(db, "matchmaking"), "value", queueListener);
    queueListener = null;
  }
  if (waitingRef) {
    await remove(waitingRef).catch(() => {});
    waitingRef = null;
  }
}

function setSearchingUI(isSearching) {
  searching = isSearching;
  if (isSearching) {
    matchRings.classList.add("searching");
    matchTitle.textContent = "Looking for someone…";
    matchSubtitle.textContent = "Hang tight — we're finding an online user for you.";
    matchBtn.textContent = "Cancel";
    matchBtn.classList.add("searching");
    matchBtn.classList.add("cancel");
  } else {
    matchRings.classList.remove("searching");
    matchTitle.textContent = "Find someone to talk to";
    matchSubtitle.textContent = "We'll connect you with a random person who's online right now. Calls cost 2 coins per minute.";
    matchBtn.textContent = "Start matching";
    matchBtn.classList.remove("searching");
    matchBtn.classList.remove("cancel");
  }
}

function goToCall(callId, role) {
  cleanupMatchmaking();
  window.location.href = `call.html?callId=${encodeURIComponent(callId)}&role=${role}`;
}

async function startMatching() {
  const myCoins = parseInt(coinBalance.textContent, 10) || 0;
  if (myCoins < 2) {
    showToast("You need at least 2 coins to start a call.");
    return;
  }

  setSearchingUI(true);

  // Step 1: look for an existing waiting user (not me)
  const queueRef = ref(db, "matchmaking");
  const snap = await get(queueRef);
  const queue = snap.val() || {};

  const candidates = Object.entries(queue).filter(([otherUid]) => otherUid !== uid);

  if (candidates.length > 0) {
    // Claim the first available candidate
    const [otherUid, ticket] = candidates[0];

    // Create a call room
    const callsRef = ref(db, "calls");
    const newCallRef = push(callsRef);
    const callId = newCallRef.key;

    await set(newCallRef, {
      callerId: uid,
      calleeId: otherUid,
      status: "pending",
      startTime: serverTimestamp(),
    });

    // Tell the waiting user they've been matched, then remove their ticket
    await update(ref(db, `matchmaking/${otherUid}`), {
      matchedCallId: callId,
      matchedRole: "callee",
    });

    // small delay isn't needed; the waiting user listens for matchedCallId
    goToCall(callId, "caller");
    return;
  }

  // Step 2: no one waiting — post my own ticket and listen for a match
  waitingRef = ref(db, `matchmaking/${uid}`);
  await set(waitingRef, {
    uid,
    createdAt: serverTimestamp(),
  });

  waitingListener = onValue(waitingRef, async (snap) => {
    const data = snap.val();
    if (data && data.matchedCallId) {
      const callId = data.matchedCallId;
      await remove(waitingRef).catch(() => {});
      goToCall(callId, "callee");
    }
  });
}

matchBtn.addEventListener("click", async () => {
  if (searching) {
    await cleanupMatchmaking();
    setSearchingUI(false);
  } else {
    matchBtn.disabled = true;
    await startMatching();
    matchBtn.disabled = false;
  }
});

initSession().then((session) => {
  uid = session.uid;
  watchProfile(uid, (profile) => {
    coinBalance.textContent = profile.coins ?? 0;
  });
});

window.addEventListener("beforeunload", () => {
  cleanupMatchmaking();
});
