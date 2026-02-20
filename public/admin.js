function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

// --- Products ---
async function loadProducts() {
  const res = await fetch('/api/products');
  const { data } = await res.json();
  const container = document.getElementById('products-list');

  if (data.length === 0) {
    container.innerHTML = '<p class="empty">No products yet.</p>';
    return;
  }

  container.innerHTML = '';
  for (const p of data) {
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <div class="admin-row-info">
        <strong>${esc(p.name)}</strong>
        <span>ZMW ${Number(p.price).toLocaleString()}</span>
      </div>
      <button class="btn-delete" data-id="${p.id}">Delete</button>
    `;
    row.querySelector('.btn-delete').onclick = async () => {
      if (!confirm(`Delete "${p.name}"?`)) return;
      await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
      loadProducts();
    };
    container.appendChild(row);
  }
}

// --- Add product ---
document.getElementById('add-form').onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('p-name').value.trim();
  const price = parseFloat(document.getElementById('p-price').value);
  const imageFile = document.getElementById('p-image').files[0];
  const description = document.getElementById('p-desc').value.trim();

  if (!name || !price) return;

  const formData = new FormData();
  formData.append('name', name);
  formData.append('price', price);
  formData.append('description', description);
  if (imageFile) formData.append('image', imageFile);

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
