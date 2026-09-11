import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Signs the current user out and clears cached account data. */
export function SignOutButton({
  className = "btn-outline !py-2 !px-4 text-sm",
  label = "Sign out",
  onDone,
}: {
  className?: string;
  label?: string;
  onDone?: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      qc.removeQueries({ queryKey: ["auth-user"] });
      qc.clear();
      toast.success("Signed out");
      onDone?.();
      await navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={signOut} disabled={busy} className={className}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      {label}
    </button>
  );
}
