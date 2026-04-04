import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "Server configuration error" }, 500);
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return json({ error: "Unauthorized" }, 401);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;

    if (claimsError || !callerId) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      return json({ error: roleError.message }, 500);
    }

    if (!roleData) {
      return json({ error: "Forbidden: admin only" }, 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const targetUserId = typeof (body as Record<string, unknown>)?.target_user_id === "string"
      ? ((body as Record<string, unknown>).target_user_id as string).trim()
      : "";
    const newPassword = typeof (body as Record<string, unknown>)?.new_password === "string"
      ? ((body as Record<string, unknown>).new_password as string)
      : "";

    if (!targetUserId || !newPassword) {
      return json({ error: "target_user_id and new_password required" }, 400);
    }

    if (newPassword.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("admin-reset-password error:", message);
    return json({ error: message }, 500);
  }
});
