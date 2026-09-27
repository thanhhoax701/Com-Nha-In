// Sau khi tạo Firebase project, điền firebaseConfig tại đây.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const hasValidFirebaseConfig = Object.values(firebaseConfig).every(value =>
  typeof value === "string" && value && !value.includes("YOUR_")
);

let db = null;
let auth = null;

if (hasValidFirebaseConfig) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} else {
  console.info("Firebase chưa cấu hình, đang dùng dữ liệu mẫu trên trang.");
}

export { db, auth };
