function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

// --- Toast notifications ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- Debounce helper ---
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// --- View switching ---
function switchView(viewId) {
  document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));

  const view = document.getElementById(`view-${viewId}`);
  if (view) view.classList.add('active');

  const navBtn = document.querySelector(`.admin-nav-item[data-view="${viewId}"]`);
  if (navBtn) navBtn.classList.add('active');

  location.hash = viewId;
  closeSidebar();
}

// Sidebar nav clicks
document.querySelectorAll('.admin-nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// Hash-based routing
function routeFromHash() {
  const hash = location.hash.replace('#', '') || 'dashboard';
  switchView(hash);
}
window.addEventListener('hashchange', routeFromHash);

// --- Mobile sidebar ---
function openSidebar() {
  document.getElementById('admin-sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}

function closeSidebar() {
  document.getElementById('admin-sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

document.getElementById('sidebar-toggle').addEventListener('click', openSidebar);
document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

// --- Dashboard stats ---
async function loadDashboard() {
  try {
    const res = await fetch('/api/admin/stats');
    const { data } = await res.json();
    document.getElementById('stat-products').textContent = `${data.totalProducts} (${data.totalStock} units)`;
    document.getElementById('stat-revenue').textContent = `ZMW ${Number(data.revenue).toLocaleString()}`;
    document.getElementById('stat-pending').textContent = data.pendingOrders;
    document.getElementById('stat-stock-warn').textContent = `${data.outOfStock} / ${data.lowStock}`;
  } catch {
    // silent fail — dashboard is non-critical
  }
}

// --- Dashboard recent transactions ---
function renderDashboardRecentTxns() {
  const container = document.getElementById('dashboard-recent-txns');
  const recent = allPayments.slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = '<p class="empty">No transactions yet.</p>';
    return;
  }

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Customer</th>
          <th>Product</th>
          <th>Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const p of recent) {
    const date = new Date(p.createdAt).toLocaleDateString();
    html += `
      <tr>
        <td>${esc(date)}</td>
        <td>${esc(p.customerName || '—')}</td>
        <td>${esc(p.productName || 'Deleted product')}</td>
        <td>ZMW ${Number(p.amount).toLocaleString()}</td>
        <td><span class="status-badge status-${esc(p.status)}">${esc(p.status)}</span></td>
      </tr>
    `;
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

// --- Products ---
let allAdminProducts = [];

async function loadProducts() {
  const res = await fetch('/api/products', { cache: 'no-store' });
  const { data } = await res.json();
  allAdminProducts = data;
  renderProducts(data);
}

function renderProducts(data) {
  const container = document.getElementById('products-list');

  if (data.length === 0) {
    container.innerHTML = '<p class="empty">No products found.</p>';
    return;
  }

  container.innerHTML = '';
  for (const p of data) {
    let stockClass, stockText;
    if (p.stock === 0) {
      stockClass = 'stock-out';
      stockText = 'Out of stock';
    } else if (p.stock < 5) {
      stockClass = 'stock-low';
      stockText = `Low stock (${p.stock})`;
    } else {
      stockClass = 'stock-available';
      stockText = `${p.stock} in stock`;
    }

    const thumbSrc = p.image || '';
    const thumbHtml = thumbSrc
      ? `<img class="admin-row-thumb" src="${esc(thumbSrc)}" alt="">`
      : `<span class="admin-row-thumb" style="display:inline-block"></span>`;

    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <div class="admin-row-info">
        ${thumbHtml}
        <strong>${esc(p.name)}</strong>
        <span>ZMW ${Number(p.price).toLocaleString()}</span>
        <span class="stock-badge ${stockClass}">${stockText}</span>
        ${p.category ? `<span class="category-tag">${esc(p.category)}</span>` : ''}
      </div>
      <div class="admin-row-actions">
        <button class="btn-edit" data-id="${p.id}">Edit</button>
        <button class="btn-delete" data-id="${p.id}">Delete</button>
      </div>
    `;
    row.querySelector('.btn-delete').onclick = async () => {
      if (!confirm(`Delete "${p.name}"?`)) return;
      const res = await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`"${p.name}" deleted`, 'success');
        loadProducts();
        loadDashboard();
      } else {
        showToast('Failed to delete product', 'error');
      }
    };
    row.querySelector('.btn-edit').onclick = () => openProductModal(p);
    container.appendChild(row);
  }
}

// --- Product search ---
document.getElementById('product-search').addEventListener('input', debounce((e) => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) {
    renderProducts(allAdminProducts);
    return;
  }
  const filtered = allAdminProducts.filter(p =>
    p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
  );
  renderProducts(filtered);
}, 250));

// --- Image preview helper ---
function setupImagePreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('change', () => {
    const container = document.getElementById(previewId);
    container.innerHTML = '';
    const files = input.files;
    for (const file of files) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      container.appendChild(img);
    }
  });
}

// --- Product modal ---
const modalOverlay = document.getElementById('product-modal-overlay');
const modalTitle = document.getElementById('product-modal-title');
const modalSubmit = document.getElementById('product-modal-submit');
const productForm = document.getElementById('product-form');

function openProductModal(product) {
  // Reset form
  productForm.reset();
  document.getElementById('pf-id').value = '';
  document.getElementById('pf-image-preview').innerHTML = '';
  document.getElementById('pf-gallery-preview').innerHTML = '';
  document.getElementById('pf-existing-gallery').innerHTML = '';

  if (product) {
    // Edit mode — fetch full product data
    modalTitle.textContent = 'Edit Product';
    modalSubmit.textContent = 'Save Changes';
    fetchAndFillProduct(product.id);
  } else {
    // Add mode
    modalTitle.textContent = 'Add Product';
    modalSubmit.textContent = 'Add Product';
  }

  modalOverlay.classList.add('open');
  setupImagePreview('pf-image', 'pf-image-preview');
  setupImagePreview('pf-gallery', 'pf-gallery-preview');
}

async function fetchAndFillProduct(id) {
  const res = await fetch(`/api/products/${id}`, { cache: 'no-store' });
  const { data: p } = await res.json();
  const images = p.images || [];

  document.getElementById('pf-id').value = p.id;
  document.getElementById('pf-name').value = p.name;
  document.getElementById('pf-price').value = p.price;
  document.getElementById('pf-stock').value = p.stock;
  document.getElementById('pf-category').value = p.category || '';
  document.getElementById('pf-desc').value = p.description || '';

  // Show existing gallery images
  if (images.length > 0) {
    const container = document.getElementById('pf-existing-gallery');
    let html = '<div class="admin-gallery"><p class="gallery-label">Existing gallery images:</p><div class="admin-gallery-grid">';
    for (const img of images) {
      html += `
        <div class="admin-gallery-item" data-id="${img.id}">
          <img src="${esc(img.imagePath)}" alt="Gallery">
          <button type="button" class="gallery-delete-btn" data-img-id="${img.id}">&times;</button>
        </div>
      `;
    }
    html += '</div></div>';
    container.innerHTML = html;

    container.querySelectorAll('.gallery-delete-btn').forEach(btn => {
      btn.onclick = async () => {
        const imgId = btn.dataset.imgId;
        const res = await fetch(`/api/product-images/${imgId}`, { method: 'DELETE' });
        if (res.ok) {
          btn.closest('.admin-gallery-item').remove();
          showToast('Gallery image removed', 'success');
        } else {
          showToast('Failed to delete image', 'error');
        }
      };
    });
  }
}

function closeProductModal() {
  modalOverlay.classList.remove('open');
}

document.getElementById('product-modal-close').addEventListener('click', closeProductModal);
document.getElementById('product-modal-cancel').addEventListener('click', closeProductModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeProductModal();
});

// Form submit — handles both add and edit
productForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('pf-id').value;
  const formData = new FormData();
  formData.append('name', document.getElementById('pf-name').value.trim());
  formData.append('price', document.getElementById('pf-price').value);
  formData.append('stock', document.getElementById('pf-stock').value);
  formData.append('category', document.getElementById('pf-category').value);
  formData.append('description', document.getElementById('pf-desc').value.trim());

  const imageFile = document.getElementById('pf-image').files[0];
  if (imageFile) formData.append('image', imageFile);

  const galleryFiles = document.getElementById('pf-gallery').files;
  for (const f of galleryFiles) formData.append('gallery', f);

  const url = id ? `/api/products/${id}` : '/api/products';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, { method, body: formData });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || `Failed to ${id ? 'update' : 'add'} product`, 'error');
    return;
  }

  closeProductModal();
  showToast(id ? 'Product updated' : `"${document.getElementById('pf-name').value.trim()}" added`, 'success');
  loadProducts();
  loadDashboard();
});

// --- Dropzone feedback ---
function setupDropzone(dropzoneId, inputId) {
  const dropzone = document.getElementById(dropzoneId);
  const input = document.getElementById(inputId);
  if (!dropzone || !input) return;

  dropzone.addEventListener('click', () => input.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    input.files = e.dataTransfer.files;
    input.dispatchEvent(new Event('change'));
  });
}

setupDropzone('pf-image-dropzone', 'pf-image');
setupDropzone('pf-gallery-dropzone', 'pf-gallery');

// --- Payments / Transactions ---
let allPayments = [];
let currentStatusFilter = '';

async function loadPayments() {
  const res = await fetch('/api/payments');
  const { data } = await res.json();

  // Refresh status from PawaPay for pending payments
  const pending = data.filter(p => p.status === 'pending');
  await Promise.all(pending.map(p =>
    fetch(`/api/payments/${p.depositId}/status`).catch(() => {})
  ));

  // Reload if any statuses were updated
  if (pending.length > 0) {
    const updated = await fetch('/api/payments');
    const updatedData = await updated.json();
    data.length = 0;
    data.push(...updatedData.data);
  }

  allPayments = data;
  renderPayments(data);
  renderDashboardRecentTxns();
}

function renderPayments(data) {
  const container = document.getElementById('payments-list');

  if (data.length === 0) {
    container.innerHTML = '<p class="empty">No transactions found.</p>';
    return;
  }

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Customer</th>
          <th>Phone</th>
          <th>Product</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Deposit ID</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const p of data) {
    const date = new Date(p.createdAt).toLocaleString();
    html += `
      <tr class="txn-row" data-deposit="${esc(p.depositId)}">
        <td>${esc(date)}</td>
        <td>${esc(p.customerName || '—')}</td>
        <td>${esc(p.customerPhone || '—')}</td>
        <td>${esc(p.productName || 'Deleted product')}</td>
        <td>ZMW ${Number(p.amount).toLocaleString()}</td>
        <td><span class="status-badge status-${esc(p.status)}">${esc(p.status)}</span></td>
        <td class="deposit-id">${esc(p.depositId)}</td>
        <td><a href="/transaction.html?depositId=${encodeURIComponent(p.depositId)}" class="btn-view" onclick="event.stopPropagation()">View</a></td>
      </tr>
      <tr class="txn-detail-row" id="detail-${esc(p.depositId)}" style="display:none">
        <td colspan="8">
          <div class="txn-detail">
            <div class="txn-detail-grid">
              <div><span class="txn-detail-label">Full Name</span><span>${esc(p.customerName || '—')}</span></div>
              <div><span class="txn-detail-label">Phone</span><span>${esc(p.customerPhone || '—')}</span></div>
              <div><span class="txn-detail-label">Email</span><span>${esc(p.customerEmail || '—')}</span></div>
              <div><span class="txn-detail-label">Address</span><span>${esc(p.customerAddress || '—')}</span></div>
              <div><span class="txn-detail-label">City</span><span>${esc(p.customerCity || '—')}</span></div>
              <div><span class="txn-detail-label">Deposit ID</span><span class="deposit-id">${esc(p.depositId)}</span></div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  html += '</tbody></table>';
  container.innerHTML = html;

  // Toggle detail rows on click
  container.querySelectorAll('.txn-row').forEach(row => {
    row.onclick = () => {
      const detailRow = document.getElementById(`detail-${row.dataset.deposit}`);
      const isOpen = detailRow.style.display !== 'none';
      // Close all open detail rows
      container.querySelectorAll('.txn-detail-row').forEach(r => r.style.display = 'none');
      container.querySelectorAll('.txn-row').forEach(r => r.classList.remove('txn-row-active'));
      if (!isOpen) {
        detailRow.style.display = '';
        row.classList.add('txn-row-active');
      }
    };
  });
}

// --- Transaction filters ---
function filterPayments() {
  const q = document.getElementById('txn-search').value.toLowerCase().trim();

  let filtered = allPayments;
  if (currentStatusFilter) {
    filtered = filtered.filter(p => p.status === currentStatusFilter);
  }
  if (q) {
    filtered = filtered.filter(p =>
      (p.customerName || '').toLowerCase().includes(q) ||
      (p.customerPhone || '').toLowerCase().includes(q) ||
      (p.productName || '').toLowerCase().includes(q)
    );
  }
  renderPayments(filtered);
}

document.getElementById('txn-search').addEventListener('input', debounce(filterPayments, 250));

// Filter pills
document.querySelectorAll('#txn-status-pills .admin-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#txn-status-pills .admin-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentStatusFilter = pill.dataset.status;
    filterPayments();
  });
});

// Init
routeFromHash();
loadDashboard();
loadProducts();
loadPayments();
