/**
 * Database Layer for Forex Auto Signal System
 * Supports MongoDB Atlas via Mongoose + Seamless Resilient In-Memory Fallback
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IUser {
  email: string;
  name: string;
  plan: string;
  createdAt: Date;
}

export interface ISignal {
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
  generatedAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'win' | 'loss' | 'no_signal';
  noSignalReason?: string;
  invalidation?: number;
  tags?: string[];
}

export interface IMarketTick {
  symbol: string;
  bid: number;
  ask: number;
  time: Date;
}

// Mongoose Schemas
const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  plan: { type: String, default: 'free' },
  createdAt: { type: Date, default: Date.now },
});

const SignalSchema = new Schema<ISignal>({
  symbol: { type: String, default: 'XAUUSD' },
  action: { type: String, enum: ['BUY', 'SELL'], default: 'SELL' },
  session: { type: String, required: true },
  score: { type: Number, default: 0 },
  riskLevel: { type: String, default: 'LOW RISK' },
  rr: { type: String, default: '1:2.41' },
  aiDecision: { type: String, default: 'WAIT THIS TRADE' },
  entryZone: {
    low: { type: Number, required: true },
    high: { type: Number, required: true },
  },
  stopLoss: { type: Number, required: true },
  tp1: {
    price: { type: Number, required: true },
    rr: { type: String, default: '1:0.79' },
    percent: { type: Number, default: 50 },
  },
  tp2: {
    price: { type: Number, required: true },
    rr: { type: String, default: '1:2.41' },
    percent: { type: Number, default: 30 },
  },
  tp3: {
    price: { type: Number, required: true },
    rr: { type: String, default: '1:4.34' },
    percent: { type: Number, default: 20 },
  },
  realPriceUsed: { type: Number, required: true },
  strategyReason: { type: String, default: '' },
  generatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['active', 'expired', 'win', 'loss', 'no_signal'],
    default: 'active',
  },
  noSignalReason: { type: String, default: '' },
  invalidation: { type: Number },
  tags: { type: [String], default: [] },
});

const MarketTickSchema = new Schema<IMarketTick>({
  symbol: { type: String, required: true },
  bid: { type: Number, required: true },
  ask: { type: Number, required: true },
  time: { type: Date, default: Date.now },
});

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const SignalModel = mongoose.models.Signal || mongoose.model<ISignal>('Signal', SignalSchema);
export const MarketTickModel = mongoose.models.MarketTick || mongoose.model<IMarketTick>('MarketTick', MarketTickSchema);

// In-Memory Storage for standalone/offline or when MONGODB_URI is pending
export class MemoryStore {
  users: IUser[] = [];
  signals: ISignal[] = [];
  ticks: IMarketTick[] = [];
  isMongoConnected = false;

  constructor() {
    this.seedDefaultSignals();
  }

  seedDefaultSignals() {
    const now = new Date();
    // Default active screenshot-calibrated signal
    const initialSignal: ISignal = {
      _id: 'sig_london_ny_overlap_initial',
      symbol: 'XAUUSD',
      action: 'SELL',
      session: 'LONDON/NY OVERLAP',
      score: 76,
      riskLevel: 'LOW RISK',
      rr: '1:2.41',
      aiDecision: 'WAIT THIS TRADE',
      entryZone: { low: 3928.81, high: 3941.02 },
      stopLoss: 3966.00,
      tp1: { price: 3910.37, rr: '1:0.79', percent: 50 },
      tp2: { price: 3860.00, rr: '1:2.41', percent: 30 },
      tp3: { price: 3800.00, rr: '1:4.34', percent: 20 },
      realPriceUsed: 3935.42,
      strategyReason: 'EMA20 < EMA50 Bearish Overlap + Peak Overlap Liquidity',
      generatedAt: new Date(now.getTime() - 15 * 60 * 1000), // 15 mins ago
      expiresAt: new Date(now.getTime() + 45 * 60 * 1000), // 45 mins left
      status: 'active',
      noSignalReason: '',
      invalidation: 3966.00,
      tags: ['TRENDING', 'London/NY overlap'],
    };
    this.signals.push(initialSignal);
  }

  async upsertUser(email: string, name: string): Promise<IUser> {
    if (this.isMongoConnected) {
      const updated = await UserModel.findOneAndUpdate(
        { email },
        { email, name },
        { upsert: true, new: true }
      );
      return updated.toObject();
    }
    let u = this.users.find(x => x.email === email);
    if (!u) {
      u = { email, name, plan: 'free', createdAt: new Date() };
      this.users.push(u);
    } else {
      u.name = name;
    }
    return u;
  }

  async saveSignal(signalData: Partial<ISignal>): Promise<ISignal> {
    if (this.isMongoConnected) {
      const created = await SignalModel.create(signalData);
      return created.toObject();
    }
    const doc: ISignal = {
      _id: 'sig_' + Math.random().toString(36).substring(2, 9),
      symbol: signalData.symbol || 'XAUUSD',
      action: signalData.action || 'SELL',
      session: signalData.session || 'NO SIGNAL',
      score: signalData.score || 0,
      riskLevel: signalData.riskLevel || 'LOW RISK',
      rr: signalData.rr || '1:2.41',
      aiDecision: signalData.aiDecision || 'WAIT THIS TRADE',
      entryZone: signalData.entryZone || { low: 3928.81, high: 3941.02 },
      stopLoss: signalData.stopLoss || 3966.00,
      tp1: signalData.tp1 || { price: 3910.37, rr: '1:0.79', percent: 50 },
      tp2: signalData.tp2 || { price: 3860.00, rr: '1:2.41', percent: 30 },
      tp3: signalData.tp3 || { price: 3800.00, rr: '1:4.34', percent: 20 },
      realPriceUsed: signalData.realPriceUsed || 3935.42,
      strategyReason: signalData.strategyReason || '',
      generatedAt: signalData.generatedAt || new Date(),
      expiresAt: signalData.expiresAt || new Date(Date.now() + 60 * 60 * 1000),
      status: signalData.status || 'active',
      noSignalReason: signalData.noSignalReason || '',
      invalidation: signalData.invalidation || signalData.stopLoss || 3966.00,
      tags: signalData.tags || [],
    };
    this.signals.unshift(doc);
    return doc;
  }

  async getLatestSignal(): Promise<ISignal | null> {
    if (this.isMongoConnected) {
      const doc = await SignalModel.findOne({
        status: { $in: ['active', 'no_signal'] },
        expiresAt: { $gt: new Date() },
      }).sort({ generatedAt: -1 });

      if (doc) return doc.toObject();
    }

    const now = new Date();
    const found = this.signals.find(
      s => (s.status === 'active' || s.status === 'no_signal') && new Date(s.expiresAt) > now
    );
    return found || this.signals[0] || null;
  }

  async markSignalResult(signalId: string, result: 'win' | 'loss'): Promise<boolean> {
    if (this.isMongoConnected) {
      const res = await SignalModel.updateOne({ _id: signalId }, { status: result });
      return res.modifiedCount > 0;
    }
    const sig = this.signals.find(s => s._id === signalId);
    if (sig) {
      sig.status = result;
      return true;
    }
    return false;
  }

  async getLastSignals(limit: number = 50): Promise<ISignal[]> {
    if (this.isMongoConnected) {
      const docs = await SignalModel.find().sort({ generatedAt: -1 }).limit(limit);
      return docs.map(d => d.toObject());
    }
    return this.signals.slice(0, limit);
  }

  async saveMarketTick(tick: IMarketTick) {
    if (this.isMongoConnected) {
      await MarketTickModel.create(tick);
      return;
    }
    this.ticks.unshift(tick);
    if (this.ticks.length > 500) {
      this.ticks.pop();
    }
  }
}

export const dbStore = new MemoryStore();

export async function initDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('ℹ️ MONGODB_URI not set. Running in-memory resilient storage mode.');
    return;
  }

  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    dbStore.isMongoConnected = true;
    console.log('✅ Connected to MongoDB Atlas successfully.');
  } catch (err: any) {
    console.warn('⚠️ MongoDB connection failed, falling back to resilient in-memory database:', err.message);
    dbStore.isMongoConnected = false;
  }
}
