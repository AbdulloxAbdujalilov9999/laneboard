/* =====================================================================
   Haulwise Loads — read-only loads & lanes viewer for Haulwise Dispatch.
   Static, no build step (same convention as Haulwise Dispatch). Signs in
   with the same accounts and reads loads through the same Apps Script
   backend (`loadAll`); it never writes anything back — loads are only
   created/edited in Haulwise Dispatch, including the "Mark as lane" flag.
   ===================================================================== */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const perMile = (amount, miles) => Number(miles) > 0 ? Math.round(Number(amount || 0) / Number(miles) * 100) / 100 : null;
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtDateTime = iso => iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const label = s => String(s || "").replace(/_/g, " ").replace(/\w\S*/g, t => t[0].toUpperCase() + t.slice(1).toLowerCase());
const badge = s => `<span class="badge b-${esc(s)}">${esc(label(s))}</span>`;

/* ---- icon set (inline SVG, no emoji) ---- */
const svg = (path, vb = "0 0 24 24") => `<svg viewBox="${vb}" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const ICONS = {
  arrow: svg(`<path d="M4 12h15M14 6l6 6-6 6"/>`),
  chevronDown: svg(`<path d="M6 9l6 6 6-6"/>`),
  chevronLeft: svg(`<path d="M15 6l-6 6 6 6"/>`),
  chevronRight: svg(`<path d="M9 6l6 6-6 6"/>`),
  calendar: svg(`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>`),
  route: svg(`<path d="M5 19c1.5 0 2-1 2.2-2.4L9 6.4C9.2 5 9.7 4 11 4s1.8 1 2 2.4l1.8 10.2c.2 1.4.7 2.4 2.2 2.4"/><circle cx="6" cy="19" r="1.4"/><circle cx="18" cy="19" r="1.4"/>`),
  dollar: svg(`<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`),
  cash: svg(`<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 10v.01M18 14v.01"/>`),
  note: svg(`<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>`),
  sun: svg(`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`),
  moon: svg(`<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>`),
  search: svg(`<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>`),
  tag: svg(`<path d="M20.59 13.41 12 22l-8.59-8.59a2 2 0 0 1 0-2.82L11 3h9v9z"/><circle cx="16.5" cy="7.5" r="1.5"/>`),
  truck: svg(`<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>`),
  filter: svg(`<path d="M4 5h16M7 12h10M10 19h4"/>`),
  refresh: svg(`<path d="M4 12a8 8 0 0 1 14.3-5"/><path d="M18 3v5h-5"/><path d="M20 12a8 8 0 0 1-14.3 5"/><path d="M6 21v-5h5"/>`),
  logout: svg(`<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>`),
  user: svg(`<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>`),
};
const icon = (name, cls = "") => `<span class="i ${cls}">${ICONS[name]}</span>`;
const arrowIcon = icon("arrow");
const chevIcon = icon("chevronDown", "chev");

/* =====================================================================
   1. API — same Apps Script backend as Haulwise Dispatch. POST with
   text/plain avoids a CORS preflight the script doesn't handle (same
   trick Haulwise Dispatch's own front end uses).
   ===================================================================== */
const CONFIG = { sheetsUrl: "https://script.google.com/macros/s/AKfycbwyuuYwNBfULphLwf58KTxEsrIQ0HLt8913bC0-DNrUxweT0hGaYCGtusFwI1Rf_q0c6g/exec" };
const SHEETS_URL = (localStorage.getItem("hw-sheets-url") || CONFIG.sheetsUrl || "").trim();
const TOKEN_KEY = "hwl-token";

async function api(action, extra = {}) {
  if (!SHEETS_URL) { const err = new Error("Not connected to Haulwise Dispatch."); err.code = "config"; throw err; }
  const body = JSON.stringify({ action, token: localStorage.getItem(TOKEN_KEY) || "", ...extra });
  let res;
  try {
    res = await fetch(SHEETS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
  } catch {
    const err = new Error("Couldn't reach Haulwise Dispatch. Check your connection and try again."); err.code = "network"; throw err;
  }
  const json = await res.json();
  if (json.error) { const err = new Error(json.error); err.code = json.code; throw err; }
  return json;
}
const regionOf = loc => { const parts = String(loc || "").split(","); return parts.length > 1 ? parts[parts.length - 1].trim() : ""; };
function fromApiLoad(row) {
  return {
    id: row.id, ref: row.ref, status: row.status,
    pickupLocation: row.pickupLocation, pickupDate: row.pickupDate, pickupLat: row.pickupLat, pickupLng: row.pickupLng,
    deliveryLocation: row.deliveryLocation, deliveryDate: row.deliveryDate, deliveryLat: row.deliveryLat, deliveryLng: row.deliveryLng,
    pickupRegion: regionOf(row.pickupLocation), deliveryRegion: regionOf(row.deliveryLocation),
    commodity: row.commodity, equipment: row.equipment, weightLbs: row.weightLbs,
    broker: row.brokerName, dispatcher: row.dispatcherName,
    brokerRate: row.brokerRate, carrierRate: row.carrierRate, miles: row.miles,
    notes: row.notes, isLane: row.isLane === true || row.isLane === "TRUE" || row.isLane === "true",
  };
}

/* =====================================================================
   2. AUTH / GATE
   ===================================================================== */
let me = null;

function setAuthView(view, opts = {}) {
  document.body.classList.toggle("authed", view === "ready");
  if (view !== "ready") renderGateBody(view, opts);
  if (view === "ready" && map) requestAnimationFrame(() => map.invalidateSize());
}
function renderGateBody(view, opts) {
  const body = $("#gateBody");
  if (view === "checking") {
    body.innerHTML = `<div class="gate-icon">${icon("truck")}</div><div class="gate-title">Signing you in…</div><div class="gate-sub">Connecting to Haulwise Dispatch.</div>`;
  } else if (view === "pending") {
    body.innerHTML = `<div class="gate-icon">${icon("calendar")}</div><div class="gate-title">Access requested</div>
      <div class="gate-sub">Your request is waiting for the owner to approve it in Haulwise Dispatch's Team page.</div>
      <button class="btn" id="gateSignOut" style="width:100%">Back to sign in</button>`;
  } else if (view === "no-access") {
    body.innerHTML = `<div class="gate-icon">${icon("tag")}</div><div class="gate-title">No access to loads</div>
      <div class="gate-sub">Signed in as <b>${esc(opts.email || "")}</b> (${esc(label(opts.role || ""))}) — this role doesn't view loads in Haulwise Dispatch.</div>
      <button class="btn" id="gateSignOut" style="width:100%">Sign out</button>`;
  } else {
    body.innerHTML = `
      <div class="gate-icon">${icon("truck")}</div>
      <div class="gate-title">Sign in to Haulwise Loads</div>
      <div class="gate-sub">Use your Haulwise Dispatch account — loads sync live from the same sheet.</div>
      ${opts.error ? `<div class="gate-error">${esc(opts.error)}</div>` : ""}
      <form id="gateForm">
        <div class="gate-field"><label class="f">Email</label><input class="input" type="email" name="email" required autocomplete="username"></div>
        <div class="gate-field"><label class="f">Password</label><input class="input" type="password" name="password" required autocomplete="current-password"></div>
        <button class="btn btn-primary" type="submit" style="width:100%" ${opts.loading ? "disabled" : ""}>${opts.loading ? "Signing in…" : "Sign in"}</button>
      </form>
      <div class="gate-sub" style="margin-top:14px">No account yet? Request access from Haulwise Dispatch — it approves and assigns your role there.</div>`;
    $("#gateForm").addEventListener("submit", handleLogin);
  }
  $("#gateSignOut")?.addEventListener("click", signOut);
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.elements.email.value.trim(), password = form.elements.password.value;
  renderGateBody("form", { loading: true });
  try {
    const res = await api("login", { email, password });
    if (res.pending) { setAuthView("pending"); return; }
    localStorage.setItem(TOKEN_KEY, res.token);
    me = res.user;
    await afterLogin();
  } catch (err) {
    renderGateBody("form", { error: err.message || "Sign-in failed." });
  }
}

function signOut() {
  localStorage.removeItem(TOKEN_KEY);
  me = null; state.loads = [];
  setAuthView("form");
}

async function afterLogin() {
  if (me.role === "hr") { setAuthView("no-access", { email: me.email, role: me.role }); return; }
  setAuthView("ready");
  $("#userChipText").textContent = `${me.name} · ${label(me.role)}`;
  await refreshLoads();
}

async function refreshLoads() {
  const btn = $("#refreshBtn"); if (btn) btn.classList.add("spinning");
  try {
    const res = await api("loadAll");
    state.loads = (res.data?.loads || []).map(fromApiLoad);
    renderAll();
  } catch (err) {
    if (err.code === "auth") { localStorage.removeItem(TOKEN_KEY); me = null; setAuthView("form", { error: "Your session expired — sign in again." }); }
    else toast(err.message || "Couldn't load data.");
  } finally {
    if (btn) btn.classList.remove("spinning");
  }
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  $("#toastRoot").appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

async function boot() {
  populateFilterOptions();
  wireStaticIcons();
  applyTheme();
  initMap();
  wireEvents();

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) { setAuthView("form"); return; }
  setAuthView("checking");
  try {
    const res = await api("me");
    me = res.user;
    await afterLogin();
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    setAuthView("form");
  }
}

/* =====================================================================
   3. STATE + FILTERS
   ===================================================================== */
function mondayOf(d) { const x = new Date(d); const day = x.getDay(); const diff = (day === 0 ? -6 : 1) - day; x.setDate(x.getDate() + diff); x.setHours(0, 0, 0, 0); return x; }
const isoDate = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };

const state = {
  loads: [],
  tab: "loads",
  search: "",
  status: "",
  equipment: "",
  weekStart: isoDate(mondayOf(new Date())),
  weekActive: false,
  selectedId: null,
  openId: null,
  laneSort: { key: "loads", dir: -1 },
  theme: localStorage.getItem("hwl-theme") || "light",
};

function byId(id) { return state.loads.find(l => l.id === id); }

function filteredLoads() {
  let rows = state.loads;
  if (state.weekActive) {
    const start = new Date(state.weekStart + "T00:00:00"), end = new Date(start); end.setDate(end.getDate() + 7);
    rows = rows.filter(l => { const d = new Date(l.pickupDate); return d >= start && d < end; });
  }
  if (state.status) rows = rows.filter(l => l.status === state.status);
  if (state.equipment) rows = rows.filter(l => l.equipment === state.equipment);
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    rows = rows.filter(l => [l.ref, l.pickupLocation, l.deliveryLocation, l.broker, l.commodity].some(v => String(v || "").toLowerCase().includes(q)));
  }
  return [...rows].sort((a, b) => new Date(a.pickupDate) - new Date(b.pickupDate));
}

/* =====================================================================
   4. TOP STAT STRIP
   ===================================================================== */
function renderStats() {
  const rows = filteredLoads();
  const miles = rows.reduce((s, l) => s + Number(l.miles || 0), 0);
  const revenue = rows.reduce((s, l) => s + Number(l.brokerRate || 0), 0);
  const rpm = perMile(revenue, miles);
  $("#statStrip").innerHTML = `
    <span>${money(revenue)}</span><span class="divider">·</span>
    <span>${rpm != null ? "$" + rpm.toFixed(2) : "$0.00"} RPM</span><span class="divider">·</span>
    <span>${Math.round(miles).toLocaleString()} mi</span><span class="divider">·</span>
    <span><b>${rows.length}</b> load${rows.length === 1 ? "" : "s"}</span>`;
}

/* =====================================================================
   5. LOADS LIST + CARDS
   ===================================================================== */
function cardHtml(l) {
  const rpm = perMile(l.brokerRate, l.miles), crpm = perMile(l.carrierRate, l.miles), margin = (l.brokerRate || 0) - (l.carrierRate || 0);
  const open = state.openId === l.id, selected = state.selectedId === l.id;
  return `<div class="card ${open ? "open" : ""} ${selected ? "selected" : ""}" data-id="${l.id}">
    <div class="card-head" data-action="toggle-card" data-id="${l.id}">
      <div class="card-row1">
        <span class="card-ref">${esc(l.ref)}</span>
        ${badge(l.status)}
        ${l.isLane ? `<span class="badge b-LANE">${icon("tag")}Lane</span>` : ""}
        <span class="spacer"></span>
        ${chevIcon}
      </div>
      <div class="route-line"><span>${esc(l.pickupLocation)}</span>${arrowIcon}<span>${esc(l.deliveryLocation)}</span></div>
      <div class="card-meta">
        <span class="meta-item">${icon("calendar")}<b>${fmtDate(l.pickupDate)}</b></span>
        <span class="meta-item">${icon("route")}<b>${l.miles ? Number(l.miles).toLocaleString() + " mi" : "—"}</b></span>
        <span class="meta-item">${icon("dollar")}<b>${rpm != null ? rpm.toFixed(2) + "/mi" : "—"}</b></span>
        <span class="meta-item">${icon("cash")}<b>${money(l.brokerRate)}</b></span>
      </div>
    </div>
    <div class="card-body">
      <div class="detail-grid">
        <div class="detail-item"><div class="l">Pickup</div><div class="v">${esc(l.pickupLocation)}</div><div class="muted">${fmtDateTime(l.pickupDate)}</div></div>
        <div class="detail-item"><div class="l">Delivery</div><div class="v">${esc(l.deliveryLocation)}</div><div class="muted">${fmtDateTime(l.deliveryDate)}</div></div>
        <div class="detail-item"><div class="l">Broker</div><div class="v">${esc(l.broker || "—")}</div></div>
        <div class="detail-item"><div class="l">Dispatcher</div><div class="v">${esc(l.dispatcher || "—")}</div></div>
        <div class="detail-item"><div class="l">Commodity</div><div class="v">${esc(l.commodity || "—")}</div></div>
        <div class="detail-item"><div class="l">Equipment</div><div class="v">${esc(l.equipment || "—")}</div></div>
        <div class="detail-item"><div class="l">Weight</div><div class="v">${l.weightLbs ? Number(l.weightLbs).toLocaleString() + " lbs" : "—"}</div></div>
      </div>
      <div class="rate-strip">
        <div class="rate-pill">Miles<br><b>${l.miles ? Number(l.miles).toLocaleString() : "—"}</b></div>
        <div class="rate-pill">Broker rate<br><b>${money(l.brokerRate)}</b></div>
        <div class="rate-pill">Broker RPM<br><b>${rpm != null ? "$" + rpm.toFixed(2) : "—"}</b></div>
        <div class="rate-pill">Carrier rate<br><b>${money(l.carrierRate)}</b></div>
        <div class="rate-pill">Carrier RPM<br><b>${crpm != null ? "$" + crpm.toFixed(2) : "—"}</b></div>
        <div class="rate-pill">Margin<br><b>${money(margin)}</b></div>
      </div>
      ${l.notes ? `<div class="note-box">${icon("note")}<span>${esc(l.notes)}</span></div>` : ""}
    </div>
  </div>`;
}

function renderList() {
  const rows = filteredLoads();
  $("#listCount").textContent = `${rows.length} load${rows.length === 1 ? "" : "s"}`;
  $("#listScroll").innerHTML = rows.length ? rows.map(cardHtml).join("") : `<div class="empty">No loads match these filters.</div>`;
}

/* =====================================================================
   6. LANES
   ===================================================================== */
function laneRows() {
  const rows = filteredLoads().filter(l => l.isLane);
  const map = new Map();
  for (const l of rows) {
    const key = `${l.pickupRegion || "?"} → ${l.deliveryRegion || "?"}`;
    if (!map.has(key)) map.set(key, { key, loads: 0, miles: 0, revenue: 0, carrierCost: 0 });
    const g = map.get(key);
    g.loads++; g.miles += Number(l.miles || 0); g.revenue += Number(l.brokerRate || 0); g.carrierCost += Number(l.carrierRate || 0);
  }
  const list = [...map.values()].map(g => ({ ...g, avgMiles: g.miles / g.loads, rpm: perMile(g.revenue, g.miles) || 0, margin: g.revenue - g.carrierCost }));
  const { key, dir } = state.laneSort;
  list.sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * dir);
  return list;
}
const LANE_COLS = [
  { k: "key", h: "Lane" }, { k: "loads", h: "Loads" }, { k: "avgMiles", h: "Avg miles" },
  { k: "revenue", h: "Total revenue" }, { k: "rpm", h: "Avg RPM" }, { k: "margin", h: "Margin" },
];
function renderLanes() {
  const rows = laneRows();
  const hint = `<div class="lanes-hint">${icon("tag")}Only loads marked <b>Lane</b> in Haulwise Dispatch are aggregated here.</div>`;
  const table = !rows.length ? `<div class="empty">No loads are marked as a lane yet — tick "Mark as lane" on a load in Haulwise Dispatch.</div>` : `
    <table class="lanes"><thead><tr>${LANE_COLS.map(c => `<th data-sort="${c.k}">${c.h}${state.laneSort.key === c.k ? `<span class="sort-arrow">${state.laneSort.dir > 0 ? "▲" : "▼"}</span>` : ""}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr data-lane="${esc(r.key)}">
      <td class="strong">${esc(r.key)}</td><td>${r.loads}</td><td>${Math.round(r.avgMiles).toLocaleString()} mi</td>
      <td>${money(r.revenue)}</td><td>$${r.rpm.toFixed(2)}/mi</td><td>${money(r.margin)}</td>
    </tr>`).join("")}</tbody></table>`;
  $("#lanesView").innerHTML = hint + table;
}

/* =====================================================================
   7. MAP — Leaflet + free OpenStreetMap tiles (no key). Dark mode is a
   CSS filter on the tile pane, not a separate keyed dark-tile provider.
   ===================================================================== */
let map, overviewLayer, routeLayer;
function initMap() {
  map = L.map("map", { scrollWheelZoom: true, zoomControl: true }).setView([39.5, -98.35], 4);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
  overviewLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  window.addEventListener("resize", () => map.invalidateSize());
}
function updateTiles() { $("#map").parentElement.classList.toggle("dark-tiles", state.theme === "dark"); }

function renderMapOverview() {
  map.invalidateSize();
  overviewLayer.clearLayers();
  const rows = filteredLoads().filter(l => l.id !== state.selectedId && l.pickupLat != null && l.deliveryLat != null);
  const bounds = [];
  for (const l of rows) {
    const a = [l.pickupLat, l.pickupLng], b = [l.deliveryLat, l.deliveryLng];
    L.polyline([a, b], { color: "#8b9bc7", weight: 1.4, opacity: 0.45, dashArray: "3 5" }).addTo(overviewLayer);
    L.circleMarker(a, { radius: 3, color: "#16a34a", fillOpacity: 0.8 }).addTo(overviewLayer);
    L.circleMarker(b, { radius: 3, color: "#dc2626", fillOpacity: 0.8 }).addTo(overviewLayer);
    bounds.push(a, b);
  }
  if (!state.selectedId && bounds.length) map.fitBounds(bounds, { padding: [40, 40] });
  else if (!bounds.length && !state.selectedId) map.setView([39.5, -98.35], 4);
}

async function renderSelectedRoute() {
  routeLayer.clearLayers();
  const l = byId(state.selectedId);
  const overlay = $("#mapOverlay");
  if (!l || l.pickupLat == null || l.deliveryLat == null) {
    overlay.innerHTML = `<div class="empty-hint">Click a load in the list to see its route, mileage and RPM here.</div>
      <div class="map-legend"><span><i class="dot pu"></i>Pickup</span><span><i class="dot del"></i>Delivery</span></div>`;
    return;
  }
  const a = [l.pickupLat, l.pickupLng], b = [l.deliveryLat, l.deliveryLng];
  const rpm = perMile(l.brokerRate, l.miles);
  overlay.innerHTML = `<div><b>${esc(l.ref)}</b> ${badge(l.status)}</div>
    <div class="route-line" style="margin-top:6px">${esc(l.pickupLocation)}${arrowIcon}${esc(l.deliveryLocation)}</div>
    <div class="muted" style="margin-top:4px">${fmtDateTime(l.pickupDate)} → ${fmtDateTime(l.deliveryDate)}</div>
    <div style="margin-top:8px"><b>${l.miles ? Number(l.miles).toLocaleString() + " mi" : "—"}</b> &nbsp;·&nbsp; <b>${rpm != null ? "$" + rpm.toFixed(2) : "—"}/mi</b> &nbsp;·&nbsp; <b>${money(l.brokerRate)}</b></div>
    <div class="map-legend"><span><i class="dot pu"></i>Pickup</span><span><i class="dot del"></i>Delivery</span></div>`;

  L.marker(a).addTo(routeLayer).bindPopup("Pickup: " + esc(l.pickupLocation));
  L.marker(b).addTo(routeLayer).bindPopup("Delivery: " + esc(l.deliveryLocation));
  const straight = L.polyline([a, b], { color: "#2f5be7", weight: 3, dashArray: "6 6" }).addTo(routeLayer);
  map.fitBounds(straight.getBounds(), { padding: [50, 50] });
  const seq = (renderSelectedRoute._seq = (renderSelectedRoute._seq || 0) + 1);
  const coords = await drivingRoute({ lat: l.pickupLat, lng: l.pickupLng }, { lat: l.deliveryLat, lng: l.deliveryLng });
  if (renderSelectedRoute._seq !== seq || state.selectedId !== l.id) return;
  if (coords) {
    routeLayer.removeLayer(straight);
    const road = L.polyline(coords, { color: "#2f5be7", weight: 4 }).addTo(routeLayer);
    map.fitBounds(road.getBounds(), { padding: [50, 50] });
  }
}
async function fetchJson(url, ms = 7000) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try { const res = await fetch(url, { signal: ctl.signal }); if (!res.ok) throw new Error("HTTP " + res.status); return await res.json(); } finally { clearTimeout(timer); }
}
async function drivingRoute(a, b) {
  try {
    const j = await fetchJson(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`);
    return j.routes[0].geometry.coordinates.map(([x, y]) => [y, x]);
  } catch { return null; }
}

function refreshMap() { renderMapOverview(); renderSelectedRoute(); }

/* =====================================================================
   8. RENDER ORCHESTRATION
   ===================================================================== */
function renderAll() {
  renderStats();
  if (state.tab === "loads") { renderList(); refreshMap(); } else { renderLanes(); }
}

/* =====================================================================
   9. EVENTS
   ===================================================================== */
function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  $("#themeToggle").innerHTML = state.theme === "dark" ? icon("sun") : icon("moon");
  updateTiles();
}

function populateFilterOptions() {
  $("#statusFilter").innerHTML = `<option value="">All statuses</option>` + LOAD_STATUSES.map(s => `<option value="${s}">${label(s)}</option>`).join("");
  $("#equipFilter").innerHTML = `<option value="">All equipment</option>` + EQUIPMENT.map(e => `<option value="${e}">${e}</option>`).join("");
}

function wireStaticIcons() {
  $("#searchIcon").innerHTML = ICONS.search;
  $("#prevWeek").innerHTML = `${icon("chevronLeft")}<span>Previous week</span>`;
  $("#nextWeek").innerHTML = `<span>Next week</span>${icon("chevronRight")}`;
  $("#clearWeek").innerHTML = `${icon("calendar")}<span>All dates</span>`;
  $("#clearFilters").innerHTML = `${icon("filter")}<span>Clear filters</span>`;
  $("#refreshBtn").innerHTML = icon("refresh");
  $("#signOutBtn").innerHTML = icon("logout");
}

function wireEvents() {
  $$(".tabs button").forEach(b => b.addEventListener("click", () => {
    $$(".tabs button").forEach(x => x.classList.remove("active")); b.classList.add("active");
    state.tab = b.dataset.tab;
    $("#loadsView").style.display = state.tab === "loads" ? "flex" : "none";
    $("#lanesView").style.display = state.tab === "lanes" ? "block" : "none";
    renderAll();
  }));

  $("#searchInput").addEventListener("input", e => { state.search = e.target.value; renderAll(); });
  $("#statusFilter").addEventListener("change", e => { state.status = e.target.value; renderAll(); });
  $("#equipFilter").addEventListener("change", e => { state.equipment = e.target.value; renderAll(); });

  $("#weekStart").value = state.weekStart;
  $("#weekStart").addEventListener("change", e => { state.weekStart = e.target.value; state.weekActive = true; renderAll(); });
  $("#prevWeek").addEventListener("click", () => { const d = new Date(state.weekStart + "T00:00:00"); d.setDate(d.getDate() - 7); state.weekStart = isoDate(d); state.weekActive = true; $("#weekStart").value = state.weekStart; renderAll(); });
  $("#nextWeek").addEventListener("click", () => { const d = new Date(state.weekStart + "T00:00:00"); d.setDate(d.getDate() + 7); state.weekStart = isoDate(d); state.weekActive = true; $("#weekStart").value = state.weekStart; renderAll(); });
  $("#clearWeek").addEventListener("click", () => { state.weekActive = false; renderAll(); });

  $("#clearFilters").addEventListener("click", () => {
    state.search = ""; state.status = ""; state.equipment = ""; state.weekActive = false;
    $("#searchInput").value = ""; $("#statusFilter").value = ""; $("#equipFilter").value = "";
    renderAll();
  });

  $("#themeToggle").addEventListener("click", () => { state.theme = state.theme === "dark" ? "light" : "dark"; localStorage.setItem("hwl-theme", state.theme); applyTheme(); });
  $("#refreshBtn").addEventListener("click", refreshLoads);
  $("#signOutBtn").addEventListener("click", signOut);

  $("#listScroll").addEventListener("click", e => {
    const toggle = e.target.closest("[data-action='toggle-card']");
    if (toggle) {
      const id = toggle.dataset.id;
      state.selectedId = id;
      state.openId = state.openId === id ? null : id;
      renderAll();
    }
  });

  $("#lanesView").addEventListener("click", e => {
    const th = e.target.closest("th[data-sort]");
    if (th) { const k = th.dataset.sort; state.laneSort = { key: k, dir: state.laneSort.key === k ? -state.laneSort.dir : (k === "key" ? 1 : -1) }; renderLanes(); return; }
    const tr = e.target.closest("tr[data-lane]");
    if (tr) {
      const [pu, del] = tr.dataset.lane.split(" → ");
      state.search = ""; $("#searchInput").value = "";
      $$(".tabs button").forEach(x => x.classList.remove("active"));
      $(".tabs button[data-tab='loads']").classList.add("active");
      state.tab = "loads"; $("#loadsView").style.display = "flex"; $("#lanesView").style.display = "none";
      const match = filteredLoads().find(l => l.pickupRegion === pu && l.deliveryRegion === del);
      if (match) { state.selectedId = match.id; state.openId = match.id; }
      renderAll();
    }
  });
}

/* =====================================================================
   10. BOOT
   ===================================================================== */
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
