import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase server credentials are missing.");
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    return NextResponse.json({ ok: true, activities: data || [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
