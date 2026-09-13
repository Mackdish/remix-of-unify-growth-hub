import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Unify Youth Group" },
      { name: "description", content: "Photos from Unify Youth Group meetings, projects and community events in Wote, Makueni." },
      { property: "og:title", content: "Gallery — Unify Youth Group" },
      { property: "og:description", content: "Meetings, community events, and project photos." },
    ],
  }),
  component: Gallery,
});

function Gallery() {
  const [open, setOpen] = useState<number | null>(null);

  const { data: uploaded } = useQuery({
    queryKey: ["gallery-images"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_images")
        .select("id, title, public_url")
        .eq("category", "gallery")
        .order("sort_order")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const images = (uploaded ?? []).map((u) => ({
    src: u.public_url,
    alt: u.title ?? "Unify Youth Group photo",
  }));

  return (
    <div>
      <section className="bg-surface border-b border-border">
        <div className="container-page py-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary-glow">Gallery</span>
          <h1 className="mt-3 text-4xl md:text-5xl text-foreground">Moments from our journey.</h1>
        </div>
      </section>

      <section className="container-page py-14">
        {images.length === 0 ? (
          <p className="text-muted-foreground">
            Photos will appear here once the administrator uploads them.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setOpen(i)}
                className="group relative overflow-hidden rounded-xl aspect-square bg-muted"
              >
                <img src={img.src} alt={img.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 transition" />
              </button>
            ))}
          </div>
        )}
      </section>

      {open !== null && images[open] && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(null)}
        >
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setOpen(null)} aria-label="Close">
            <X className="h-6 w-6" />
          </button>
          <img src={images[open].src} alt={images[open].alt} className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
