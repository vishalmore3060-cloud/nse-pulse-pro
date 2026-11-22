require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const YAHOO_MAP = {
  'NIFTY 50': '^NSEI',
  'NIFTY BANK': '^NSEBANK',
  'RELIANCE': 'RELIANCE.NS',
  'TCS': 'TCS.NS',
  'HDFCBANK': 'HDFCBANK.NS',
  'ICICIBANK': 'ICICIBANK.NS',
  'AXISBANK': 'AXISBANK.NS',
  'SBIN': 'SBIN.NS',
  'INFY': 'INFY.NS',
  'BHARTIARTL': 'BHARTIARTL.NS',
  'MARUTI': 'MARUTI.NS',
  'SUNPHARMA': 'SUNPHARMA.NS',
  'KOTAKBANK': 'KOTAKBANK.NS',
  'LT': 'LT.NS',
  'ITC': 'ITC.NS',
  'BAJFINANCE': 'BAJFINANCE.NS',
  'TITAN': 'TITAN.NS',
  'HINDUNILVR': 'HINDUNILVR.NS'
};

async function fetchYahooChart(yahooSym, interval = '1m', range = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No chart data');
  const meta = result.meta || {};
  const q = result.indicators?.quote?.[0] || {};
  const ts = result.timestamp || [];
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.open?.[i] == null || q.close?.[i] == null) continue;
    candles.push({
      time: ts[i] * 1000,
      open: +q.open[i].toFixed(2),
      high: +(q.high[i] ?? q.close[i]).toFixed(2),
      low: +(q.low[i] ?? q.close[i]).toFixed(2),
      close: +q.close[i].toFixed(2),
      volume: q.volume?.[i] || 0
    });
  }
  return {
    ltp: meta.regularMarketPrice || candles[candles.length - 1]?.close,
    prevClose: meta.chartPreviousClose || meta.previousClose,
    open: meta.regularMarketDayOpen || candles[0]?.open,
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    vol: meta.regularMarketVolume,
    candles
  };
}

// Fetch live/latest quotes for all NSE symbols
app.get('/api/nse/quotes', async (req, res) => {
  try {
    const entries = await Promise.allSettled(
      Object.entries(YAHOO_MAP).map(async ([sym, ySym]) => {
        const data = await fetchYahooChart(ySym, '5m', '1d');
        return [sym, data];
      })
    );
    const quotes = {};
    entries.forEach(e => {
      if (e.status === 'fulfilled') quotes[e.value[0]] = e.value[1];
    });
    res.json({ ok: true, source: 'NSE .NS Free Feed', quotes });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Fetch candles for a specific symbol & timeframe
app.get('/api/nse/candles/:symbol', async (req, res) => {
  const sym = req.params.symbol;
  const ySym = YAHOO_MAP[sym] || `${sym}.NS`;
  const tf = req.query.tf || '1m';
  const interval = tf === '1H' ? '60m' : tf;
  const range = tf === '1H' ? '1mo' : tf === '15m' ? '5d' : '1d';
  try {
    const data = await fetchYahooChart(ySym, interval, range);
    res.json({ ok: true, symbol: sym, ...data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`NSE Pulse Pro running on http://localhost:${PORT}`);
});
