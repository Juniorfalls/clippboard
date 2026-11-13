import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("connected_accounts")
      .select("id, platform, platform_user_id, expires_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      if (
        error.code === "42P01" ||
        error.message?.includes("does not exist") ||
        error.message?.includes("Could not find the table")
      ) {
        return NextResponse.json({ accounts: [] });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ accounts: data ?? [] });
  } catch (error) {
    console.error("[connected-accounts] Query failed", error);
    return NextResponse.json({ accounts: [] });
  }
}
