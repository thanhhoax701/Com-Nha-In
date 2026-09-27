# Cơm Nhà Ín — Firebase Setup

1. Vào Firebase Console và tạo project.
2. Tạo Web App.
3. Copy `firebaseConfig` vào `js/firebase.js`.
4. Tạo Firestore Database.
5. Tạo collection `products` nếu muốn thay dữ liệu mẫu.
6. Khi triển khai thật, bật Authentication (Email/Password hoặc Google).
7. Thiết lập Firestore Security Rules trước khi public.

## Mẫu document products

{
  "name": "Cơm gà chiên mắm",
  "price": 45000,
  "category": "Cơm",
  "description": "Gà chiên vàng giòn, sốt mắm đậm đà, cơm nóng.",
  "emoji": "🍗",
  "active": true
}
