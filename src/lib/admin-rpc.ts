/**
 * Small typed wrapper for calling the admin database functions created in
 * supabase/migrations/20261104100000_admin_rpcs_without_service_key.sql.
 *
 * The functions run with the signed-in user's own session and verify the
 * caller's role inside the database, so no service/secret key is involved.
 *
 * This goes through a loose type on purpose: the generated Supabase types do
 * not know about these functions until Lovable regenerates them after the
 * migration is applied.
 */

export type RpcError = { message: string; code?: string };
type RpcResult = { data: unknown; error: RpcError | null };
type RpcCapableClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
};

/** Raw call: returns { data, error } without throwing. */
export async function adminRpc(
  client: unknown,
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcResult> {
  return await (client as RpcCapableClient).rpc(fn, args);
}

/** Throwing call: 42501 (insufficient privilege) becomes a 403 Response. */
export async function callAdminRpc<T extends Record<string, unknown> = Record<string, unknown>>(
  client: unknown,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await adminRpc(client, fn, args);
  if (error) {
    if (error.code === "42501") throw new Response(error.message, { status: 403 });
    throw new Error(error.message);
  }
  return (data ?? {}) as T;
}
