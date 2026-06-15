import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  ref,
  set,
  get,
} from "./firebase-config.js";

const STARTING_COINS = 100;

const form = document.getElementById("authForm");
const nameField = document.getElementById("nameField");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const submitBtn = document.getElementById("submitBtn");
const switchBtn = document.getElementById("switchBtn");
const switchText = document.getElementById("switchText");
const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");
const errorBanner = document.getElementById("errorBanner");

let mode = "login"; // or "signup"

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.add("show");
}

function clearError() {
  errorBanner.classList.remove("show");
  errorBanner.textContent = "";
}

function setMode(newMode) {
  mode = newMode;
  clearError();
  if (mode === "signup") {
    nameField.style.display = "block";
    nameInput.required = true;
    formTitle.textContent = "Create your account";
    formSubtitle.textContent = "Join Wavelength and start connecting with people around the world.";
    submitBtn.textContent = "Create account";
    passwordInput.placeholder = "At least 6 characters";
    passwordInput.autocomplete = "new-password";
    switchText.innerHTML = `Already have an account? <button class="btn-link" id="switchBtn">Sign in</button>`;
  } else {
    nameField.style.display = "none";
    nameInput.required = false;
    formTitle.textContent = "Welcome back";
    formSubtitle.textContent = "Sign in to pick up where the conversation left off.";
    submitBtn.textContent = "Sign in";
    passwordInput.placeholder = "Your password";
    passwordInput.autocomplete = "current-password";
    switchText.innerHTML = `New here? <button class="btn-link" id="switchBtn">Create an account</button>`;
  }
  document.getElementById("switchBtn").addEventListener("click", () => {
    setMode(mode === "login" ? "signup" : "login");
  });
}

document.getElementById("switchBtn").addEventListener("click", () => {
  setMode(mode === "login" ? "signup" : "login");
});

function friendlyError(error) {
  const code = error.code || "";
  if (code.includes("email-already-in-use")) return "That email is already registered. Try signing in instead.";
  if (code.includes("invalid-email")) return "That email address doesn't look right.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Email or password is incorrect.";
  }
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait a moment and try again.";
  return "Something went wrong. Please try again.";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  submitBtn.disabled = true;
  submitBtn.textContent = mode === "signup" ? "Creating account…" : "Signing in…";

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const name = nameInput.value.trim();

  try {
    if (mode === "signup") {
      if (!name) {
        showError("Please enter your name.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Create account";
        return;
      }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      await set(ref(db, `users/${uid}`), {
        name,
        email,
        coins: STARTING_COINS,
        status: "online",
        profilePic: "",
        createdAt: Date.now(),
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    window.location.href = "home.html";
  } catch (err) {
    showError(friendlyError(err));
    submitBtn.disabled = false;
    submitBtn.textContent = mode === "signup" ? "Create account" : "Sign in";
  }
});

// If already signed in, go straight to home
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "home.html";
  }
});
