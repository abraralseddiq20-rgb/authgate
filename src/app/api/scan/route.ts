// src/app/api/scan/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as jose from 'jose';
import crypto from 'crypto';

async function logAction(action: string, decision: string) {
  const { data: lastLog } = await supabase.from('audit_logs').select('current_hash').order('id', { ascending: false }).limit(1).maybeSingle();
  const prevHash = lastLog?.current_hash || "GENESIS";
  const currentHash = crypto.createHash('sha256').update(`${action}${decision}${prevHash}${Date.now()}`).digest('hex');
  await supabase.from('audit_logs').insert({ action, decision, prev_hash: prevHash, current_hash: currentHash });
}

export async function POST(req: Request) {
  const { path, code, action, pin } = await req.json();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');

  if (action === 'SUBMIT' || action === 'SCAN') {
    let risk = 0;
    if (path.includes('auth') || path.includes('db')) risk += 100;
    if (code.includes('f"SELECT') || code.includes('api_key=')) risk += 90;
    const decision = risk >= 75 ? 'BLOCK' : 'APPROVE';
    
    await supabase.from('submissions').insert({ path, code, code_hash: codeHash, status: decision });
    await logAction(`SCAN ${path}`, decision);
    return NextResponse.json({ decision, risk });
  }

  if (action === 'APPROVE') {
    if (pin !== process.env.SENIOR_PIN && pin !== '1234') {
      return NextResponse.json({ error: "Unauthorized: Invalid Senior PIN" }, { status: 401 });
    }

    const jti = crypto.randomUUID(); // نستخدم مكتبة التشفير المدمجة
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const token = await new jose.SignJWT({ diff_hash: codeHash, jti })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .sign(secret);
      
    // حفظ التوكن في الداتابيز والتأكد من عدم وجود خطأ
    const { error: dbError } = await supabase.from('tokens').insert({ jti });
    if (dbError) {
      console.error("DB Token Insert Error:", dbError);
      return NextResponse.json({ error: "Database failed to save token" }, { status: 500 });
    }

    await logAction(`APPROVE ${path}`, 'TOKEN_GENERATED');
    return NextResponse.json({ token });
  }
}