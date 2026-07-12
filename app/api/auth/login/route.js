import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const adminEmail = (process.env.ADMIN_EMAIL || "klipphahn@gmail.com").toLowerCase();

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (String(email).toLowerCase() !== adminEmail) {
      return NextResponse.json(
        { ok: false, error: "This email is not authorized for Brokie OS." },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to sign in." },
      { status: 500 }
    );
  }
}
