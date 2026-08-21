import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedAdminEmail } from "@/lib/admin-email";

export class AdminApiAuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = "AdminApiAuthError";
    this.status = status;
  }
}

function readBearerToken(request) {
  const header = request?.headers?.get?.("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function requireAdminApiUser(request = null) {
  const bearer = readBearerToken(request);

  if (bearer) {
    const adminClient = createSupabaseAdminClient();
    const { data } = await adminClient.auth.getUser(bearer);
    let user = data?.user || null;

    if (!user) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      const publicKey = (
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )?.trim();

      if (!supabaseUrl || !publicKey) {
        throw new AdminApiAuthError("Authentication required", 401);
      }

      const publicClient = createClient(supabaseUrl, publicKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
      const publicAuth = await publicClient.auth.getUser(bearer);
      user = publicAuth.data?.user || null;

      if (publicAuth.error || !user) {
        throw new AdminApiAuthError("Authentication required", 401);
      }
    }

    if (!isAuthorizedAdminEmail(user.email)) {
      throw new AdminApiAuthError(
        "This account is not authorized for Brokie OS.",
        403
      );
    }

    return user;
  }

  const hasSessionCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  if (!hasSessionCredentials) {
    throw new AdminApiAuthError("Authentication required", 401);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user || null;

  if (error || !user) {
    throw new AdminApiAuthError("Authentication required", 401);
  }

  if (!isAuthorizedAdminEmail(user.email)) {
    throw new AdminApiAuthError(
      "This account is not authorized for Brokie OS.",
      403
    );
  }

  return user;
}
