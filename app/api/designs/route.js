import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are missing.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("q") || "").trim();
    const favorite = url.searchParams.get("favorite") === "true";
    let query = client().from("designs").select("*").order("created_at", { ascending: false }).limit(100);
    if (search) query = query.ilike("name", `%${search}%`);
    if (favorite) query = query.eq("favorite", true);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true, designs: data || [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = String(body.id || "");
    if (!id) throw new Error("Design id is required.");
    const updates = {};
    if (typeof body.favorite === "boolean") updates.favorite = body.favorite;
    if (typeof body.status === "string") updates.status = body.status;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await client().from("designs").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, design: data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Design id is required.");
    const supabase = client();
    const { data: design } = await supabase.from("designs").select("front_artwork_url").eq("id", id).single();
    const { error } = await supabase.from("designs").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true, deleted: id, artworkUrl: design?.front_artwork_url || null });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
