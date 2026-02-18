function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

async function loadProducts() {
  const res = await fetch('/api/products');
  const { data } = await res.json();
  const grid = document.getElementById('products');
  grid.innerHTML = '';

  for (const p of data) {
    const card = document.createElement('a');
    card.className = 'product-card';
    card.href = `/product.html?id=${p.id}`;
    card.innerHTML = `
      <img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.style.display='none'">
      <h3>${esc(p.name)}</h3>
      <div class="description">${esc(p.description)}</div>
      <div class="price">ZMW ${Number(p.price).toLocaleString()}</div>
    `;
    grid.appendChild(card);
  }
}

loadProducts();
