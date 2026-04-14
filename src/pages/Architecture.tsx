import { useNavigate } from "react-router-dom";
import {
  Globe, Database, Cpu, Layers, ArrowRight, ArrowDown,
  RotateCcw, Sparkles, Search, Brain, Zap, BookOpen,
  GitBranch, Calendar, Mail, Code2, FolderOpen, Link,
  Settings, Star, ScanSearch, Lightbulb,
  ChevronRight, Shield, User, Box, Network, FileText,
  HardDrive, Tag, Clock, Activity
} from "lucide-react";

const LayerHeader = ({ label, sub, color }: { label: string; sub: string; color: string }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className={`h-px flex-1 opacity-40 ${color}`} style={{ background: "currentColor" }} />
    <div className="text-center">
      <div className={`text-[10px] font-mono tracking-[0.3em] uppercase opacity-60 mb-0.5 ${color}`}>{sub}</div>
      <div className="text-sm font-semibold text-foreground tracking-wide">{label}</div>
    </div>
    <div className={`h-px flex-1 opacity-40 ${color}`} style={{ background: "currentColor" }} />
  </div>
);

const Chip = ({ icon: Icon, label, color = "text-muted-foreground", bg = "bg-muted/40" }: {
  icon?: React.ElementType; label: string; color?: string; bg?: string;
}) => (
  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/50 text-xs font-medium whitespace-nowrap ${bg} ${color}`}>
    {Icon && <Icon size={11} />}
    {label}
  </div>
);

const ArrowV = ({ color = "text-muted-foreground/40" }: { color?: string }) => (
  <div className={`flex justify-center my-1 ${color}`}>
    <ArrowDown size={18} strokeWidth={1.5} />
  </div>
);

const FlowArrow = () => (
  <ChevronRight size={14} className="text-muted-foreground/50 shrink-0" />
);

export default function Architecture() {
  const navigate = useNavigate();

  const pods = [
    { icon: BookOpen, label: "Capture", color: "text-primary", border: "border-primary/30", bg: "bg-primary/8", glow: "shadow-[0_0_12px_rgba(0,255,102,0.15)]" },
    { icon: Search, label: "Retrieval", color: "text-secondary", border: "border-secondary/30", bg: "bg-secondary/8", glow: "shadow-[0_0_12px_rgba(102,240,255,0.12)]" },
    { icon: Lightbulb, label: "Insight", color: "text-accent", border: "border-accent/30", bg: "bg-accent/8", glow: "shadow-[0_0_12px_rgba(140,100,255,0.12)]" },
    { icon: Brain, label: "Memory", color: "text-yellow-400", border: "border-yellow-400/30", bg: "bg-yellow-400/8", glow: "" },
    { icon: Zap, label: "Action", color: "text-pink-400", border: "border-pink-400/30", bg: "bg-pink-400/8", glow: "" },
  ];

  const flows = [
    { label: "Capture", sub: "输入委托", color: "text-primary", border: "border-primary/25", bg: "bg-primary/8", lines: ["文本 / URL", "文件 / 想法"] },
    { label: "Retrieval", sub: "语义检索", color: "text-secondary", border: "border-secondary/25", bg: "bg-secondary/8", lines: ["召回旧节点", "关键词+语义"] },
    { label: "Insight", sub: "深度理解", color: "text-accent", border: "border-accent/25", bg: "bg-accent/8", lines: ["生成新知识", "4种解读模式"] },
    { label: "Memory", sub: "上下文唤醒", color: "text-yellow-400", border: "border-yellow-400/25", bg: "bg-yellow-400/8", lines: ["相关节点", "唤醒关联"] },
    { label: "Action", sub: "知识转化", color: "text-pink-400", border: "border-pink-400/25", bg: "bg-pink-400/8", lines: ["任务/提纲", "问题/素材"] },
  ];

  const agentSteps = [
    { label: ["Input", "Delegation"], icon: ArrowRight, sub: "用户委托" },
    { label: ["Classify", "& Route"], icon: GitBranch, sub: "意图分类" },
    { label: ["RAG", "Retrieval"], icon: ScanSearch, sub: "知识检索" },
    { label: ["MCP", "Tool Use"], icon: Globe, sub: "外部工具" },
    { label: ["Distill", "& Generate"], icon: Sparkles, sub: "提炼生成" },
    { label: ["Typed", "Node Output"], icon: Box, sub: "知识对象" },
    { label: ["Write Back", "Star Map"], icon: Network, sub: "回写星图" },
  ];

  const ragSteps = [
    { icon: FolderOpen, label: "Knowledge Ingestion", items: ["上传文件", "文本输入", "链接保存", "笔记录入"] },
    { icon: Code2, label: "Parsing & Chunking", items: ["文本提取 & 清洗", "切块分段", "元数据处理"] },
    { icon: Layers, label: "Embedding & Indexing", items: ["向量生成", "私有索引构建", "user_id / project_id 隔离"] },
    { icon: ScanSearch, label: "Retrieval Engine", items: ["语义检索", "关键词检索", "Hybrid + Reranking"] },
    { icon: Sparkles, label: "Grounded Generation", items: ["基于检索生成", "带来源引用", "Source Lineage 追溯"] },
  ];

  const mcpTools = [
    { icon: FileText, label: "Notion", sub: "文档知识" },
    { icon: FolderOpen, label: "Google Drive", sub: "云端文件" },
    { icon: GitBranch, label: "GitHub", sub: "代码知识" },
    { icon: Search, label: "Web Search", sub: "实时检索" },
    { icon: Database, label: "Database", sub: "数据工具" },
    { icon: Calendar, label: "Calendar / Tasks", sub: "任务规划" },
    { icon: Mail, label: "Email / APIs", sub: "外部接入" },
    { icon: Code2, label: "Analysis Tools", sub: "代码执行" },
  ];

  const dataNodes = [
    { icon: User, label: "User Accounts", sub: "user_id 隔离" },
    { icon: Box, label: "Project Spaces", sub: "project_id 隔离" },
    { icon: FileText, label: "Documents", sub: "原始文档" },
    { icon: Layers, label: "Chunks", sub: "切块分段" },
    { icon: HardDrive, label: "Embeddings / Vectors", sub: "向量索引" },
    { icon: Network, label: "Knowledge Nodes", sub: "知识节点" },
    { icon: Sparkles, label: "Galaxy / Cluster", sub: "星系关联" },
    { icon: Zap, label: "Actions / Tasks", sub: "行动对象" },
    { icon: Settings, label: "Settings / Prefs", sub: "用户配置" },
    { icon: GitBranch, label: "Source Lineage", sub: "来源链溯源" },
  ];

  const legend = [
    { color: "bg-primary", label: "主界面核心", desc: "3D 知识星图 · 前台入口" },
    { color: "bg-secondary", label: "私有云 RAG", desc: "用户知识底盘 · 语义检索" },
    { color: "bg-accent", label: "Agent 协调层", desc: "LLM 驱动 · 路由委托" },
    { color: "bg-yellow-400", label: "MCP 外部层", desc: "外部工具 · 执行扩展" },
    { color: "bg-pink-400", label: "知识流循环", desc: "Capture→Action→回写" },
    { color: "bg-muted-foreground", label: "数据存储层", desc: "私有数据 · 节点溯源" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(0,255,102,0.04),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,rgba(102,240,255,0.04),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(140,100,255,0.03),transparent_60%)]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-10">

        {/* title */}
        <div className="text-center mb-12">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowRight size={12} className="rotate-180" /> 返回应用
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono tracking-wider mb-4">
            <Activity size={12} /> SYSTEM ARCHITECTURE
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
            个人知识星图 · 产品结构图
          </h1>
          <p className="text-muted-foreground text-sm">Personal Cognitive Operating System — Architecture Overview</p>
        </div>

        {/* LAYER 1 */}
        <div className="rounded-2xl border border-primary/25 bg-card/60 backdrop-blur-sm p-5 shadow-[0_0_40px_rgba(0,255,102,0.06)] mb-2">
          <LayerHeader label="UI / Experience Layer" sub="Layer 1 · User Interface" color="text-primary" />

          <div className="relative rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 p-5 mb-4 overflow-hidden">
            {[...Array(18)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-primary opacity-30"
                style={{
                  width: i % 3 === 0 ? 3 : 2,
                  height: i % 3 === 0 ? 3 : 2,
                  left: `${5 + (i * 53) % 90}%`,
                  top: `${10 + (i * 37) % 80}%`,
                  boxShadow: i % 4 === 0 ? "0 0 6px rgba(0,255,102,0.6)" : "none",
                }}
              />
            ))}
            <div className="relative flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shadow-[0_0_16px_rgba(0,255,102,0.2)]">
                <Network size={18} className="text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-primary">3D Infinite Knowledge Star Map</div>
                <div className="text-xs text-muted-foreground">PRIMARY INTERFACE · 三维无限知识星图</div>
              </div>
              <div className="ml-auto px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-mono border border-primary/25">CORE UI</div>
            </div>
            <div className="relative flex flex-wrap gap-2">
              <Chip icon={RotateCcw} label="平移 / 缩放 / 旋转" color="text-primary/80" bg="bg-primary/8" />
              <Chip icon={Star} label="节点编辑 & 展开" color="text-primary/80" bg="bg-primary/8" />
              <Chip icon={Sparkles} label="自动高亮星系" color="text-primary/80" bg="bg-primary/8" />
              <Chip icon={GitBranch} label="Trail 路径显示" color="text-primary/80" bg="bg-primary/8" />
              <Chip icon={Link} label="来源链 & 召回结果" color="text-primary/80" bg="bg-primary/8" />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-2 ml-1">Floating Pods · 漂浮功能舱</div>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {pods.map(({ icon: Icon, label, color, border, bg, glow }) => (
                <div key={label} className={`rounded-xl border ${border} ${bg} ${glow} p-3 flex flex-col items-center gap-1.5 text-center`}>
                  <Icon size={16} className={color} />
                  <div className={`text-[11px] font-semibold ${color}`}>{label}</div>
                  <div className="text-[9px] text-muted-foreground font-mono">Pod</div>
                </div>
              ))}
            </div>
            <div className="flex justify-center">
              <Chip icon={Settings} label="Settings Component · 次级控制入口" color="text-muted-foreground" bg="bg-muted/30" />
            </div>
          </div>
        </div>

        <ArrowV color="text-primary/30" />

        {/* LAYER 2 */}
        <div className="rounded-2xl border border-secondary/25 bg-card/60 backdrop-blur-sm p-5 shadow-[0_0_40px_rgba(102,240,255,0.05)] mb-2">
          <LayerHeader label="Knowledge Flow Layer" sub="Layer 2 · Cognitive Pipeline" color="text-secondary" />

          <div className="relative">
            <div className="absolute -inset-2 rounded-2xl border border-secondary/10 pointer-events-none" />
            <div className="flex items-stretch gap-1 mb-3">
              {flows.map(({ label, sub, color, border, bg, lines }, i) => (
                <div key={label} className="flex items-center gap-1 flex-1">
                  <div className={`flex-1 rounded-xl border ${border} ${bg} p-3 text-center`}>
                    <div className={`text-xs font-semibold ${color}`}>{label}</div>
                    <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{sub}</div>
                    <div className="mt-1.5 space-y-0.5">
                      {lines.map(l => (
                        <div key={l} className="text-[9px] text-muted-foreground/60 leading-relaxed">{l}</div>
                      ))}
                    </div>
                  </div>
                  {i < flows.length - 1 && <FlowArrow />}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-secondary/20 bg-secondary/5">
              <RotateCcw size={13} className="text-secondary shrink-0" />
              <div className="text-xs text-secondary/80">
                所有输出重新写回 <span className="text-primary font-semibold">知识星图</span> · 形成新节点 / 更新关联 / 追加来源链
              </div>
              <div className="ml-auto text-[10px] font-mono text-secondary/50 shrink-0">LOOP BACK</div>
            </div>

            <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-xl border border-muted/30 bg-muted/20">
              <Cpu size={12} className="text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-[11px] text-muted-foreground/80 leading-relaxed">
                输入不直接保存 · 先进入 <span className="text-foreground font-medium">Agent Processing Flow</span> →
                分类 → 路由 → RAG检索 → MCP工具调用 → 生成知识对象 → 写回星图
              </div>
            </div>
          </div>
        </div>

        <ArrowV color="text-accent/30" />

        {/* LAYER 3 */}
        <div className="rounded-2xl border border-accent/25 bg-card/60 backdrop-blur-sm p-5 shadow-[0_0_40px_rgba(140,100,255,0.06)] mb-2">
          <LayerHeader label="Agent Orchestration Layer" sub="Layer 3 · AI Coordination" color="text-accent" />

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3">
            {agentSteps.map(({ label, icon: Icon, sub }, i, arr) => (
              <div key={label[0]} className="flex items-center gap-1 shrink-0">
                <div className="rounded-xl border border-accent/25 bg-accent/8 p-2.5 text-center w-[78px]">
                  <Icon size={14} className="text-accent mx-auto mb-1" />
                  <div className="text-[10px] font-semibold text-accent/90 leading-tight">
                    {label.map((l, li) => <div key={li}>{l}</div>)}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{sub}</div>
                </div>
                {i < arr.length - 1 && <ChevronRight size={12} className="text-accent/40 shrink-0" />}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip icon={Cpu} label="LLM: Claude Sonnet 4.6" color="text-accent/90" bg="bg-accent/10" />
            <Chip icon={Shield} label="Agent-driven 委托模式" color="text-accent/80" bg="bg-accent/8" />
            <Chip icon={Box} label="输出为 Knowledge Objects，非普通文本" color="text-muted-foreground" bg="bg-muted/30" />
          </div>
        </div>

        <ArrowV />

        {/* LAYER 4 + 5 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
          {/* RAG */}
          <div className="rounded-2xl border border-secondary/30 bg-card/60 backdrop-blur-sm p-5 shadow-[0_0_30px_rgba(102,240,255,0.07)]">
            <LayerHeader label="Private Cloud RAG Layer" sub="Layer 4 · Knowledge Base" color="text-secondary" />
            <div className="space-y-2">
              {ragSteps.map(({ icon: Icon, label, items }) => (
                <div key={label} className="flex items-start gap-2.5 p-2.5 rounded-xl border border-secondary/15 bg-secondary/5">
                  <Icon size={13} className="text-secondary mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] font-semibold text-secondary">{label}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {items.map(item => (
                        <span key={item} className="text-[9px] text-muted-foreground/70 font-mono bg-muted/30 px-1.5 py-0.5 rounded-full">{item}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 px-2.5 py-2 rounded-xl bg-secondary/10 border border-secondary/20">
              <Shield size={12} className="text-secondary shrink-0" />
              <div className="text-[10px] text-secondary/80">私有云 RAG · 每用户独立知识空间 · 服务于星图与 5 个舱</div>
            </div>
          </div>

          {/* MCP */}
          <div className="rounded-2xl border border-yellow-400/30 bg-card/60 backdrop-blur-sm p-5 shadow-[0_0_30px_rgba(255,200,50,0.05)]">
            <LayerHeader label="MCP Capability Layer" sub="Layer 5 · External Tools" color="text-yellow-400" />
            <div className="grid grid-cols-2 gap-2 mb-3">
              {mcpTools.map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-2 p-2 rounded-lg border border-yellow-400/15 bg-yellow-400/5">
                  <Icon size={12} className="text-yellow-400 shrink-0" />
                  <div>
                    <div className="text-[10px] font-semibold text-yellow-400">{label}</div>
                    <div className="text-[9px] text-muted-foreground font-mono">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-yellow-400/8 border border-yellow-400/20">
                <ScanSearch size={11} className="text-secondary mt-0.5 shrink-0" />
                <div className="text-[10px] text-muted-foreground/80">
                  <span className="text-secondary font-medium">RAG</span> 负责找回用户自己的知识
                </div>
              </div>
              <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-yellow-400/8 border border-yellow-400/20">
                <Globe size={11} className="text-yellow-400 mt-0.5 shrink-0" />
                <div className="text-[10px] text-muted-foreground/80">
                  <span className="text-yellow-400 font-medium">MCP</span> 连接外部工具、资源与执行能力
                </div>
              </div>
              <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-muted/30">
                <Cpu size={11} className="text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-[10px] text-muted-foreground/80">主要增强 Capture / Insight / Action · 作为 agent 背后的工具层</div>
              </div>
            </div>
          </div>
        </div>

        <ArrowV />

        {/* LAYER 6 */}
        <div className="rounded-2xl border border-muted/40 bg-card/40 backdrop-blur-sm p-5">
          <LayerHeader label="Data / Storage Layer" sub="Layer 6 · Private Data Foundation" color="text-muted-foreground" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            {dataNodes.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex flex-col items-center gap-1 p-3 rounded-xl border border-muted/30 bg-muted/20 text-center">
                <Icon size={14} className="text-muted-foreground/70" />
                <div className="text-[10px] font-semibold text-muted-foreground/90 leading-tight">{label}</div>
                <div className="text-[9px] text-muted-foreground/50 font-mono">{sub}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Chip icon={Shield} label="user_id 全局隔离" color="text-muted-foreground/80" />
            <Chip icon={Tag} label="project_id 空间隔离" color="text-muted-foreground/80" />
            <Chip icon={GitBranch} label="节点与来源链完整可追溯" color="text-muted-foreground/80" />
            <Chip icon={Clock} label="时序关系保留" color="text-muted-foreground/80" />
          </div>
        </div>

        {/* legend */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3">
          {legend.map(({ color, label, desc }) => (
            <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-muted/30 bg-card/40">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
              <div>
                <div className="text-xs font-semibold text-foreground/90">{label}</div>
                <div className="text-[10px] text-muted-foreground">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center text-[10px] font-mono text-muted-foreground/30 tracking-widest">
          PING · PERSONAL COGNITIVE OS · ARCHITECTURE v1
        </div>
      </div>
    </div>
  );
}
