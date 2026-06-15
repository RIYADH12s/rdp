import { db, ref, onValue } from "./firebase-config.js";
import { initSession, watchProfile, initials } from "./session.js";

const onlineList = document.getElementById("onlineList");
const offlineList = document.getElementById("offlineList");
const emptyState = document.getElementById("emptyState");
const coinBalance = document.getElementById("coinBalance");

// Bottom nav routing
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    if (page === "home") return; // already here
    if (page === "match") window.location.href = "match.html";
    if (page === "profile") window.location.href = "profile.html";
  });
});

function renderAvatar(user) {
  if (user.profilePic) {
    return `<img src="${escapeAttr(user.profilePic)}" alt="" />`;
  }
  return initials(user.name);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str ?? "").replace(/"/g, "&quot;");
}

function userRow(uid, user) {
  const statusClass = user.status === "online" ? "online" : "offline";
  const statusLabel = user.status === "online" ? "Online" : "Offline";
  return `
    <div class="user-card" data-uid="${uid}">
      <div class="avatar">
        ${renderAvatar(user)}
        <span class="status-dot ${statusClass}"></span>
      </div>
      <div class="user-info">
        <div class="name">${escapeHtml(user.name || "Unnamed")}</div>
        <div class="status-text ${statusClass}">${statusLabel}</div>
      </div>
    </div>
  `;
}

initSession().then(({ uid }) => {
  // Live coin balance
  watchProfile(uid, (profile) => {
    coinBalance.textContent = profile.coins ?? 0;
  });

  // All users list
  const usersRef = ref(db, "users");
  onValue(usersRef, (snap) => {
    const all = snap.val() || {};
    const online = [];
    const offline = [];

    Object.entries(all).forEach(([otherUid, user]) => {
      if (otherUid === uid) return;
      if (user.status === "online") online.push([otherUid, user]);
      else offline.push([otherUid, user]);
    });

    onlineList.innerHTML = online.map(([id, u]) => userRow(id, u)).join("");
    offlineList.innerHTML = offline.map(([id, u]) => userRow(id, u)).join("");

    if (online.length === 0 && offline.length === 0) {
      emptyState.style.display = "block";
    } else {
      emptyState.style.display = "none";
    }
  });
});
