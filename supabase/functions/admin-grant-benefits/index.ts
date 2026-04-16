/**
 * admin-grant-benefits
 * Directly grants credits or a subscription to any user.
 * POST body: { targetUserId, grantType: 'credits'|'subscription', creditsAmount?, plan?, durationDays?, notes? }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { data: profile } = await svc.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!profile?.is_admin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS });

    const { targetUserId, grantType, creditsAmount, plan, durationDays, notes } = await req.json();

    if (!targetUserId || !grantType || !['credits', 'subscription'].includes(grantType)) {
      return new Response(JSON.stringify({ error: 'targetUserId and grantType required' }), { status: 400, headers: CORS });
    }

    const now = new Date();
    let result: Record<string, unknown> = {};

    if (grantType === 'credits') {
      const amount = Math.max(1, Math.floor(creditsAmount ?? 0));
      if (!amount) return new Response(JSON.stringify({ error: 'creditsAmount required' }), { status: 400, headers: CORS });

      const { data: existing } = await svc.from('user_credits').select('balance').eq('user_id', targetUserId).maybeSingle();
      const newBalance = (existing?.balance ?? 0) + amount;

      await svc.from('user_credits').upsert({
        user_id:    targetUserId,
        balance:    newBalance,
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id' });

      result = { newBalance };

    } else if (grantType === 'subscription') {
      if (!plan) return new Response(JSON.stringify({ error: 'plan required' }), { status: 400, headers: CORS });
      const days = Math.max(1, Math.floor(durationDays ?? 30));
      const periodEnd = addDays(now, days);

      // Check if user already has an active subscription to extend it
      const { data: existingSub } = await svc.from('subscriptions').select('current_period_end').eq('user_id', targetUserId).maybeSingle();
      const existingEnd = existingSub?.current_period_end ? new Date(existingSub.current_period_end) : null;
      const baseDate = (existingEnd && existingEnd > now) ? existingEnd : now;
      const finalEnd = addDays(baseDate, days);

      await svc.from('subscriptions').upsert({
        user_id:              targetUserId,
        plan,
        status:               'active',
        current_period_start: now.toISOString(),
        current_period_end:   finalEnd.toISOString(),
        updated_at:           now.toISOString(),
      }, { onConflict: 'user_id' });

      result = { subscriptionEnd: finalEnd.toISOString(), plan };
    }

    // Audit log
    await svc.from('admin_grants').insert({
      admin_id:          user.id,
      target_user_id:    targetUserId,
      grant_type:        grantType,
      credits_amount:    grantType === 'credits' ? (creditsAmount ?? null) : null,
      subscription_plan: grantType === 'subscription' ? plan : null,
      subscription_days: grantType === 'subscription' ? (durationDays ?? 30) : null,
      notes:             notes ?? null,
    });

    console.log(`Admin ${user.id} granted ${grantType} to ${targetUserId}`);
    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('admin-grant-benefits error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
