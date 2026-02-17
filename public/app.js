const cart = [];

function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}

// Load categories
async function loadCategories() {
  const { data } = await fetchJSON('/api/categories');
  const nav = document.getElementById('categories');
  const allBtn = document.createElement('button');
  allBtn.className = 'cat-btn active';
  allBtn.textContent = 'All';
  allBtn.onclick = () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    loadProducts();
  };
  nav.appendChild(allBtn);

  for (const cat of data) {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.textContent = cat;
    btn.onclick = () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadProducts(cat);
    };
    nav.appendChild(btn);
  }
}

// Load products
async function loadProducts(category) {
  const url = category ? `/api/products?category=${encodeURIComponent(category)}` : '/api/products';
  const { data } = await fetchJSON(url);
  const grid = document.getElementById('products');
  grid.innerHTML = '';

  for (const p of data) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.style.display='none'">
      <h3>${esc(p.name)}</h3>
      <div class="category">${esc(p.category)}</div>
      <div class="description">${esc(p.description)}</div>
      <div class="price">$${p.price.toLocaleString()}</div>
      <button class="add-btn" data-id="${p.id}">Add to Cart</button>
    `;
    card.querySelector('.add-btn').onclick = () => addToCart(p);
    grid.appendChild(card);
  }
}

// Cart logic
function addToCart(product) {
  const existing = cart.find(i => i.product.id === product.id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ product, quantity: 1 });
  }
  updateCartUI();
}

function removeFromCart(productId) {
  const idx = cart.findIndex(i => i.product.id === productId);
  if (idx !== -1) cart.splice(idx, 1);
  updateCartUI();
}

function changeQty(productId, delta) {
  const item = cart.find(i => i.product.id === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  updateCartUI();
}

function getTotal() {
  return cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
}

function updateCartUI() {
  const countEl = document.getElementById('cart-count');
  const totalEl = document.getElementById('cart-total');
  const itemsEl = document.getElementById('cart-items');
  const checkoutBtn = document.getElementById('checkout-btn');

  const totalQty = cart.reduce((sum, i) => sum + i.quantity, 0);
  countEl.textContent = totalQty;
  totalEl.textContent = getTotal().toLocaleString('en-US', { minimumFractionDigits: 2 });
  checkoutBtn.disabled = cart.length === 0;

  if (cart.length === 0) {
    itemsEl.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
    return;
  }

  itemsEl.innerHTML = '';
  for (const item of cart) {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item-info">
        <h4>${esc(item.product.name)}</h4>
        <span>$${item.product.price.toLocaleString()} each</span>
      </div>
      <div class="cart-item-actions">
        <button class="qty-btn minus">-</button>
        <span>${item.quantity}</span>
        <button class="qty-btn plus">+</button>
      </div>
    `;
    div.querySelector('.minus').onclick = () => changeQty(item.product.id, -1);
    div.querySelector('.plus').onclick = () => changeQty(item.product.id, 1);
    itemsEl.appendChild(div);
  }
}

// Cart panel toggle
function toggleCart(show) {
  document.getElementById('cart-panel').classList.toggle('hidden', !show);
  document.getElementById('overlay').classList.toggle('hidden', !show);
  // Reset checkout state
  document.getElementById('checkout-form').classList.add('hidden');
  document.getElementById('order-success').classList.add('hidden');
}

document.getElementById('cart-btn').onclick = () => toggleCart(true);
document.getElementById('close-cart').onclick = () => toggleCart(false);
document.getElementById('overlay').onclick = () => toggleCart(false);

// Checkout
document.getElementById('checkout-btn').onclick = () => {
  document.getElementById('checkout-form').classList.remove('hidden');
};

document.getElementById('place-order-btn').onclick = async () => {
  const name = document.getElementById('cust-name').value.trim();
  const email = document.getElementById('cust-email').value.trim();

  if (!name || !email) {
    alert('Please fill in your name and email.');
    return;
  }

  const items = cart.map(i => ({ productId: i.product.id, quantity: i.quantity }));

  const result = await fetchJSON('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerName: name, customerEmail: email, items }),
  });

  if (result.success) {
    cart.length = 0;
    updateCartUI();
    document.getElementById('checkout-form').classList.add('hidden');
    const successEl = document.getElementById('order-success');
    successEl.classList.remove('hidden');
    successEl.innerHTML = `
      <h3>Order Placed!</h3>
      <p>Order #${result.data.orderId}</p>
      <p>Total: $${result.data.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
      <p>${result.data.itemCount} item(s)</p>
    `;
  } else {
    alert('Error: ' + result.error);
  }
};

// Init
loadCategories();
loadProducts();
updateCartUI();
