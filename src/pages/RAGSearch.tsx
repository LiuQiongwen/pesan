import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, BookOpen, RefreshCw, ChevronDown, ChevronUp, ArrowRight, Database, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRAG, RAGConversation, WikiCitation } from "@/hooks/useRAG";
import { useT, useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SUPERSCRIPTS = ["¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

function renderAnswerWithCitations(answer: string): React.ReactNode[] {
  // Convert [1], [2] etc to superscripts
  const parts: React.ReactNode[] = [];
  const regex = /\[(\d+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(answer)) !== null) {
    if (match.index > last) parts.push(answer.slice(last, match.index));
    const num = parseInt(match[1]) - 1;
    parts.push(
      <sup key={match.index} className="text-emerald-400 font-bold ml-0.5 text-xs cursor-default" title={`Reference ${match[1]}`}>
        {SUPERSCRIPTS[num] || match[0]}
      </sup>
    );
    last = match.index + match[0].length;
  }
  if (last < answer.length) parts.push(answer.slice(last));
  return parts;
}

function CitationCard({ citation }: { citation: RAGConversation["citations"][number] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-emerald-400 font-bold text-xs w-5 flex-shrink-0">
          {SUPERSCRIPTS[citation.id - 1] || String(citation.id)}
        </span>
        <span className="text-white/80 text-sm truncate flex-1">{citation.note_title}</span>
        <span className="text-white/30 text-xs flex-shrink-0">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-white/5">
          <p className="text-white/50 text-xs leading-relaxed mb-2">{citation.excerpt}</p>
          <button
            onClick={() => navigate(`/note/${citation.note_id}`)}
            className="flex items-center gap-1 text-emerald-400 text-xs hover:underline"
          >
            <ArrowRight size={10} /> 查看原文 / View note
          </button>
        </div>
      )}
    </div>
  );
}

function WikiCitCard({ citation }: { citation: WikiCitation }) {
  const typeLabels: Record<string, string> = {
    topic: "WIKI:TOPIC", entity: "WIKI:ENTITY", timeline: "WIKI:TIMELINE",
    summary: "WIKI:SUMMARY", question: "WIKI:Q", overview: "WIKI:OVERVIEW",
  };
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-emerald-400 font-bold text-[10px] bg-emerald-400/10 px-1.5 py-0.5 rounded font-mono">
          {typeLabels[citation.page_type] || "WIKI"}
        </span>
        <span className="text-white/80 text-sm truncate flex-1">{citation.title}</span>
      </div>
      {citation.excerpt && (
        <p className="text-white/40 text-xs leading-relaxed">{citation.excerpt}</p>
      )}
    </div>
  );
}

function ConversationItem({ convo }: { convo: RAGConversation }) {
  const [showCitations, setShowCitations] = useState(false);
  const totalCitations = convo.citations.length + (convo.wiki_citations?.length || 0);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
      {/* Query */}
      <div className="flex items-start gap-2">
        <Search size={14} className="text-white/30 mt-1 flex-shrink-0" />
        <p className="text-white/60 text-sm">{convo.query}</p>
      </div>
      {/* Answer */}
      <div className="pl-5">
        <p className="text-white text-sm leading-relaxed">
          {renderAnswerWithCitations(convo.answer)}
        </p>
      </div>
      {/* Wiki citations */}
      {convo.wiki_citations && convo.wiki_citations.length > 0 && (
        <div className="pl-5 space-y-1.5">
          {convo.wiki_citations.map(w => (
            <WikiCitCard key={w.wiki_page_id} citation={w} />
          ))}
        </div>
      )}
      {/* Citations toggle */}
      {totalCitations > 0 && (
        <div className="pl-5">
          <button
            className="flex items-center gap-1.5 text-emerald-400/70 text-xs hover:text-emerald-400 transition-colors mb-2"
            onClick={() => setShowCitations(o => !o)}
          >
            <BookOpen size={11} />
            {convo.citations.length} 条原文引用
            {showCitations ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {showCitations && (
            <div className="space-y-2">
              {convo.citations.map(c => (
                <CitationCard key={c.chunk_id} citation={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RAGSearch() {
  const t = useT();
  const { lang } = useLanguage();
  const { user } = useAuth();
  const { search, indexNote, loading, error, conversations, clearConversations } = useRAG();
  const [query, setQuery] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [indexMsg, setIndexMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    await search(query);
    setQuery("");
  };

  const handleReindex = async () => {
    if (!user?.id || indexing) return;
    setIndexing(true);
    setIndexMsg(null);
    try {
      // Fetch all notes for the user
      const { data: notes } = await supabase
        .from("notes")
        .select("id, title, content_markdown, summary_markdown, analysis_markdown, source_type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!notes || notes.length === 0) {
        setIndexMsg(lang === "zh" ? "暂无笔记可索引" : "No notes to index");
        return;
      }

      let indexed = 0;
      for (const note of notes) {
        const content = [
          note.content_markdown || "",
          note.summary_markdown || "",
          note.analysis_markdown || "",
        ].join("\n\n").slice(0, 5000);
        await indexNote(note.id, content, note.title || "Untitled", note.source_type || "text");
        indexed++;
      }
      setIndexMsg(
        lang === "zh"
          ? `已索引 ${indexed} 篇笔记`
          : `Indexed ${indexed} note${indexed > 1 ? "s" : ""}`
      );
    } catch (e) {
      setIndexMsg(lang === "zh" ? "索引失败，请重试" : "Indexing failed, please retry");
    } finally {
      setIndexing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <Database size={16} className="text-emerald-400" />
            <span className="text-emerald-400 text-xs font-mono tracking-wider uppercase">
              {lang === "zh" ? "个人知识库 RAG" : "Personal Knowledge RAG"}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {t("rag.title")}
          </h1>
          <p className="text-white/40 text-sm">{t("rag.subtitle")}</p>
        </div>

        {/* Search box */}
        <form onSubmit={handleSearch} className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t("rag.placeholder")}
                className="w-full pl-9 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl font-medium text-sm disabled:opacity-40 transition-all"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : t("rag.search")}
            </Button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Conversations */}
        {conversations.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-white/30 text-xs">{t("rag.results")}</span>
              <button
                onClick={clearConversations}
                className="text-white/25 text-xs hover:text-white/50 transition-colors"
              >
                {lang === "zh" ? "清空" : "Clear"}
              </button>
            </div>
            {conversations.map((c, i) => (
              <ConversationItem key={c.id || i} convo={c} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {conversations.length === 0 && !loading && (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <Search size={20} className="text-white/20" />
            </div>
            <p className="text-white/30 text-sm">{t("rag.empty")}</p>
          </div>
        )}

        {/* Re-index section */}
        <div className="border-t border-white/5 pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/50 text-sm font-medium">{t("rag.reindex")}</p>
              <p className="text-white/25 text-xs mt-0.5">{t("rag.reindexDesc")}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReindex}
              disabled={indexing}
              className="border-white/15 text-white/50 hover:text-white hover:border-white/30 text-xs gap-1.5"
            >
              {indexing
                ? <Loader2 size={12} className="animate-spin" />
                : <RefreshCw size={12} />
              }
              {indexing ? t("rag.indexing") : t("rag.reindexBtn")}
            </Button>
          </div>
          {indexMsg && (
            <p className="text-emerald-400 text-xs">{indexMsg}</p>
          )}
        </div>

      </div>
    </div>
  );
}
