/**
 * manual-pay-admin-list
 * Returns paginated manual orders for admin review dashboard.
 * POST body: { status?, page?, limit? }
 * OR GET ?status=submitted&page=0&limit=20
 * Now includes user_email fetched via auth.admin
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

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const { data: profile } = await svc.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!profile?.is_admin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS });

    // Accept params from body (POST) or query string (GET)
    let status = 'submitted';
    let page = 0;
    let limit = 40;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        status = body.status ?? status;
        page   = body.page   ?? page;
        limit  = body.limit  ?? limit;
      } catch { /* ignore */ }
    } else {
      const url = new URL(req.url);
      status = url.searchParams.get('status') ?? status;
      page   = parseInt(url.searchParams.get('page')  ?? '0',  10);
      limit  = parseInt(url.searchParams.get('limit') ?? '40', 10);
    }

    limit = Math.min(limit, 50);
    const from = page * limit;
    const to   = from + limit - 1;

    let query = svc
      .from('manual_orders')
      .select(`
        id, order_no, user_id, product_name, product_code, product_type,
        amount_fen, status, reject_reason, fulfilled_at, created_at,
        profiles!manual_orders_user_id_fkey ( username ),
        manual_order_submissions ( id, proof_image_url, payment_method, payer_nickname, payment_time, payment_amount_fen, note, submitted_at )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: orders, error, count } = await query;
    if (error) throw error;

    // Fetch emails for all users in this page via auth.admin
    const uniqueUserIds = [...new Set((orders ?? []).map((o: { user_id: string }) => o.user_id))];
    const emailMap: Record<string, string> = {};
    if (uniqueUserIds.length > 0) {
      try {
        const { data: { users } } = await svc.auth.admin.listUsers({ perPage: 1000 });
        users.forEach(u => { if (u.email) emailMap[u.id] = u.email; });
      } catch (e) {
        console.warn('Failed to fetch user emails:', e);
      }
    }

    const ordersWithEmail = (orders ?? []).map((o: { user_id: string }) => ({
      ...o,
      user_email: emailMap[o.user_id] ?? null,
    }));

    return new Response(JSON.stringify({ orders: ordersWithEmail, total: count ?? 0, page, limit }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('manual-pay-admin-list error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
