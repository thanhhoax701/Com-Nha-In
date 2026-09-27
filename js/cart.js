import { db } from "./firebase.js";
import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

function money(value) {
  return new Intl.NumberFormat("vi-VN").format(value) + "đ";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

let cart = JSON.parse(localStorage.getItem("comNhaInCart") || "[]");
let checkoutOpen = false;
let lastOrderId = "";
let orderSavedToCloud = false;
let checkoutError = "";

function render() {
  const container = document.querySelector("#cart");

  if (!cart.length) {
    container.innerHTML = lastOrderId
      ? `<div class="order-success" role="status">
          <span class="success-mark" aria-hidden="true">✓</span>
          <h2>Đã lưu yêu cầu đặt món</h2>
          <p>Mã đơn <strong>${lastOrderId}</strong> ${orderSavedToCloud ? "đã được gửi đến quán." : "chỉ được lưu trên trình duyệt này; hãy gọi quán để xác nhận."}</p>
          <a class="primary-btn" href="tel:+84936169702">Gọi Cơm Nhà Ín · 0936 169 702</a>
          <a class="continue-link" href="index.html#menu">Tiếp tục xem thực đơn</a>
        </div>`
      : '<div class="empty">🛒<h2>Giỏ hàng đang trống</h2><p>Chọn vài món ngon nhà Ín nhé!</p><a class="primary-btn" href="index.html#menu">Xem thực đơn</a></div>';
    return;
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const checkoutForm = checkoutOpen ? `
    <section class="checkout-panel" aria-labelledby="checkoutTitle">
      <div class="checkout-heading">
        <span class="eyebrow">THÔNG TIN NHẬN MÓN</span>
        <h2 id="checkoutTitle">Gửi yêu cầu đặt món</h2>
        <p>Nhà Ín sẽ dùng thông tin này để liên hệ xác nhận đơn hàng.</p>
      </div>
      <form id="checkoutForm">
        <div class="checkout-fields">
          <label>Họ và tên
            <input name="customer" type="text" autocomplete="name" required>
          </label>
          <label>Số điện thoại
            <input name="phone" type="tel" autocomplete="tel" inputmode="tel" required>
          </label>
          <label class="field-wide">Địa chỉ giao hàng
            <input name="address" type="text" autocomplete="street-address" required>
          </label>
          <label class="field-wide">Ghi chú cho quán <span class="optional-label">Không bắt buộc</span>
            <textarea name="note" rows="3" placeholder="Ví dụ: ít cay, gọi trước khi giao"></textarea>
          </label>
        </div>
        <p class="checkout-notice">Chưa thanh toán trực tuyến. Quán sẽ liên hệ để xác nhận đơn.</p>
        ${checkoutError ? `<p class="checkout-error" role="alert">${escapeHtml(checkoutError)}</p>` : ""}
        <div class="checkout-actions">
          <button type="submit" class="primary-btn">Gửi yêu cầu · ${money(total)}</button>
          <button type="button" class="ghost-btn" id="cancelCheckout">Quay lại giỏ</button>
        </div>
      </form>
    </section>` : "";

  container.innerHTML = `
    <div class="cart-layout">
      <div class="cart-list">${cart.map(item => `
        <div class="cart-row">
          <span class="cart-emoji">${escapeHtml(item.emoji || "🍚")}</span>
          <div class="cart-info"><strong>${escapeHtml(item.name)}</strong><small>${money(item.price)} / phần</small></div>
          <div class="qty">
            <button type="button" aria-label="Giảm ${escapeHtml(item.name)}" data-qty-change="-1" data-id="${escapeHtml(item.id)}">−</button>
            <b>${item.qty}</b>
            <button type="button" aria-label="Tăng ${escapeHtml(item.name)}" data-qty-change="1" data-id="${escapeHtml(item.id)}">+</button>
          </div>
          <strong>${money(item.price * item.qty)}</strong>
          <button class="remove" type="button" aria-label="Xóa ${escapeHtml(item.name)}" data-cart-remove="${escapeHtml(item.id)}">×</button>
        </div>`).join("")}
      </div>
      <aside class="cart-summary">
        <span class="eyebrow">TÓM TẮT ĐƠN HÀNG</span>
        <div class="cart-total"><span>Tạm tính</span><strong>${money(total)}</strong></div>
        <p>Phí giao hàng sẽ được quán xác nhận cùng đơn.</p>
        <button class="primary-btn checkout" id="checkoutButton" type="button">Tiến hành đặt món <span aria-hidden="true">→</span></button>
        <a class="continue-link" href="index.html#menu">← Tiếp tục chọn món</a>
      </aside>
    </div>
    ${checkoutForm}`;

  document.getElementById("cancelCheckout")?.addEventListener("click", () => {
    checkoutOpen = false;
    render();
  });
  document.getElementById("checkoutForm")?.addEventListener("submit", submitOrder);
  document.getElementById("checkoutButton")?.addEventListener("click", checkout);
  container.querySelectorAll("[data-qty-change]").forEach(button => {
    button.addEventListener("click", () => changeQuantity(button.dataset.id, Number(button.dataset.qtyChange)));
  });
  container.querySelectorAll("[data-cart-remove]").forEach(button => {
    button.addEventListener("click", () => removeItem(button.dataset.cartRemove));
  });
}

function changeQuantity(id, difference) {
  const item = cart.find(entry => entry.id === id);
  if (!item) return;
  item.qty += difference;
  if (item.qty <= 0) cart = cart.filter(entry => entry.id !== id);
  save();
}

function removeItem(id) {
  cart = cart.filter(item => item.id !== id);
  save();
}

function checkout() {
  checkoutOpen = true;
  render();
  document.querySelector("#checkoutTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector('#checkoutForm input[name="customer"]')?.focus({ preventScroll: true });
}

async function submitOrder(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const orderId = `DH${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const order = {
    id: orderId,
    customer: String(form.get("customer")).trim(),
    phone: String(form.get("phone")).trim(),
    address: String(form.get("address")).trim(),
    note: String(form.get("note") || "").trim(),
    items: cart.map(item => `${item.name} x${item.qty}`).join(", "),
    total,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  const submitButton = event.currentTarget.querySelector('[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Đang gửi đơn...";

  try {
    if (db) {
      await setDoc(doc(db, "orders", orderId), {
        ...order,
        createdAt: serverTimestamp()
      });
    }

    const orders = JSON.parse(localStorage.getItem("comNhaIn_orders") || "[]");
    orders.unshift(order);
    localStorage.setItem("comNhaIn_orders", JSON.stringify(orders));
    localStorage.setItem("comNhaInCart", "[]");
    cart = [];
    checkoutOpen = false;
    checkoutError = "";
    lastOrderId = orderId;
    orderSavedToCloud = Boolean(db);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error("Không thể gửi đơn hàng lên Firebase.", error);
    checkoutError = "Chưa gửi được đơn hàng. Vui lòng thử lại hoặc gọi 0936 169 702.";
    render();
  }
}

function save() {
  localStorage.setItem("comNhaInCart", JSON.stringify(cart));
  render();
}

render();
