/**
 * Forex Auto Signal System
 * Pixel-Perfect UI Matching Screenshot & Complete 24/7 Engine
 * Powered by TwelveData Free Forever ($0), Zero MetaApi
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  RefreshCw, 
  TrendingDown, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Sliders, 
  Volume2, 
  VolumeX, 
  ShieldAlert, 
  Database,
  ExternalLink,
  Info
} from 'lucide-react';

interface Signal {
  _id?: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  session: string;
  score: number;
  riskLevel: 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK';
  rr: string;
  aiDecision: string;
  entryZone: { low: number; high: number };
  stopLoss: number;
  tp1: { price: number; rr: string; percent: number };
  tp2: { price: number; rr: string; percent: number };
  tp3: { price: number; rr: string; percent: number };
  realPriceUsed: number;
  strategyReason: string;
  generatedAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'win' | 'loss' | 'no_signal';
  noSignalReason?: string;
  invalidation?: number;
  tags?: string[];
}

interface SessionInfo {
  name: string;
  winRate: number;
  activeHours: number[];
  isActiveNow: boolean;
  description: string;
}

export default function App() {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [isNoSignal, setIsNoSignal] = useState<boolean>(false);
  const [realPrice, setRealPrice] = useState<number>(3935.42);
  const [priceSource, setPriceSource] = useState<string>('TWELVEDATA FREE - Har abada');
  const [timeLeftStr, setTimeLeftStr] = useState<string>('44:58');
  const [minsLeft, setMinsLeft] = useState<number>(45);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showSessionsModal, setShowSessionsModal] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [adminKey, setAdminKey] = useState<string>('shahid2024');
  const [adminSignals, setAdminSignals] = useState<Signal[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [registerSuccess, setRegisterSuccess] = useState<boolean>(false);
  const [stats, setStats] = useState({ wins: 8, losses: 2, total: 10 });
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play audio chime
  const playAlertSound = useCallback((isSell: boolean) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isSell ? 587.33 : 880, ctx.currentTime); // D5 or A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio not permitted without interaction
    }
  }, [soundEnabled]);

  // Fetch real market price from TwelveData backend
  const fetchMarketPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/market-price');
      if (res.ok) {
        const data = await res.json();
        if (data.realPrice) {
          setRealPrice(data.realPrice);
          if (data.source) setPriceSource(data.source);
        }
      }
    } catch {
      // keep steady
    }
  }, []);

  // Fetch latest active/no_signal signal
  const fetchLatestSignal = useCallback(async (forcedOption?: { forceNoSignal?: boolean; sessionName?: string }) => {
    setIsLoading(true);
    try {
      let res;
      if (forcedOption) {
        res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(forcedOption),
        });
      } else {
        res = await fetch('/api/latest-signal');
      }

      if (res.ok) {
        const data = await res.json();
        if (data.signal) {
          setSignal(data.signal);
          setIsNoSignal(Boolean(data.isNoSignal || data.signal.status === 'no_signal'));
          if (data.signal.status !== 'no_signal') {
            playAlertSound(data.signal.action === 'SELL');
          }
        }
      }
    } catch (e) {
      console.error('Failed to load signal:', e);
    } finally {
      setIsLoading(false);
    }
  }, [playAlertSound]);

  // Load session matrix
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      // quiet
    }
  }, []);

  // Load admin signals
  const fetchAdminSignals = useCallback(async () => {
    try {
      const res = await fetch('/api/all-signals');
      if (res.ok) {
        const data = await res.json();
        setAdminSignals(data.signals || []);
      }
    } catch {
      // quiet
    }
  }, []);

  // Register free user
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) return;
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, name: userName }),
      });
      if (res.ok) {
        setRegisterSuccess(true);
        setTimeout(() => {
          setShowRegisterModal(false);
          setRegisterSuccess(false);
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Mark signal result
  const handleMarkResult = async (result: 'win' | 'loss') => {
    if (!signal?._id) return;
    try {
      await fetch('/api/mark-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId: signal._id, result }),
      });
      setStats(prev => ({
        wins: result === 'win' ? prev.wins + 1 : prev.wins,
        losses: result === 'loss' ? prev.losses + 1 : prev.losses,
        total: prev.total + 1,
      }));
      // update state
      setSignal(prev => prev ? { ...prev, status: result } : null);
    } catch (e) {
      console.error(e);
    }
  };

  // Countdown timer logic
  useEffect(() => {
    if (!signal?.expiresAt) return;

    const interval = setInterval(() => {
      const exp = new Date(signal.expiresAt).getTime();
      const diff = Math.max(0, exp - Date.now());
      const totalSecs = Math.floor(diff / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      setTimeLeftStr(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      setMinsLeft(mins);

      if (diff <= 0) {
        fetchLatestSignal();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [signal?.expiresAt, fetchLatestSignal]);

  // Initial mount & recurring intervals
  useEffect(() => {
    fetchLatestSignal();
    fetchMarketPrice();
    fetchSessions();

    const priceTimer = setInterval(fetchMarketPrice, 5000); // 5 sec live ticker
    const signalTimer = setInterval(() => fetchLatestSignal(), 15000); // 15 sec auto-check

    return () => {
      clearInterval(priceTimer);
      clearInterval(signalTimer);
    };
  }, [fetchLatestSignal, fetchMarketPrice, fetchSessions]);

  // Format generated time (e.g. "07:07 PM")
  const formatTime = (iso?: string) => {
    if (!iso) return '07:07 PM';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="min-h-screen bg-[#080811] text-white font-mono flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 selection:bg-[#ff0033] selection:text-white">
      
      {/* Top Navbar / System Bar */}
      <header className="w-full max-w-[420px] mb-3 flex items-center justify-between text-[11px] text-[#8888aa] px-1 border-b border-[#1c1c30] pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse"></span>
          <span className="text-[#00e676] font-bold tracking-wider">TWELVEDATA FEED</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 hover:text-white rounded transition"
            title={soundEnabled ? 'Mute Alerts' : 'Unmute Alerts'}
          >
            {soundEnabled ? <Volume2 size={14} className="text-[#00e676]" /> : <VolumeX size={14} className="text-[#666]" />}
          </button>
          <button 
            onClick={() => { fetchSessions(); setShowSessionsModal(true); }}
            className="px-2 py-0.5 bg-[#17172b] hover:bg-[#252542] rounded text-[10px] text-[#aaaaff] border border-[#2e2e4a] transition"
          >
            7 SESSIONS
          </button>
          <button 
            onClick={() => { fetchAdminSignals(); setShowAdminModal(true); }}
            className="px-2 py-0.5 bg-[#1f172b] hover:bg-[#322547] rounded text-[10px] text-[#ffcc00] border border-[#3e3215] transition"
          >
            ADMIN
          </button>
        </div>
      </header>

      {/* Live Price Bar */}
      <div className="w-full max-w-[360px] text-center mb-3 bg-[#0d0d18] border border-[#1e1e32] py-2 px-3 rounded-lg shadow-inner">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#8888aa] font-bold">REAL XAUUSD</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[#00e676] text-[14px] font-black">${realPrice.toFixed(2)}</span>
            <span className="text-[9px] text-[#555577]">USD</span>
          </div>
        </div>
        <div className="text-[9px] text-[#666688] mt-0.5 flex justify-between">
          <span>{priceSource}</span>
          <span className="text-[#00e676]">800 REQ/DAY FREE</span>
        </div>
      </div>

      {/* Interactive State Switcher for Testing/Inspection */}
      <div className="w-full max-w-[360px] flex gap-1.5 mb-3">
        <button
          onClick={() => fetchLatestSignal({ sessionName: 'LONDON/NY OVERLAP' })}
          className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded transition border ${
            !isNoSignal
              ? 'bg-[#ff0033]/20 text-[#ff5566] border-[#ff0033]'
              : 'bg-[#121220] text-[#777799] border-[#222238] hover:border-[#444466]'
          }`}
        >
          🎯 SCREENSHOT SIGNAL
        </button>
        <button
          onClick={() => fetchLatestSignal({ forceNoSignal: true })}
          className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded transition border ${
            isNoSignal
              ? 'bg-[#ffcc00]/20 text-[#ffcc00] border-[#ffcc00]'
              : 'bg-[#121220] text-[#777799] border-[#222238] hover:border-[#444466]'
          }`}
        >
          ⏳ BABU SIGNAL YANZU
        </button>
      </div>

      {/* MAIN CONTAINER (Mobile Width 360px) */}
      <main className="w-[360px] max-w-full">
        {isNoSignal ? (
          /* ========================================================================= */
          /* NO SIGNAL STATE (Exact Specification)                                     */
          /* ========================================================================= */
          <div className="w-[360px] max-w-full bg-[#1a1a0f] border-2 border-[#555555] rounded-xl p-5 shadow-[0_0_15px_rgba(85,85,85,0.4)] flex flex-col items-center text-center">
            
            {/* Big Yellow Notice */}
            <h1 className="text-[#ffcc00] text-[24px] font-black tracking-tight leading-tight mt-1">
              ⏳ BABU SIGNAL YANZU
            </h1>
            <p className="text-[#888888] text-[12px] font-bold tracking-widest mt-1">
              NO SIGNAL FOUND
            </p>

            {/* Explanatory Box */}
            <div className="w-full bg-[#252518] border border-[#4a4a28] rounded-lg p-3 mt-4 text-[#e0e0aa] text-[11px] leading-relaxed">
              <p>{signal?.noSignalReason || 'Market yana low volatility, Ana jira LONDON/NY OVERLAP'}</p>
              <p className="mt-2 text-[#ffcc00] font-bold">
                Next check in {timeLeftStr}
              </p>
            </div>

            {/* Green Circle Countdown */}
            <div className="my-5 flex flex-col items-center">
              <div className="w-[68px] h-[68px] rounded-full border-[3px] border-[#00e676] shadow-[0_0_12px_rgba(0,230,118,0.4)] flex flex-col items-center justify-center bg-[#0d160f]">
                <span className="text-[14px] font-black text-white leading-none">
                  {timeLeftStr}
                </span>
                <span className="text-[7px] text-[#88ffbb] font-bold mt-1 uppercase text-center leading-tight">
                  VALID FOR<br/>NEXT CHECK
                </span>
              </div>
            </div>

            {/* Real Price Display */}
            <div className="text-[12px] text-[#aaaaaa]">
              Real Price: <span className="text-[#00e676] font-bold">${(signal?.realPriceUsed || realPrice).toFixed(2)}</span> - Waiting
            </div>

            {/* Check Now Button */}
            <button
              onClick={() => fetchLatestSignal()}
              disabled={isLoading}
              className="w-full mt-4 py-2.5 px-4 bg-[#ffcc00] hover:bg-[#e6b800] active:scale-[0.99] text-black font-black text-[13px] rounded-md transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              🔄 CHECK NOW
            </button>

            <div className="mt-3 text-[9px] text-[#777788] tracking-wider">
              TWELVEDATA FREE - Har abada kyauta - 800/day
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* HAS SIGNAL STATE (Pixel-Perfect Screenshot Reproduction)                  */
          /* ========================================================================= */
          <div 
            className={`w-[360px] max-w-full bg-[#0f0f1a] rounded-xl p-5 shadow-2xl relative ${
              signal?.action === 'BUY'
                ? 'border-2 border-[#00e676] shadow-[0_0_20px_rgba(0,230,118,0.4)]'
                : 'border-2 border-[#ff0033] shadow-[0_0_20px_rgba(255,0,51,0.45)]'
            }`}
          >
            {/* Top Action Heading: 48px Bold letter-spacing 8px */}
            <div 
              className={`text-center text-[48px] font-black tracking-[8px] leading-none mt-1 ${
                signal?.action === 'BUY' ? 'text-[#00e676] drop-shadow-[0_0_12px_rgba(0,230,118,0.7)]' : 'text-[#ff0033] drop-shadow-[0_0_12px_rgba(255,0,51,0.7)]'
              }`}
            >
              {signal?.action || 'SELL'}
            </div>

            {/* Sub meta: 11px #ff5566 */}
            <div 
              className={`text-center text-[11px] font-bold mt-2 ${
                signal?.action === 'BUY' ? 'text-[#00e676]' : 'text-[#ff5566]'
              }`}
            >
              {signal?.symbol || 'XAUUSD'} · {signal?.session || 'LONDON/NY OVERLAP'} · R:R {signal?.rr || '1:2.41'}
            </div>

            {/* Green Badge Dot */}
            <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[#00e676] text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#00e676] shadow-[0_0_8px_#00e676] inline-block animate-ping"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] inline-block -ml-3"></span>
              <span>● A - SCORE: {signal?.score ?? 76}/100 - {signal?.riskLevel || 'LOW RISK'}</span>
            </div>

            {/* Tags Row */}
            <div className="flex justify-center gap-2 mt-2">
              {(signal?.tags && signal.tags.length > 0 ? signal.tags : ['TRENDING', 'London/NY overlap']).map((tag, i) => (
                <span 
                  key={i} 
                  className="bg-[#17172b] border border-[#2e2e4a] px-2 py-0.5 rounded text-[10px] text-[#9999bb] font-semibold uppercase tracking-wider"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Brown Amber Box: ⌛ AI SAYS: WAIT THIS TRADE */}
            <div className="bg-[#3b2812] border border-[#754c1d] rounded-md py-2 px-3 text-center text-[#ffb84d] text-[12px] font-bold mt-3.5 tracking-wide shadow-sm">
              ⌛ AI SAYS: {signal?.aiDecision || 'WAIT THIS TRADE'}
            </div>

            {/* Timer Row */}
            <div className="flex items-center justify-between mt-4 px-1">
              <div className="w-[58px] h-[58px] rounded-full border-[3px] border-[#00e676] shadow-[0_0_10px_rgba(0,230,118,0.3)] flex flex-col items-center justify-center bg-[#0e1713] flex-shrink-0">
                <span className="text-[13px] font-bold text-white leading-none">
                  {timeLeftStr}
                </span>
                <span className="text-[7px] text-[#88ffbb] font-bold uppercase mt-0.5 tracking-tighter">
                  VALID FOR
                </span>
              </div>

              <div className="text-right text-[11px] text-[#aaaaaa] leading-tight">
                <div>GENERATED <strong className="text-white">{formatTime(signal?.generatedAt)}</strong></div>
                <div className="mt-1">EXPIRES IN <strong className="text-white">{minsLeft}</strong> MIN</div>
              </div>
            </div>

            {/* Entry Zone & Stop Loss Boxes */}
            <div className="grid grid-cols-2 gap-2.5 mt-3.5">
              <div className="bg-[#141424] border border-[#22223a] rounded-md p-2">
                <div className="text-[9px] text-[#777799] tracking-wider font-bold">ENTRY ZONE</div>
                <div className="text-[12px] font-black text-[#aaaaff] mt-1">
                  {signal ? `${signal.entryZone.low.toFixed(2)}-${signal.entryZone.high.toFixed(2)}` : '3928.81-3941.02'}
                </div>
              </div>

              <div className="bg-[#141424] border border-[#22223a] rounded-md p-2">
                <div className="text-[9px] text-[#777799] tracking-wider font-bold">STOP LOSS</div>
                <div className="text-[13px] font-black text-[#ff4455] mt-1">
                  {signal ? signal.stopLoss.toFixed(2) : '3966.00'}
                </div>
              </div>
            </div>

            {/* Section: 🎯 3-TARGET PROFIT SYSTEM */}
            <div className="mt-3.5 bg-[#121222] border border-[#22223a] rounded-md p-3">
              <div className="text-[11px] font-black text-white tracking-wide mb-2 flex items-center justify-between">
                <span>🎯 3-TARGET PROFIT SYSTEM</span>
              </div>

              {/* TP1 */}
              <div className="mt-1.5 text-[11px]">
                <div className="flex justify-between items-center text-[#bbbbdd] mb-1">
                  <span>TP1 (50%) <span className="text-[#888899] text-[10px]">R:R {signal?.tp1.rr || '1:0.79'}</span></span>
                  <span className="text-[#00e676] font-bold">{signal?.tp1.price.toFixed(2) || '3910.37'}</span>
                </div>
                <div className="w-full h-1 bg-[#252538] rounded-full overflow-hidden">
                  <div className="h-full bg-[#00e676] w-[50%]"></div>
                </div>
              </div>

              {/* TP2 */}
              <div className="mt-2 text-[11px]">
                <div className="flex justify-between items-center text-[#bbbbdd] mb-1">
                  <span>TP2 (30%) <span className="text-[#888899] text-[10px]">R:R {signal?.tp2.rr || '1:2.41'}</span></span>
                  <span className="text-[#00e676] font-bold">{signal?.tp2.price.toFixed(2) || '3860.00'}</span>
                </div>
                <div className="w-full h-1 bg-[#252538] rounded-full overflow-hidden">
                  <div className="h-full bg-[#00e676] w-[75%]"></div>
                </div>
              </div>

              {/* TP3 */}
              <div className="mt-2 text-[11px]">
                <div className="flex justify-between items-center text-[#bbbbdd] mb-1">
                  <span>TP3 (20%) <span className="text-[#888899] text-[10px]">R:R {signal?.tp3.rr || '1:4.34'}</span></span>
                  <span className="text-[#00e676] font-bold">{signal?.tp3.price.toFixed(2) || '3800.00'}</span>
                </div>
                <div className="w-full h-1 bg-[#252538] rounded-full overflow-hidden">
                  <div className="h-full bg-[#00e676] w-[100%]"></div>
                </div>
              </div>

              <div className="text-right text-[9px] text-[#777799] mt-2 font-medium">
                — TRACKING - need 10 trades
              </div>
            </div>

            {/* Bottom Invalidation */}
            <div className="mt-3 pt-2.5 border-t border-dashed border-[#2a2a3e] flex justify-between items-center text-[11px] px-1">
              <span className="text-[#888899] font-bold">INVALIDATION</span>
              <span className="text-[#ff4455] font-black">
                {signal ? (signal.invalidation || signal.stopLoss).toFixed(2) : '3966.00'}
              </span>
            </div>

            {/* Result Marking Buttons */}
            <div className="flex gap-2 mt-3.5">
              <button
                onClick={() => handleMarkResult('win')}
                className="flex-1 py-1.5 bg-[#00e676] hover:bg-[#00c864] text-black font-black text-[11px] rounded transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <CheckCircle2 size={13} /> MARK WIN
              </button>
              <button
                onClick={() => handleMarkResult('loss')}
                className="flex-1 py-1.5 bg-[#ff0033] hover:bg-[#d6002b] text-white font-black text-[11px] rounded transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <XCircle size={13} /> MARK LOSS
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchLatestSignal()}
              disabled={isLoading}
              className="w-full mt-3 py-2 bg-[#1b1b2d] hover:bg-[#262640] border border-[#33334d] text-white font-bold text-[12px] rounded transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#00e676]' : ''} />
              🔄 CHECK NOW
            </button>

            <div className="mt-2.5 text-center text-[9px] text-[#666688] tracking-wider">
              TWELVEDATA FREE - Har abada kyauta - 800/day
            </div>
          </div>
        )}
      </main>

      {/* Footer Info / Links */}
      <footer className="w-full max-w-[360px] mt-4 flex items-center justify-between text-[10px] text-[#666688] px-1">
        <span>Win Rate: <strong className="text-[#00e676]">{((stats.wins / stats.total) * 100).toFixed(0)}%</strong> ({stats.wins}W / {stats.losses}L)</span>
        <button 
          onClick={() => setShowRegisterModal(true)}
          className="text-[#aaaaff] hover:underline cursor-pointer"
        >
          Free Account
        </button>
        <a 
          href="/admin/signals?key=shahid2024" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[#ffcc00] hover:underline flex items-center gap-1"
        >
          Admin Feed <ExternalLink size={10} />
        </a>
      </footer>

      {/* 24/7 SESSIONS MODAL */}
      {showSessionsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f0f1a] border-2 border-[#333355] rounded-xl max-w-[420px] w-full p-5 text-white max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#222238] pb-3 mb-4">
              <h2 className="text-[#00e676] text-[15px] font-black tracking-wider flex items-center gap-2">
                <Sliders size={16} /> 7 FOREX SESSIONS (24/7)
              </h2>
              <button 
                onClick={() => setShowSessionsModal(false)}
                className="text-[#888] hover:text-white text-[16px] font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-[#aaa] mb-3 leading-relaxed">
              Automated algorithmic strategies running continuously. Select any session to simulate and test its specific signal logic:
            </p>

            <div className="space-y-2.5">
              {sessions.map((s, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-lg border text-[11px] transition cursor-pointer ${
                    s.name === signal?.session && !isNoSignal
                      ? 'bg-[#1b1b33] border-[#00e676]'
                      : 'bg-[#141424] border-[#22223a] hover:border-[#444466]'
                  }`}
                  onClick={() => {
                    fetchLatestSignal({ sessionName: s.name });
                    setShowSessionsModal(false);
                  }}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-white flex items-center gap-1.5">
                      {s.isActiveNow && <span className="w-2 h-2 rounded-full bg-[#00e676]"></span>}
                      {s.name}
                    </span>
                    <span className="text-[#00e676]">{s.winRate}% WIN</span>
                  </div>
                  <p className="text-[#777799] text-[10px] mt-1">{s.description}</p>
                  <div className="flex justify-between items-center text-[9px] text-[#555577] mt-1.5 pt-1 border-t border-[#1e1e30]">
                    <span>UTC Hours: {s.activeHours.join(', ')}</span>
                    <span className={s.isActiveNow ? 'text-[#00e676] font-bold' : 'text-[#666]'}>
                      {s.isActiveNow ? 'ACTIVE NOW' : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowSessionsModal(false)}
              className="w-full mt-4 py-2 bg-[#22223a] hover:bg-[#33334d] text-white text-[11px] font-bold rounded"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* ADMIN SIGNALS MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f0f1a] border-2 border-[#ff0033] rounded-xl max-w-[680px] w-full p-5 text-white max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#222238] pb-3 mb-3">
              <div>
                <h2 className="text-[#ff5566] text-[15px] font-black tracking-wider flex items-center gap-2">
                  <Database size={16} /> ADMIN SIGNALS TABLE
                </h2>
                <div className="text-[10px] text-[#888]">Key: {adminKey} · Last 50 Signals</div>
              </div>
              <button 
                onClick={() => setShowAdminModal(false)}
                className="text-[#888] hover:text-white text-[16px] font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto text-[11px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#333] text-[#777799]">
                    <th className="p-2">Time</th>
                    <th className="p-2">Action</th>
                    <th className="p-2">Session</th>
                    <th className="p-2">Score</th>
                    <th className="p-2">Price</th>
                    <th className="p-2">SL</th>
                    <th className="p-2">TP2</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {adminSignals.map((s, i) => {
                    const isNoSig = s.status === 'no_signal';
                    return (
                      <tr key={i} className={`border-b border-[#1f1f2e] ${isNoSig ? 'bg-[#18181f] text-[#666]' : 'hover:bg-[#151525]'}`}>
                        <td className="p-2 whitespace-nowrap">{formatTime(s.generatedAt)}</td>
                        <td className="p-2 font-bold">
                          {isNoSig ? (
                            <span className="text-[#ffcc00]">NO SIG</span>
                          ) : (
                            <span className={s.action === 'SELL' ? 'text-[#ff3366]' : 'text-[#00e676]'}>
                              {s.action}
                            </span>
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap">{s.session}</td>
                        <td className="p-2">{isNoSig ? '0' : s.score}</td>
                        <td className="p-2">{s.realPriceUsed.toFixed(2)}</td>
                        <td className="p-2 text-[#ff4455]">{isNoSig ? '-' : s.stopLoss.toFixed(2)}</td>
                        <td className="p-2 text-[#00e676]">{isNoSig ? '-' : s.tp2.price.toFixed(2)}</td>
                        <td className="p-2 font-bold uppercase text-[9px]">
                          <span className={s.status === 'win' ? 'text-[#00e676]' : s.status === 'loss' ? 'text-[#ff3366]' : 'text-[#888]'}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-between items-center text-[10px] text-[#666]">
              <span>Direct Link: <code>/admin/signals?key=shahid2024</code></span>
              <button
                onClick={() => setShowAdminModal(false)}
                className="py-1 px-4 bg-[#222238] text-white rounded font-bold"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f0f1a] border-2 border-[#00e676] rounded-xl max-w-[360px] w-full p-5 text-white">
            <div className="flex justify-between items-center border-b border-[#222238] pb-3 mb-4">
              <h2 className="text-[#00e676] text-[14px] font-black tracking-wider">
                JOIN FREE FOREVER ($0)
              </h2>
              <button 
                onClick={() => setShowRegisterModal(false)}
                className="text-[#888] hover:text-white text-[16px] font-bold"
              >
                ✕
              </button>
            </div>

            {registerSuccess ? (
              <div className="py-6 text-center text-[#00e676]">
                <CheckCircle2 size={32} className="mx-auto mb-2" />
                <p className="font-bold text-[13px]">Successfully Registered!</p>
                <p className="text-[11px] text-[#aaa] mt-1">Free plan active with TwelveData API access.</p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="text-[10px] text-[#8888aa] block mb-1">YOUR NAME</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                    placeholder="Trader Name"
                    className="w-full bg-[#141424] border border-[#2a2a44] rounded p-2 text-[12px] text-white focus:outline-hidden focus:border-[#00e676]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8888aa] block mb-1">EMAIL ADDRESS *</label>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={e => setUserEmail(e.target.value)}
                    placeholder="trader@forex.com"
                    className="w-full bg-[#141424] border border-[#2a2a44] rounded p-2 text-[12px] text-white focus:outline-hidden focus:border-[#00e676]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-[#00e676] hover:bg-[#00c864] text-black font-black text-[12px] rounded transition mt-2 cursor-pointer"
                >
                  ACTIVATE FREE ACCESS
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
