import { supabase } from "@/integrations/supabase/client";
import { ADMIN_ROLES } from "@/lib/permissions";

export type AuthenticatedLandingRoute = "/admin" | "/dashboard";

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

/**
 * Revalidates the signed-in user, then reads that exact user's roles.
 * Short retries cover the session propagation window after OAuth/password login.
 */
export async function getAuthenticatedLandingRoute(
  expectedUserId?: string,
): Promise<AuthenticatedLandingRoute> {
  const retryDelays = [0, 150, 400];
  let lastError: Error | null = null;

  for (const delay of retryDelays) {
    if (delay > 0) await wait(delay);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;
    if (userError || !user) {
      lastError = userError ?? new Error("Your sign-in session could not be verified.");
      continue;
    }
    if (expectedUserId && user.id !== expectedUserId) {
      lastError = new Error("The active sign-in session changed. Please try again.");
      continue;
    }

    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError) {
      lastError = roleError;
      continue;
    }

    const isAdmin = (roleRows ?? []).some(({ role }) =>
      (ADMIN_ROLES as readonly string[]).includes(role),
    );
    return isAdmin ? "/admin" : "/dashboard";
  }

  throw lastError ?? new Error("Could not verify your account access.");
}