import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-whmcs-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * WHMCS Provisioning API
 * 
 * Actions:
 *   - create_account: Creates user + profile + assigns IP
 *   - suspend_account: Disables all firewall rules for user
 *   - unsuspend_account: Re-enables all firewall rules for user
 *   - terminate_account: Deletes user profile, IPs, rules
 *   - get_status: Returns account status
 * 
 * Auth: x-whmcs-key header must match WHMCS_API_SECRET env var
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const whmcsSecret = Deno.env.get("WHMCS_API_SECRET");

    if (!whmcsSecret) {
      return new Response(JSON.stringify({ error: "WHMCS_API_SECRET not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify WHMCS authentication
    const whmcsKey = req.headers.get("x-whmcs-key");
    if (!whmcsKey || whmcsKey !== whmcsSecret) {
      return new Response(JSON.stringify({ error: "Invalid WHMCS API key" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action parameter" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════
    // CREATE ACCOUNT
    // ═══════════════════════════════════
    if (action === "create_account") {
      const { email, password, display_name, ip_address, ip_label, max_rules } = body;

      if (!email || !password) {
        return new Response(JSON.stringify({ error: "email and password are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm since WHMCS already verified
      });

      if (authError) {
        // If user already exists, try to find them
        if (authError.message?.includes("already") || authError.message?.includes("exists")) {
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(u => u.email === email);

          if (existingUser) {
            // User exists — just add IP if provided
            if (ip_address) {
              await supabase.from("client_ips").upsert({
                user_id: existingUser.id,
                ip_address,
                label: ip_label || `WHMCS - ${ip_address}`,
              }, { onConflict: "user_id,ip_address" }).select();
            }

            return new Response(JSON.stringify({
              success: true,
              message: "User already exists, IP added",
              user_id: existingUser.id,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        return new Response(JSON.stringify({ error: `Auth error: ${authError.message}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = authData.user.id;

      // 2. Update profile (trigger should create it, but update with extra data)
      // Wait a bit for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 500));

      const profileUpdate: Record<string, unknown> = {};
      if (display_name) profileUpdate.display_name = display_name;
      if (max_rules) profileUpdate.max_rules = max_rules;

      if (Object.keys(profileUpdate).length > 0) {
        await supabase.from("profiles").update(profileUpdate).eq("user_id", userId);
      }

      // 3. Add dedicated IP
      if (ip_address) {
        const { error: ipError } = await supabase.from("client_ips").insert({
          user_id: userId,
          ip_address,
          label: ip_label || `WHMCS - ${ip_address}`,
        });

        if (ipError && !ipError.message?.includes("duplicate")) {
          console.error("IP insert error:", ipError);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Account created successfully",
        user_id: userId,
        email,
        ip_address: ip_address || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════
    // SUSPEND ACCOUNT
    // ═══════════════════════════════════
    if (action === "suspend_account") {
      const { email, user_id } = body;
      const uid = user_id || await resolveUserId(supabase, email);

      if (!uid) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Disable all firewall rules
      const { error } = await supabase
        .from("firewall_rules")
        .update({ enabled: false })
        .eq("user_id", uid);

      // Ban the auth user
      await supabase.auth.admin.updateUserById(uid, { ban_duration: "876000h" }); // ~100 years

      return new Response(JSON.stringify({
        success: true,
        message: "Account suspended",
        user_id: uid,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════
    // UNSUSPEND ACCOUNT
    // ═══════════════════════════════════
    if (action === "unsuspend_account") {
      const { email, user_id } = body;
      const uid = user_id || await resolveUserId(supabase, email);

      if (!uid) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Re-enable all firewall rules
      const { error } = await supabase
        .from("firewall_rules")
        .update({ enabled: true })
        .eq("user_id", uid);

      // Unban the auth user
      await supabase.auth.admin.updateUserById(uid, { ban_duration: "none" });

      return new Response(JSON.stringify({
        success: true,
        message: "Account unsuspended",
        user_id: uid,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════
    // TERMINATE ACCOUNT
    // ═══════════════════════════════════
    if (action === "terminate_account") {
      const { email, user_id, keep_user } = body;
      const uid = user_id || await resolveUserId(supabase, email);

      if (!uid) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete firewall rules
      await supabase.from("firewall_rules").delete().eq("user_id", uid);

      // Delete client IPs
      await supabase.from("client_ips").delete().eq("user_id", uid);

      // Delete servers
      await supabase.from("servers").delete().eq("user_id", uid);

      // Delete profile
      await supabase.from("profiles").delete().eq("user_id", uid);

      // Delete auth user (unless keep_user is true)
      if (!keep_user) {
        await supabase.auth.admin.deleteUser(uid);
      }

      return new Response(JSON.stringify({
        success: true,
        message: keep_user ? "Account data terminated (user kept)" : "Account fully terminated",
        user_id: uid,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════
    // GET STATUS
    // ═══════════════════════════════════
    if (action === "get_status") {
      const { email, user_id } = body;
      const uid = user_id || await resolveUserId(supabase, email);

      if (!uid) {
        return new Response(JSON.stringify({ error: "User not found", status: "not_found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [profileRes, ipsRes, rulesRes, serversRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("client_ips").select("ip_address, label").eq("user_id", uid),
        supabase.from("firewall_rules").select("id, enabled").eq("user_id", uid),
        supabase.from("servers").select("id, hostname, status, last_sync_at").eq("user_id", uid),
      ]);

      const { data: authUser } = await supabase.auth.admin.getUserById(uid);

      const totalRules = rulesRes.data?.length || 0;
      const enabledRules = rulesRes.data?.filter(r => r.enabled).length || 0;
      const isBanned = authUser?.user?.banned_until && new Date(authUser.user.banned_until) > new Date();

      return new Response(JSON.stringify({
        success: true,
        user_id: uid,
        email: profileRes.data?.email,
        display_name: profileRes.data?.display_name,
        status: isBanned ? "suspended" : "active",
        ips: ipsRes.data || [],
        rules: { total: totalRules, enabled: enabledRules },
        servers: serversRes.data || [],
        ddos_protection: profileRes.data?.ddos_protection || false,
        max_rules: profileRes.data?.max_rules || 20,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════
    // ADD IP (for upgrades/changes)
    // ═══════════════════════════════════
    if (action === "add_ip") {
      const { email, user_id, ip_address, ip_label } = body;
      const uid = user_id || await resolveUserId(supabase, email);

      if (!uid || !ip_address) {
        return new Response(JSON.stringify({ error: "user and ip_address required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase.from("client_ips").insert({
        user_id: uid,
        ip_address,
        label: ip_label || `WHMCS - ${ip_address}`,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "IP added", user_id: uid, ip_address }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════
    // REMOVE IP
    // ═══════════════════════════════════
    if (action === "remove_ip") {
      const { email, user_id, ip_address } = body;
      const uid = user_id || await resolveUserId(supabase, email);

      if (!uid || !ip_address) {
        return new Response(JSON.stringify({ error: "user and ip_address required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("client_ips").delete().eq("user_id", uid).eq("ip_address", ip_address);

      return new Response(JSON.stringify({ success: true, message: "IP removed", user_id: uid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("WHMCS Provision error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper: resolve user_id from email
async function resolveUserId(supabase: any, email?: string): Promise<string | null> {
  if (!email) return null;
  const { data } = await supabase.from("profiles").select("user_id").eq("email", email).maybeSingle();
  return data?.user_id || null;
}
