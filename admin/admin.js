import { auth, db } from '../js/firebase.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const STORAGE_KEYS = {
  products: 'comNhaIn_products',
  employees: 'comNhaIn_employees',
  orders: 'comNhaIn_orders',
  inventory: 'comNhaIn_inventory'
};

const sampleData = {
  products: [
    { id: 'p1', name: 'Cơm gà chiên mắm', category: 'Cơm', price: 45000, emoji: '🍗', description: 'Gà chiên vàng giòn, cơm nóng, sốt mắm đậm đà.' },
    { id: 'p2', name: 'Cơm sườn nướng', category: 'Cơm', price: 50000, emoji: '🥩', description: 'Sườn nướng mềm thơm, ăn cùng rau sống và cơm.' },
    { id: 'p3', name: 'Cơm thịt kho trứng', category: 'Cơm', price: 45000, emoji: '🥚', description: 'Thịt kho mềm đậm vị cùng trứng và cơm trắng.' },
    { id: 'p4', name: 'Canh chua cá', category: 'Canh', price: 30000, emoji: '🍲', description: 'Canh chua thanh mát, vị đậm đà.' },
    { id: 'p5', name: 'Trứng chiên', category: 'Món thêm', price: 20000, emoji: '🍳', description: 'Trứng chiên vàng, thêm vào suất cơm.' },
    { id: 'p6', name: 'Nước chanh', category: 'Nước', price: 15000, emoji: '🍋', description: 'Nước chanh mát lạnh, giải ngấy.' }
  ],
  employees: [
    { id: 'e1', name: 'Nguyễn Thị Lan', role: 'Bếp trưởng', phone: '0901112233', shift: 'Sáng' },
    { id: 'e2', name: 'Trần Văn Hùng', role: 'Nhân viên bếp', phone: '0902223344', shift: 'Chiều' },
    { id: 'e3', name: 'Phạm Ý Nhi', role: 'Giao hàng', phone: '0903334455', shift: 'Tối' }
  ],
  orders: [
    { id: 'DH1001', customer: 'Khách A', items: 'Cơm sườn nướng, Nước chanh', total: 65000, status: 'pending' },
    { id: 'DH1002', customer: 'Khách B', items: 'Cơm gà chiên mắm', total: 45000, status: 'confirmed' },
    { id: 'DH1003', customer: 'Khách C', items: 'Canh chua cá, Trứng chiên', total: 50000, status: 'delivered' },
    { id: 'DH1004', customer: 'Khách D', items: 'Cơm thịt kho trứng', total: 45000, status: 'cancelled' }
  ],
  inventory: [
    { id: 'i1', item: 'Gạo', unit: 'kg', qty: 120, status: 'Đủ' },
    { id: 'i2', item: 'Sườn heo', unit: 'kg', qty: 15, status: 'Sắp hết' },
    { id: 'i3', item: 'Trứng', unit: 'hộp', qty: 0, status: 'Hết' },
    { id: 'i4', item: 'Rau sống', unit: 'kg', qty: 18, status: 'Đủ' }
  ]
};

function loadData(key) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(sampleData[key.replace('comNhaIn_', '')]));
    return sampleData[key.replace('comNhaIn_', '')];
  }
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.setItem(key, JSON.stringify(sampleData[key.replace('comNhaIn_', '')]));
    return sampleData[key.replace('comNhaIn_', '')];
  }
}

function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function currency(value) {
  return Number(value).toLocaleString('vi-VN') + 'đ';
}

function statusLabel(status) {
  const map = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    delivered: 'Đã giao',
    cancelled: 'Đã huỷ'
  };
  return map[status] || status;
}

function safeOrderStatus(status) {
  return ['pending', 'confirmed', 'delivered', 'cancelled'].includes(status) ? status : 'pending';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function getProducts() { return loadData(STORAGE_KEYS.products); }
function getEmployees() { return loadData(STORAGE_KEYS.employees); }
function getOrders() { return loadData(STORAGE_KEYS.orders); }
function getInventory() { return loadData(STORAGE_KEYS.inventory); }

async function syncCloudData() {
  const collections = Object.keys(STORAGE_KEYS);
  const snapshots = await Promise.all(collections.map(name => getDocs(collection(db, name))));

  for (let index = 0; index < collections.length; index += 1) {
    const name = collections[index];
    let records = snapshots[index].docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }));

    if (records.length === 0) {
      const localRecords = loadData(STORAGE_KEYS[name]);
      const isUnmodifiedSample = JSON.stringify(localRecords) === JSON.stringify(sampleData[name]);

      if (name === 'products' || (localRecords.length > 0 && !isUnmodifiedSample)) {
        if (name === 'products') {
          records = localRecords.map(product => ({ ...product, active: product.active !== false }));
        } else if (name === 'orders') {
          records = localRecords.filter(order => !sampleData.orders.some(sample => sample.id === order.id));
        } else {
          records = localRecords.filter(record => {
            const sample = sampleData[name].find(item => item.id === record.id);
            return !sample || JSON.stringify(record) !== JSON.stringify(sample);
          });
        }
        await Promise.all(records.map(record => saveRemoteRecord(name, record)));
      }
    }

    saveData(STORAGE_KEYS[name], records);
  }
}

function saveRemoteRecord(collectionName, record) {
  return setDoc(doc(db, collectionName, record.id), record);
}

async function deleteRemoteRecord(collectionName, id) {
  try {
    await deleteDoc(doc(db, collectionName, id));
    return true;
  } catch (error) {
    console.error(`Không thể xóa dữ liệu trong ${collectionName}.`, error);
    showAdminNotice('Không thể xóa trên Firebase. Kiểm tra quyền truy cập và thử lại.');
    return false;
  }
}

function showAdminNotice(message) {
  const notice = document.getElementById('adminNotice');
  notice.textContent = message;
  notice.hidden = false;
}

function renderStats() {
  const products = getProducts();
  const employees = getEmployees();
  const orders = getOrders();
  const inventory = getInventory();

  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const lowStock = inventory.filter(item => item.status === 'Sắp hết' || item.status === 'Hết').length;
  const pendingOrders = orders.filter(order => order.status === 'pending').length;

  const stats = [
    { label: 'Tổng sản phẩm', value: products.length, meta: '+2 tháng này' },
    { label: 'Nhân viên', value: employees.length, meta: 'Đang làm việc' },
    { label: 'Đơn hàng', value: orders.length, meta: `${pendingOrders} chờ xử lý` },
    { label: 'Doanh thu', value: currency(totalRevenue), meta: `${lowStock} mặt hàng cần bổ sung` }
  ];

  document.getElementById('statsGrid').innerHTML = stats.map(stat => `
    <div class="stat-card">
      <div class="label">${stat.label}</div>
      <div class="value">${stat.value}</div>
      <div class="meta">${stat.meta}</div>
    </div>
  `).join('');
}

function renderRecentOrders() {
  const orders = getOrders().slice(0, 4);
  const container = document.getElementById('recentOrders');

  container.innerHTML = orders.map(order => `
    <div class="mini-item">
      <div>
        <strong>${escapeHtml(order.id)}</strong>
        <span>${escapeHtml(order.customer)} · ${escapeHtml(order.items)}</span>
      </div>
      <div class="chip ${safeOrderStatus(order.status)}">${escapeHtml(statusLabel(order.status))}</div>
    </div>
  `).join('');
}

function renderInventoryAlert() {
  const items = getInventory().slice(0, 4);
  const container = document.getElementById('inventoryAlert');

  container.innerHTML = items.map(item => `
    <div class="mini-item">
      <div>
        <strong>${escapeHtml(item.item)}</strong>
        <span>${escapeHtml(item.qty)} ${escapeHtml(item.unit)}</span>
      </div>
      <div class="chip ${item.status === 'Đủ' ? 'ok' : 'low'}">${escapeHtml(item.status)}</div>
    </div>
  `).join('');
}

function renderProducts() {
  const tbody = document.getElementById('productTableBody');
  const products = getProducts();

  tbody.innerHTML = products.length
    ? products.map(product => `
      <tr>
        <td><strong>${escapeHtml(product.emoji || '🍚')} ${escapeHtml(product.name)}</strong></td>
        <td>${escapeHtml(product.category)}</td>
        <td>${currency(product.price)}</td>
        <td>${escapeHtml(product.description || '-')}</td>
        <td>
          <div class="row-actions">
            <button class="tiny-btn primary" data-action="edit-product" data-id="${escapeHtml(product.id)}">Sửa</button>
            <button class="tiny-btn danger" data-action="delete-product" data-id="${escapeHtml(product.id)}">Xoá</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="empty-box">Chưa có sản phẩm nào</td></tr>';
}

function renderEmployees() {
  const tbody = document.getElementById('employeeTableBody');
  const employees = getEmployees();

  tbody.innerHTML = employees.length
    ? employees.map(employee => `
      <tr>
        <td>${escapeHtml(employee.name)}</td>
        <td>${escapeHtml(employee.role)}</td>
        <td>${escapeHtml(employee.shift)}</td>
        <td>${escapeHtml(employee.phone)}</td>
        <td>
          <div class="row-actions">
            <button class="tiny-btn primary" data-action="edit-employee" data-id="${escapeHtml(employee.id)}">Sửa</button>
            <button class="tiny-btn danger" data-action="delete-employee" data-id="${escapeHtml(employee.id)}">Xoá</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="empty-box">Chưa có nhân viên nào</td></tr>';
}

function renderOrders() {
  const tbody = document.getElementById('orderTableBody');
  const orders = getOrders();

  tbody.innerHTML = orders.length
    ? orders.map(order => `
      <tr>
        <td>${escapeHtml(order.id)}</td>
        <td>
          ${escapeHtml(order.customer)}
          ${order.phone ? `<small class="order-detail">${escapeHtml(order.phone)}</small>` : ''}
          ${order.address ? `<small class="order-detail">${escapeHtml(order.address)}</small>` : ''}
          ${order.note ? `<small class="order-detail">Ghi chú: ${escapeHtml(order.note)}</small>` : ''}
        </td>
        <td>${escapeHtml(order.items)}</td>
        <td>${currency(order.total)}</td>
        <td><span class="chip ${safeOrderStatus(order.status)}">${escapeHtml(statusLabel(order.status))}</span></td>
        <td>
          <div class="row-actions">
            <button class="tiny-btn primary" data-action="next-order" data-id="${escapeHtml(order.id)}">Cập nhật</button>
            <button class="tiny-btn danger" data-action="delete-order" data-id="${escapeHtml(order.id)}">Xoá</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="empty-box">Chưa có đơn hàng nào</td></tr>';
}

function renderInventory() {
  const tbody = document.getElementById('inventoryTableBody');
  const inventory = getInventory();

  tbody.innerHTML = inventory.length
    ? inventory.map(item => `
      <tr>
        <td>${escapeHtml(item.item)}</td>
        <td>${escapeHtml(item.unit)}</td>
        <td>${escapeHtml(item.qty)}</td>
        <td><span class="chip ${item.status === 'Đủ' ? 'ok' : 'low'}">${escapeHtml(item.status)}</span></td>
        <td>
          <div class="row-actions">
            <button class="tiny-btn primary" data-action="edit-inventory" data-id="${escapeHtml(item.id)}">Sửa</button>
            <button class="tiny-btn danger" data-action="delete-inventory" data-id="${escapeHtml(item.id)}">Xoá</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="empty-box">Chưa có dữ liệu kho</td></tr>';
}

function bindTabNavigation() {
  document.querySelectorAll('.nav-btn').forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.target;
      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn === button));
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === target));
    });
  });
}

function openModal(target, item = null) {
  const modal = document.getElementById('entityModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalFields = document.getElementById('modalFields');
  const entityId = document.getElementById('entityId');
  const entityType = document.getElementById('entityType');

  entityType.value = target;
  entityId.value = item ? item.id : '';
  const errorMessage = document.getElementById('adminActionError');
  errorMessage.hidden = true;
  errorMessage.textContent = '';

  if (target === 'product') {
    modalTitle.textContent = item ? 'Chỉnh sửa món' : 'Thêm món';
    modalFields.innerHTML = `
      <div class="field">
        <label for="product_name">Tên món</label>
        <input id="product_name" name="name" type="text" value="${escapeHtml(item?.name || '')}" placeholder="VD: Cơm sườn nướng" required>
      </div>
      <div class="field">
        <label for="product_category">Danh mục</label>
        <select id="product_category" name="category">
          <option value="Cơm" ${item?.category === 'Cơm' ? 'selected' : ''}>Cơm</option>
          <option value="Canh" ${item?.category === 'Canh' ? 'selected' : ''}>Canh</option>
          <option value="Món thêm" ${item?.category === 'Món thêm' ? 'selected' : ''}>Món thêm</option>
          <option value="Nước" ${item?.category === 'Nước' ? 'selected' : ''}>Nước</option>
        </select>
      </div>
      <div class="field">
        <label for="product_price">Giá</label>
        <input id="product_price" name="price" type="number" min="0" value="${escapeHtml(item?.price ?? 45000)}" placeholder="45000" required>
      </div>
      <div class="field">
        <label for="product_emoji">Emoji</label>
        <div class="emoji-preview" id="emojiPreview">${escapeHtml(item?.emoji || '🍚')}</div>
        <input id="product_emoji" name="emoji" type="text" value="${escapeHtml(item?.emoji || '🍚')}" placeholder="🍚">
      </div>
      <div class="field full">
        <label for="product_desc">Mô tả</label>
        <textarea id="product_desc" name="description" placeholder="Mô tả món ăn">${escapeHtml(item?.description || '')}</textarea>
      </div>
    `;

    const emojiInput = document.getElementById('product_emoji');
    const emojiPreview = document.getElementById('emojiPreview');
    emojiInput.addEventListener('input', () => {
      emojiPreview.textContent = emojiInput.value || '🍚';
    });
  }

  if (target === 'employee') {
    modalTitle.textContent = item ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên';
    modalFields.innerHTML = `
      <div class="field">
        <label for="emp_name">Họ tên</label>
        <input id="emp_name" name="name" type="text" value="${escapeHtml(item?.name || '')}" required>
      </div>
      <div class="field">
        <label for="emp_role">Chức vụ</label>
        <select id="emp_role" name="role">
          <option value="Bếp trưởng" ${item?.role === 'Bếp trưởng' ? 'selected' : ''}>Bếp trưởng</option>
          <option value="Nhân viên bếp" ${item?.role === 'Nhân viên bếp' ? 'selected' : ''}>Nhân viên bếp</option>
          <option value="Phụ bếp" ${item?.role === 'Phụ bếp' ? 'selected' : ''}>Phụ bếp</option>
          <option value="Giao hàng" ${item?.role === 'Giao hàng' ? 'selected' : ''}>Giao hàng</option>
          <option value="Quản lý" ${item?.role === 'Quản lý' ? 'selected' : ''}>Quản lý</option>
        </select>
      </div>
      <div class="field">
        <label for="emp_phone">Điện thoại</label>
        <input id="emp_phone" name="phone" type="tel" value="${escapeHtml(item?.phone || '')}" required>
      </div>
      <div class="field">
        <label for="emp_shift">Ca làm</label>
        <select id="emp_shift" name="shift">
          <option value="Sáng" ${item?.shift === 'Sáng' ? 'selected' : ''}>Sáng</option>
          <option value="Chiều" ${item?.shift === 'Chiều' ? 'selected' : ''}>Chiều</option>
          <option value="Tối" ${item?.shift === 'Tối' ? 'selected' : ''}>Tối</option>
        </select>
      </div>
    `;
  }

  if (target === 'inventory') {
    modalTitle.textContent = item ? 'Chỉnh sửa kho' : 'Thêm nguyên liệu';
    modalFields.innerHTML = `
      <div class="field">
        <label for="inv_item">Tên nguyên liệu</label>
        <input id="inv_item" name="item" type="text" value="${escapeHtml(item?.item || '')}" required>
      </div>
      <div class="field">
        <label for="inv_unit">Đơn vị</label>
        <input id="inv_unit" name="unit" type="text" value="${escapeHtml(item?.unit || 'kg')}" required>
      </div>
      <div class="field">
        <label for="inv_qty">Số lượng</label>
        <input id="inv_qty" name="qty" type="number" min="0" value="${escapeHtml(item?.qty ?? 0)}" required>
      </div>
      <div class="field">
        <label for="inv_status">Tình trạng</label>
        <select id="inv_status" name="status">
          <option value="Đủ" ${item?.status === 'Đủ' ? 'selected' : ''}>Đủ</option>
          <option value="Sắp hết" ${item?.status === 'Sắp hết' ? 'selected' : ''}>Sắp hết</option>
          <option value="Hết" ${item?.status === 'Hết' ? 'selected' : ''}>Hết</option>
        </select>
      </div>
    `;
  }

  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  const modal = document.getElementById('entityModal');
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  document.getElementById('entityForm').reset();
  document.getElementById('entityId').value = '';
  document.getElementById('entityType').value = '';
  document.getElementById('modalFields').innerHTML = '';
  document.getElementById('adminActionError').hidden = true;
}

async function submitEntityForm(event) {
  event.preventDefault();
  const errorMessage = document.getElementById('adminActionError');
  errorMessage.hidden = true;
  errorMessage.textContent = '';
  const type = document.getElementById('entityType').value;
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());

  if (type === 'product') {
    const products = getProducts();
    const id = document.getElementById('entityId').value || crypto.randomUUID();
    const product = {
      id,
      name: payload.name.trim(),
      category: payload.category,
      price: Number(payload.price),
      emoji: payload.emoji || '🍚',
      description: (payload.description || '').trim(),
      active: item?.active !== false
    };

    const idx = products.findIndex(item => item.id === id);
    if (idx >= 0) products[idx] = product;
    else products.push(product);

    await saveRemoteRecord('products', product);
    saveData(STORAGE_KEYS.products, products);
  }

  if (type === 'employee') {
    const employees = getEmployees();
    const id = document.getElementById('entityId').value || crypto.randomUUID();
    const employee = {
      id,
      name: payload.name.trim(),
      role: payload.role,
      phone: payload.phone.trim(),
      shift: payload.shift
    };

    const idx = employees.findIndex(item => item.id === id);
    if (idx >= 0) employees[idx] = employee;
    else employees.push(employee);

    await saveRemoteRecord('employees', employee);
    saveData(STORAGE_KEYS.employees, employees);
  }

  if (type === 'inventory') {
    const inventory = getInventory();
    const id = document.getElementById('entityId').value || crypto.randomUUID();
    const item = {
      id,
      item: payload.item.trim(),
      unit: payload.unit.trim(),
      qty: Number(payload.qty),
      status: payload.status
    };

    const idx = inventory.findIndex(entry => entry.id === id);
    if (idx >= 0) inventory[idx] = item;
    else inventory.push(item);

    await saveRemoteRecord('inventory', item);
    saveData(STORAGE_KEYS.inventory, inventory);
  }

  closeModal();
  renderAll();
}

function bindTableActions() {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const { action, id } = button.dataset;

    if (action === 'delete-product') {
      if (!await deleteRemoteRecord('products', id)) return;
      const products = getProducts().filter(product => product.id !== id);
      saveData(STORAGE_KEYS.products, products);
      renderAll();
    }

    if (action === 'delete-employee') {
      if (!await deleteRemoteRecord('employees', id)) return;
      const employees = getEmployees().filter(item => item.id !== id);
      saveData(STORAGE_KEYS.employees, employees);
      renderAll();
    }

    if (action === 'delete-order') {
      if (!await deleteRemoteRecord('orders', id)) return;
      const orders = getOrders().filter(item => item.id !== id);
      saveData(STORAGE_KEYS.orders, orders);
      renderAll();
    }

    if (action === 'next-order') {
      const orders = getOrders();
      const order = orders.find(item => item.id === id);
      if (!order) return;

      const nextStatus = {
        pending: 'confirmed',
        confirmed: 'delivered',
        delivered: 'delivered',
        cancelled: 'cancelled'
      }[order.status] || 'confirmed';

      try {
        await updateDoc(doc(db, 'orders', id), { status: nextStatus });
      } catch (error) {
        console.error('Không thể cập nhật trạng thái đơn hàng.', error);
        showAdminNotice('Không thể cập nhật đơn hàng trên Firebase. Thử lại sau.');
        return;
      }
      order.status = nextStatus;
      saveData(STORAGE_KEYS.orders, orders);
      renderAll();
    }

    if (action === 'delete-inventory') {
      if (!await deleteRemoteRecord('inventory', id)) return;
      const inventory = getInventory().filter(item => item.id !== id);
      saveData(STORAGE_KEYS.inventory, inventory);
      renderAll();
    }

    if (action === 'edit-product') {
      const product = getProducts().find(item => item.id === id);
      if (product) openModal('product', product);
    }

    if (action === 'edit-employee') {
      const employee = getEmployees().find(item => item.id === id);
      if (employee) openModal('employee', employee);
    }

    if (action === 'edit-inventory') {
      const item = getInventory().find(entry => entry.id === id);
      if (item) openModal('inventory', item);
    }
  });
}

async function resetData() {
  if (!window.confirm('Khôi phục dữ liệu mẫu trên Firebase? Dữ liệu hiện tại sẽ bị thay thế.')) return;

  try {
    for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
      const current = await getDocs(collection(db, key));
      await Promise.all(current.docs.map(snapshot => deleteDoc(snapshot.ref)));
      const records = key === 'products'
        ? sampleData[key].map(product => ({ ...product, active: true }))
        : sampleData[key];
      await Promise.all(records.map(record => saveRemoteRecord(key, record)));
      saveData(storageKey, records);
    }
    renderAll();
    showAdminNotice('Đã khôi phục dữ liệu mẫu trên Firebase.');
  } catch (error) {
    console.error('Không thể khôi phục dữ liệu mẫu trên Firebase.', error);
    showAdminNotice('Không thể khôi phục dữ liệu. Kiểm tra kết nối và quyền Firebase.');
  }
}

function renderAll() {
  renderStats();
  renderRecentOrders();
  renderInventoryAlert();
  renderProducts();
  renderEmployees();
  renderOrders();
  renderInventory();
}

function loginErrorMessage(error) {
  const messages = {
    'auth/invalid-credential': 'Email hoặc mật khẩu không chính xác.',
    'auth/user-not-found': 'Không tìm thấy tài khoản quản trị.',
    'auth/wrong-password': 'Email hoặc mật khẩu không chính xác.',
    'auth/too-many-requests': 'Đăng nhập bị tạm khóa. Vui lòng thử lại sau.',
    'auth/unauthorized-domain': 'Tên miền này chưa được cấp phép trong Firebase Authentication.'
  };
  return messages[error.code] || 'Không thể đăng nhập. Kiểm tra kết nối Firebase rồi thử lại.';
}

function init() {
  bindTabNavigation();
  bindTableActions();

  document.getElementById('entityForm').addEventListener('submit', event => {
    submitEntityForm(event).catch(error => {
      console.error('Không thể lưu dữ liệu lên Firebase.', error);
      const message = document.getElementById('adminActionError');
      message.textContent = 'Không thể lưu lên Firebase. Kiểm tra quyền truy cập và thử lại.';
      message.hidden = false;
    });
  });
  document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
  document.querySelector('.modal-close').addEventListener('click', closeModal);
  document.getElementById('entityModal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
  });

  document.querySelectorAll('.open-modal-btn').forEach(button => {
    button.addEventListener('click', () => {
      openModal(button.dataset.target);
    });
  });

  document.getElementById('resetDataBtn').addEventListener('click', resetData);
  document.getElementById('adminSignOut').addEventListener('click', () => signOut(auth));
  document.getElementById('adminLoginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = document.getElementById('adminLoginMessage');
    message.textContent = 'Đang xác thực...';

    try {
      await signInWithEmailAndPassword(auth, form.get('email'), form.get('password'));
    } catch (error) {
      message.textContent = loginErrorMessage(error);
    }
  });

  onAuthStateChanged(auth, async user => {
    const login = document.getElementById('adminLogin');
    const shell = document.getElementById('adminShell');
    const message = document.getElementById('adminLoginMessage');
    shell.hidden = true;
    login.hidden = false;
    if (!user) return;

    try {
      const adminDocument = await getDoc(doc(db, 'admins', user.uid));
      if (!adminDocument.exists()) {
        message.textContent = 'Tài khoản đã đăng nhập nhưng chưa được cấp quyền admin.';
        await signOut(auth);
        return;
      }

      message.textContent = '';
      await syncCloudData();
      login.hidden = true;
      shell.hidden = false;
      renderAll();
    } catch (error) {
      console.error('Không thể tải dữ liệu quản trị từ Firebase.', error);
      message.textContent = 'Không thể tải dữ liệu. Kiểm tra Firestore Rules và kết nối mạng.';
      await signOut(auth);
    }
  });
}

init();
