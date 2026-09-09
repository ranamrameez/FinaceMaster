import { getScrapeConfig, setScrapeConfig } from './common.js';

const $ = (id) => document.getElementById(id);

function sendMessage(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function readFields() {
  return {
    targetUrl: $('targetUrl').value.trim(),
    rowSelector: $('rowSelector').value.trim(),
    tickerSelector: $('tickerSelector').value.trim(),
    priceSelector: $('priceSelector').value.trim(),
    changeSelector: $('changeSelector').value.trim(),
    nameSelector: $('nameSelector').value.trim(),
  };
}

async function load() {
  const cfg = await getScrapeConfig();
  $('targetUrl').value = cfg.targetUrl;
  $('rowSelector').value = cfg.rowSelector;
  $('tickerSelector').value = cfg.tickerSelector;
  $('priceSelector').value = cfg.priceSelector;
  $('changeSelector').value = cfg.changeSelector;
  $('nameSelector').value = cfg.nameSelector;
}

$('saveBtn').addEventListener('click', async () => {
  await setScrapeConfig(readFields());
  $('savedMsg').hidden = false;
  setTimeout(() => ($('savedMsg').hidden = true), 1500);
});

$('testBtn').addEventListener('click', async () => {
  $('testBtn').disabled = true;
  $('testOutput').textContent = 'Scraping…';
  $('testStrategy').innerHTML = '';
  const fields = readFields();
  const res = await sendMessage({
    type: 'TEST_SCRAPE',
    targetUrl: fields.targetUrl,
    config: fields,
  });
  $('testBtn').disabled = false;
  if (!res?.ok) {
    $('testOutput').textContent = `Error: ${res?.error || 'unknown error'}`;
    return;
  }
  const strategyPill =
    res.strategy === 'configured'
      ? '<span class="pill pill-ok">using your selectors</span>'
      : '<span class="pill pill-warn">auto-detect heuristic (no/empty selectors matched)</span>';
  $('testStrategy').innerHTML = strategyPill;
  $('testOutput').textContent = res.rows.length
    ? JSON.stringify(res.rows.slice(0, 25), null, 2) + (res.rows.length > 25 ? `\n… and ${res.rows.length - 25} more` : '')
    : 'Scraped 0 rows. Adjust the selectors above and try again, or make sure the market page tab is actually open and finished loading.';
});

load();
