import { Link } from "@tanstack/react-router";
import { Phone, MapPin, Mail } from "lucide-react";
import logo from "@/assets/logo.png";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-[color-mix(in_oklab,var(--primary)_95%,black)] text-primary-foreground">
      <div className="container-page py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-11 w-11 rounded bg-white/10 p-1" width={44} height={44} />
            <div>
              <div className="font-display font-bold text-lg">Unify Youth Group</div>
              <div className="text-xs text-primary-foreground/70">Wote · Makueni · Kenya</div>
            </div>
          </div>
          <p className="text-sm text-primary-foreground/75 max-w-md">
            Empowering youth through unity, financial cooperation, and community development.
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-accent">Explore</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/about" className="hover:text-accent">About us</Link></li>
            <li><Link to="/projects" className="hover:text-accent">Our projects</Link></li>
            <li><Link to="/gallery" className="hover:text-accent">Gallery</Link></li>
            <li><Link to="/contact" className="hover:text-accent">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-accent">Reach us</h4>
          <ul className="space-y-2.5 text-sm text-primary-foreground/85">
            <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-accent" /> Wote, Makueni, Kenya</li>
            <li className="flex items-start gap-2"><Phone className="h-4 w-4 mt-0.5 text-accent" /> <a href="tel:+254703977431" className="hover:text-accent">0703 977 431</a></li>
            <li className="flex items-start gap-2"><Mail className="h-4 w-4 mt-0.5 text-accent" /> info@unifyyouth.org</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page py-5 text-xs text-primary-foreground/60 flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} Unify Youth Group. All rights reserved.</span>
          <span>Empowering youth · Building community</span>
        </div>
      </div>
    </footer>
  );
}
