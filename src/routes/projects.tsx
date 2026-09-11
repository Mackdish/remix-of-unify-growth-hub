import { createFileRoute } from "@tanstack/react-router";
import p1 from "@/assets/project-1.jpg";
import p2 from "@/assets/project-2.jpg";
import p3 from "@/assets/project-3.jpg";
import { usePublicProjects } from "@/hooks/use-site-content";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Unify Youth Group" },
      { name: "description", content: "Community projects and initiatives run by Unify Youth Group in Wote, Makueni." },
      { property: "og:title", content: "Projects — Unify Youth Group" },
      { property: "og:description", content: "Ongoing, completed and planned initiatives from Unify Youth Group." },
    ],
  }),
  component: Projects,
});

const fallbackImages = [p1, p2, p3];

const statusStyle: Record<string, string> = {
  Ongoing: "bg-accent/25 text-[color-mix(in_oklab,var(--accent-foreground)_100%,transparent)]",
  Live: "bg-primary/15 text-primary",
  Planned: "bg-muted text-muted-foreground",
  Completed: "bg-primary/15 text-primary",
};

function Projects() {
  return (
    <div>
      <section className="bg-surface border-b border-border">
        <div className="container-page py-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary-glow">Our projects</span>
          <h1 className="mt-3 text-4xl md:text-5xl text-foreground">Investing in Makueni, one initiative at a time.</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            The administrator can add, update, and manage projects from the admin control panel.
          </p>
        </div>
      </section>

      <section className="container-page py-16 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((p) => (
          <article key={p.title} className="rounded-2xl overflow-hidden bg-card border border-border shadow-[var(--shadow-soft)] flex flex-col">
            <div className="aspect-[4/3] overflow-hidden">
              <img src={p.img} alt={p.title} loading="lazy" width={1200} height={900} className="h-full w-full object-cover" />
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <span className={`inline-flex w-fit text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle[p.status]}`}>{p.status}</span>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground flex-1">{p.desc}</p>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Progress</span><span>{p.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: "var(--gradient-hero)" }} />
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
