/**
 * admin-user-list
 * Returns all users with credits, subscriptions, and feature usage counts.
 * POST body: { page?, limit?, search? }
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

    let page = 0, limit = 50, search = '';
    try {
      const body = await req.json();
      page  = body.page  ?? page;
      limit = body.limit ?? limit;
      search = body.search ?? search;
    } catch { /* optional body */ }

    limit = Math.min(limit, 100);
    const from = page * limit;
    const to   = from + limit - 1;

    // Fetch auth users for emails
    const { data: { users: authUsers } } = await svc.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    authUsers.forEach(u => { if (u.email) emailMap[u.id] = u.email; });

    // Fetch profiles
    const { data: profiles, count: totalProfiles } = await svc
      .from('profiles')
      .select('id, username, is_admin, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!profiles) return new Response(JSON.stringify({ users: [], total: 0 }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

    const userIds = profiles.map(p => p.id);

    // Batch fetch credits + subscriptions + usage counts
    const [creditsRes, subsRes, notesRes, distillRes, ragRes, actionsRes, analysesRes] = await Promise.all([
      svc.from('user_credits').select('user_id, balance').in('user_id', userIds),
      svc.from('subscriptions').select('user_id, plan, status, current_period_end').in('user_id', userIds),
      svc.from('notes').select('user_id').in('user_id', userIds),
      svc.from('distillations').select('user_id').in('user_id', userIds),
      svc.from('rag_conversations').select('user_id').in('user_id', userIds),
      svc.from('actions').select('user_id').in('user_id', userIds),
      svc.from('analyses').select('user_id').in('user_id', userIds),
    ]);

    // Build lookup maps
    const creditsMap: Record<string, number> = {};
    (creditsRes.data ?? []).forEach(r => { creditsMap[r.user_id] = r.balance; });

    const subsMap: Record<string, { plan: string; status: string; current_period_end: string | null }> = {};
    (subsRes.data ?? []).forEach(r => { subsMap[r.user_id] = r; });

    const countMap = (arr: Array<{ user_id: string }>) => {
      const m: Record<string, number> = {};
      arr.forEach(r => { m[r.user_id] = (m[r.user_id] ?? 0) + 1; });
      return m;
    };

    const notesCount   = countMap(notesRes.data   ?? []);
    const distillCount = countMap(distillRes.data  ?? []);
    const ragCount     = countMap(ragRes.data      ?? []);
    const actionsCount = countMap(actionsRes.data  ?? []);
    const analysesCount= countMap(analysesRes.data ?? []);

    const users = profiles.map(p => ({
      id:          p.id,
      username:    p.username,
      email:       emailMap[p.id] ?? null,
      is_admin:    p.is_admin,
      created_at:  p.created_at,
      credits:     creditsMap[p.id] ?? 0,
      subscription: subsMap[p.id] ?? null,
      usage: {
        notes:        notesCount[p.id]   ?? 0,
        distillations: distillCount[p.id] ?? 0,
        rag_queries:  ragCount[p.id]     ?? 0,
        actions:      actionsCount[p.id] ?? 0,
        analyses:     analysesCount[p.id] ?? 0,
      },
    }));

    // Filter by search client-side
    const filtered = search
      ? users.filter(u =>
          (u.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (u.email ?? '').toLowerCase().includes(search.toLowerCase())
        )
      : users;

    return new Response(JSON.stringify({ users: filtered, total: totalProfiles ?? 0 }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('admin-user-list error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
