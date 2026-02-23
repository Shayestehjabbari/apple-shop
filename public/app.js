function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

let allProducts = [];
let activeCategory = 'All';
let searchQuery = '';
let debounceTimer = null;

async function loadProducts() {
  const res = await fetch('/api/products');
  const { data } = await res.json();
  allProducts = data;
  buildCategoryFilters();
  applyFilters();
}

function buildCategoryFilters() {
  const categories = ['All', ...new Set(allProducts.map(p => p.category).filter(Boolean))];
  const bar = document.getElementById('filter-bar');
  if (!bar) return;

  const pills = bar.querySelector('.category-pills');
  pills.innerHTML = '';
  for (const cat of categories) {
    const btn = document.createElement('button');
    btn.className = 'category-pill' + (cat === activeCategory ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => {
      activeCategory = cat;
      buildCategoryFilters();
      applyFilters();
    };
    pills.appendChild(btn);
  }
}

function applyFilters() {
  let filtered = allProducts;

  // Category filter
  if (activeCategory !== 'All') {
    filtered = filtered.filter(p => p.category === activeCategory);
  }

  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
    );
  }

  renderProducts(filtered);
}

function renderProducts(products) {
  const grid = document.getElementById('products');
  grid.innerHTML = '';

  if (products.length === 0) {
    grid.innerHTML = '<p class="no-products">No products found.</p>';
    return;
  }

  for (const p of products) {
    const card = document.createElement('a');
    card.className = 'product-card';
    card.href = `/product.html?id=${p.id}`;

    const stockClass = p.stock > 0 ? 'stock-available' : 'stock-out';
    const stockText = p.stock > 0 ? `${p.stock} in stock` : 'Out of Stock';

    card.innerHTML = `
      <img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.style.display='none'">
      <h3>${esc(p.name)}</h3>
      <div class="description">${esc(p.description)}</div>
      <div class="price">ZMW ${Number(p.price).toLocaleString()}</div>
      <span class="stock-badge ${stockClass}">${stockText}</span>
    `;
    grid.appendChild(card);
  }
}

// Search input handler
const searchInput = document.getElementById('search-input');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = e.target.value.trim();
      applyFilters();
    }, 250);
  });
}

loadProducts();
