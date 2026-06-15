/* ──────────────────────────────────────────────────────────────
   Ink Vial - self-contained basket
   Works with the existing .snipcart-add-item buttons and
   .snipcart-checkout / .snipcart-items-count elements.
   Stores the basket in localStorage so it survives page loads.
   No external service required. Swap checkout() for Snipcart/Stripe
   when you're ready to take live payments.
   ────────────────────────────────────────────────────────────── */
(function () {
  const STORAGE_KEY = 'inkvial_cart_v1';
  const SHIPPING = 3.50;
  const FREE_SHIP_OVER = 40;   // free UK shipping once subtotal reaches this
  const EMAIL = 'hello@inkvial.co.uk';

  const inks = (typeof INKS !== 'undefined') ? INKS : [];
  const inkById = {};
  inks.forEach(i => { inkById[i.id] = i; });

  let cart = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); }

  const money = n => '£' + n.toFixed(2);
  const itemCount = () => cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = () => cart.reduce((s, i) => s + i.price * i.qty, 0);

  // ── Inject styles ──────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .iv-cart-overlay{position:fixed;inset:0;background:rgba(42,24,64,0.45);backdrop-filter:blur(3px);opacity:0;visibility:hidden;transition:opacity .25s;z-index:9998;}
    .iv-cart-overlay.open{opacity:1;visibility:visible;}
    .iv-cart{position:fixed;top:0;right:0;height:100%;width:400px;max-width:90vw;background:#faf3e8;box-shadow:-8px 0 40px rgba(42,24,64,0.25);transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);z-index:9999;display:flex;flex-direction:column;font-family:'Nunito',sans-serif;}
    .iv-cart.open{transform:translateX(0);}
    .iv-cart-head{display:flex;align-items:center;justify-content:space-between;padding:22px 24px;border-bottom:1px solid rgba(176,154,216,0.3);}
    .iv-cart-head h2{font-family:'Playfair Display',serif;font-size:1.35rem;font-weight:700;color:#3d2458;}
    .iv-cart-close{background:none;border:none;cursor:pointer;font-size:1.5rem;line-height:1;color:#8b68cc;padding:4px;}
    .iv-cart-close:hover{color:#3d2458;}
    .iv-cart-body{flex:1;overflow-y:auto;padding:8px 24px;}
    .iv-empty{text-align:center;padding:60px 20px;color:rgba(61,36,88,0.5);}
    .iv-empty svg{width:48px;height:48px;stroke:#d4c4ee;fill:none;stroke-width:1.5;margin-bottom:14px;}
    .iv-empty p{font-size:.95rem;margin-bottom:18px;}
    .iv-line{display:flex;gap:12px;padding:16px 0;border-bottom:1px solid rgba(176,154,216,0.2);}
    .iv-thumb{width:56px;height:56px;border-radius:10px;flex-shrink:0;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.12);}
    .iv-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
    .iv-line-info{flex:1;min-width:0;}
    .iv-line-brand{font-size:.6rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:rgba(61,36,88,0.45);}
    .iv-line-name{font-family:'Playfair Display',serif;font-size:.95rem;font-weight:700;color:#3d2458;margin-bottom:6px;line-height:1.2;}
    .iv-line-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;}
    .iv-qty{display:flex;align-items:center;border:1.5px solid rgba(176,154,216,0.4);border-radius:7px;overflow:hidden;background:#fff;}
    .iv-qty button{width:26px;height:26px;border:none;background:none;cursor:pointer;color:#5c3a9a;font-weight:700;font-size:1rem;display:flex;align-items:center;justify-content:center;}
    .iv-qty button:hover{background:#ede6f8;}
    .iv-qty span{width:26px;text-align:center;font-size:.85rem;font-weight:700;color:#3d2458;}
    .iv-line-price{font-size:.9rem;font-weight:800;color:#5c3a9a;}
    .iv-remove{background:none;border:none;cursor:pointer;font-size:.72rem;font-weight:700;color:rgba(61,36,88,0.4);text-transform:uppercase;letter-spacing:.06em;margin-top:4px;}
    .iv-remove:hover{color:#c0405a;}
    .iv-cart-foot{padding:20px 24px 24px;border-top:1px solid rgba(176,154,216,0.3);background:#fff;}
    .iv-row{display:flex;justify-content:space-between;font-size:.9rem;color:rgba(61,36,88,0.65);margin-bottom:8px;}
    .iv-row.total{font-size:1.15rem;font-weight:800;color:#3d2458;margin:12px 0 4px;}
    .iv-ship-note{font-size:.72rem;color:rgba(61,36,88,0.5);margin-bottom:14px;}
    .iv-ship-note strong{color:#5c3a9a;}
    .iv-ship-note.iv-ship-win{color:#2d7a3a;font-weight:700;}
    .iv-ship-bar{height:6px;border-radius:3px;background:#ede6f8;overflow:hidden;margin-bottom:8px;}
    .iv-ship-fill{height:100%;background:linear-gradient(90deg,#b09ad8,#8b68cc);border-radius:3px;transition:width .35s ease;}
    .iv-empty-btn{width:100%;margin-top:10px;padding:8px;background:none;border:none;cursor:pointer;font-family:'Nunito',sans-serif;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(61,36,88,0.4);}
    .iv-empty-btn:hover{color:#c0405a;}
    .iv-checkout{width:100%;padding:15px;background:#5c3a9a;color:#fff;border:none;border-radius:9px;font-family:'Nunito',sans-serif;font-size:.92rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:background .2s,transform .1s;}
    .iv-checkout:hover{background:#8b68cc;transform:translateY(-1px);}
    .iv-checkout:disabled{background:#c4b0e4;cursor:not-allowed;transform:none;}
    .iv-cart-btn{display:inline-flex;align-items:center;gap:6px;}
    .iv-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;background:#f5a0b0;color:#fff;border-radius:9px;font-size:.7rem;font-weight:800;}
    @keyframes iv-pop{0%{transform:scale(1);}40%{transform:scale(1.25);}100%{transform:scale(1);}}
    .iv-pop{animation:iv-pop .35s ease;}
  `;
  document.head.appendChild(style);

  // ── Build drawer ───────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'iv-cart-overlay';
  const drawer = document.createElement('aside');
  drawer.className = 'iv-cart';
  drawer.setAttribute('aria-label', 'Shopping basket');
  drawer.innerHTML = `
    <div class="iv-cart-head">
      <h2>Your Basket</h2>
      <button class="iv-cart-close" aria-label="Close basket">&times;</button>
    </div>
    <div class="iv-cart-body" id="iv-body"></div>
    <div class="iv-cart-foot" id="iv-foot"></div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  const body = drawer.querySelector('#iv-body');
  const foot = drawer.querySelector('#iv-foot');
  drawer.querySelector('.iv-cart-close').addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);

  function openCart() { render(); overlay.classList.add('open'); drawer.classList.add('open'); }
  function closeCart() { overlay.classList.remove('open'); drawer.classList.remove('open'); }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    if (!cart.length) {
      body.innerHTML = `
        <div class="iv-empty">
          <svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
          <p>Your basket is empty.</p>
        </div>`;
      foot.innerHTML = `<button class="iv-checkout" disabled>Checkout</button>`;
      return;
    }
    body.innerHTML = cart.map((it, idx) => {
      const ink = inkById[it.id];
      const thumb = (ink && ink.image)
        ? `<img src="${ink.image}" alt="${it.name}" />`
        : `<div style="width:100%;height:100%;background:linear-gradient(160deg,${(ink&&ink.colorPrimary)||'#8b68cc'},${(ink&&ink.colorDark)||'#5c3a9a'})"></div>`;
      return `
        <div class="iv-line">
          <div class="iv-thumb">${thumb}</div>
          <div class="iv-line-info">
            <div class="iv-line-brand">${it.brand||''}</div>
            <div class="iv-line-name">${it.name}</div>
            <div class="iv-line-bottom">
              <div class="iv-qty">
                <button data-act="dec" data-i="${idx}" aria-label="Decrease">−</button>
                <span>${it.qty}</span>
                <button data-act="inc" data-i="${idx}" aria-label="Increase">+</button>
              </div>
              <div class="iv-line-price">${money(it.price * it.qty)}</div>
            </div>
            <button class="iv-remove" data-act="rm" data-i="${idx}">Remove</button>
          </div>
        </div>`;
    }).join('');

    const sub = subtotal();
    const freeShip = sub >= FREE_SHIP_OVER;
    const ship = freeShip ? 0 : SHIPPING;
    const total = sub + ship;

    let nudge;
    if (freeShip) {
      nudge = `<div class="iv-ship-bar"><div class="iv-ship-fill" style="width:100%"></div></div>
               <div class="iv-ship-note iv-ship-win">🎉 You've unlocked free UK shipping!</div>`;
    } else {
      const remaining = FREE_SHIP_OVER - sub;
      const pct = Math.min(100, (sub / FREE_SHIP_OVER) * 100);
      nudge = `<div class="iv-ship-bar"><div class="iv-ship-fill" style="width:${pct}%"></div></div>
               <div class="iv-ship-note">Spend <strong>${money(remaining)}</strong> more for free UK shipping</div>`;
    }

    foot.innerHTML = `
      ${nudge}
      <div class="iv-row"><span>Subtotal (${itemCount()} item${itemCount()!==1?'s':''})</span><span>${money(sub)}</span></div>
      <div class="iv-row"><span>Shipping</span><span>${freeShip ? '<strong style="color:#2d7a3a">FREE</strong>' : money(SHIPPING)}</span></div>
      <div class="iv-row total"><span>Total</span><span>${money(total)}</span></div>
      <button class="iv-checkout" id="iv-checkout">Checkout - ${money(total)}</button>
      <button class="iv-empty-btn" id="iv-empty">Empty basket</button>
    `;
    foot.querySelector('#iv-checkout').addEventListener('click', checkout);
    foot.querySelector('#iv-empty').addEventListener('click', () => {
      cart = []; save(); render(); updateBadges();
    });
  }

  // delegated qty / remove inside drawer
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const i = +btn.dataset.i;
    const act = btn.dataset.act;
    if (act === 'inc') cart[i].qty++;
    else if (act === 'dec') { cart[i].qty--; if (cart[i].qty < 1) cart.splice(i, 1); }
    else if (act === 'rm') cart.splice(i, 1);
    save(); render(); updateBadges();
  });

  // ── Add to cart (capture phase so card-nav stopPropagation can't block us) ──
  document.addEventListener('click', (e) => {
    const add = e.target.closest('.snipcart-add-item');
    if (add) {
      e.preventDefault(); e.stopPropagation();
      const id = add.getAttribute('data-item-id');
      const price = parseFloat(add.getAttribute('data-item-price')) || 0;
      const name = add.getAttribute('data-item-name') || (inkById[id] && (inkById[id].brand+' '+inkById[id].name)) || 'Ink';
      const qty = parseInt(add.getAttribute('data-item-quantity')) || 1;
      const ink = inkById[id] || {};
      // Defensive: never add a sold-out ink
      if (typeof getStockStatus === 'function' && getStockStatus(ink) === 'out') return;
      addItem({ id, name: ink.name || name, brand: ink.brand || '', price, qty });
      return;
    }
    const checkoutBtn = e.target.closest('.snipcart-checkout');
    if (checkoutBtn) { e.preventDefault(); e.stopPropagation(); openCart(); }
  }, true);

  function addItem(item) {
    const existing = cart.find(c => c.id === item.id);
    if (existing) existing.qty += item.qty;
    else cart.push(item);
    save(); updateBadges(); openCart();
  }

  // ── Badges in nav ──────────────────────────────────────────
  function updateBadges() {
    const n = itemCount();
    document.querySelectorAll('.snipcart-items-count').forEach(el => {
      el.textContent = n;
      el.classList.remove('iv-pop'); void el.offsetWidth; el.classList.add('iv-pop');
    });
  }

  // ── Checkout - Stripe in production, email fallback locally ──
  async function checkout() {
    if (!cart.length) return;
    const btn = document.getElementById('iv-checkout');
    if (btn) { btn.disabled = true; btn.textContent = 'Taking you to checkout…'; }
    try {
      let res;
      try {
        res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cart.map(i => ({ id: i.id, qty: i.qty })) })
        });
      } catch (netErr) {
        // No endpoint reachable at all (e.g. running locally): email the order
        emailOrder();
        if (btn) { btn.disabled = false; render(); }
        return;
      }
      // The endpoint exists but rejected the order - show its reason, do not
      // silently switch to email.
      const FAIL = 'Sorry, we could not start checkout just now. Please try again, or email ' + EMAIL + '.';
      // The endpoint exists but rejected the order - show its reason, do not
      // silently switch to email.
      if (!res.ok) {
        let msg = FAIL;
        try { const err = await res.json(); if (err && err.error) msg = err.error; } catch (e) {}
        render();                 // resets the button; rebuilds the footer
        showCheckoutError(msg);   // ...so the banner must go in afterwards
        return;
      }
      const data = await res.json();
      if (data && data.url) { window.location.href = data.url; return; }
      render();
      showCheckoutError(FAIL);
    } catch (e) {
      render();
      showCheckoutError('Sorry, we could not start checkout just now. Please try again, or email ' + EMAIL + '.');
    }
  }

  function showCheckoutError(msg) {
    const el = document.createElement('div');
    el.id = 'iv-checkout-error';
    el.style.cssText = 'margin:0 0 10px;padding:10px 14px;border-radius:10px;background:#fbe6e6;color:#7a1f1f;font-size:14px;line-height:1.4;';
    el.textContent = msg;
    if (foot) foot.insertBefore(el, foot.firstChild);
  }

  function emailOrder() {
    const sub = subtotal();
    const ship = sub >= FREE_SHIP_OVER ? 0 : SHIPPING;
    const lines = cart.map(i => `${i.qty} x ${i.brand} ${i.name} (${money(i.price)} each) = ${money(i.price*i.qty)}`);
    lines.push('');
    lines.push(`Subtotal: ${money(sub)}`);
    lines.push(`Shipping: ${ship === 0 ? 'FREE' : money(ship)}`);
    lines.push(`Total: ${money(sub + ship)}`);
    const body = encodeURIComponent(
      "Hi Ink Vial,\n\nI'd like to order the following:\n\n" + lines.join('\n') +
      "\n\nMy delivery address:\n\n\nThank you!"
    );
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Ink Vial order')}&body=${body}`;
  }

  // Let the success page clear the basket after payment
  window.IVCartClear = function () { cart = []; save(); updateBadges(); };

  // init
  updateBadges();
  window.IVCart = { open: openCart, close: closeCart, get: () => cart };
})();
