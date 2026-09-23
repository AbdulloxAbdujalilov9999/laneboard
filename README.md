# Haulwise Loads

A read-only loads-and-lanes companion to
[Haulwise Dispatch](https://github.com/AbdulloxAbdujalilov9999/dispatching-bro) —
one static page (`index.html` + `app.js` + `data.js`, no build step, same
convention as Haulwise Dispatch). It signs in with the same accounts and
reads live from the same Google Sheet, through the same Apps Script backend
(`loadAll`). It never writes anything back — loads are only created and
edited in Haulwise Dispatch. Left: a live map with pickup/delivery markers
and the driving route. Right: every load as a card you can expand for full
detail. A Lanes tab aggregates just the loads marked as a lane.

## What's inside

- **Sign in** — the same email/password accounts as Haulwise Dispatch,
  checked by the same backend. Roles are respected: an account that can't
  view loads there (HR) sees a clear "no access" screen here instead of an
  empty dashboard. New accounts are still requested and approved in
  Haulwise Dispatch's Team page — this app doesn't duplicate that flow.
- **Map** — Leaflet + free OpenStreetMap tiles (no API key). All filtered
  loads are drawn as thin overview lines; clicking a load draws its real
  driving route (via the public OSRM router, same as Haulwise Dispatch)
  with mileage and RPM shown over the map. Dark mode is a CSS filter on the
  tiles, not a separate keyed provider.
- **Loads list** — searchable, filterable by status/equipment, and by
  pickup week (Previous/Next week). Click a card to expand it: pickup/
  delivery city & time, broker, dispatcher, commodity, equipment, weight,
  rates, RPM, margin, notes.
- **Lanes** — only loads with **Mark as lane** checked in Haulwise
  Dispatch, grouped by `pickup region → delivery region`, sortable by
  loads, avg miles, revenue, RPM, margin. Click a lane to jump back to its
  loads. Most loads aren't lanes — this keeps the view to the routes that
  actually repeat.
- **Refresh** — pulls the latest loads on demand (top bar). Sign-in
  sessions last as long as they do in Haulwise Dispatch (14 days).

## Data

There's no local data and nothing is stored beyond a session token
(`localStorage`, key `hwl-token`) and your light/dark preference. Every load
shown here was created in Haulwise Dispatch; `CONFIG.sheetsUrl` in `app.js`
points at the same deployed Apps Script web app. `fromApiLoad()` in `app.js`
is the one place that maps the sheet's field names (`brokerName`,
`dispatcherName`, …) onto what this app displays — if Haulwise Dispatch's
Loads schema changes, that's the function to update.

## Running it locally

Static files, no dependencies to install:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` and sign in with a real Haulwise Dispatch
account.

## Deploy on Vercel

Import the repo, framework preset **Other**, no build command — it's just
static files.
