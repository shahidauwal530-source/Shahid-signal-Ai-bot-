/**
 * Main Full-Stack Server
 * Forex Auto Signal System (TwelveData Free Forever, Zero MetaApi)
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dbStore, initDatabase } from './server/db.ts';
import { getGoldHistory, getRealXAUUSDPrice, PRICE_SOURCE } from './server/twelvedata.ts';
import { SESSIONS, selectBestStrategy } from './strategies/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files in public directory without overriding root index
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Standalone vanilla version route
app.get('/standalone', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'standalone.html'));
});

/**
 * Core signal generation function
 */
async function generateAndStoreSignal(options?: { forceNoSignal?: boolean; sessionName?: string }) {
  const realPrice = await getRealXAUUSDPrice();
  const ticks = await getGoldHistory();

  // If forceNoSignal is requested or strategy evaluation returns null
  let strategyResult = null;
  if (!options?.forceNoSignal) {
    strategyResult = selectBestStrategy(realPrice, ticks, options?.sessionName);
  }

  const now = new Date();

  if (!strategyResult || strategyResult.score < 60) {
    // NO SIGNAL STATE: 15-minute validity
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const noSig = await dbStore.saveSignal({
      symbol: 'XAUUSD',
      action: 'SELL',
      session: 'NO SIGNAL',
      score: 0,
      riskLevel: 'LOW RISK',
      rr: 'N/A',
      aiDecision: 'BABU SIGNAL YANZU',
      noSignalReason: 'Market yana low volatility, Ana jira LONDON/NY OVERLAP',
      realPriceUsed: realPrice,
      strategyReason: 'Market in consolidation / low volatility. Awaiting optimal session edge.',
      generatedAt: now,
      expiresAt: expiresAt,
      status: 'no_signal',
      entryZone: { low: realPrice - 1, high: realPrice + 1 },
      stopLoss: realPrice + 10,
      tp1: { price: realPrice - 5, rr: '1:1', percent: 50 },
      tp2: { price: realPrice - 15, rr: '1:2', percent: 30 },
      tp3: { price: realPrice - 25, rr: '1:3', percent: 20 },
      invalidation: realPrice + 10,
      tags: ['NO SIGNAL', 'WAITING'],
    });
    console.log('⏳ NO SIGNAL saved at', now.toISOString());
    return { signal: noSig, isNoSignal: true };
  } else {
    // Normal Active Signal: 60-minute validity
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    const activeSig = await dbStore.saveSignal({
      symbol: 'XAUUSD',
      action: strategyResult.action,
      session: strategyResult.strategyName,
      score: strategyResult.score,
      riskLevel: strategyResult.riskLevel,
      rr: strategyResult.rr,
      aiDecision: strategyResult.aiDecision,
      entryZone: strategyResult.entryZone,
      stopLoss: strategyResult.stopLoss,
      tp1: strategyResult.tp1,
      tp2: strategyResult.tp2,
      tp3: strategyResult.tp3,
      realPriceUsed: realPrice,
      strategyReason: strategyResult.reason,
      generatedAt: now,
      expiresAt: expiresAt,
      status: 'active',
      noSignalReason: '',
      invalidation: strategyResult.invalidation,
      tags: strategyResult.tags,
    });
    console.log(`🎯 STRATEGY ${strategyResult.strategyName}: ${strategyResult.action} Score ${strategyResult.score}`);
    return { signal: activeSig, isNoSignal: false };
  }
}

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// POST /api/register {email, name}
app.post('/api/register', async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    const user = await dbStore.upsertUser(email, name || '');
    return res.json({ success: true, user });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/latest-signal
app.get('/api/latest-signal', async (req: Request, res: Response) => {
  try {
    let latest = await dbStore.getLatestSignal();

    if (!latest) {
      const generated = await generateAndStoreSignal();
      latest = generated.signal;
    }

    const isNoSignal = latest.status === 'no_signal';
    return res.json({
      success: true,
      signal: latest,
      isNoSignal,
      serverTime: new Date(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/market-price
app.get('/api/market-price', async (req: Request, res: Response) => {
  try {
    const realPrice = await getRealXAUUSDPrice();
    return res.json({
      realPrice,
      source: PRICE_SOURCE,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/mark-result {signalId, result}
app.post('/api/mark-result', async (req: Request, res: Response) => {
  try {
    const { signalId, result } = req.body;
    if (!signalId || !['win', 'loss'].includes(result)) {
      return res.status(400).json({ success: false, error: 'Invalid signalId or result' });
    }
    const ok = await dbStore.markSignalResult(signalId, result);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/generate
app.post('/api/generate', async (req: Request, res: Response) => {
  try {
    const { forceNoSignal, sessionName } = req.body || {};
    const result = await generateAndStoreSignal({ forceNoSignal, sessionName });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sessions (24/7 Session status)
app.get('/api/sessions', (req: Request, res: Response) => {
  const currentUtcHour = new Date().getUTCHours();
  const sessionList = SESSIONS.map(s => ({
    name: s.name,
    winRate: s.winRate,
    activeHours: s.activeHours,
    isActiveNow: s.activeHours.includes(currentUtcHour),
    description: s.description,
  }));
  return res.json({ currentUtcHour, sessions: sessionList });
});

// GET /api/all-signals
app.get('/api/all-signals', async (req: Request, res: Response) => {
  const list = await dbStore.getLastSignals(50);
  return res.json({ signals: list });
});

// GET /admin/signals?key=shahid2024
app.get('/admin/signals', async (req: Request, res: Response) => {
  const key = req.query.key;
  if (key !== 'shahid2024') {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Admin - Unauthorized</title></head>
      <body style="background:#0f0f1a;color:#ff3366;font-family:monospace;padding:40px;text-align:center;">
        <h2>⛔ Access Denied</h2>
        <p>Invalid or missing admin key. Usage: <code>/admin/signals?key=shahid2024</code></p>
      </body>
      </html>
    `);
  }

  const signals = await dbStore.getLastSignals(50);
  const rows = signals.map(s => {
    const isNoSig = s.status === 'no_signal';
    const rowBg = isNoSig ? '#242426' : (s.action === 'SELL' ? 'rgba(255,0,51,0.1)' : 'rgba(0,230,118,0.1)');
    const textColor = isNoSig ? '#888' : '#e0e0e0';
    const actionBadge = isNoSig
      ? '<span style="color:#ffcc00;font-weight:bold;">NO SIGNAL</span>'
      : `<span style="color:${s.action === 'SELL' ? '#ff3366' : '#00e676'};font-weight:bold;">${s.action}</span>`;

    return `
      <tr style="background:${rowBg};color:${textColor};border-bottom:1px solid #333;">
        <td style="padding:10px 12px;">${new Date(s.generatedAt).toLocaleTimeString()}</td>
        <td style="padding:10px 12px;font-weight:bold;">${s.symbol}</td>
        <td style="padding:10px 12px;">${actionBadge}</td>
        <td style="padding:10px 12px;">${s.session}</td>
        <td style="padding:10px 12px;">${isNoSig ? '0' : s.score}/100</td>
        <td style="padding:10px 12px;">${s.realPriceUsed.toFixed(2)}</td>
        <td style="padding:10px 12px;">${isNoSig ? '-' : `${s.entryZone.low} - ${s.entryZone.high}`}</td>
        <td style="padding:10px 12px;color:#ff5566;">${isNoSig ? '-' : s.stopLoss.toFixed(2)}</td>
        <td style="padding:10px 12px;color:#00e676;">${isNoSig ? '-' : s.tp2.price.toFixed(2)}</td>
        <td style="padding:10px 12px;">${s.aiDecision}</td>
        <td style="padding:10px 12px;text-transform:uppercase;font-weight:bold;color:${s.status === 'win' ? '#00e676' : s.status === 'loss' ? '#ff3366' : '#aaa'}">${s.status}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Admin Signals Panel - Shahid 2024</title>
      <style>
        body { background: #0f0f1a; color: #f0f0f5; font-family: monospace; margin: 0; padding: 24px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ff0033; padding-bottom: 16px; margin-bottom: 20px; }
        h1 { margin: 0; font-size: 22px; color: #00e676; letter-spacing: 2px; }
        .badge { background: #1a1a2e; border: 1px solid #444; padding: 4px 10px; border-radius: 4px; font-size: 12px; color: #aaa; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #171728; color: #ff5566; text-align: left; padding: 12px; border-bottom: 2px solid #444; }
        .back-link { color: #00e676; text-decoration: none; font-weight: bold; }
        .back-link:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>📊 ADMIN SIGNALS FEED (LAST 50)</h1>
          <p style="margin:4px 0 0; color:#888; font-size:12px;">Source: ${PRICE_SOURCE} | Key: shahid2024</p>
        </div>
        <div>
          <a href="/" class="back-link">← Return to App</a>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Symbol</th>
              <th>Action</th>
              <th>Session</th>
              <th>Score</th>
              <th>Real Price</th>
              <th>Entry Zone</th>
              <th>SL</th>
              <th>TP2</th>
              <th>AI Decision</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;
  return res.send(html);
});

// -------------------------------------------------------------
// AUTOMATED CRON TASKS
// -------------------------------------------------------------

// Cron 1: Save MarketTick every 1 minute
cron.schedule('* * * * *', async () => {
  try {
    const price = await getRealXAUUSDPrice();
    const spread = 0.35;
    await dbStore.saveMarketTick({
      symbol: 'XAU/USD',
      bid: parseFloat((price - spread / 2).toFixed(2)),
      ask: parseFloat((price + spread / 2).toFixed(2)),
      time: new Date(),
    });
  } catch (e) {
    // suppress periodic errors
  }
});

// Cron 2: Auto Signal Generator every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  try {
    await generateAndStoreSignal();
  } catch (err: any) {
    console.error('Error in 15min auto signal cron:', err);
  }
});

// -------------------------------------------------------------
// VITE / STATIC CLIENT MOUNTING
// -------------------------------------------------------------

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  await initDatabase();

  // Run initial tick and signal check
  try {
    const p = await getRealXAUUSDPrice();
    await dbStore.saveMarketTick({
      symbol: 'XAU/USD',
      bid: p - 0.2,
      ask: p + 0.2,
      time: new Date(),
    });
    console.log(`📡 TwelveData Initial Price: $${p} (Source: ${PRICE_SOURCE})`);
  } catch (e) {
    // console.warn('Initial price check note:', e);
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files from dist
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Forex Signal System running on http://0.0.0.0:${PORT}`);
    console.log(`⭐ Admin panel available at: http://localhost:${PORT}/admin/signals?key=shahid2024`);
  });
}

startServer();
