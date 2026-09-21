import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRequirePermission } from "@/hooks/use-permissions";
import { toast } from "sonner";
import {
  ShieldCheck,
  ArrowLeft,
  Settings,
  Megaphone,
  ImagePlus,
  Trash2,
  Loader2,
  UserPlus,
  Save,
  Eye,
  EyeOff,
  FolderKanban,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Control panel — Unify Youth Group" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ControlPanel,
});

const CATEGORIES = ["gallery", "projects", "hero"] as const;

const CATEGORY_LABEL: Record<(typeof CATEGORIES)[number], string> = {
  gallery: "Gallery photo",
  projects: "Project photo",
  hero: "Homepage background",
};

function ControlPanel() {
  const { can, allowed, loading: checking, isSuperAdmin } = useRequirePermission("manage_content");
  const canEditSettings = can("manage_settings");

  if (checking || !allowed) {
    return <div className="container-page py-24 text-center text-muted-foreground">Checking access…</div>;
  }

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary-glow font-semibold uppercase tracking-widest">
            <ShieldCheck className="h-4 w-4" /> Admin
          </div>
          <h1 className="mt-1 text-3xl md:text-4xl text-foreground">Control panel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Site settings, notice marquee, photo uploads, and user management in one place.
          </p>
        </div>
        <Link to="/admin" className="btn-outline"><ArrowLeft className="h-4 w-4" /> Admin dashboard</Link>
      </div>

      <SettingsCard isSuper={canEditSettings || isSuperAdmin} />
      <NoticesCard />
      <ProjectsCard />
      <ImagesCard />

      <section className="mt-8 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" /> Users & access
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Add members, approve their accounts, invite admins, and manage roles.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {can("manage_members") && (
            <Link to="/admin" className="btn-outline !py-2 !px-4 text-sm">Add / approve members</Link>
          )}
          {can("manage_roles") && (
            <Link to="/admin/roles" className="btn-primary !py-2 !px-4 text-sm">Invite admins & roles</Link>
          )}
          {!can("manage_members") && !can("manage_roles") && (
            <span className="text-sm text-muted-foreground">Your role doesn't include user management.</span>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------------- Site settings ---------------- */
function SettingsCard({ isSuper }: { isSuper: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<null | {
    id: string;
    group_name: string;
    tagline: string;
    phone: string;
    email: string;
    location: string;
    about_intro: string;
    vision: string;
    mission: string;
    marquee_enabled: boolean;
  }>(null);

  const { data } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data && !form) {
      setForm({
        id: data.id,
        group_name: data.group_name,
        tagline: data.tagline,
        phone: data.phone,
        email: data.email,
        location: data.location,
        about_intro: data.about_intro ?? "",
        vision: data.vision ?? "",
        mission: data.mission ?? "",
        marquee_enabled: data.marquee_enabled,
      });
    }
  }, [data, form]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: form.id,
          group_name: form.group_name,
          tagline: form.tagline,
          phone: form.phone,
          email: form.email,
          location: form.location,
          about_intro: form.about_intro,
          vision: form.vision,
          mission: form.mission,
          marquee_enabled: form.marquee_enabled,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(result?.error || `Settings update failed (${response.status})`);
      }
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["site-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!form) {
    return (
      <section className="mt-8 rounded-2xl bg-card border border-border p-5 text-sm text-muted-foreground">
        Loading settings…
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" /> Site settings
      </h2>
      <p className="text-xs text-muted-foreground mt-0.5">
        {isSuper ? "Super admins can edit these values." : "Read-only — super admin access required to edit."}
      </p>
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="mt-5 grid md:grid-cols-2 gap-3"
      >
        {([
          ["group_name", "Group name"],
          ["tagline", "Tagline"],
          ["phone", "Phone"],
          ["email", "Contact email"],
          ["location", "Location"],
        ] as const).map(([key, label]) => (
          <label key={key} className="text-sm">
            <span className="text-xs text-muted-foreground">{label}</span>
            <input
              disabled={!isSuper}
              maxLength={200}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm disabled:opacity-60"
            />
          </label>
        ))}
        {([
          ["about_intro", "About page intro"],
          ["vision", "Our vision"],
          ["mission", "Our mission"],
        ] as const).map(([key, label]) => (
          <label key={key} className="text-sm md:col-span-2">
            <span className="text-xs text-muted-foreground">{label}</span>
            <textarea
              disabled={!isSuper}
              maxLength={1200}
              rows={3}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm disabled:opacity-60"
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm mt-6">
          <input
            type="checkbox"
            disabled={!isSuper}
            checked={form.marquee_enabled}
            onChange={(e) => setForm({ ...form, marquee_enabled: e.target.checked })}
            className="h-4 w-4"
          />
          Show notice marquee on the public site
        </label>
        {isSuper && (
          <button type="submit" disabled={save.isPending} className="btn-primary md:col-span-2 disabled:opacity-60">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
          </button>
        )}
      </form>
    </section>
  );
}

/* ---------------- Notices ---------------- */
function NoticesCard() {
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [priority, setPriority] = useState(0);

  const { data: notices } = useQuery({
    queryKey: ["admin-notices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notices")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const msg = message.trim();
      if (!msg) throw new Error("Notice message is required");
      if (msg.length > 300) throw new Error("Keep notices under 300 characters");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("notices").insert({
        message: msg,
        link: link.trim() || null,
        priority,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notice added");
      setMessage(""); setLink(""); setPriority(0);
      qc.invalidateQueries({ queryKey: ["admin-notices"] });
      qc.invalidateQueries({ queryKey: ["public-notices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("notices").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notices"] });
      qc.invalidateQueries({ queryKey: ["public-notices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notice removed");
      qc.invalidateQueries({ queryKey: ["admin-notices"] });
      qc.invalidateQueries({ queryKey: ["public-notices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-8 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" /> Notice marquee
      </h2>
      <p className="text-xs text-muted-foreground mt-0.5">
        Active notices scroll across the top of every page.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="mt-5 grid md:grid-cols-6 gap-3">
        <input
          required
          maxLength={300}
          placeholder="Notice message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="md:col-span-3 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        />
        <input
          maxLength={300}
          placeholder="Link (optional, e.g. /projects)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="md:col-span-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        />
        <input
          type="number"
          min={0}
          max={100}
          placeholder="Priority"
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        />
        <button type="submit" disabled={add.isPending} className="btn-primary md:col-span-6 disabled:opacity-60">
          {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add notice
        </button>
      </form>

      <ul className="mt-5 divide-y divide-border rounded-lg border border-border">
        {(notices ?? []).length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No notices yet.</li>
        ) : (
          (notices ?? []).map((n) => (
            <li key={n.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className={`text-sm ${n.active ? "text-foreground" : "text-muted-foreground line-through"}`}>
                  {n.message}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Priority {n.priority}{n.link ? ` · ${n.link}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggle.mutate({ id: n.id, active: !n.active })}
                  className="btn-outline !py-1.5 !px-3 text-xs"
                >
                  {n.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {n.active ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => remove.mutate(n.id)}
                  className="btn-outline !py-1.5 !px-3 text-xs text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

/* ---------------- Projects ---------------- */
type ProjectRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  image_url: string | null;
  sort_order: number;
};

const PROJECT_STATUSES = ["Ongoing", "Planned", "Completed"] as const;

function ProjectsCard() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    status: "Ongoing",
    progress: 0,
    image_url: "",
  });

  const { data: projects } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, status, progress, image_url, sort_order")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectRow[];
    },
  });

  const { data: projectImages } = useQuery({
    queryKey: ["site-images", "projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_images")
        .select("id, title, public_url")
        .eq("category", "projects")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-projects"] });
    qc.invalidateQueries({ queryKey: ["public-projects"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const title = draft.title.trim();
      if (!title) throw new Error("Project title is required");
      const { data: u } = await supabase.auth.getUser();
      const nextOrder = (projects?.length ?? 0) + 1;
      const { error } = await supabase.from("projects").insert({
        title,
        description: draft.description.trim(),
        status: draft.status,
        progress: Math.min(100, Math.max(0, Number(draft.progress) || 0)),
        image_url: draft.image_url || null,
        sort_order: nextOrder,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project added");
      setDraft({ title: "", description: "", status: "Ongoing", progress: 0, image_url: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ProjectRow> }) => {
      const { error } = await supabase.from("projects").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Project updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const list = projects ?? [];
      const target = list[index + dir];
      const current = list[index];
      if (!target || !current) return;
      const a = await supabase.from("projects").update({ sort_order: target.sort_order }).eq("id", current.id);
      if (a.error) throw a.error;
      const b = await supabase.from("projects").update({ sort_order: current.sort_order }).eq("id", target.id);
      if (b.error) throw b.error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Project removed"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-8 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
        <FolderKanban className="h-5 w-5 text-primary" /> Projects
      </h2>
      <p className="text-xs text-muted-foreground mt-0.5">
        Anything you add here appears on the public projects page and the homepage.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="mt-5 grid md:grid-cols-6 gap-3">
        <input
          required
          maxLength={140}
          placeholder="Project title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="md:col-span-3 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        />
        <select
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          className="md:col-span-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        >
          {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          type="number"
          min={0}
          max={100}
          value={draft.progress}
          onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })}
          className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        />
        <textarea
          rows={2}
          maxLength={800}
          placeholder="Short description"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="md:col-span-4 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        />
        <select
          value={draft.image_url}
          onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
          className="md:col-span-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        >
          <option value="">Picture: none</option>
          {(projectImages ?? []).map((img) => (
            <option key={img.id} value={img.public_url}>{img.title ?? "Untitled"}</option>
          ))}
        </select>
        <button type="submit" disabled={add.isPending} className="btn-primary md:col-span-6 disabled:opacity-60">
          {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add project
        </button>
      </form>

      <ul className="mt-5 divide-y divide-border rounded-lg border border-border">
        {(projects ?? []).length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No projects yet.</li>
        ) : (
          (projects ?? []).map((p, i) => (
            <li key={p.id} className="p-4 grid md:grid-cols-6 gap-3 items-center">
              <input
                defaultValue={p.title}
                maxLength={140}
                onBlur={(e) => e.target.value.trim() !== p.title && update.mutate({ id: p.id, patch: { title: e.target.value.trim() } })}
                className="md:col-span-2 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <select
                value={p.status}
                onChange={(e) => update.mutate({ id: p.id, patch: { status: e.target.value } })}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                type="number"
                min={0}
                max={100}
                defaultValue={p.progress}
                onBlur={(e) => Number(e.target.value) !== p.progress && update.mutate({ id: p.id, patch: { progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } })}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <select
                value={p.image_url ?? ""}
                onChange={(e) => update.mutate({ id: p.id, patch: { image_url: e.target.value || null } })}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Picture: none</option>
                {(projectImages ?? []).map((img) => (
                  <option key={img.id} value={img.public_url}>{img.title ?? "Untitled"}</option>
                ))}
                {p.image_url && !(projectImages ?? []).some((im) => im.public_url === p.image_url) && (
                  <option value={p.image_url}>Current picture</option>
                )}
              </select>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => move.mutate({ index: i, dir: -1 })}
                  disabled={i === 0}
                  className="btn-outline !py-1.5 !px-2 text-xs disabled:opacity-40"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => move.mutate({ index: i, dir: 1 })}
                  disabled={i === (projects ?? []).length - 1}
                  className="btn-outline !py-1.5 !px-2 text-xs disabled:opacity-40"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove.mutate(p.id)}
                  className="btn-outline !py-1.5 !px-3 text-xs text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                rows={2}
                maxLength={800}
                defaultValue={p.description}
                onBlur={(e) => e.target.value !== p.description && update.mutate({ id: p.id, patch: { description: e.target.value } })}
                className="md:col-span-6 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

/* ---------------- Images ---------------- */
function ImagesCard() {
  const qc = useQueryClient();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("gallery");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: images } = useQuery({
    queryKey: ["site-images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_images")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Only image files are allowed");
    if (file.size > 8 * 1024 * 1024) return toast.error("Image must be under 8 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${category}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("site-media").upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("site-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("site_images").insert({
        title: title.trim() || file.name,
        category,
        storage_path: path,
        public_url: signed.signedUrl,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Image uploaded");
      setTitle("");
      qc.invalidateQueries({ queryKey: ["site-images"] });
      qc.invalidateQueries({ queryKey: ["site-image"] });
      qc.invalidateQueries({ queryKey: ["gallery-images"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const remove = useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string }) => {
      await supabase.storage.from("site-media").remove([path]);
      const { error } = await supabase.from("site_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Image deleted");
      qc.invalidateQueries({ queryKey: ["site-images"] });
      qc.invalidateQueries({ queryKey: ["site-image"] });
      qc.invalidateQueries({ queryKey: ["gallery-images"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-8 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
        <ImagePlus className="h-5 w-5 text-primary" /> Photos
      </h2>
      <p className="text-xs text-muted-foreground mt-0.5">
        Gallery photos show on the gallery page, and a homepage background replaces the front-page
        picture straight away.
      </p>

      <div className="mt-5 grid md:grid-cols-4 gap-3 items-end">
        <label className="text-sm">
          <span className="text-xs text-muted-foreground">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </label>
        <label className="text-sm md:col-span-2">
          <span className="text-xs text-muted-foreground">Caption (optional)</span>
          <input
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />
        </label>
        <label className={`btn-primary justify-center cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Choose image"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
        </label>
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        {(images ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full">No uploads yet.</p>
        ) : (
          (images ?? []).map((img) => (
            <div key={img.id} className="rounded-lg overflow-hidden border border-border bg-secondary/40">
              <img src={img.public_url} alt={img.title ?? ""} className="h-32 w-full object-cover" loading="lazy" />
              <div className="p-2">
                <div className="text-xs font-medium text-foreground truncate">{img.title ?? "Untitled"}</div>
                <div className="text-[11px] text-muted-foreground">{img.category}</div>
                <button
                  onClick={() => remove.mutate({ id: img.id, path: img.storage_path })}
                  className="mt-2 text-[11px] text-destructive inline-flex items-center gap-1 hover:underline"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
