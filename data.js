/* =====================================================================
   CITIES — North American freight hubs (used by the mock generator and,
   later, by a live city-search the same way dispatch-bro's Loads form
   does it). Swap/extend freely.
   ===================================================================== */
const CITIES = [
  { name: "Vancouver", region: "BC", lat: 49.2827, lng: -123.1207 },
  { name: "Calgary", region: "AB", lat: 51.0447, lng: -114.0719 },
  { name: "Edmonton", region: "AB", lat: 53.5461, lng: -113.4938 },
  { name: "Winnipeg", region: "MB", lat: 49.8951, lng: -97.1384 },
  { name: "Toronto", region: "ON", lat: 43.6532, lng: -79.3832 },
  { name: "Montreal", region: "QC", lat: 45.5019, lng: -73.5674 },
  { name: "Seattle", region: "WA", lat: 47.6062, lng: -122.3321 },
  { name: "Portland", region: "OR", lat: 45.5152, lng: -122.6784 },
  { name: "San Francisco", region: "CA", lat: 37.7749, lng: -122.4194 },
  { name: "Los Angeles", region: "CA", lat: 34.0522, lng: -118.2437 },
  { name: "San Diego", region: "CA", lat: 32.7157, lng: -117.1611 },
  { name: "Las Vegas", region: "NV", lat: 36.1699, lng: -115.1398 },
  { name: "Phoenix", region: "AZ", lat: 33.4484, lng: -112.0740 },
  { name: "Salt Lake City", region: "UT", lat: 40.7608, lng: -111.8910 },
  { name: "Denver", region: "CO", lat: 39.7392, lng: -104.9903 },
  { name: "Albuquerque", region: "NM", lat: 35.0844, lng: -106.6504 },
  { name: "El Paso", region: "TX", lat: 31.7619, lng: -106.4850 },
  { name: "San Antonio", region: "TX", lat: 29.4241, lng: -98.4936 },
  { name: "Houston", region: "TX", lat: 29.7604, lng: -95.3698 },
  { name: "Dallas", region: "TX", lat: 32.7767, lng: -96.7970 },
  { name: "Oklahoma City", region: "OK", lat: 35.4676, lng: -97.5164 },
  { name: "Kansas City", region: "MO", lat: 39.0997, lng: -94.5786 },
  { name: "Omaha", region: "NE", lat: 41.2565, lng: -95.9345 },
  { name: "Minneapolis", region: "MN", lat: 44.9778, lng: -93.2650 },
  { name: "Chicago", region: "IL", lat: 41.8781, lng: -87.6298 },
  { name: "St. Louis", region: "MO", lat: 38.6270, lng: -90.1994 },
  { name: "Memphis", region: "TN", lat: 35.1495, lng: -90.0490 },
  { name: "Nashville", region: "TN", lat: 36.1627, lng: -86.7816 },
  { name: "Atlanta", region: "GA", lat: 33.7490, lng: -84.3880 },
  { name: "Charlotte", region: "NC", lat: 35.2271, lng: -80.8431 },
  { name: "Jacksonville", region: "FL", lat: 30.3322, lng: -81.6557 },
  { name: "Miami", region: "FL", lat: 25.7617, lng: -80.1918 },
  { name: "Orlando", region: "FL", lat: 28.5383, lng: -81.3792 },
  { name: "Tampa", region: "FL", lat: 27.9506, lng: -82.4572 },
  { name: "Indianapolis", region: "IN", lat: 39.7684, lng: -86.1581 },
  { name: "Columbus", region: "OH", lat: 39.9612, lng: -82.9988 },
  { name: "Detroit", region: "MI", lat: 42.3314, lng: -83.0458 },
  { name: "Cleveland", region: "OH", lat: 41.4993, lng: -81.6944 },
  { name: "Pittsburgh", region: "PA", lat: 40.4406, lng: -79.9959 },
  { name: "Philadelphia", region: "PA", lat: 39.9526, lng: -75.1652 },
  { name: "New York", region: "NY", lat: 40.7128, lng: -74.0060 },
  { name: "Boston", region: "MA", lat: 42.3601, lng: -71.0589 },
  { name: "Washington", region: "DC", lat: 38.9072, lng: -77.0369 },
  { name: "Baltimore", region: "MD", lat: 39.2904, lng: -76.6122 },
  { name: "Richmond", region: "VA", lat: 37.5407, lng: -77.4360 },
  { name: "Monterrey", region: "MX", lat: 25.6866, lng: -100.3161 },
  { name: "Laredo", region: "TX", lat: 27.5306, lng: -99.4803 },
];

const EQUIPMENT = ["Dry Van", "Reefer", "Flatbed", "Step Deck", "Power Only", "Box Truck"];
const COMMODITIES = ["General Freight", "Produce", "Electronics", "Building Materials", "Automotive Parts",
  "Paper Products", "Machinery", "Retail Goods", "Frozen Foods", "Steel Coils", "Furniture", "Beverages"];
const BROKERS = ["TQL", "Coyote Logistics", "C.H. Robinson", "Echo Global", "Landstar", "RXO", "Uber Freight",
  "Arrive Logistics", "Total Quality", "Redwood Logistics", "BlueGrace", "Worldwide Express"];
const LOAD_STATUSES = ["BOOKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "INVOICED", "CANCELLED"];

const haversineMiles = (a, b) => {
  const R = 3958.8, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
function randFloat(min, max, dp = 2) { return +(min + Math.random() * (max - min)).toFixed(dp); }

/* Generates a realistic set of loads spread across the 5 weeks around today,
   so "This week", "Previous week" and "Next week" all have data to show. */
function generateMockLoads(count = 60) {
  const today = new Date();
  const loads = [];
  for (let i = 0; i < count; i++) {
    let pu = pick(CITIES), del = pick(CITIES);
    while (del === pu) del = pick(CITIES);
    const miles = Math.round(haversineMiles(pu, del) * 1.22 * 10) / 10;
    const dayOffset = randInt(-21, 21);
    const pickupDate = new Date(today);
    pickupDate.setDate(pickupDate.getDate() + dayOffset);
    pickupDate.setHours(randInt(5, 18), pick([0, 15, 30, 45]), 0, 0);
    const transitHours = Math.max(3, miles / randFloat(38, 52)) + randInt(0, 6);
    const deliveryDate = new Date(pickupDate.getTime() + transitHours * 3600 * 1000);

    const brokerRate = Math.round(miles * randFloat(1.9, 3.4) * 100) / 100;
    const carrierRate = Math.round(brokerRate * randFloat(0.8, 0.93) * 100) / 100;

    const statusWeights = ["BOOKED", "BOOKED", "DISPATCHED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "DELIVERED", "INVOICED", "CANCELLED"];
    const status = dayOffset > 2 ? pick(["BOOKED", "DISPATCHED"]) : pick(statusWeights);

    loads.push({
      id: "L" + (10000 + i),
      ref: "HW-" + (100200 + i),
      status,
      pickupLocation: `${pu.name}, ${pu.region}`, pickupLat: pu.lat, pickupLng: pu.lng, pickupDate: pickupDate.toISOString(),
      deliveryLocation: `${del.name}, ${del.region}`, deliveryLat: del.lat, deliveryLng: del.lng, deliveryDate: deliveryDate.toISOString(),
      pickupRegion: pu.region, deliveryRegion: del.region,
      miles, commodity: pick(COMMODITIES), equipment: pick(EQUIPMENT), weightLbs: randInt(8000, 45000),
      broker: pick(BROKERS), brokerRate, carrierRate,
      notes: Math.random() < 0.25 ? pick([
        "Driver must call 1 hour before pickup.", "No lumper fee — dock to dock.",
        "Appointment required for delivery.", "Tarps required.", "Team drivers preferred.",
      ]) : "",
    });
  }
  return loads.sort((a, b) => new Date(a.pickupDate) - new Date(b.pickupDate));
}
