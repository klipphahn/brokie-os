(function () {
  var script = document.currentScript;
  var host = document.querySelector(script.dataset.target || "[data-brokie-merch]");
  if (!host) return;
  var origin = new URL(script.src).origin;
  var feed = script.dataset.feed || origin + "/api/storefront/featured";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  function node(tag, className, value) {
    var item = document.createElement(tag);
    if (className) item.className = className;
    if (value) item.textContent = value;
    return item;
  }
  function anchor(className, value, url) {
    var item = node("a", className, value);
    item.href = url;
    return item;
  }
  function money(value, currency) {
    return value == null ? "" : new Intl.NumberFormat(undefined, {
      style: "currency", currency: currency || "USD"
    }).format(value);
  }

  var style = node("style");
  style.textContent = `
    :host{display:block}.bb{--bg:#080808;--panel:#151515;--orange:#ff4f00;--gold:#ffc107;--text:#fff;--muted:#999;background:var(--bg);color:var(--text);font-family:Arial,sans-serif;padding:48px clamp(18px,5vw,70px)}
    *{box-sizing:border-box}.head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:22px}.eyebrow{color:var(--orange);font-weight:900;font-size:11px;letter-spacing:.16em}.head h2{font-size:clamp(36px,6vw,72px);line-height:.9;margin:8px 0;text-transform:uppercase}.head p{color:var(--muted);max-width:560px}.all{color:#fff;border:2px solid var(--orange);background:var(--orange);padding:12px 18px;text-decoration:none;font-weight:900;white-space:nowrap}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}.card{position:relative;background:var(--panel);border:1px solid #333}.image{display:block;aspect-ratio:1;background:#222;overflow:hidden}.image img{width:100%;height:100%;object-fit:cover;transition:transform .2s}.card:hover img{transform:scale(1.025)}.body{padding:14px}.body strong{display:block;text-transform:uppercase}.body small{display:block;color:var(--muted);min-height:18px;margin:5px 0}.price{color:var(--gold);font-weight:900}.badge{position:absolute;z-index:1;top:9px;left:9px;background:var(--orange);padding:5px 7px;font-size:9px;font-weight:900}.empty{color:var(--muted);text-align:center;padding:30px}
    @media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.head{align-items:start;flex-direction:column}.grid{grid-template-columns:1fr}}
  `;
  root.appendChild(style);
  root.appendChild(node("div", "empty", "Loading The Brokie goods…"));

  fetch(feed, { headers: { Accept: "application/json" } })
    .then(function (response) { if (!response.ok) throw new Error(); return response.json(); })
    .then(function (data) {
      if (!data.ok) throw new Error();
      while (root.childNodes.length > 1) root.removeChild(root.lastChild);
      var store = data.storefront;
      var wrap = node("section", "bb");
      Object.keys(store.palette || {}).forEach(function (key) {
        wrap.style.setProperty("--" + (key === "background" ? "bg" : key), store.palette[key]);
      });
      var head = node("div", "head");
      var copy = node("div");
      copy.append(node("span", "eyebrow", store.hero.eyebrow), node("h2", "", store.collection.title), node("p", "", store.collection.description));
      head.append(copy, anchor("all", "SHOP ALL", store.collection.url));
      wrap.appendChild(head);
      var grid = node("div", "grid");
      (data.products || []).forEach(function (product) {
        var card = node("article", "card");
        if (product.badge) card.appendChild(node("span", "badge", product.badge));
        var imageLink = anchor("image", "", product.url);
        if (product.image) { var image = node("img"); image.src = product.image; image.alt = product.imageAlt || product.title; image.loading = "lazy"; imageLink.appendChild(image); }
        var body = node("div", "body");
        body.append(node("strong", "", product.title), node("small", "", product.subtitle || ""), node("span", "price", money(product.price, product.currencyCode)));
        card.append(imageLink, body); grid.appendChild(card);
      });
      if (!(data.products || []).length) grid.appendChild(node("div", "empty", "The next drop is still building."));
      wrap.appendChild(grid); root.appendChild(wrap);
    })
    .catch(function () {
      while (root.childNodes.length > 1) root.removeChild(root.lastChild);
      root.appendChild(node("div", "empty", "The Brokie goods are temporarily unavailable."));
    });
})();
