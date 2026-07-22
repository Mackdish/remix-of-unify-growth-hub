import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Users, HandCoins, Sprout, ShieldCheck, TrendingUp, HeartHandshake } from "lucide-react";
import heroImg from "@/assets/hero.jpg";
import p1 from "@/assets/project-1.jpg";
import p2 from "@/assets/project-2.jpg";
import p3 from "@/assets/project-3.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Unify Youth Group — Empowering Youth in Wote, Makueni" },
      { name: "description", content: "A youth community and financial empowerment group in Wote, Makueni, Kenya. Contributions, loans, projects, and unity." },
      { property: "og:title", content: "Unify Youth Group — Empowering Youth in Wote, Makueni" },
      { property: "og:description", content: "A youth community and financial empowerment group in Wote, Makueni, Kenya. Contributions, loans, projects, and unity." },
    ],
  }),
  component: Home,
});

const stats = [
  { label: "Active members", value: "11" },
  { label: "Total contributions", value: "KSh 16,500" },
  { label: "Active loans", value: "KSh 195,000" },
  { label: "Group balance", value: "KSh 228,757" },
];

const values = [
  { icon: HeartHandshake, title: "Unity", body: "We work together, decide together, and grow together as one." },
  { icon: ShieldCheck, title: "Transparency", body: "Every shilling is tracked and every member can verify their records." },
  { icon: TrendingUp, title: "Empowerment", body: "Financial discipline that lets our members take real steps forward." },
  { icon: Sprout, title: "Community", body: "Projects and initiatives that improve life around Wote and Makueni." },
];

const featured = [
  { img: p1, title: "Green Makueni", status: "Ongoing", desc: "Tree-planting and land-restoration drives across our community." },
  { img: p2, title: "Youth Skills Hub", status: "Ongoing", desc: "Business, digital, and financial-literacy training for members." },
  { img: p3, title: "Members' Savings", status: "Live", desc: "Monthly contributions, boosting, and internal lending, tracked transparently." },
];

function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="" className="h-full w-full object-cover" width={1600} height={1104} />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/50" />
        </div>
        <div className="container-page relative py-24 md:py-36">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Wote · Makueni · Kenya
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl md:text-6xl font-bold text-white leading-[1.05]">
            Empowering youth. <span className="text-accent">Building community.</span> Creating a better future.
          </h1>
          <p className="mt-5 max-w-xl text-base md:text-lg text-white/85">
            Unify Youth Group is a member-run financial and community organisation.
            We save together, lend together, and invest in projects that lift our neighbourhood.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/about" className="btn-accent">
              Learn about us <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-md border-2 border-white/70 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition">
              Member login
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container-page -mt-10 md:-mt-14 relative z-10">
        <div className="rounded-2xl bg-card shadow-[var(--shadow-elegant)] border border-border grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
          {stats.map((s) => (
            <div key={s.label} className="p-6 text-center">
              <div className="text-2xl md:text-3xl font-display font-bold text-primary">{s.value}</div>
              <div className="mt-1 text-xs md:text-sm text-muted-foreground uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Status as at 15 July 2026 · Verified by group administrator
        </p>
      </section>

      {/* Intro */}
      <section className="container-page py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary-glow">Who we are</span>
          <h2 className="mt-3 text-3xl md:text-4xl text-foreground">
            A youth-led group building financial strength, together.
          </h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            We are eleven young people from Wote and the surrounding areas of Makueni who chose to pool
            our resources, back each other with loans, and invest in projects that grow both our members
            and our community. Every contribution, loan and repayment is recorded transparently.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/about" className="btn-primary">Our story</Link>
            <Link to="/projects" className="btn-outline">See projects</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {values.map((v) => (
            <div key={v.title} className="rounded-xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <v.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">{v.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Projects */}
      <section className="bg-surface border-y border-border">
        <div className="container-page py-20">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary-glow">Our work</span>
              <h2 className="mt-2 text-3xl md:text-4xl text-foreground">Featured projects</h2>
            </div>
            <Link to="/projects" className="text-sm font-semibold text-primary hover:text-primary-glow inline-flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {featured.map((p) => (
              <article key={p.title} className="group rounded-2xl overflow-hidden bg-card border border-border shadow-[var(--shadow-soft)]">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={p.img} alt={p.title} loading="lazy" width={1200} height={900} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-5">
                  <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-[color-mix(in_oklab,var(--accent-foreground)_100%,transparent)]">{p.status}</span>
                  <h3 className="mt-3 text-lg font-semibold text-foreground">{p.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{p.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page py-20">
        <div className="rounded-3xl relative overflow-hidden p-10 md:p-16 text-center" style={{ background: "var(--gradient-hero)" }}>
          <Users className="h-10 w-10 mx-auto text-accent" />
          <h2 className="mt-4 text-3xl md:text-4xl text-primary-foreground">Ready to join or already a member?</h2>
          <p className="mt-3 max-w-xl mx-auto text-primary-foreground/80">
            Members can log in to view contributions, loans and statements. To become a member, contact us.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/auth" className="btn-accent"><HandCoins className="h-4 w-4" /> Member login</Link>
            <Link to="/contact" className="inline-flex items-center gap-2 rounded-md border-2 border-white/60 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Contact the group
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
