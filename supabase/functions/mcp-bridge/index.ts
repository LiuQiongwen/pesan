
/**
 * MCP Bridge — Controlled read/write gateway for external tools (Obsidian plugin, MCP clients).
 *
 * Supported tools:
 *   cosmos.list_notes  — list user notes (paginated)
 *   cosmos.read_note   — read a single note
 *   cosmos.search_rag  — RAG search across knowledge base
 *   cosmos.list_insights — list distillations
 *   cosmos.write_cosmos — write a file to _cosmos/ export queue
 *
 * Auth: Bearer token (Supabase JWT) required.
 * Safety: write operations only target the `cosmos_exports` staging table.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ToolCall = await req.json();
    const { tool, params } = body;

    if (!tool || typeof tool !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "Missing tool name" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: ToolResult;

    switch (tool) {
      case "cosmos.list_notes": {
        const limit = Number(params.limit) || 50;
        const offset = Number(params.offset) || 0;
        const { data, error } = await supabase
          .from("notes")
          .select("id, title, tags, node_type, obsidian_path, created_at, updated_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        result = error ? { ok: false, error: error.message } : { ok: true, data };
        break;
      }

      case "cosmos.read_note": {
        const noteId = String(params.note_id || "");
        if (!noteId) { result = { ok: false, error: "note_id required" }; break; }
        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .eq("id", noteId)
          .eq("user_id", user.id)
          .maybeSingle();
        result = error ? { ok: false, error: error.message } : { ok: true, data };
        break;
      }

      case "cosmos.search_rag": {
        const query = String(params.query || "");
        if (!query) { result = { ok: false, error: "query required" }; break; }
        const limit = Number(params.limit) || 10;
        const { data, error } = await supabase
          .from("knowledge_chunks")
          .select("id, content, source_title, source_type, note_id")
          .eq("user_id", user.id)
          .textSearch("search_vector", query.split(/\s+/).join(" & "))
          .limit(limit);
        result = error ? { ok: false, error: error.message } : { ok: true, data };
        break;
      }

      case "cosmos.list_insights": {
        const limit = Number(params.limit) || 20;
        const { data, error } = await supabase
          .from("distillations")
          .select("id, title, key_insight, tags, confidence, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(limit);
        result = error ? { ok: false, error: error.message } : { ok: true, data };
        break;
      }

      case "cosmos.list_actions": {
        const limit = Number(params.limit) || 20;
        const status = String(params.status || "");
        let q = supabase
          .from("actions")
          .select("id, content, status, priority, due_date, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        result = error ? { ok: false, error: error.message } : { ok: true, data };
        break;
      }

      case "cosmos.list_tools": {
        result = {
          ok: true,
          data: {
            tools: [
              { name: "cosmos.list_notes", description: "List user notes (paginated)", params: ["limit?", "offset?"] },
              { name: "cosmos.read_note", description: "Read a single note by ID", params: ["note_id"] },
              { name: "cosmos.search_rag", description: "Full-text search across knowledge chunks", params: ["query", "limit?"] },
              { name: "cosmos.list_insights", description: "List distilled insights", params: ["limit?"] },
              { name: "cosmos.list_actions", description: "List action items", params: ["limit?", "status?"] },
              { name: "cosmos.list_tools", description: "List available MCP tools", params: [] },
            ],
          },
        };
        break;
      }

      default:
        result = { ok: false, error: `Unknown tool: ${tool}` };
    }

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("mcp-bridge error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
