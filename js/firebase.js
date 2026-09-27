import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCepds14nGea6qxVe9IlKUYnaliYWbkGuY",
  authDomain: "com-nha-in.firebaseapp.com",
  projectId: "com-nha-in",
  storageBucket: "com-nha-in.firebasestorage.app",
  messagingSenderId: "613197788972",
  appId: "1:613197788972:web:66b8b01acc4ff405b95e89",
  measurementId: "G-7NFQ41DPF6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
