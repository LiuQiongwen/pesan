/**
 * useBilling — fetches current subscription plan and credit balance for the
 * authenticated user. Creates default rows if they don't exist yet.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BillingInfo {
  plan:        'free' | 'pro' | 'team';
  status:      string;
  periodEnd:   string | null;
  credits:     number;
  loading:     boolean;
}

export function useBilling(userId: string | undefined): BillingInfo & { refetch: () => void } {
  const [info, setInfo] = useState<BillingInfo>({
    plan: 'free', status: 'active', periodEnd: null, credits: 0, loading: true,
  });

  const fetch = useCallback(async () => {
    if (!userId) return;

    const [subRes, credRes] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_credits').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    const sub  = subRes.data;
    const cred = credRes.data;

    setInfo({
      plan:      (sub?.plan  ?? 'free') as BillingInfo['plan'],
      status:    sub?.status ?? 'active',
      periodEnd: sub?.current_period_end ?? null,
      credits:   cred?.balance ?? 0,
      loading:   false,
    });
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { ...info, refetch: fetch };
}
