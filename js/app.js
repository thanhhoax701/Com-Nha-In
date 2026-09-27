import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const sampleProducts = [
  {id:"com-ga", name:"Cơm gà chiên mắm", price:45000, category:"Cơm", emoji:"🍗", description:"Gà chiên vàng giòn, sốt mắm đậm đà, cơm nóng."},
  {id:"com-suon", name:"Cơm sườn nướng", price:50000, category:"Cơm", emoji:"🥩", description:"Sườn nướng thơm lừng, mềm mọng, ăn cùng cơm nóng."},
  {id:"com-thit-kho", name:"Cơm thịt kho trứng", price:45000, category:"Cơm", emoji:"🥚", description:"Thịt kho mềm đậm vị cùng trứng và cơm trắng."},
  {id:"canh-chua", name:"Canh chua cá", price:30000, category:"Canh", emoji:"🍲", description:"Canh chua thanh mát, vị vừa ăn."},
  {id:"trung-chien", name:"Trứng chiên", price:20000, category:"Món thêm", emoji:"🍳", description:"Trứng chiên vàng thơm, món thêm quen thuộc."},
  {id:"nuoc-chanh", name:"Nước chanh", price:15000, category:"Nước", emoji:"🍋", description:"Nước chanh mát lạnh, giải khát."}
];

let products = sampleProducts;
let activeCategory = "Tất cả";
let searchTerm = "";

async function loadProducts(){
  if (db) {
    try {
      const snap = await getDocs(collection(db, "products"));
      if (!snap.empty) products = snap.docs.map(d => ({id:d.id, ...d.data()}));
    } catch(e) {
      console.info("Firebase chưa cấu hình, đang dùng dữ liệu mẫu.");
    }
  }

  if (!products.length) products = sampleProducts;

  renderCategories();
  document.querySelector("#menuSearch").addEventListener("input", event => {
    searchTerm = event.target.value;
    renderProducts();
  });
  renderProducts();
  updateCartCount();
}

function money(n){ return new Intl.NumberFormat("vi-VN").format(n) + "đ"; }

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLocaleLowerCase("vi");
}

function renderCategories(){
  const cats = ["Tất cả", ...new Set(products.map(p => p.category))];
  document.querySelector("#categories").innerHTML = cats.map(c =>
    `<button class="category ${c===activeCategory?"active":""}" data-category="${c}">${c}</button>`
  ).join("");
  document.querySelectorAll(".category").forEach(btn => btn.onclick=()=>{
    activeCategory=btn.dataset.category; renderCategories(); renderProducts();
  });
}

function renderProducts(){
  const query = normalizeSearch(searchTerm.trim());
  const list = products.filter(product => {
    const categoryMatches = activeCategory === "Tất cả" || product.category === activeCategory;
    const searchableText = normalizeSearch(`${product.name} ${product.category} ${product.description || ""}`);
    return categoryMatches && searchableText.includes(query);
  });
  const resultCount = document.querySelector("#menuResultCount");
  resultCount.textContent = list.length ? `${list.length} món trong thực đơn` : "Không tìm thấy món phù hợp";

  if (!list.length) {
    document.querySelector("#products").innerHTML = `
      <div class="menu-empty">
        <strong>Chưa tìm thấy món phù hợp</strong>
        <span>Thử từ khóa khác hoặc xem toàn bộ thực đơn.</span>
        <button class="clear-search" type="button">Xem tất cả món</button>
      </div>`;
    document.querySelector(".clear-search").addEventListener("click", () => {
      activeCategory = "Tất cả";
      searchTerm = "";
      document.querySelector("#menuSearch").value = "";
      renderCategories();
      renderProducts();
    });
    return;
  }

  document.querySelector("#products").innerHTML = list.map(product => `
    <article class="product">
      <div class="product-img">${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : `<span>${escapeHtml(product.emoji || "🍚")}</span>`}</div>
      <div class="product-body">
        <span class="product-cat">${escapeHtml(product.category)}</span>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description || "")}</p>
        <div class="product-bottom"><strong>${money(product.price)}</strong><button class="add" type="button" data-id="${escapeHtml(product.id)}" aria-label="Thêm ${escapeHtml(product.name)} vào giỏ">+</button></div>
      </div>
    </article>`).join("");
  document.querySelectorAll(".add").forEach(btn=>btn.onclick=()=>addToCart(btn.dataset.id));
}

function addToCart(id){
  const p=products.find(x=>x.id===id); if(!p) return;
  const cart=JSON.parse(localStorage.getItem("comNhaInCart")||"[]");
  const item=cart.find(x=>x.id===id);
  if(item) item.qty++; else cart.push({...p,qty:1});
  localStorage.setItem("comNhaInCart",JSON.stringify(cart));
  updateCartCount();
  showToast(`Đã thêm ${p.name} vào giỏ hàng`);
}
let toastTimer;
function showToast(message){
  const toast=document.querySelector("#siteToast");
  if(!toast) return;
  toast.textContent=message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove("show"),2600);
}
function updateCartCount(){
  const cart=JSON.parse(localStorage.getItem("comNhaInCart")||"[]");
  const n=cart.reduce((s,x)=>s+x.qty,0);
  const el=document.querySelector("#cartCount"); if(el) el.textContent=n;
}
loadProducts();
