/**
 * alipay-create-order
 * Creates a payment order and returns an Alipay pay URL.
 *
 * POST body: { type: 'subscription'|'credits', itemId: string }
 *
 * Required secrets (set via Enter Cloud secrets):
 *   ALIPAY_APP_ID        — Alipay merchant app ID
 *   ALIPAY_PRIVATE_KEY   — RSA2 private key (PKCS8, no PEM headers needed)
 *   ALIPAY_NOTIFY_URL    — Public URL for async notification, e.g.
 *                          https://<project>.supabase.co/functions/v1/alipay-notify
 *   ALIPAY_SANDBOX       — "true" to use sandbox gateway
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Catalogue ─────────────────────────────────────────────────────────────────
const PLANS: Record<string, { name: string; amountFen: number }> = {
  pro_monthly:   { name: 'Pro 月度订阅 · Pesta',   amountFen: 2900  },
  pro_yearly:    { name: 'Pro 年度订阅 · Pesta',   amountFen: 28800 },
  team_monthly:  { name: 'Team 月度订阅 · Pesta',  amountFen: 9900  },
};

const CREDIT_PACKS: Record<string, { name: string; amountFen: number; credits: number }> = {
  credits_100:  { name: '100 AI Credits',  amountFen: 990,   credits: 100  },
  credits_500:  { name: '500 AI Credits',  amountFen: 3900,  credits: 500  },
  credits_2000: { name: '2000 AI Credits', amountFen: 12900, credits: 2000 },
};

// ── RSA2 signing ─────────────────────────────────────────────────────────────
async function signRSA2(content: string, privateKeyB64: string): Promise<string> {
  const der = Uint8Array.from(atob(privateKeyB64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(content));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function fmtDate(d: Date) {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const { type, itemId } = await req.json();

    // Resolve item
    let itemName = '';
    let amountFen = 0;
    if (type === 'subscription') {
      const plan = PLANS[itemId];
      if (!plan) return new Response(JSON.stringify({ error: 'Unknown plan' }), { status: 400, headers: CORS });
      itemName  = plan.name;
      amountFen = plan.amountFen;
    } else if (type === 'credits') {
      const pack = CREDIT_PACKS[itemId];
      if (!pack) return new Response(JSON.stringify({ error: 'Unknown credits pack' }), { status: 400, headers: CORS });
      itemName  = pack.name;
      amountFen = pack.amountFen;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400, headers: CORS });
    }

    // Generate unique order number
    const ts = Date.now();
    const rnd = Math.floor(Math.random() * 9000) + 1000;
    const orderNo = `PESTA${ts}${rnd}`;

    // Insert order record
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    await serviceClient.from('payment_orders').insert({
      order_no:   orderNo,
      user_id:    user.id,
      type,
      item_id:    itemId,
      item_name:  itemName,
      amount_fen: amountFen,
      status:     'pending',
    });

    // Build Alipay params
    const appId      = Deno.env.get('ALIPAY_APP_ID');
    const privateKey = Deno.env.get('ALIPAY_PRIVATE_KEY');
    const notifyUrl  = Deno.env.get('ALIPAY_NOTIFY_URL') ?? '';
    const sandbox    = Deno.env.get('ALIPAY_SANDBOX') === 'true';
    const gateway    = sandbox
      ? 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
      : 'https://openapi.alipay.com/gateway.do';

    // If secrets not yet configured, return a demo order
    if (!appId || !privateKey) {
      return new Response(JSON.stringify({
        orderNo,
        payUrl:   null,
        demoMode: true,
        message:  '支付宝密钥尚未配置，当前为演示模式',
      }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const bizContent = JSON.stringify({
      out_trade_no: orderNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: (amountFen / 100).toFixed(2),
      subject:      itemName,
    });

    const params: Record<string, string> = {
      app_id:      appId,
      method:      'alipay.trade.page.pay',
      charset:     'utf-8',
      sign_type:   'RSA2',
      timestamp:   fmtDate(new Date()),
      version:     '1.0',
      notify_url:  notifyUrl,
      biz_content: bizContent,
    };

    // Sort & build sign string
    const sortedKeys = Object.keys(params).sort();
    const signStr    = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
    params.sign      = await signRSA2(signStr, privateKey.replace(/\s/g, ''));

    // Build pay URL (GET redirect)
    const payUrl = `${gateway}?` + sortedKeys.concat('sign')
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');

    return new Response(JSON.stringify({ orderNo, payUrl, demoMode: false }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('alipay-create-order error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
