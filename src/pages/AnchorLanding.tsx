/**
 * AnchorLanding — public page for `/anchor/:id`.
 * Shows anchor info and redirects authenticated users to the star map.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { QrCode, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface AnchorRow {
  id: string;
  label: string;
  anchor_type: string;
  target_id: string;
  universe_id: string;
}

export default function AnchorLanding() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<AnchorRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) { setError('Missing anchor ID'); setLoading(false); return; }
    supabase
      .from('reality_anchors')
      .select('id, label, anchor_type, target_id, universe_id')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) { setError('Anchor not found'); }
        else { setAnchor(data as AnchorRow); }
        setLoading(false);
      });
  }, [id]);

  const handleEnter = async () => {
    if (!anchor) return;
    // Check if logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Save anchor and redirect to auth
      sessionStorage.setItem('pendingAnchor', JSON.stringify(anchor));
      navigate('/auth');
      return;
    }
    navigate(`/app?anchor=${anchor.id}&atype=${anchor.anchor_type}&atarget=${anchor.target_id}&auniverse=${anchor.universe_id}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #01040d 0%, #060e1f 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {loading ? (
        <Loader2 size={32} color="#66f0ff" style={{ animation: 'spin 1s linear infinite' }} />
      ) : error ? (
        <div style={{ textAlign: 'center' }}>
          <AlertTriangle size={40} color="#ff4466" />
          <p style={{ fontFamily: INTER, fontSize: 16, color: 'rgba(255,255,255,0.70)', marginTop: 16 }}>{error}</p>
          <button
            onClick={() => navigate('/')}
            style={{
              marginTop: 20, padding: '10px 24px',
              fontFamily: INTER, fontSize: 14, fontWeight: 600,
              color: '#66f0ff', background: 'rgba(102,240,255,0.10)',
              border: '1px solid rgba(102,240,255,0.30)',
              borderRadius: 10, cursor: 'pointer',
            }}
          >
            Back to Home
          </button>
        </div>
      ) : anchor && (
        <div style={{
          width: '100%', maxWidth: 380,
          background: 'rgba(8,14,30,0.95)',
          border: '1px solid rgba(102,240,255,0.20)',
          borderRadius: 20, padding: 32,
          boxShadow: '0 0 60px rgba(102,240,255,0.08)',
          textAlign: 'center',
        }}>
          {/* Icon */}
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'rgba(102,240,255,0.10)',
            border: '1.5px solid rgba(102,240,255,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <QrCode size={28} color="#66f0ff" />
          </div>

          {/* Label */}
          <h1 style={{
            fontFamily: INTER, fontSize: 20, fontWeight: 700,
            color: 'rgba(225,235,255,0.95)', margin: '0 0 8px',
          }}>
            {anchor.label || 'Reality Anchor'}
          </h1>

          {/* Type badge */}
          <div style={{
            display: 'inline-block',
            fontFamily: MONO, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.10em',
            color: '#66f0ff',
            background: 'rgba(102,240,255,0.10)',
            border: '1px solid rgba(102,240,255,0.25)',
            borderRadius: 4, padding: '3px 8px',
            marginBottom: 24,
            textTransform: 'uppercase',
          }}>
            {anchor.anchor_type}
          </div>

          <p style={{
            fontFamily: INTER, fontSize: 14, lineHeight: 1.5,
            color: 'rgba(200,210,235,0.60)', margin: '0 0 28px',
          }}>
            This anchor links to a region in a knowledge universe. Tap below to enter.
          </p>

          {/* Enter button */}
          <button
            onClick={handleEnter}
            style={{
              width: '100%', padding: '14px 0',
              fontFamily: INTER, fontSize: 15, fontWeight: 700,
              color: '#01040d',
              background: 'linear-gradient(135deg, #66f0ff, #4ecdc4)',
              border: 'none', borderRadius: 12,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 20px rgba(102,240,255,0.30)',
            }}
          >
            Enter Universe <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
