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
- **Loads list** — searchable (press `/` to jump to the search box), filterable
  by status/equipment/dispatcher and by pickup week (Previous/Next week), and
  sortable (pickup date, rate, RPM, or miles). Click a card to expand it:
  pickup/delivery city & time, broker, dispatcher, commodity, equipment,
  weight, rates, RPM, margin, notes.
- **Lanes** — only loads with **Mark as lane** checked in Haulwise
  Dispatch, grouped by `pickup region → delivery region`, sortable by
  loads, avg miles, revenue, RPM, margin. Click a lane to jump back to its
  loads. Most loads aren't lanes — this keeps the view to the routes that
  actually repeat.
- **Export CSV** — downloads whatever the current filters/search/sort show,
  in the same field names Haulwise Dispatch uses.
- **Stays fresh automatically** — refreshes in the background every 3
  minutes (paused while the tab is hidden or the browser is offline), and
  again the moment you switch back to the tab. The **Refresh** button and
  the "Updated …" time next to it are there for a manual check. Sign-in
  sessions last as long as they do in Haulwise Dispatch (14 days).
- **Offline banner** — if your connection drops, a banner says so and the
  app keeps showing the last loads it had rather than going blank.

## Data

Nothing is stored beyond a session token (`localStorage`, key `hwl-token`),
your light/dark preference, and a snapshot of your last-loaded loads (keyed
to your email) so the app can render instantly on the next visit while it
refreshes in the background — the same "open instantly, update quietly"
approach Haulwise Dispatch itself uses. Every load shown here was created in
Haulwise Dispatch; `CONFIG.sheetsUrl` in `app.js` points at the same
deployed Apps Script web app. `fromApiLoad()` in `app.js` is the one place
that maps the sheet's field names (`brokerName`, `dispatcherName`, …) onto
what this app displays — if Haulwise Dispatch's Loads schema changes,
that's the function to update.

With more than 300 loads in view, the map only draws routes for the first
300 (a note says so) — the list, stats and CSV export are never capped.

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
