/* =====================================================================
   Haulwise Loads — loads & lanes viewer.
   Static, no build step (same convention as Haulwise Dispatch). Data
   currently lives in localStorage (seeded with mock loads); swap
   `loadState()` / `persist()` for a real fetch to switch to a live
   backend without touching the rest of the app.
   ===================================================================== */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const perMile = (amount, miles) => Number(miles) > 0 ? Math.round(Number(amount || 0) / Number(miles) * 100) / 100 : null;
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtDateTime = iso => iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const label = s => String(s || "").replace(/_/g, " ").replace(/\w\S*/g, t => t[0] + t.slice(1).toLowerCase());
const badge = s => `<span class="badge b-${esc(s)}">${esc(label(s))}</span>`;
const loadLabel = l => `${l.ref} · ${l.pickupLocation} → ${l.deliveryLocation}`;

/* =====================================================================
   1. GEO — free, no-key services (Photon for city search, OSRM for
   driving distance/route), same providers and pattern as Haulwise
   Dispatch's Loads form.
   ===================================================================== */
const GEO = { suggest: "https://photon.komoot.io/api/", route: "https://router.project-osrm.org/route/v1/driving/", bbox: "-170,14,-50,72" };
const STATE_ABBR = { Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC", Ontario: "ON", Quebec: "QC", "British Columbia": "BC", Alberta: "AB", Manitoba: "MB", Saskatchewan: "SK", "Nova Scotia": "NS", "New Brunswick": "NB" };
const geoCache = (() => { try { return JSON.parse(localStorage.getItem("hwl-geo")) || { q: {}, r: {} }; } catch { return { q: {}, r: {} }; } })();
function saveGeoCache() {
  for (const k of ["q", "r"]) { const keys = Object.keys(geoCache[k]); if (keys.length > 300) keys.slice(0, keys.length - 300).forEach(x => delete geoCache[k][x]); }
  try { localStorage.setItem("hwl-geo", JSON.stringify(geoCache)); } catch {}
}
async function fetchJson(url, ms = 7000) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try { const res = await fetch(url, { signal: ctl.signal }); if (!res.ok) throw new Error("HTTP " + res.status); return await res.json(); } finally { clearTimeout(timer); }
}
async function citySuggest(text) {
  const q = String(text || "").trim(); if (q.length < 2) return [];
  const key = q.toLowerCase(); if (geoCache.q[key]) return geoCache.q[key];
  const j = await fetchJson(`${GEO.suggest}?q=${encodeURIComponent(q)}&limit=8&lang=en&bbox=${GEO.bbox}&osm_tag=place:city&osm_tag=place:town`);
  const seen = new Set(), out = [];
  for (const f of j.features || []) {
    const p = f.properties || {}; if (!["US", "CA", "MX"].includes(p.countrycode) || !p.name) continue;
    const st = STATE_ABBR[p.state] || p.state || "";
    const lbl = ["US", "CA"].includes(p.countrycode) ? `${p.name}, ${st}` : `${p.name}, ${st}, ${p.countrycode}`;
    if (seen.has(lbl)) continue; seen.add(lbl);
    const [lng, lat] = f.geometry.coordinates;
    out.push({ label: lbl, sub: p.county || p.state || "", lat: +lat.toFixed(5), lng: +lng.toFixed(5) });
  }
  geoCache.q[key] = out; saveGeoCache(); return out;
}
const haversineMi = (a, b) => { const R = 3958.8, rad = x => x * Math.PI / 180, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
async function drivingMiles(a, b) {
  const key = [a.lat, a.lng, b.lat, b.lng].map(n => Number(n).toFixed(3)).join(",");
  if (geoCache.r[key]) return geoCache.r[key];
  try {
    const j = await fetchJson(`${GEO.route}${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`);
    const res = { miles: Math.round(j.routes[0].distance * 0.000621371 * 10) / 10, estimated: false };
    geoCache.r[key] = res; saveGeoCache(); return res;
  } catch { return { miles: Math.round(haversineMi(a, b) * 1.22 * 10) / 10, estimated: true }; }
}
async function drivingRoute(a, b) {
  try { const j = await fetchJson(`${GEO.route}${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`);
    return j.routes[0].geometry.coordinates.map(([x, y]) => [y, x]); } catch { return null; }
}

/* =====================================================================
   2. STATE
   ===================================================================== */
const STORE_KEY = "hwl-loads-v1";
function loadState() {
  try { const raw = JSON.parse(localStorage.getItem(STORE_KEY)); if (raw && raw.length) return raw; } catch {}
  const seeded = generateMockLoads(60);
  persist(seeded);
  return seeded;
}
function persist(loads) { try { localStorage.setItem(STORE_KEY, JSON.stringify(loads)); } catch {} }

function mondayOf(d) { const x = new Date(d); const day = x.getDay(); const diff = (day === 0 ? -6 : 1) - day; x.setDate(x.getDate() + diff); x.setHours(0, 0, 0, 0); return x; }
const isoDate = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };

const state = {
  loads: loadState(),
  tab: "loads",
  search: "",
  status: "",
  equipment: "",
  weekStart: isoDate(mondayOf(new Date())),
  weekActive: true,
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
   3. TOP STAT STRIP
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
   4. LOADS LIST + CARDS
   ===================================================================== */
const arrowIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 12h15M14 6l6 6-6 6"/></svg>`;
const chevIcon = `<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;

function cardHtml(l) {
  const rpm = perMile(l.brokerRate, l.miles), crpm = perMile(l.carrierRate, l.miles), margin = (l.brokerRate || 0) - (l.carrierRate || 0);
  const open = state.openId === l.id, selected = state.selectedId === l.id;
  return `<div class="card ${open ? "open" : ""} ${selected ? "selected" : ""}" data-id="${l.id}">
    <div class="card-head" data-action="toggle-card" data-id="${l.id}">
      <div class="card-row1">
        <span class="card-ref">${esc(l.ref)}</span>
        ${badge(l.status)}
        ${chevIcon}
      </div>
      <div class="route-line"><span>${esc(l.pickupLocation)}</span>${arrowIcon}<span>${esc(l.deliveryLocation)}</span></div>
      <div class="card-meta">
        <span>📅 <b>${fmtDate(l.pickupDate)}</b></span>
        <span>🛣️ <b>${l.miles ? l.miles.toLocaleString() + " mi" : "—"}</b></span>
        <span>💲 <b>${rpm != null ? rpm.toFixed(2) + "/mi" : "—"}</b></span>
        <span>💰 <b>${money(l.brokerRate)}</b></span>
      </div>
    </div>
    <div class="card-body">
      <div class="detail-grid">
        <div class="detail-item"><div class="l">Pickup</div><div class="v">${esc(l.pickupLocation)}</div><div class="muted">${fmtDateTime(l.pickupDate)}</div></div>
        <div class="detail-item"><div class="l">Delivery</div><div class="v">${esc(l.deliveryLocation)}</div><div class="muted">${fmtDateTime(l.deliveryDate)}</div></div>
        <div class="detail-item"><div class="l">Broker</div><div class="v">${esc(l.broker || "—")}</div></div>
        <div class="detail-item"><div class="l">Commodity</div><div class="v">${esc(l.commodity || "—")}</div></div>
        <div class="detail-item"><div class="l">Equipment</div><div class="v">${esc(l.equipment || "—")}</div></div>
        <div class="detail-item"><div class="l">Weight</div><div class="v">${l.weightLbs ? l.weightLbs.toLocaleString() + " lbs" : "—"}</div></div>
      </div>
      <div class="rate-strip">
        <div class="rate-pill">Miles<br><b>${l.miles ? l.miles.toLocaleString() : "—"}</b></div>
        <div class="rate-pill">Broker rate<br><b>${money(l.brokerRate)}</b></div>
        <div class="rate-pill">Broker RPM<br><b>${rpm != null ? "$" + rpm.toFixed(2) : "—"}</b></div>
        <div class="rate-pill">Carrier rate<br><b>${money(l.carrierRate)}</b></div>
        <div class="rate-pill">Carrier RPM<br><b>${crpm != null ? "$" + crpm.toFixed(2) : "—"}</b></div>
        <div class="rate-pill">Margin<br><b>${money(margin)}</b></div>
      </div>
      ${l.notes ? `<div class="note-box">📝 ${esc(l.notes)}</div>` : ""}
      <div class="card-actions">
        <button class="icon-btn" data-action="edit-load" data-id="${l.id}">Edit</button>
        <button class="icon-btn" data-action="delete-load" data-id="${l.id}">Delete</button>
      </div>
    </div>
  </div>`;
}

function renderList() {
  const rows = filteredLoads();
  $("#listCount").textContent = `${rows.length} load${rows.length === 1 ? "" : "s"}`;
  $("#listScroll").innerHTML = rows.length ? rows.map(cardHtml).join("") : `<div class="empty">No loads match these filters.</div>`;
}

/* =====================================================================
   5. LANES
   ===================================================================== */
function laneRows() {
  const rows = filteredLoads();
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
  $("#lanesView").innerHTML = !rows.length ? `<div class="empty">No loads match these filters.</div>` : `
    <table class="lanes"><thead><tr>${LANE_COLS.map(c => `<th data-sort="${c.k}">${c.h}${state.laneSort.key === c.k ? `<span class="sort-arrow">${state.laneSort.dir > 0 ? "▲" : "▼"}</span>` : ""}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr data-lane="${esc(r.key)}">
      <td class="strong">${esc(r.key)}</td><td>${r.loads}</td><td>${Math.round(r.avgMiles).toLocaleString()} mi</td>
      <td>${money(r.revenue)}</td><td>$${r.rpm.toFixed(2)}/mi</td><td>${money(r.margin)}</td>
    </tr>`).join("")}</tbody></table>`;
}

/* =====================================================================
   6. MAP
   ===================================================================== */
let map, overviewLayer, routeLayer;
function initMap() {
  map = L.map("map", { scrollWheelZoom: true, zoomControl: true }).setView([39.5, -98.35], 4);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
  overviewLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
}
/* No keyed dark-tile provider needed: OSM tiles stay the same, we just
   invert/hue-shift them in CSS for dark mode (see .map-pane.dark-tiles). */
function updateTiles() { $("#map").parentElement.classList.toggle("dark-tiles", state.theme === "dark"); }

function renderMapOverview() {
  overviewLayer.clearLayers();
  const rows = filteredLoads().filter(l => l.id !== state.selectedId);
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
  if (!l) {
    overlay.innerHTML = `<div class="empty-hint">Click a load in the list to see its route, mileage and RPM here.</div>
      <div class="map-legend"><span><i class="dot pu"></i>Pickup</span><span><i class="dot del"></i>Delivery</span></div>`;
    return;
  }
  const a = [l.pickupLat, l.pickupLng], b = [l.deliveryLat, l.deliveryLng];
  const rpm = perMile(l.brokerRate, l.miles);
  overlay.innerHTML = `<div><b>${esc(l.ref)}</b> ${badge(l.status)}</div>
    <div class="route-line" style="margin-top:6px">${esc(l.pickupLocation)}${arrowIcon}${esc(l.deliveryLocation)}</div>
    <div class="muted" style="margin-top:4px">${fmtDateTime(l.pickupDate)} → ${fmtDateTime(l.deliveryDate)}</div>
    <div style="margin-top:8px"><b>${l.miles ? l.miles.toLocaleString() + " mi" : "—"}</b> &nbsp;·&nbsp; <b>${rpm != null ? "$" + rpm.toFixed(2) : "—"}/mi</b> &nbsp;·&nbsp; <b>${money(l.brokerRate)}</b></div>
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

function refreshMap() { renderMapOverview(); renderSelectedRoute(); }

/* =====================================================================
   7. RENDER ORCHESTRATION
   ===================================================================== */
function renderAll() {
  renderStats();
  if (state.tab === "loads") { renderList(); refreshMap(); } else { renderLanes(); }
}

/* =====================================================================
   8. ADD / EDIT LOAD MODAL
   ===================================================================== */
function openLoadModal(existing) {
  const l = existing || { id: null, status: "BOOKED", ref: "", pickupLocation: "", deliveryLocation: "", pickupDate: "", deliveryDate: "", commodity: "", equipment: "", weightLbs: "", broker: "", brokerRate: 0, carrierRate: 0, miles: "", notes: "" };
  const isNew = !existing;
  const html = `<div class="modal-backdrop" id="loadModalBackdrop">
    <div class="modal">
      <div class="modal-head"><h2>${isNew ? "Add load" : "Edit " + esc(l.ref)}</h2><button class="close-x" data-action="close-modal">✕</button></div>
      <div class="modal-body">
        <form id="loadForm">
          <div class="form-grid">
            <div><label class="f">Reference #</label><input class="input" name="ref" value="${esc(l.ref)}" placeholder="Auto"></div>
            <div><label class="f">Status</label><select class="select" name="status">${LOAD_STATUSES.map(s => `<option value="${s}" ${s === l.status ? "selected" : ""}>${label(s)}</option>`).join("")}</select></div>

            <div class="full city-wrap"><label class="f">Pickup city *</label><input class="input" id="pickupInput" name="pickupLocation" value="${esc(l.pickupLocation)}" placeholder="Start typing a city…" autocomplete="off" required><div class="suggest" id="sug-pickup" hidden></div></div>
            <div><label class="f">Pickup date/time *</label><input class="input" type="datetime-local" name="pickupDate" value="${inputDT(l.pickupDate)}" required></div>

            <div class="full city-wrap"><label class="f">Delivery city *</label><input class="input" id="deliveryInput" name="deliveryLocation" value="${esc(l.deliveryLocation)}" placeholder="Start typing a city…" autocomplete="off" required><div class="suggest" id="sug-delivery" hidden></div></div>
            <div><label class="f">Delivery date/time *</label><input class="input" type="datetime-local" name="deliveryDate" value="${inputDT(l.deliveryDate)}" required></div>

            <input type="hidden" name="pickupLat" value="${l.pickupLat ?? ""}"><input type="hidden" name="pickupLng" value="${l.pickupLng ?? ""}">
            <input type="hidden" name="deliveryLat" value="${l.deliveryLat ?? ""}"><input type="hidden" name="deliveryLng" value="${l.deliveryLng ?? ""}">
            <input type="hidden" name="pickupRegion" value="${esc(l.pickupRegion || "")}"><input type="hidden" name="deliveryRegion" value="${esc(l.deliveryRegion || "")}">

            <div class="full"><div class="geo-info" id="geoSummary">Pick both cities from the suggestions to get driving miles and RPM automatically.</div></div>

            <div><label class="f">Commodity</label><input class="input" name="commodity" value="${esc(l.commodity)}" list="commodity-list"><datalist id="commodity-list">${COMMODITIES.map(c => `<option value="${c}">`).join("")}</datalist></div>
            <div><label class="f">Equipment</label><input class="input" name="equipment" value="${esc(l.equipment)}" list="equip-list"><datalist id="equip-list">${EQUIPMENT.map(e => `<option value="${e}">`).join("")}</datalist></div>

            <div><label class="f">Weight (lbs)</label><input class="input" type="number" min="0" name="weightLbs" value="${esc(l.weightLbs)}"></div>
            <div><label class="f">Broker</label><input class="input" name="broker" value="${esc(l.broker)}" list="broker-list"><datalist id="broker-list">${BROKERS.map(b => `<option value="${b}">`).join("")}</datalist></div>

            <div><label class="f">Broker rate ($)</label><input class="input" type="number" min="0" step="0.01" name="brokerRate" value="${esc(l.brokerRate)}"></div>
            <div><label class="f">Carrier rate ($)</label><input class="input" type="number" min="0" step="0.01" name="carrierRate" value="${esc(l.carrierRate)}"></div>
            <div><label class="f">Miles</label><input class="input" type="number" min="0" step="0.1" name="miles" value="${esc(l.miles)}"></div>

            <div class="full"><label class="f">Notes</label><textarea class="textarea" name="notes">${esc(l.notes)}</textarea></div>
          </div>
        </form>
      </div>
      <div class="modal-foot">
        <button class="icon-btn" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary" data-action="save-load" data-id="${l.id || ""}">${isNew ? "Add load" : "Save changes"}</button>
      </div>
    </div>
  </div>`;
  $("#modalRoot").innerHTML = html;
  wireCitySuggest("pickupInput", "sug-pickup", "pickup");
  wireCitySuggest("deliveryInput", "sug-delivery", "delivery");
  renderGeoSummary();
}
function inputDT(iso) { if (!iso) return ""; const d = new Date(iso); const pad = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function closeModal() { $("#modalRoot").innerHTML = ""; }

function ptOf(which) { const form = $("#loadForm"); const a = form.elements[which + "Lat"].value, b = form.elements[which + "Lng"].value; return a !== "" && b !== "" ? { lat: +a, lng: +b } : null; }
function renderGeoSummary() {
  const form = $("#loadForm"); if (!form) return;
  const box = $("#geoSummary");
  const miles = Number(form.elements.miles.value), br = Number(form.elements.brokerRate.value || 0), cr = Number(form.elements.carrierRate.value || 0);
  if (!(miles > 0)) { box.textContent = "Pick both cities from the suggestions to get driving miles and RPM automatically — or type the miles yourself."; return; }
  const a = perMile(br, miles), b = perMile(cr, miles), fmt = v => v == null ? "—" : "$" + v.toFixed(2);
  box.innerHTML = `<b>${miles.toLocaleString()} mi</b> &nbsp;·&nbsp; Broker RPM <b>${fmt(a)}/mi</b> &nbsp;·&nbsp; Carrier RPM <b>${fmt(b)}/mi</b> &nbsp;·&nbsp; Margin <b>${money(br - cr)}</b>`;
}
async function updateMilesFromCities() {
  const form = $("#loadForm"); if (!form) return;
  const a = ptOf("pickup"), b = ptOf("delivery"); if (!a || !b) return renderGeoSummary();
  const box = $("#geoSummary"); box.textContent = "Calculating driving miles…";
  const r = await drivingMiles(a, b);
  form.elements.miles.value = r.miles; renderGeoSummary();
}
function wireCitySuggest(inputId, boxId, which) {
  const input = $("#" + inputId); if (!input) return;
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const text = input.value;
    timer = setTimeout(async () => {
      const box = $("#" + boxId); if (text.trim().length < 2) { box.hidden = true; return; }
      box.hidden = false; box.innerHTML = `<div class="sug-note">Searching…</div>`;
      let list; try { list = await citySuggest(text); } catch { box.innerHTML = `<div class="sug-note">Suggestions unavailable — type the city yourself.</div>`; return; }
      if (input.value !== text) return;
      box.innerHTML = list.length ? list.map((c, i) => `<button type="button" class="sug" data-pick="${which}" data-i="${i}"><b>${esc(c.label)}</b><span class="muted">${esc(c.sub)}</span></button>`).join("") : `<div class="sug-note">No match — you can still type it.</div>`;
      box._list = list;
    }, 300);
  });
  $("#" + boxId).addEventListener("click", e => {
    const btn = e.target.closest("[data-pick]"); if (!btn) return;
    const c = $("#" + boxId)._list[+btn.dataset.i];
    const form = $("#loadForm");
    form.elements[which + "Location"].value = c.label;
    form.elements[which + "Lat"].value = c.lat; form.elements[which + "Lng"].value = c.lng;
    form.elements[which + "Region"].value = (c.label.split(",")[1] || "").trim();
    $("#" + boxId).hidden = true;
    updateMilesFromCities();
  });
}

function nextRef() {
  const nums = state.loads.map(l => +String(l.ref).replace(/\D/g, "")).filter(Boolean);
  return "HW-" + (nums.length ? Math.max(...nums) + 1 : 100200);
}

function saveLoadFromForm(id) {
  const form = $("#loadForm");
  const fd = new FormData(form);
  const get = k => fd.get(k);
  const rec = {
    id: id || "L" + Date.now(),
    ref: get("ref") || nextRef(),
    status: get("status"),
    pickupLocation: get("pickupLocation"), pickupDate: get("pickupDate") ? new Date(get("pickupDate")).toISOString() : "",
    pickupLat: get("pickupLat") ? +get("pickupLat") : null, pickupLng: get("pickupLng") ? +get("pickupLng") : null,
    deliveryLocation: get("deliveryLocation"), deliveryDate: get("deliveryDate") ? new Date(get("deliveryDate")).toISOString() : "",
    deliveryLat: get("deliveryLat") ? +get("deliveryLat") : null, deliveryLng: get("deliveryLng") ? +get("deliveryLng") : null,
    pickupRegion: get("pickupRegion"), deliveryRegion: get("deliveryRegion"),
    commodity: get("commodity"), equipment: get("equipment"), weightLbs: +get("weightLbs") || 0,
    broker: get("broker"), brokerRate: +get("brokerRate") || 0, carrierRate: +get("carrierRate") || 0,
    miles: +get("miles") || 0, notes: get("notes"),
  };
  if (id) { const i = state.loads.findIndex(l => l.id === id); state.loads[i] = rec; }
  else state.loads.push(rec);
  persist(state.loads);
  closeModal();
  state.selectedId = rec.id; state.openId = rec.id;
  renderAll();
}

/* =====================================================================
   9. EVENTS
   ===================================================================== */
function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  $("#themeToggle").textContent = state.theme === "dark" ? "☀" : "◐";
  updateTiles();
}

function populateFilterOptions() {
  $("#statusFilter").innerHTML = `<option value="">All statuses</option>` + LOAD_STATUSES.map(s => `<option value="${s}">${label(s)}</option>`).join("");
  $("#equipFilter").innerHTML = `<option value="">All equipment</option>` + EQUIPMENT.map(e => `<option value="${e}">${e}</option>`).join("");
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
  $("#addLoadBtn").addEventListener("click", () => openLoadModal(null));

  $("#listScroll").addEventListener("click", e => {
    const toggle = e.target.closest("[data-action='toggle-card']");
    const edit = e.target.closest("[data-action='edit-load']");
    const del = e.target.closest("[data-action='delete-load']");
    if (edit) { e.stopPropagation(); openLoadModal(byId(edit.dataset.id)); return; }
    if (del) { e.stopPropagation(); if (confirm("Delete this load?")) { state.loads = state.loads.filter(l => l.id !== del.dataset.id); persist(state.loads); if (state.selectedId === del.dataset.id) state.selectedId = null; renderAll(); } return; }
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

  $("#modalRoot").addEventListener("click", e => {
    if (e.target.closest("[data-action='close-modal']") || e.target === $("#loadModalBackdrop")) closeModal();
    const save = e.target.closest("[data-action='save-load']");
    if (save) { const form = $("#loadForm"); if (!form.reportValidity()) return; saveLoadFromForm(save.dataset.id || null); }
  });
  $("#modalRoot").addEventListener("input", e => {
    if (["brokerRate", "carrierRate", "miles"].includes(e.target.name)) renderGeoSummary();
  });
}

/* =====================================================================
   10. BOOT
   ===================================================================== */
function boot() {
  populateFilterOptions();
  applyTheme();
  initMap();
  wireEvents();
  renderAll();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
