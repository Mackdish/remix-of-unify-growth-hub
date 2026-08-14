import { Link } from "@tanstack/react-router";
import { Menu, X, LayoutDashboard, ShieldCheck } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.png";
import { useSession } from "@/hooks/use-session";
import { usePermissions } from "@/hooks/use-permissions";

const nav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/projects", label: "Projects" },
  { to: "/gallery", label: "Gallery" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useSession();
  const { isAdmin } = usePermissions();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <img src={logo} alt="Unify Youth Group" className="h-9 w-9 object-contain" width={36} height={36} />
          <span className="font-display font-bold text-primary leading-tight text-sm sm:text-base">
            Unify Youth Group
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/75 transition-colors hover:text-primary"
              activeProps={{ className: "text-primary" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            isAdmin ? (
              <Link to="/admin" className="btn-primary !py-2 !px-4 text-sm">
                <ShieldCheck className="h-4 w-4" /> Admin panel
              </Link>
            ) : (
              <Link to="/dashboard" className="btn-primary !py-2 !px-4 text-sm">
                <LayoutDashboard className="h-4 w-4" /> My dashboard
              </Link>
            )
          ) : (
            <Link to="/auth" className="btn-outline !py-2 !px-4 text-sm">Member Login</Link>
          )}
        </div>


        <button
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-border"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container-page flex flex-col py-3">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground/80"
                activeProps={{ className: "text-primary bg-secondary" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <Link
                to={isAdmin ? "/admin" : "/dashboard"}
                onClick={() => setOpen(false)}
                className="btn-primary mt-3"
              >
                {isAdmin ? "Admin panel" : "My dashboard"}
              </Link>
            ) : (
              <Link to="/auth" onClick={() => setOpen(false)} className="btn-primary mt-3">
                Member Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
