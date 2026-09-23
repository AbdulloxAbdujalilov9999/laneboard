# Haulwise Loads

A loads-and-lanes companion to [Haulwise Dispatch](https://github.com/AbdulloxAbdujalilov9999/dispatching-bro) —
one static page (`index.html` + `app.js` + `data.js`, no build step, same
convention as Haulwise Dispatch). Left: a live map with pickup/delivery
markers and the driving route. Right: every load as a card you can expand
for full detail. Top: a Lanes view that aggregates loads by origin →
destination region.

## What's inside

- **Map** — Leaflet + free CARTO tiles (light/dark). All filtered loads are
  drawn as thin overview lines; clicking a load draws its real driving route
  (via the public OSRM router, same as Haulwise Dispatch) with mileage and
  RPM shown over the map.
- **Loads list** — searchable, filterable by status/equipment, and by
  pickup week (Previous/Next week, like a weekly planner). Click a card to
  expand it: pickup/delivery city & time, commodity, equipment, weight,
  broker, rates, RPM, margin, notes.
- **Lanes** — loads grouped by `pickup region → delivery region`, sortable
  by loads, avg miles, revenue, RPM, margin. Click a lane to jump back to
  its loads.
- **Add / Edit load** — city autocomplete (Photon) and automatic driving
  miles (OSRM) exactly like Haulwise Dispatch's load form; RPM and margin
  update live as you type rates.

## Data

Loads currently live in the browser's `localStorage`, seeded with ~60
realistic mock loads across North American freight hubs the first time you
open the app (see `generateMockLoads` in `data.js`). Add, edit or delete
loads and they persist locally.

To connect this to a real backend (e.g. the same Google Sheet Haulwise
Dispatch uses) later, only two functions in `app.js` need to change:
`loadState()` (how loads are fetched) and `persist()` (how they're saved) —
the rest of the app just reads from `state.loads`.

## Running it locally

Static files, no dependencies to install:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy on Vercel

Import the repo, framework preset **Other**, no build command — it's just
static files.
