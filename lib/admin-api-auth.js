import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AdminApiAuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = "AdminApiAuthError";
    this.status = status;
  }
}

export async function requireAdminApiUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user || null;
  const adminEmail = (
    process.env.ADMIN_EMAIL || "klipphahn@gmail.com"
  ).toLowerCase();

  if (error || !user) {
    throw new AdminApiAuthError("Authentication required", 401);
  }

  if (user.email?.toLowerCase() !== adminEmail) {
    throw new AdminApiAuthError(
      "This account is not authorized for Brokie OS.",
      403
    );
  }

  return user;
}
