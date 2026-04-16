/**
 * useManualOrders — fetches the current user's manual payment orders,
 * sorted by created_at desc. Includes latest submission per order.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ManualSubmission {
  id: string;
  proof_image_url: string;
  payment_method: string | null;
  payer_nickname: string | null;
  note: string | null;
  submitted_at: string;
}

export interface ManualOrder {
  id: string;
  order_no: string;
  product_type: 'subscription' | 'credits';
  product_code: string;
  product_name: string;
  amount_fen: number;
  payment_method: string | null;
  status: 'pending' | 'submitted' | 'paid' | 'rejected' | 'expired' | 'fulfilled';
  reject_reason: string | null;
  fulfilled_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  latest_submission?: ManualSubmission | null;
}

export function useManualOrders(userId: string | undefined) {
  const [orders, setOrders]   = useState<ManualOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('manual_orders')
        .select(`
          *,
          manual_order_submissions ( * )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (data) {
        const mapped: ManualOrder[] = data.map((o: Record<string, unknown>) => {
          const subs = (o.manual_order_submissions as ManualSubmission[] | null) ?? [];
          const latest = subs.length > 0
            ? subs.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0]
            : null;
          return { ...o, latest_submission: latest } as ManualOrder;
        });
        setOrders(mapped);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`manual_orders_${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'manual_orders',
        filter: `user_id=eq.${userId}`,
      }, () => { fetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetch]);

  return { orders, loading, refetch: fetch };
}
