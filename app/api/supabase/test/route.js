import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase URL or server key is missing." },
      { status: 400 }
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false }
  });

  const { error } = await supabase.from("collections").select("id").limit(1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ message: "Supabase connected." });
}
