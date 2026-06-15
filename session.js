import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  ref,
  onValue,
  update,
  onDisconnect,
  serverTimestamp,
} from "./firebase-config.js";

// Resolves with { uid, profile } once auth + presence are ready.
// Redirects to index.html if not authenticated.
export function initSession() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      const uid = user.uid;
      const userRef = ref(db, `users/${uid}`);

      // Mark online now, and set up onDisconnect to flip to offline.
      update(userRef, { status: "online", lastSeen: serverTimestamp() });
      const discRef = onDisconnect(userRef);
      discRef.update({ status: "offline", lastSeen: serverTimestamp() });

      onValue(
        userRef,
        (snap) => {
          const profile = snap.val() || {};
          resolve({ uid, profile, userRef });
        },
        { onlyOnce: true }
      );

      // Keep page-level listeners working for live profile updates
      window.__currentUid = uid;
    });
  });
}

export function watchProfile(uid, callback) {
  const userRef = ref(db, `users/${uid}`);
  return onValue(userRef, (snap) => {
    callback(snap.val() || {});
  });
}

export async function logout(uid) {
  if (uid) {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, { status: "offline", lastSeen: serverTimestamp() });
  }
  await signOut(auth);
  window.location.href = "index.html";
}

export function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
