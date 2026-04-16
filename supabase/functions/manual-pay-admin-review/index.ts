/**
 * manual-pay-admin-review
 * Admin approves or rejects a submitted order.
 * POST body: { orderId, action: 'approved'|'rejected', rejectReason?: string, notes?: string }
 *
 * On approval: grants credits or subscription, marks order fulfilled.
 * Idempotent: if already fulfilled, returns success without re-granting.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_PACKS: Record<string, number> = {
  credits_100:  100,
  credits_500:  500,
  credits_2000: 2000,
};

const PLAN_DAYS: Record<string, number> = {
  pro_monthly:  30,
  pro_yearly:   365,
  team_monthly: 30,
};

function planKey(productCode: string): string {
  if (productCode.startsWith('pro'))  return 'pro';
  if (productCode.startsWith('team')) return 'team';
  return 'free';
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Auth check
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    // Admin check
    const { data: profile } = await svc
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile?.is_admin) return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), { status: 403, headers: CORS });

    const { orderId, action, rejectReason, notes } = await req.json();
    if (!orderId || !['approved', 'rejected'].includes(action)) {
      return new Response(JSON.stringify({ error: 'orderId and action (approved|rejected) required' }), { status: 400, headers: CORS });
    }

    // Fetch order
    const { data: order } = await svc
      .from('manual_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: CORS });

    // Idempotency guard
    if (order.status === 'fulfilled') {
      return new Response(JSON.stringify({ success: true, message: 'already fulfilled' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();

    if (action === 'rejected') {
      await svc.from('manual_orders').update({
        status:        'rejected',
        reject_reason: rejectReason ?? null,
        updated_at:    now.toISOString(),
      }).eq('id', orderId);

      await svc.from('manual_order_reviews').insert({
        order_id:      orderId,
        reviewer_id:   user.id,
        action:        'rejected',
        reject_reason: rejectReason ?? null,
        notes:         notes ?? null,
      });

      return new Response(JSON.stringify({ success: true, status: 'rejected' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── APPROVE ────────────────────────────────────────────────────────────────
    // Atomic idempotency: only proceed if status is still 'submitted'
    const { data: updated, error: updErr } = await svc
      .from('manual_orders')
      .update({
        status:       'fulfilled',
        fulfilled_at: now.toISOString(),
        updated_at:   now.toISOString(),
      })
      .eq('id', orderId)
      .eq('status', 'submitted')  // Guard: only update if still submitted
      .select('id')
      .maybeSingle();

    if (updErr) throw updErr;

    if (!updated) {
      // Another request already fulfilled it
      return new Response(JSON.stringify({ success: true, message: 'concurrent fulfill resolved' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const userId = order.user_id;

    // ── Grant credits ──────────────────────────────────────────────────────────
    if (order.product_type === 'credits') {
      const creditsToAdd = CREDIT_PACKS[order.product_code] ?? 0;
      if (creditsToAdd > 0) {
        const { data: existing } = await svc
          .from('user_credits')
          .select('balance')
          .eq('user_id', userId)
          .maybeSingle();

        await svc.from('user_credits').upsert({
          user_id:    userId,
          balance:    (existing?.balance ?? 0) + creditsToAdd,
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id' });
      }

    // ── Grant subscription ─────────────────────────────────────────────────────
    } else if (order.product_type === 'subscription') {
      const days      = PLAN_DAYS[order.product_code] ?? 30;
      const plan      = planKey(order.product_code);
      const periodEnd = addDays(now, days);

      await svc.from('subscriptions').upsert({
        user_id:              userId,
        plan,
        status:               'active',
        current_period_start: now.toISOString(),
        current_period_end:   periodEnd.toISOString(),
        updated_at:           now.toISOString(),
      }, { onConflict: 'user_id' });
    }

    // Record review
    await svc.from('manual_order_reviews').insert({
      order_id:    orderId,
      reviewer_id: user.id,
      action:      'approved',
      notes:       notes ?? null,
    });

    console.log(`Order ${order.order_no} approved for user ${userId}`);
    return new Response(JSON.stringify({ success: true, status: 'fulfilled' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('manual-pay-admin-review error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
