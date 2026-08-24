const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

initializeApp();

// Every currency the app's pickers offer (webapp/src/lib/currencies.ts) —
// keep these two lists in sync if that file ever changes. USD is the base
// currency the free API quotes against; every other rate here is
// USD-per-1-unit-of-that-currency, i.e. rates[X] means "1 X = rates[X] USD"
// after inversion below.
const TARGET_CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'PKR', 'INR'];

// open.er-api.com's free tier has no API key and updates once every 24
// hours regardless of how often it's polled — polling more often than that
// would just re-fetch the same cached value, so this function itself only
// runs once a day (matches the "even once a day is fine" instruction this
// schedule was built against; see CLAUDE.md's Design decisions section for
// why the app never calls this — or any market-data API — directly from a
// page load).
const FX_API_URL = 'https://open.er-api.com/v6/latest/USD';

async function fetchAndStoreRates() {
  const res = await fetch(FX_API_URL);
  if (!res.ok) throw new Error(`FX API responded ${res.status}`);
  const data = await res.json();
  if (data.result !== 'success' || !data.rates) throw new Error('FX API returned an unexpected shape');

  // Base currencies for every module in the app (USD-per-1-unit): store
  // exactly the target list, dropping anything the API added that the app
  // doesn't use, and erroring loudly (not silently skipping) if one of the
  // app's own currencies is missing from the response.
  const rates = {};
  for (const code of TARGET_CURRENCIES) {
    if (typeof data.rates[code] !== 'number') {
      throw new Error(`FX API response is missing a rate for ${code}`);
    }
    rates[code] = data.rates[code];
  }

  const db = getDatabase();
  await db.ref('fxRates/latest').set({
    base: 'USD',
    rates,
    fetchedAt: new Date().toISOString(),
    source: 'open.er-api.com',
  });
}

// v2 scheduled function — "every 24 hours" starting from deploy time.
// Change the schedule string (standard cron, or a `every X hours` shorthand)
// if the free tier's actual refresh cadence ever changes; there's no
// benefit to polling faster than the upstream source updates.
exports.fetchFxRates = onSchedule('every 24 hours', async () => {
  await fetchAndStoreRates();
});
