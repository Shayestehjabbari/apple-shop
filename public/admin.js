function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

// --- Products ---
async function loadProducts() {
  const res = await fetch('/api/products', { cache: 'no-store' });
  const { data } = await res.json();
  const container = document.getElementById('products-list');

  if (data.length === 0) {
    container.innerHTML = '<p class="empty">No products yet.</p>';
    return;
  }

  container.innerHTML = '';
  for (const p of data) {
    const stockClass = p.stock > 0 ? 'stock-available' : 'stock-out';
    const stockText = p.stock > 0 ? `${p.stock} in stock` : 'Out of stock';
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <div class="admin-row-info">
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
      await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
      loadProducts();
    };
    row.querySelector('.btn-edit').onclick = () => showEditForm(p);
    container.appendChild(row);
  }
}

// --- Edit product ---
async function showEditForm(product) {
  // Fetch full product to get gallery images
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
        <option value="Accessories" ${fullProduct.category === 'Accessories' ? 'selected' : ''}>Accessories</option>
        <option value="Cases" ${fullProduct.category === 'Cases' ? 'selected' : ''}>Cases</option>
      </select>
      <label class="file-label">Main Image <input type="file" id="e-image" accept="image/*"></label>
      <label class="file-label">Add Gallery Images <input type="file" id="e-gallery" accept="image/*" multiple></label>
      <textarea id="e-desc" placeholder="Description" rows="2">${esc(fullProduct.description || '')}</textarea>
      ${galleryHtml}
      <div class="edit-form-actions">
        <button type="submit" class="btn-primary">Save Changes</button>
        <button type="button" id="edit-cancel" class="btn-cancel">Cancel</button>
      </div>
    </form>
  `;

  // Gallery delete buttons
  container.querySelectorAll('.gallery-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const imgId = btn.dataset.imgId;
      await fetch(`/api/product-images/${imgId}`, { method: 'DELETE' });
      btn.closest('.admin-gallery-item').remove();
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
      alert(err.error || 'Failed to update product');
      return;
    }

    container.style.display = 'none';
    loadProducts();
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

  await fetch('/api/products', {
    method: 'POST',
    body: formData,
  });

  document.getElementById('add-form').reset();
  loadProducts();
};

// --- Payments / Transactions ---
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
  const container = document.getElementById('payments-list');

  if (data.length === 0) {
    container.innerHTML = '<p class="empty">No transactions yet.</p>';
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

// Init
loadProducts();
loadPayments();
