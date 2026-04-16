/**
 * manual-pay-create
 * Creates a manual payment order.
 * POST body: { productCode: string }
 * Returns: { orderId, orderNo, productName, amountFen, expiresAt, wechatQrUrl, alipayQrUrl, wechatPayee, alipayPayee }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATALOGUE: Record<string, { name: string; amountFen: number; type: string }> = {
  pro_monthly:   { name: 'Pro 月度订阅 · Pesta',  amountFen: 2900,  type: 'subscription' },
  pro_yearly:    { name: 'Pro 年度订阅 · Pesta',  amountFen: 28800, type: 'subscription' },
  team_monthly:  { name: 'Team 月度订阅 · Pesta', amountFen: 9900,  type: 'subscription' },
  credits_100:   { name: '100 AI Credits',  amountFen: 990,   type: 'credits' },
  credits_500:   { name: '500 AI Credits',  amountFen: 3900,  type: 'credits' },
  credits_2000:  { name: '2000 AI Credits', amountFen: 12900, type: 'credits' },
};

async function getSetting(svc: ReturnType<typeof createClient>, key: string): Promise<string | null> {
  const { data } = await svc
    .from('admin_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const { productCode } = await req.json();
    const item = CATALOGUE[productCode];
    if (!item) return new Response(JSON.stringify({ error: `Unknown product: ${productCode}` }), { status: 400, headers: CORS });

    const ts     = Date.now();
    const rnd    = Math.floor(Math.random() * 9000) + 1000;
    const orderNo = `MP${ts}${rnd}`;
    const expiresAt = new Date(ts + 24 * 60 * 60 * 1000).toISOString();

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: order, error: insertErr } = await svc
      .from('manual_orders')
      .insert({
        order_no:     orderNo,
        user_id:      user.id,
        product_type: item.type,
        product_code: productCode,
        product_name: item.name,
        amount_fen:   item.amountFen,
        status:       'pending',
        expires_at:   expiresAt,
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    // Read QR URLs from admin_settings (DB), fallback to env secrets
    const [wechatQrUrl, alipayQrUrl, wechatPayee, alipayPayee] = await Promise.all([
      getSetting(svc, 'manual_pay_wechat_qr_url').then(v => v ?? Deno.env.get('MANUAL_PAY_WECHAT_QR_URL') ?? null),
      getSetting(svc, 'manual_pay_alipay_qr_url').then(v => v ?? Deno.env.get('MANUAL_PAY_ALIPAY_QR_URL') ?? null),
      getSetting(svc, 'manual_pay_wechat_payee').then(v => v ?? Deno.env.get('MANUAL_PAY_WECHAT_PAYEE') ?? 'Pesta'),
      getSetting(svc, 'manual_pay_alipay_payee').then(v => v ?? Deno.env.get('MANUAL_PAY_ALIPAY_PAYEE') ?? 'Pesta'),
    ]);

    return new Response(JSON.stringify({
      orderId:     order.id,
      orderNo,
      productName: item.name,
      productCode,
      productType: item.type,
      amountFen:   item.amountFen,
      expiresAt,
      wechatQrUrl,
      alipayQrUrl,
      wechatPayee,
      alipayPayee,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('manual-pay-create error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
