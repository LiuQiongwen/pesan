/**
 * manual-pay-submit-proof
 * Saves payment proof and transitions order to 'submitted'.
 * POST body: {
 *   orderId, proofImageUrl, paymentTime, paymentAmountFen,
 *   paymentMethod, payerNickname, note
 * }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const {
      orderId, proofImageUrl, paymentTime,
      paymentAmountFen, paymentMethod, payerNickname, note,
    } = await req.json();

    if (!orderId || !proofImageUrl) {
      return new Response(JSON.stringify({ error: 'orderId and proofImageUrl required' }), { status: 400, headers: CORS });
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify order ownership and status
    const { data: order } = await svc
      .from('manual_orders')
      .select('id, user_id, status, expires_at')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: CORS });
    if (order.user_id !== user.id) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS });
    if (order.status === 'fulfilled') return new Response(JSON.stringify({ error: 'Order already fulfilled' }), { status: 409, headers: CORS });
    if (order.status === 'expired' || new Date(order.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Order expired' }), { status: 410, headers: CORS });
    }
    if (!['pending', 'rejected'].includes(order.status)) {
      return new Response(JSON.stringify({ error: `Cannot submit proof for order in status: ${order.status}` }), { status: 409, headers: CORS });
    }

    // Insert submission
    const { error: subErr } = await svc
      .from('manual_order_submissions')
      .insert({
        order_id:            orderId,
        user_id:             user.id,
        proof_image_url:     proofImageUrl,
        payment_time:        paymentTime ?? null,
        payment_amount_fen:  paymentAmountFen ?? null,
        payment_method:      paymentMethod ?? null,
        payer_nickname:      payerNickname ?? null,
        note:                note ?? null,
      });

    if (subErr) throw subErr;

    // Transition order to submitted
    const { error: updErr } = await svc
      .from('manual_orders')
      .update({ status: 'submitted', reject_reason: null, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (updErr) throw updErr;

    return new Response(JSON.stringify({ success: true, status: 'submitted' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('manual-pay-submit-proof error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
