// src/app/api/execute/route.ts
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
  const { token, code } = await req.json();
  
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);

    // 1. التحقق من التلاعب بالكود
    const currentHash = crypto.createHash('sha256').update(code).digest('hex');
    if (payload.diff_hash !== currentHash) {
      await logAction('EXECUTE_ATTEMPT', 'TAMPER_BLOCKED');
      return NextResponse.json({ error: "Security Alert: Code has been tampered with!" }, { status: 400 });
    }

    // 2. التحقق من التوكن في الداتابيز
    const { data: tokenRecord, error: fetchError } = await supabase
      .from('tokens')
      .select('used')
      .eq('jti', payload.jti)
      .maybeSingle(); // maybeSingle تمنع الأخطاء إذا لم يجد الصف

    if (fetchError) {
      return NextResponse.json({ error: "Database error during execution." }, { status: 500 });
    }

    if (!tokenRecord) {
      await logAction('EXECUTE_ATTEMPT', 'UNKNOWN_TOKEN');
      return NextResponse.json({ error: "Security Alert: Invalid Token (Not issued by server)." }, { status: 400 });
    }

    if (tokenRecord.used) {
      await logAction('EXECUTE_ATTEMPT', 'REPLAY_ATTACK_BLOCKED');
      return NextResponse.json({ error: "Security Alert: Replay Attack! Token already used." }, { status: 400 });
    }

    // 3. تحديث حالة التوكن إلى "مستخدم"
    const { error: updateError } = await supabase.from('tokens').update({ used: true }).eq('jti', payload.jti);
    if (updateError) {
        return NextResponse.json({ error: "Failed to mark token as used." }, { status: 500 });
    }

    await logAction('EXECUTED', 'SUCCESS');
    return NextResponse.json({ success: true, message: "Code executed successfully." });

  } catch (error) {
    return NextResponse.json({ error: "Security Alert: Invalid or expired token." }, { status: 400 });
  }
}