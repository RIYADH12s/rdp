import { db, ref, update, runTransaction } from "./firebase-config.js";
import { initSession, watchProfile, logout, initials } from "./session.js";

const coinBalanceTop = document.getElementById("coinBalanceTop");
const coinBalanceMain = document.getElementById("coinBalanceMain");
const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const displayNameInput = document.getElementById("displayNameInput");
const saveNameBtn = document.getElementById("saveNameBtn");
const logoutBtn = document.getElementById("logoutBtn");
const toast = document.getElementById("toast");

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    if (page === "profile") return;
    if (page === "home") window.location.href = "home.html";
    if (page === "match") window.location.href = "match.html";
  });
});

function showToast(message, ms = 2500) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), ms);
}

let uid = null;

initSession().then((session) => {
  uid = session.uid;

  watchProfile(uid, (profile) => {
    coinBalanceTop.textContent = profile.coins ?? 0;
    coinBalanceMain.textContent = profile.coins ?? 0;
    profileName.textContent = profile.name || "Unnamed";
    profileEmail.textContent = profile.email || "";
    profileAvatar.textContent = initials(profile.name);
    if (document.activeElement !== displayNameInput) {
      displayNameInput.value = profile.name || "";
    }
  });

  logoutBtn.addEventListener("click", () => logout(uid));

  saveNameBtn.addEventListener("click", async () => {
    const newName = displayNameInput.value.trim();
    if (!newName) {
      showToast("Name can't be empty.");
      return;
    }
    await update(ref(db, `users/${uid}`), { name: newName });
    showToast("Saved.");
  });

  // Demo recharge buttons — directly increments coins via transaction.
  document.querySelectorAll(".recharge-chip").forEach((chip) => {
    chip.addEventListener("click", async () => {
      const amount = parseInt(chip.dataset.coins, 10);
      const coinsRef = ref(db, `users/${uid}/coins`);
      await runTransaction(coinsRef, (current) => (current || 0) + amount);
      showToast(`+${amount} coins added`);
    });
  });
});
