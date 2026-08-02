import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function NoticeMarquee() {
  const { data: settings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("marquee_enabled").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: notices } = useQuery({
    queryKey: ["public-notices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notices")
        .select("id, message, link, priority")
        .eq("active", true)
        .order("priority", { ascending: false });
      return data ?? [];
    },
  });

  const list = notices ?? [];
  if (settings?.marquee_enabled === false || list.length === 0) return null;

  const items = [...list, ...list];

  return (
    <div className="bg-primary text-primary-foreground border-b border-primary/40 overflow-hidden">
      <div className="container-page flex items-center gap-3 py-2">
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-accent">
          <Megaphone className="h-3.5 w-3.5" /> Notices
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap text-sm">
            {items.map((n, i) => (
              <span key={`${n.id}-${i}`} className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                {n.link && n.link.startsWith("/") ? (
                  <Link to={n.link} className="hover:underline">{n.message}</Link>
                ) : n.link ? (
                  <a href={n.link} target="_blank" rel="noopener noreferrer" className="hover:underline">{n.message}</a>
                ) : (
                  <span>{n.message}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
