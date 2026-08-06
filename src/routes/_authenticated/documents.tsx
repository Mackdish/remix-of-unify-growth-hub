import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, ArrowLeft, Upload, Download, Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [{ title: "Documents — Unify Youth Group" }, { name: "robots", content: "noindex" }],
  }),
  component: DocumentsPage,
});

type Doc = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

const CATEGORIES = [
  { key: "minutes", label: "Minutes" },
  { key: "policy", label: "Policies" },
  { key: "constitution", label: "Constitution" },
  { key: "report", label: "Reports" },
  { key: "form", label: "Forms" },
  { key: "other", label: "Other" },
] as const;

const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

const prettySize = (n: number | null) => {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

function DocumentsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ title: "", category: "minutes", description: "" });
  const [file, setFile] = useState<File | null>(null);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return false;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      return (roles ?? []).some((r: { role: string }) =>
        ["super_admin", "treasurer", "secretary", "project_manager"].includes(r.role),
      );
    },
  });

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, category, description, file_name, storage_path, mime_type, size_bytes, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file to upload");
      if (!form.title.trim()) throw new Error("Give the document a title");
      const { data: u } = await supabase.auth.getUser();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${form.category}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;
      const { error } = await supabase.from("documents").insert({
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim() || null,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      setForm({ title: "", category: form.category, description: "" });
      setFile(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (d: Doc) => {
      await supabase.storage.from("documents").remove([d.storage_path]);
      const { error } = await supabase.from("documents").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document removed");
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.storage_path, 60 * 10, {
      download: d.file_name,
    });
    if (error || !data) return toast.error("Could not open that file");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const visible = (docs ?? []).filter((d) => filter === "all" || d.category === filter);

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary-glow font-semibold uppercase tracking-widest">
            <FileText className="h-4 w-4" /> Library
          </div>
          <h1 className="mt-1 text-3xl md:text-4xl text-foreground">Group documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Minutes, policies, the constitution and other official papers — available to every signed-in member.
          </p>
        </div>
        <Link to="/dashboard" className="btn-outline"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
      </div>

      {isAdmin && (
        <section className="mt-8 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Upload a document
          </h2>
          <form
            onSubmit={(e) => { e.preventDefault(); upload.mutate(); }}
            className="mt-4 grid md:grid-cols-6 gap-3"
          >
            <input
              required
              placeholder="Title (e.g. AGM minutes — July 2026)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="md:col-span-3 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="md:col-span-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="md:col-span-2 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              placeholder="Short description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="md:col-span-6 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            />
            <button type="submit" disabled={upload.isPending} className="btn-primary md:col-span-6 disabled:opacity-60">
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
            </button>
          </form>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {[{ key: "all", label: "All" }, ...CATEGORIES].map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
              filter === c.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <section className="mt-4 rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-soft)]">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading documents…</div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No documents here yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {CAT_LABEL[d.category] ?? d.category} · {d.created_at.slice(0, 10)} · {prettySize(d.size_bytes)}
                  </div>
                  {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => download(d)} className="btn-outline !py-1.5 !px-3 text-xs">
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => remove.mutate(d)}
                      className="rounded-lg border border-destructive/40 text-destructive px-2.5 py-1.5 text-xs hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 inline" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
