// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  onDisconnect,
  push,
  remove,
  runTransaction,
  serverTimestamp,
  off,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDQ6bQQr_SrSx950oSEO6FnXscLXUlqIxs",
  authDomain: "callingapp-e8a8a.firebaseapp.com",
  databaseURL: "https://callingapp-e8a8a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "callingapp-e8a8a",
  storageBucket: "callingapp-e8a8a.firebasestorage.app",
  messagingSenderId: "157798349343",
  appId: "1:157798349343:web:c5f0ec80842ef01e96332a",
  measurementId: "G-GYZF8WJGJ2",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export {
  app,
  auth,
  db,
  // auth
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  // db
  ref,
  set,
  get,
  update,
  onValue,
  onDisconnect,
  push,
  remove,
  runTransaction,
  serverTimestamp,
  off,
};
