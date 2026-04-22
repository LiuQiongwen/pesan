/**
 * AnchorLanding — public page for `/anchor/:anchorId` and `/a/:slug`.
 * Rich landing for scanned QR anchors with quick actions for logged-in users.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  QrCode, Loader2, AlertTriangle, ArrowRight, Eye, PenLine, ListChecks, Search,
  FileText, Orbit, LayoutDashboard, Globe, LogIn,
} from 'lucide-react';
import { toast } from 'sonner';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

interface AnchorRow {
  id: string;
  name: string;
  label: string;
  description: string | null;
  anchor_type: string;
  target_type: string;
  target_id: string;
  universe_id: string;
  anchor_slug: string;
  scan_count: number;
}

const TARGET_ICONS: Record<string, typeof FileText> = {
  note: FileText, galaxy: Orbit, workbench: LayoutDashboard, universe: Globe,
};

export default function AnchorLanding() {
  const { anchorId, slug } = useParams<{ anchorId?: string; slug?: string }>();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<AnchorRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; snippet: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // Load anchor
  useEffect(() => {
    const loadAnchor = async () => {
      let query = supabase.from('reality_anchors').select('*');
      if (slug) {
        query = query.eq('anchor_slug', slug);
      } else if (anchorId) {
        query = query.eq('id', anchorId);
      } else {
        setError('Missing anchor identifier');
        setLoading(false);
        return;
      }

      const { data, error: err } = await query.maybeSingle();
      if (err || !data) {
        setError('Anchor not found');
      } else {
        setAnchor(data as unknown as AnchorRow);
        // Increment scan count
        supabase.from('reality_anchors')
          .update({ scan_count: (data.scan_count ?? 0) + 1, last_scanned_at: new Date().toISOString() })
          .eq('id', data.id)
          .then(() => {});
      }
      setLoading(false);
    };

    loadAnchor();
  }, [anchorId, slug]);

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  const handleEnter = async () => {
    if (!anchor) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      sessionStorage.setItem('pendingAnchor', JSON.stringify(anchor));
      navigate('/auth');
      return;
    }
    navigate(`/app?anchor=${anchor.id}&atype=${anchor.target_type}&atarget=${anchor.target_id}&auniverse=${anchor.universe_id}`);
  };

  const handleQuickCapture = useCallback(async () => {
    if (!quickNote.trim() || !anchor) return;
    setSavingNote(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Please log in first'); setSavingNote(false); return; }

    const { error: err } = await supabase.from('notes').insert({
      user_id: session.user.id,
      universe_id: anchor.universe_id,
      title: `Capture @ ${anchor.name}`,
      content_markdown: quickNote.trim(),
      tags: anchor.target_type === 'galaxy' ? [anchor.target_id] : [],
      node_type: 'capture',
    });

    if (err) { toast.error('Failed to save'); } else {
      toast.success('Note captured');
      setQuickNote('');
    }
    setSavingNote(false);
  }, [quickNote, anchor]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !anchor) return;
    setSearching(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSearching(false); return; }

    let query = supabase.from('notes')
      .select('id, title, summary')
      .eq('user_id', session.user.id)
      .eq('universe_id', anchor.universe_id)
      .is('deleted_at', null)
      .ilike('title', `%${searchQuery.trim()}%`)
      .limit(10);

    if (anchor.target_type === 'galaxy') {
      query = query.contains('tags', [anchor.target_id]);
    }

    const { data } = await query;
    setSearchResults((data || []).map(n => ({
      id: n.id, title: n.title || 'Untitled',
      snippet: (n.summary || '').slice(0, 80),
    })));
    setSearching(false);
  }, [searchQuery, anchor]);

  const TargetIcon = anchor ? (TARGET_ICONS[anchor.target_type] || QrCode) : QrCode;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #01040d 0%, #060e1f 50%, #0a1628 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 16px env(safe-area-inset-bottom, 24px)',
    }}>
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <Loader2 size={32} color="#66f0ff" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <AlertTriangle size={40} color="#ff4466" />
          <p style={{ fontFamily: INTER, fontSize: 16, color: 'rgba(255,255,255,0.70)', marginTop: 16 }}>{error}</p>
          <button onClick={() => navigate('/')} style={{
            marginTop: 20, padding: '10px 24px',
            fontFamily: INTER, fontSize: 14, fontWeight: 600,
            color: '#66f0ff', background: 'rgba(102,240,255,0.10)',
            border: '1px solid rgba(102,240,255,0.30)', borderRadius: 10, cursor: 'pointer',
          }}>
            Back to Home
          </button>
        </div>
      ) : anchor && (
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Hero Card */}
          <div style={{
            background: 'rgba(8,14,30,0.95)',
            border: '1px solid rgba(102,240,255,0.20)',
            borderRadius: 20, padding: '28px 24px', textAlign: 'center',
            boxShadow: '0 0 60px rgba(102,240,255,0.08)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'rgba(102,240,255,0.10)', border: '1.5px solid rgba(102,240,255,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 30px rgba(102,240,255,0.15)',
            }}>
              <TargetIcon size={28} color="#66f0ff" />
            </div>

            <h1 style={{ fontFamily: INTER, fontSize: 20, fontWeight: 700, color: 'rgba(225,235,255,0.95)', margin: '0 0 6px' }}>
              {anchor.name || anchor.label || 'Reality Anchor'}
            </h1>

            {anchor.description && (
              <p style={{ fontFamily: INTER, fontSize: 13, lineHeight: 1.5, color: 'rgba(200,210,235,0.55)', margin: '0 0 12px' }}>
                {anchor.description}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
              <Badge text={anchor.target_type.toUpperCase()} color="#66f0ff" />
              <Badge text={`/a/${anchor.anchor_slug}`} color="rgba(200,210,235,0.50)" />
              {anchor.scan_count > 0 && <Badge text={`${anchor.scan_count} scans`} color="rgba(180,150,255,0.60)" />}
            </div>

            <button onClick={handleEnter} style={{
              width: '100%', padding: '14px 0',
              fontFamily: INTER, fontSize: 15, fontWeight: 700,
              color: '#01040d',
              background: 'linear-gradient(135deg, #66f0ff, #4ecdc4)',
              border: 'none', borderRadius: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 20px rgba(102,240,255,0.30)',
            }}>
              <Eye size={16} /> View Knowledge <ArrowRight size={16} />
            </button>
          </div>

          {/* Logged-in actions */}
          {isLoggedIn ? (
            <>
              {/* Quick Capture */}
              <ActionCard title="Quick Capture" subtitle="Record on-site thoughts" icon={PenLine}>
                <textarea
                  value={quickNote}
                  onChange={e => setQuickNote(e.target.value)}
                  placeholder="What are you thinking right now?"
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px',
                    fontFamily: INTER, fontSize: 13,
                    color: 'rgba(225,235,255,0.90)',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10, outline: 'none', resize: 'vertical',
                  }}
                />
                <button
                  onClick={handleQuickCapture}
                  disabled={savingNote || !quickNote.trim()}
                  style={{
                    marginTop: 8, width: '100%', padding: '10px 0',
                    fontFamily: INTER, fontSize: 13, fontWeight: 600,
                    color: savingNote ? 'rgba(225,235,255,0.40)' : '#66f0ff',
                    background: savingNote ? 'rgba(102,240,255,0.06)' : 'rgba(102,240,255,0.10)',
                    border: '1px solid rgba(102,240,255,0.25)',
                    borderRadius: 10, cursor: savingNote ? 'default' : 'pointer',
                  }}
                >
                  {savingNote ? 'Saving...' : 'Save Capture'}
                </button>
              </ActionCard>

              {/* Search */}
              <ActionCard title="Search in Scope" subtitle={`Search within this ${anchor.target_type}`} icon={Search}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Search..."
                    style={{
                      flex: 1, padding: '10px 12px',
                      fontFamily: INTER, fontSize: 13,
                      color: 'rgba(225,235,255,0.90)',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 10, outline: 'none',
                    }}
                  />
                  <button onClick={handleSearch} disabled={searching} style={{
                    padding: '10px 16px',
                    fontFamily: INTER, fontSize: 13, fontWeight: 600,
                    color: '#66f0ff',
                    background: 'rgba(102,240,255,0.10)',
                    border: '1px solid rgba(102,240,255,0.25)',
                    borderRadius: 10, cursor: 'pointer',
                  }}>
                    {searching ? '...' : 'Go'}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {searchResults.map(r => (
                      <button
                        key={r.id}
                        onClick={() => navigate(`/app/note/${r.id}`)}
                        style={{
                          padding: '8px 12px', textAlign: 'left',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 8, cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontFamily: INTER, fontSize: 12, fontWeight: 600, color: 'rgba(225,235,255,0.85)' }}>
                          {r.title}
                        </div>
                        {r.snippet && (
                          <div style={{ fontFamily: INTER, fontSize: 11, color: 'rgba(200,210,235,0.45)', marginTop: 2 }}>
                            {r.snippet}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ActionCard>

              {/* Continue work */}
              <ActionCard title="Continue Work" subtitle="Resume unfinished tasks" icon={ListChecks}>
                <button onClick={handleEnter} style={{
                  width: '100%', padding: '10px 0',
                  fontFamily: INTER, fontSize: 13, fontWeight: 600,
                  color: 'rgba(225,235,255,0.75)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <ListChecks size={14} /> Enter Star Map to Continue
                </button>
              </ActionCard>
            </>
          ) : (
            <div style={{
              background: 'rgba(8,14,30,0.95)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 16, padding: 20, textAlign: 'center',
            }}>
              <LogIn size={24} color="rgba(200,210,235,0.50)" style={{ marginBottom: 10 }} />
              <p style={{ fontFamily: INTER, fontSize: 13, color: 'rgba(200,210,235,0.60)', margin: '0 0 14px' }}>
                Log in to capture notes, search, and continue your work.
              </p>
              <button onClick={() => navigate('/auth')} style={{
                padding: '10px 24px',
                fontFamily: INTER, fontSize: 14, fontWeight: 600,
                color: '#66f0ff', background: 'rgba(102,240,255,0.10)',
                border: '1px solid rgba(102,240,255,0.30)',
                borderRadius: 10, cursor: 'pointer',
              }}>
                Log In / Sign Up
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────
function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700,
      letterSpacing: '0.08em', color,
      background: `${color}15`, border: `1px solid ${color}30`,
      borderRadius: 4, padding: '3px 8px',
    }}>
      {text}
    </span>
  );
}

function ActionCard({ title, subtitle, icon: Icon, children }: {
  title: string; subtitle: string; icon: typeof PenLine; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'rgba(8,14,30,0.90)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(102,240,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color="rgba(102,240,255,0.70)" />
        </div>
        <div>
          <div style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 13, fontWeight: 700, color: 'rgba(225,235,255,0.90)' }}>{title}</div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: 'rgba(160,180,220,0.45)', letterSpacing: '0.04em' }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}
