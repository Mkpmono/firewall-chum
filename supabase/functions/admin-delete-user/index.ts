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

    if (!targetUserId) {
      return json({ error: "target_user_id required" }, 400);
    }

    if (targetUserId === callerId) {
      return json({ error: "Cannot delete your own account" }, 400);
    }

    const deletions = await Promise.all([
      adminClient.from("firewall_rules").delete().eq("user_id", targetUserId),
      adminClient.from("client_ips").delete().eq("user_id", targetUserId),
      adminClient.from("ip_bans").delete().eq("user_id", targetUserId),
      adminClient.from("geoip_rules").delete().eq("user_id", targetUserId),
      adminClient.from("useragent_rules").delete().eq("user_id", targetUserId),
      adminClient.from("ddos_events").delete().eq("user_id", targetUserId),
      adminClient.from("servers").delete().eq("user_id", targetUserId),
      adminClient.from("user_roles").delete().eq("user_id", targetUserId),
      adminClient.from("profiles").delete().eq("user_id", targetUserId),
    ]);

    const deleteError = deletions.find((result) => result.error)?.error;
    if (deleteError) {
      return json({ error: deleteError.message }, 500);
    }

    const { error } = await adminClient.auth.admin.deleteUser(targetUserId);

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("admin-delete-user error:", message);
    return json({ error: message }, 500);
  }
});
