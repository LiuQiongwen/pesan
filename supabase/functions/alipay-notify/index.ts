/**
 * alipay-notify
 * Receives Alipay async payment notifications.
 * Verifies RSA2 signature, updates order + user credits/subscription.
 *
 * Required secrets:
 *   ALIPAY_PUBLIC_KEY  — Alipay's RSA2 public key (PKCS8/X.509 base64)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── RSA2 verification ────────────────────────────────────────────────────────
async function verifyRSA2(content: string, sign: string, publicKeyB64: string): Promise<boolean> {
  try {
    const der = Uint8Array.from(atob(publicKeyB64), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'spki', der,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify'],
    );
    const sigBytes = Uint8Array.from(atob(sign), c => c.charCodeAt(0));
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key, sigBytes, new TextEncoder().encode(content),
    );
  } catch {
    return false;
  }
}

// ── Credit packs catalogue ────────────────────────────────────────────────────
const CREDIT_PACKS: Record<string, number> = {
  credits_100:  100,
  credits_500:  500,
  credits_2000: 2000,
};

// ── Plan durations ────────────────────────────────────────────────────────────
function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

const PLAN_DAYS: Record<string, number> = {
  pro_monthly:  30,
  pro_yearly:   365,
  team_monthly: 30,
};

function planName(itemId: string) {
  if (itemId.startsWith('pro'))  return 'pro';
  if (itemId.startsWith('team')) return 'team';
  return 'free';
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const body    = await req.text();
    const params  = new URLSearchParams(body);
    const allData: Record<string, string> = {};
    params.forEach((v, k) => { allData[k] = v; });

    const sign      = allData['sign'] ?? '';
    const tradeStatus = allData['trade_status'] ?? '';
    const outTradeNo  = allData['out_trade_no'] ?? '';
    const tradeNo     = allData['alipay_trade_no'] ?? '';

    // Build sign content (all params except sign and sign_type, sorted)
    const publicKey = Deno.env.get('ALIPAY_PUBLIC_KEY');
    if (publicKey) {
      const signContent = Object.keys(allData)
        .filter(k => k !== 'sign' && k !== 'sign_type')
        .sort()
        .map(k => `${k}=${allData[k]}`)
        .join('&');
      const valid = await verifyRSA2(signContent, sign, publicKey.replace(/\s/g, ''));
      if (!valid) {
        console.error('Alipay notify: invalid signature');
        return new Response('fail', { status: 200 });
      }
    } else {
      console.warn('ALIPAY_PUBLIC_KEY not set — skipping signature verification (dev mode)');
    }

    // Only handle successful payments
    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      return new Response('success', { status: 200 });
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch order
    const { data: order } = await serviceClient
      .from('payment_orders')
      .select('*')
      .eq('order_no', outTradeNo)
      .maybeSingle();

    if (!order || order.status === 'paid') {
      return new Response('success', { status: 200 }); // idempotent
    }

    const userId = order.user_id;
    const now    = new Date();

    // Mark order as paid
    await serviceClient.from('payment_orders').update({
      status: 'paid', alipay_trade_no: tradeNo, updated_at: now.toISOString(),
    }).eq('order_no', outTradeNo);

    if (order.type === 'credits') {
      const creditsToAdd = CREDIT_PACKS[order.item_id] ?? 0;
      if (creditsToAdd > 0) {
        // Upsert credits balance
        const { data: existing } = await serviceClient
          .from('user_credits')
          .select('balance')
          .eq('user_id', userId)
          .maybeSingle();

        const newBalance = (existing?.balance ?? 0) + creditsToAdd;
        await serviceClient.from('user_credits').upsert({
          user_id:    userId,
          balance:    newBalance,
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id' });
      }

    } else if (order.type === 'subscription') {
      const days      = PLAN_DAYS[order.item_id] ?? 30;
      const planStr   = planName(order.item_id);
      const periodEnd = addDays(now, days);

      await serviceClient.from('subscriptions').upsert({
        user_id:              userId,
        plan:                 planStr,
        status:               'active',
        current_period_start: now.toISOString(),
        current_period_end:   periodEnd.toISOString(),
        updated_at:           now.toISOString(),
      }, { onConflict: 'user_id' });
    }

    console.log(`Order ${outTradeNo} paid OK for user ${userId}`);
    return new Response('success', { status: 200 });

  } catch (e) {
    console.error('alipay-notify error:', e);
    return new Response('fail', { status: 200 }); // Alipay expects 200 always
  }
});
