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
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.getUser(bearer);
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
