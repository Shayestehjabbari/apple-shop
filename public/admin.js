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
    row.querySelector('.btn-edit').onclick = () => showEditForm(p);
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
function setupImagePreview(inputId, previewId, multiple) {
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

// Setup previews for the add form
setupImagePreview('p-image', 'p-image-preview', false);
setupImagePreview('p-gallery', 'p-gallery-preview', true);

// --- Edit product ---
async function showEditForm(product) {
  const res = await fetch(`/api/products/${product.id}`, { cache: 'no-store' });
  const { data: fullProduct } = await res.json();
  const images = fullProduct.images || [];

  const container = document.getElementById('edit-section');
  container.style.display = 'block';

  let galleryHtml = '';
  if (images.length > 0) {
    galleryHtml = '<div class="admin-gallery"><p class="gallery-label">Gallery images:</p><div class="admin-gallery-grid">';
    for (const img of images) {
      galleryHtml += `
        <div class="admin-gallery-item" data-id="${img.id}">
          <img src="${esc(img.imagePath)}" alt="Gallery">
          <button type="button" class="gallery-delete-btn" data-img-id="${img.id}">&times;</button>
        </div>
      `;
    }
    galleryHtml += '</div></div>';
  }

  container.innerHTML = `
    <h2>Edit Product</h2>
    <form id="edit-form" class="add-form">
      <input type="text" id="e-name" value="${esc(fullProduct.name)}" placeholder="Product name" required>
      <input type="number" id="e-price" value="${fullProduct.price}" placeholder="Price (ZMW)" step="0.01" required>
      <input type="number" id="e-stock" value="${fullProduct.stock}" placeholder="Stock quantity" min="0">
      <select id="e-category">
        <option value="">— Category —</option>
        <option value="iPhone" ${fullProduct.category === 'iPhone' ? 'selected' : ''}>iPhone</option>
        <option value="Laptop" ${fullProduct.category === 'Laptop' ? 'selected' : ''}>Laptop</option>
        <option value="Tablet" ${fullProduct.category === 'Tablet' ? 'selected' : ''}>Tablet</option>
        <option value="Accessories" ${fullProduct.category === 'Accessories' ? 'selected' : ''}>Accessories</option>
        <option value="Cases" ${fullProduct.category === 'Cases' ? 'selected' : ''}>Cases</option>
      </select>
      <label class="file-label">Main Image <input type="file" id="e-image" accept="image/*"></label>
      <div id="e-image-preview" class="image-preview-area"></div>
      <label class="file-label">Add Gallery Images <input type="file" id="e-gallery" accept="image/*" multiple></label>
      <div id="e-gallery-preview" class="image-preview-row"></div>
      <textarea id="e-desc" placeholder="Description" rows="2">${esc(fullProduct.description || '')}</textarea>
      ${galleryHtml}
      <div class="edit-form-actions">
        <button type="submit" class="btn-primary">Save Changes</button>
        <button type="button" id="edit-cancel" class="btn-cancel">Cancel</button>
      </div>
    </form>
  `;

  // Setup image previews for edit form
  setupImagePreview('e-image', 'e-image-preview', false);
  setupImagePreview('e-gallery', 'e-gallery-preview', true);

  // Gallery delete buttons
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

  document.getElementById('edit-cancel').onclick = () => {
    container.style.display = 'none';
  };

  document.getElementById('edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', document.getElementById('e-name').value.trim());
    formData.append('price', document.getElementById('e-price').value);
    formData.append('stock', document.getElementById('e-stock').value);
    formData.append('category', document.getElementById('e-category').value);
    formData.append('description', document.getElementById('e-desc').value.trim());

    const imageFile = document.getElementById('e-image').files[0];
    if (imageFile) formData.append('image', imageFile);

    const galleryFiles = document.getElementById('e-gallery').files;
    for (const f of galleryFiles) formData.append('gallery', f);

    const res = await fetch(`/api/products/${fullProduct.id}`, {
      method: 'PUT',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Failed to update product', 'error');
      return;
    }

    container.style.display = 'none';
    showToast('Product updated', 'success');
    loadProducts();
    loadDashboard();
  };

  container.scrollIntoView({ behavior: 'smooth' });
}

// --- Add product ---
document.getElementById('add-form').onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('p-name').value.trim();
  const price = parseFloat(document.getElementById('p-price').value);
  const stock = document.getElementById('p-stock').value;
  const category = document.getElementById('p-category').value;
  const imageFile = document.getElementById('p-image').files[0];
  const galleryFiles = document.getElementById('p-gallery').files;
  const description = document.getElementById('p-desc').value.trim();

  if (!name || !price) return;

  const formData = new FormData();
  formData.append('name', name);
  formData.append('price', price);
  formData.append('stock', stock);
  formData.append('category', category);
  formData.append('description', description);
  if (imageFile) formData.append('image', imageFile);
  for (const f of galleryFiles) formData.append('gallery', f);

  const res = await fetch('/api/products', {
    method: 'POST',
    body: formData,
  });

  if (res.ok) {
    document.getElementById('add-form').reset();
    document.getElementById('p-image-preview').innerHTML = '';
    document.getElementById('p-gallery-preview').innerHTML = '';
    showToast(`"${name}" added`, 'success');
    loadProducts();
    loadDashboard();
  } else {
    showToast('Failed to add product', 'error');
  }
};

// --- Payments / Transactions ---
let allPayments = [];

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
        </tr>
      </thead>
      <tbody>
  `;

  for (const p of data) {
    const date = new Date(p.createdAt).toLocaleString();
    html += `
      <tr>
        <td>${esc(date)}</td>
        <td>${esc(p.customerName || '—')}</td>
        <td>${esc(p.customerPhone || '—')}</td>
        <td>${esc(p.productName || 'Deleted product')}</td>
        <td>ZMW ${Number(p.amount).toLocaleString()}</td>
        <td><span class="status-badge status-${esc(p.status)}">${esc(p.status)}</span></td>
        <td class="deposit-id">${esc(p.depositId)}</td>
      </tr>
    `;
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

// --- Transaction filters ---
function filterPayments() {
  const q = document.getElementById('txn-search').value.toLowerCase().trim();
  const status = document.getElementById('txn-status-filter').value;

  let filtered = allPayments;
  if (status) {
    filtered = filtered.filter(p => p.status === status);
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
document.getElementById('txn-status-filter').addEventListener('change', filterPayments);

// Init
loadDashboard();
loadProducts();
loadPayments();
