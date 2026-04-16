/**
 * admin-toggle-user
 * Ban or unban a user account.
 * POST body: { targetUserId, action: 'ban' | 'unban', reason? }
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

    const { targetUserId, action, reason } = await req.json();
    if (!targetUserId || !['ban', 'unban'].includes(action)) {
      return new Response(JSON.stringify({ error: 'targetUserId and action required' }), { status: 400, headers: CORS });
    }
    if (targetUserId === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot ban yourself' }), { status: 400, headers: CORS });
    }

    const now = new Date().toISOString();
    const updateData = action === 'ban'
      ? { banned_at: now, ban_reason: reason ?? 'Admin action' }
      : { banned_at: null, ban_reason: null };

    const { error: updateErr } = await svc
      .from('profiles')
      .update({ ...updateData, updated_at: now })
      .eq('id', targetUserId);
    if (updateErr) throw updateErr;

    // Log to system_events
    await svc.from('system_events').insert({
      event_type: action === 'ban' ? 'user_banned' : 'user_unbanned',
      severity: 'warn',
      user_id: targetUserId,
      message: action === 'ban'
        ? `User banned by admin ${user.id}: ${reason ?? ''}`
        : `User unbanned by admin ${user.id}`,
      payload: { admin_id: user.id, reason: reason ?? null },
    });

    console.log(`Admin ${user.id} ${action}ned user ${targetUserId}`);
    return new Response(JSON.stringify({ success: true, action }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('admin-toggle-user error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
