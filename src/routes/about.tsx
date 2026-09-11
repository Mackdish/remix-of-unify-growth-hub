import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useSiteSettings } from "@/hooks/use-site-content";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Unify Youth Group" },
      { name: "description", content: "The story, vision, mission, values, and leadership of Unify Youth Group in Wote, Makueni." },
      { property: "og:title", content: "About Unify Youth Group" },
      { property: "og:description", content: "Who we are, what we stand for, and the people leading Unify Youth Group." },
    ],
  }),
  component: About,
});

const values = ["Unity", "Integrity", "Accountability", "Transparency", "Empowerment", "Teamwork", "Financial Discipline", "Youth Development", "Community Development"];

const leaders = [
  { name: "Chairperson", role: "To be updated", bio: "Leads group direction, meetings, and community engagement." },
  { name: "Secretary", role: "To be updated", bio: "Keeps records of meetings, members, and communication." },
  { name: "Treasurer", role: "To be updated", bio: "Oversees contributions, loans, dues, and financial reporting." },
];

function About() {
  const { data: settings } = useSiteSettings();
  return (
    <div>
      <section className="bg-surface border-b border-border">
        <div className="container-page py-16 md:py-24">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary-glow">About us</span>
          <h1 className="mt-3 text-4xl md:text-5xl text-foreground max-w-3xl">
            A community of young people investing in each other and in Makueni.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Founded to promote unity, financial cooperation and youth empowerment, Unify Youth Group brings
            members together around shared savings, loans, and community projects.
          </p>
        </div>
      </section>

      <section className="container-page py-16 grid md:grid-cols-2 gap-12">
        <div>
          <h2 className="text-2xl text-foreground">Our vision</h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            A united and financially empowered youth community that leads sustainable development in Makueni and beyond.
          </p>
        </div>
        <div>
          <h2 className="text-2xl text-foreground">Our mission</h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            To empower our members through disciplined savings, fair internal lending, transparent record-keeping,
            and community projects that create real, lasting impact.
          </p>
        </div>
      </section>

      <section className="bg-surface border-y border-border">
        <div className="container-page py-16">
          <h2 className="text-2xl text-foreground">Our values</h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {values.map((v) => (
              <span key={v} className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3.5 py-1.5 text-sm text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary-glow" /> {v}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="text-2xl text-foreground">Leadership</h2>
        <p className="mt-2 text-muted-foreground text-sm">Profiles will be added by the group administrator.</p>
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {leaders.map((l) => (
            <div key={l.name} className="rounded-2xl bg-card border border-border p-6 shadow-[var(--shadow-soft)]">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground font-display font-bold text-xl">
                {l.name[0]}
              </div>
              <div className="mt-4 font-semibold text-foreground">{l.name}</div>
              <div className="text-sm text-primary-glow">{l.role}</div>
              <p className="mt-2 text-sm text-muted-foreground">{l.bio}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
