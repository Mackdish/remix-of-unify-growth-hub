import { createFileRoute } from "@tanstack/react-router";
import { Phone, MapPin, Mail, Send } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Unify Youth Group" },
      { name: "description", content: "Reach Unify Youth Group in Wote, Makueni, Kenya. Phone 0703 977 431." },
      { property: "og:title", content: "Contact — Unify Youth Group" },
      { property: "og:description", content: "Get in touch with Unify Youth Group." },
    ],
  }),
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  subject: z.string().trim().min(1, "Subject required").max(150),
  message: z.string().trim().min(1, "Message required").max(1500),
});

function Contact() {
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { errs[String(i.path[0])] = i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    // TODO: wire to server function when backend contact handling is added.
    setStatus("sent");
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div>
      <section className="bg-surface border-b border-border">
        <div className="container-page py-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary-glow">Contact</span>
          <h1 className="mt-3 text-4xl md:text-5xl text-foreground">Talk to Unify Youth Group.</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Questions about membership, projects, or partnerships? We'd love to hear from you.
          </p>
        </div>
      </section>

      <section className="container-page py-16 grid lg:grid-cols-5 gap-10">
        <aside className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-card border border-border p-6 shadow-[var(--shadow-soft)]">
            <div className="flex gap-3 items-start">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center"><MapPin className="h-5 w-5" /></div>
              <div>
                <div className="font-semibold text-foreground">Location</div>
                <div className="text-sm text-muted-foreground">Wote, Makueni, Kenya</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-card border border-border p-6 shadow-[var(--shadow-soft)]">
            <div className="flex gap-3 items-start">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center"><Phone className="h-5 w-5" /></div>
              <div>
                <div className="font-semibold text-foreground">Phone</div>
                <a href="tel:+254703977431" className="text-sm text-primary hover:text-primary-glow">0703 977 431</a>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-card border border-border p-6 shadow-[var(--shadow-soft)]">
            <div className="flex gap-3 items-start">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center"><Mail className="h-5 w-5" /></div>
              <div>
                <div className="font-semibold text-foreground">Email</div>
                <div className="text-sm text-muted-foreground">info@unifyyouth.org</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden border border-border aspect-video">
            <iframe
              title="Wote, Makueni map"
              className="w-full h-full"
              loading="lazy"
              src="https://www.openstreetmap.org/export/embed.html?bbox=37.62%2C-1.79%2C37.66%2C-1.77&layer=mapnik"
            />
          </div>
        </aside>

        <form onSubmit={onSubmit} className="lg:col-span-3 rounded-2xl bg-card border border-border p-6 md:p-8 shadow-[var(--shadow-soft)] space-y-4">
          <h2 className="text-2xl text-foreground">Send us a message</h2>

          {status === "sent" && (
            <div className="rounded-lg bg-primary/10 text-primary border border-primary/20 px-4 py-3 text-sm">
              Thank you — your message has been received. We'll be in touch shortly.
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Field name="name" label="Full name" error={errors.name} />
            <Field name="email" label="Email" type="email" error={errors.email} />
            <Field name="phone" label="Phone (optional)" error={errors.phone} />
            <Field name="subject" label="Subject" error={errors.subject} />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Message</label>
            <textarea
              name="message"
              rows={5}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.message && <p className="text-xs text-destructive mt-1">{errors.message}</p>}
          </div>

          <button type="submit" className="btn-primary">
            <Send className="h-4 w-4" /> Send message
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({ name, label, type = "text", error }: { name: string; label: string; type?: string; error?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        name={name}
        type={type}
        className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
