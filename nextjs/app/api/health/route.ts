import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';

// Ported from backend/src/app.js's GET /health.
export async function GET() {
  try {
    await connectDB();
    const ok = mongoose.connection.readyState === 1;
    return NextResponse.json(
      { ok, db: ok ? 'connected' : 'disconnected', uptimeSeconds: process.uptime(), timestamp: new Date().toISOString() },
      { status: ok ? 200 : 503 }
    );
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }
}
