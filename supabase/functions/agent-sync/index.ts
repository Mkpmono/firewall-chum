import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-server-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PANEL_TYPES = [
  { id: "virtualizor", name: "Virtualizor", icon: "Server" },
  { id: "solusvm", name: "SolusVM", icon: "Server" },
  { id: "proxmox", name: "Proxmox VE", icon: "Server" },
  { id: "virtuozzo", name: "Virtuozzo", icon: "Server" },
  { id: "xenorchestra", name: "XenOrchestra", icon: "Server" },
  { id: "ovirt", name: "oVirt", icon: "Server" },
  { id: "cpanel_whm", name: "cPanel/WHM", icon: "Globe" },
  { id: "plesk", name: "Plesk", icon: "Globe" },
  { id: "directadmin", name: "DirectAdmin", icon: "Globe" },
  { id: "cyberpanel", name: "CyberPanel", icon: "Globe" },
  { id: "hestia", name: "HestiaCP", icon: "Globe" },
  { id: "cloudpanel", name: "CloudPanel", icon: "Globe" },
  { id: "pterodactyl", name: "Pterodactyl", icon: "Gamepad2" },
  { id: "gamecp", name: "GameCP", icon: "Gamepad2" },
  { id: "dedicated", name: "Server Dedicat", icon: "HardDrive" },
  { id: "other", name: "Altul", icon: "Server" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "get_script";

    // ── Action: list panel types ──
    if (action === "panel_types") {
      return new Response(JSON.stringify({ panels: PANEL_TYPES }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: heartbeat (agent reports status) ──
    if (action === "heartbeat") {
      const serverKey = req.headers.get("x-server-key");
      if (!serverKey) {
        return new Response(JSON.stringify({ error: "Missing x-server-key" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json().catch(() => ({}));
      
      const { data: server, error: sErr } = await supabase
        .from("servers")
        .select("id, user_id")
        .eq("api_key", serverKey)
        .maybeSingle();

      if (sErr || !server) {
        return new Response(JSON.stringify({ error: "Invalid server key" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("servers").update({
        status: body.status || "online",
        last_sync_at: new Date().toISOString(),
        last_sync_status: body.sync_status || "ok",
        os_info: body.os_info || null,
      }).eq("id", server.id);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: get_script (agent pulls iptables rules) ──
    const serverKey = req.headers.get("x-server-key");
    if (!serverKey) {
      return new Response(JSON.stringify({ error: "Missing x-server-key header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: server, error: serverErr } = await supabase
      .from("servers")
      .select("id, user_id, hostname, panel_type")
      .eq("api_key", serverKey)
      .maybeSingle();

    if (serverErr || !server) {
      return new Response(JSON.stringify({ error: "Invalid server key" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile for DDoS settings
    const { data: profile } = await supabase
      .from("profiles")
      .select("ddos_protection, sinkhole_ip")
      .eq("user_id", server.user_id)
      .maybeSingle();

    // Get user's IPs
    const { data: ips } = await supabase
      .from("client_ips")
      .select("ip_address")
      .eq("user_id", server.user_id);

    // Get user's enabled firewall rules
    const { data: rules } = await supabase
      .from("firewall_rules")
      .select("*")
      .eq("user_id", server.user_id)
      .eq("enabled", true)
      .order("priority", { ascending: true });

    // Get user's GeoIP rules
    const { data: geoRules } = await supabase
      .from("geoip_rules")
      .select("*")
      .eq("user_id", server.user_id)
      .eq("enabled", true);

    // Get user's User-Agent blocking rules
    const { data: uaRules } = await supabase
      .from("useragent_rules")
      .select("*")
      .eq("user_id", server.user_id)
      .eq("enabled", true);

    // Get user's IP bans
    const { data: ipBans } = await supabase
      .from("ip_bans")
      .select("*")
      .eq("user_id", server.user_id)
      .eq("enabled", true);

    // Get active DDoS events for null-route auto
    const { data: activeDdos } = await supabase
      .from("ddos_events")
      .select("*")
      .eq("user_id", server.user_id)
      .eq("status", "active");

    const hasDdosNullRoute = profile?.ddos_protection === true;
    const userIps = (ips || []).map(i => i.ip_address);

    // Generate complete iptables script
    const lines: string[] = [
      "#!/bin/bash",
      "# ╔══════════════════════════════════════════════════════════════╗",
      `# ║  Hoxta Firewall Agent - Auto-generated`,
      `# ║  Server: ${server.hostname} (${server.panel_type})`,
      `# ║  Generated: ${new Date().toISOString()}`,
      `# ║  IPs: ${userIps.join(", ") || "none"}`,
      `# ║  DDoS: ${hasPremiumDdos ? "PREMIUM" : "STANDARD"}`,
      `# ║  GeoIP: ${(geoRules || []).length} rules`,
      "# ╚══════════════════════════════════════════════════════════════╝",
      "",
      "set -e",
      "",
      "# Flush existing rules (careful - preserves current SSH)",
      "iptables -F INPUT 2>/dev/null || true",
      "iptables -F FORWARD 2>/dev/null || true",
      "iptables -t nat -F PREROUTING 2>/dev/null || true",
      "",
      "# Allow SSH first (safety)",
      "iptables -A INPUT -p tcp --dport 22 -j ACCEPT",
      "",
    ];

    // ── IP Bans (iptables DROP) ──
    const activeBans = (ipBans || []).filter(b => {
      if (!b.expires_at) return true;
      return new Date(b.expires_at) > new Date();
    });

    if (activeBans.length > 0) {
      lines.push("# ── IP Bans (Manual) ──");
      for (const ban of activeBans) {
        const comment = ban.reason ? ` # ${ban.reason}` : "";
        lines.push(`iptables -A INPUT -s ${ban.ip_address} -j DROP${comment}`);
        lines.push(`iptables -A FORWARD -s ${ban.ip_address} -j DROP${comment}`);
      }
      lines.push(`echo "[Hoxta] ${activeBans.length} IP ban(s) applied."`);
      lines.push("");
    }


    // DDoS protection per IP
    for (const ip of userIps) {
      if (hasPremiumDdos) {
        lines.push(`# ── Premium DDoS for ${ip} ──`);
        lines.push("sysctl -w net.ipv4.tcp_syncookies=1 >/dev/null 2>&1");
        lines.push("sysctl -w net.ipv4.tcp_max_syn_backlog=8192 >/dev/null 2>&1");
        lines.push("sysctl -w net.netfilter.nf_conntrack_max=500000 >/dev/null 2>&1");
        lines.push("sysctl -w net.ipv4.conf.all.rp_filter=1 >/dev/null 2>&1");
        lines.push(`iptables -A INPUT -d ${ip} -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`);
        lines.push(`iptables -A INPUT -d ${ip} -m conntrack --ctstate INVALID -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -p tcp --tcp-flags ALL ALL -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -p tcp --tcp-flags ALL NONE -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -f -j DROP`);
        const safe = ip.replace(/\./g, '_');
        lines.push(`iptables -A INPUT -d ${ip} -p tcp --syn -m hashlimit --hashlimit-above 15/s --hashlimit-burst 30 --hashlimit-mode srcip --hashlimit-name syn_${safe} -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -p udp -m hashlimit --hashlimit-above 20/s --hashlimit-burst 40 --hashlimit-mode srcip --hashlimit-name udp_${safe} -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -p icmp --icmp-type echo-request -m hashlimit --hashlimit-above 5/s --hashlimit-burst 10 --hashlimit-mode srcip --hashlimit-name icmp_${safe} -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -p tcp --dport 80 -m connlimit --connlimit-above 80 --connlimit-mask 32 -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -p tcp --dport 443 -m connlimit --connlimit-above 80 --connlimit-mask 32 -j DROP`);
        lines.push(`iptables -t nat -A PREROUTING -d ${ip} -p tcp --syn -m hashlimit --hashlimit-above 50/s --hashlimit-burst 80 --hashlimit-mode srcip --hashlimit-name sink_syn_${safe} -j DNAT --to-destination ${sinkholeIp}`);
        lines.push(`iptables -t nat -A PREROUTING -d ${ip} -p udp -m hashlimit --hashlimit-above 50/s --hashlimit-burst 80 --hashlimit-mode srcip --hashlimit-name sink_udp_${safe} -j DNAT --to-destination ${sinkholeIp}`);
        lines.push(`ip route add blackhole ${sinkholeIp}/32 2>/dev/null || true`);
        lines.push(`iptables -A INPUT -d ${ip} -p udp --sport 53 -m length --length 512:65535 -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -p udp --sport 123 -m length --length 48:65535 -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -p udp --dport 1900 -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -p udp --dport 11211 -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -s 0.0.0.0/8 -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -s 127.0.0.0/8 -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -s 224.0.0.0/4 -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -s 240.0.0.0/4 -j DROP`);
      } else {
        lines.push(`# ── Standard DDoS for ${ip} ──`);
        lines.push(`iptables -A INPUT -d ${ip} -m state --state INVALID -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -p tcp --tcp-flags ALL ALL -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -p tcp --tcp-flags ALL NONE -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -p tcp --syn -m limit --limit 5/s --limit-burst 10 -j ACCEPT`);
        lines.push(`iptables -A INPUT -d ${ip} -p icmp --icmp-type echo-request -m limit --limit 2/s --limit-burst 5 -j ACCEPT`);
        lines.push(`iptables -A INPUT -d ${ip} -s 0.0.0.0/8 -j DROP`);
        lines.push(`iptables -A INPUT -d ${ip} -s 224.0.0.0/4 -j DROP`);
      }
      lines.push("");
    }

    // User firewall rules
    lines.push("# ── User Firewall Rules ──");
    for (const rule of rules || []) {
      let line = `iptables -A ${rule.direction}`;
      line += ` -p ${rule.protocol}`;
      if (rule.source_ip && rule.source_ip !== "0.0.0.0/0") line += ` -s ${rule.source_ip}`;
      if (rule.destination_ip && rule.destination_ip !== "0.0.0.0/0") line += ` -d ${rule.destination_ip}`;
      if (rule.port) line += ` --dport ${rule.port}`;
      else if (rule.port_range) line += ` --dport ${rule.port_range}`;
      line += ` -j ${rule.action}`;
      if (rule.label) line += ` # ${rule.label}`;
      lines.push(line);
    }

    // ── GeoIP Blocking with ipset ──
    const blacklistCountries = (geoRules || []).filter(r => r.mode === "blacklist").map(r => r.country_code);
    const whitelistCountries = (geoRules || []).filter(r => r.mode === "whitelist").map(r => r.country_code);
    const hasGeoIp = blacklistCountries.length > 0 || whitelistCountries.length > 0;

    if (hasGeoIp) {
      lines.push("");
      lines.push("# ══════════════════════════════════════════");
      lines.push("# ── GeoIP Blocking (ipset + xtables-addons) ──");
      lines.push("# ══════════════════════════════════════════");
      lines.push("");
      lines.push("# Auto-install GeoIP dependencies if missing");
      lines.push("if ! command -v ipset &>/dev/null; then");
      lines.push("  apt-get update -qq && apt-get install -y ipset xtables-addons-common libtext-csv-xs-perl >/dev/null 2>&1 || {");
      lines.push("    yum install -y ipset xtables-addons >/dev/null 2>&1 || true");
      lines.push("  }");
      lines.push("fi");
      lines.push("");
      lines.push("# Download GeoIP database if not present or older than 7 days");
      lines.push("GEOIP_DIR=\"/usr/share/xt_geoip\"");
      lines.push("mkdir -p \"$GEOIP_DIR\" 2>/dev/null || true");
      lines.push("if [ ! -f \"$GEOIP_DIR/.last_update\" ] || [ $(find \"$GEOIP_DIR/.last_update\" -mtime +7 2>/dev/null | wc -l) -gt 0 ]; then");
      lines.push("  echo '[Hoxta] Updating GeoIP database...'");
      lines.push("  TMPDIR=$(mktemp -d)");
      lines.push("  cd \"$TMPDIR\"");
      lines.push("  # Use DB-IP free database");
      lines.push("  MONTH=$(date +%Y-%m)");
      lines.push("  curl -sfL \"https://download.db-ip.com/free/dbip-country-lite-${MONTH}.csv.gz\" -o dbip.csv.gz 2>/dev/null || true");
      lines.push("  if [ -f dbip.csv.gz ]; then");
      lines.push("    gunzip -f dbip.csv.gz 2>/dev/null || true");
      lines.push("    if [ -f dbip.csv ] || [ -f dbip-country-lite-*.csv ]; then");
      lines.push("      CSV_FILE=$(ls dbip*.csv 2>/dev/null | head -1)");
      lines.push("      if command -v /usr/lib/xtables-addons/xt_geoip_build &>/dev/null; then");
      lines.push("        /usr/lib/xtables-addons/xt_geoip_build -D \"$GEOIP_DIR\" \"$CSV_FILE\" >/dev/null 2>&1 || true");
      lines.push("      elif command -v /usr/libexec/xtables-addons/xt_geoip_build &>/dev/null; then");
      lines.push("        /usr/libexec/xtables-addons/xt_geoip_build -D \"$GEOIP_DIR\" \"$CSV_FILE\" >/dev/null 2>&1 || true");
      lines.push("      fi");
      lines.push("      touch \"$GEOIP_DIR/.last_update\"");
      lines.push("    fi");
      lines.push("  fi");
      lines.push("  cd / && rm -rf \"$TMPDIR\"");
      lines.push("fi");
      lines.push("");

      // Check if xt_geoip module is available, fallback to ipset
      lines.push("# Try xt_geoip kernel module first, fallback to ipset");
      lines.push("GEOIP_METHOD=\"none\"");
      lines.push("if modprobe xt_geoip 2>/dev/null; then");
      lines.push("  GEOIP_METHOD=\"xt_geoip\"");
      lines.push("elif command -v ipset &>/dev/null; then");
      lines.push("  GEOIP_METHOD=\"ipset\"");
      lines.push("fi");
      lines.push("");

      if (blacklistCountries.length > 0) {
        const codes = blacklistCountries.join(",");
        lines.push(`# Blacklist countries: ${codes}`);
        lines.push(`if [ "$GEOIP_METHOD" = "xt_geoip" ]; then`);
        lines.push(`  iptables -A INPUT -m geoip --src-cc ${codes} -j DROP`);
        lines.push(`  echo "[Hoxta] GeoIP blacklist applied via xt_geoip: ${codes}"`);
        lines.push(`elif [ "$GEOIP_METHOD" = "ipset" ]; then`);
        lines.push(`  ipset destroy hoxta_geo_blacklist 2>/dev/null || true`);
        lines.push(`  ipset create hoxta_geo_blacklist hash:net family inet hashsize 65536 maxelem 1000000`);
        
        // For ipset, we generate a zone file download approach per country
        for (const cc of blacklistCountries) {
          lines.push(`  # Download ${cc} IP ranges`);
          lines.push(`  curl -sfL "https://www.ipdeny.com/ipblocks/data/aggregated/${cc.toLowerCase()}-aggregated.zone" 2>/dev/null | while read cidr; do`);
          lines.push(`    [ -n "$cidr" ] && ipset add hoxta_geo_blacklist "$cidr" 2>/dev/null || true`);
          lines.push(`  done`);
        }
        
        lines.push(`  iptables -A INPUT -m set --match-set hoxta_geo_blacklist src -j DROP`);
        lines.push(`  echo "[Hoxta] GeoIP blacklist applied via ipset: ${codes}"`);
        lines.push(`else`);
        lines.push(`  echo "[Hoxta] WARNING: No GeoIP method available. Install xtables-addons-common or ipset."`);
        lines.push(`fi`);
        lines.push("");
      }

      if (whitelistCountries.length > 0) {
        const codes = whitelistCountries.join(",");
        lines.push(`# Whitelist countries (only these allowed): ${codes}`);
        lines.push(`if [ "$GEOIP_METHOD" = "xt_geoip" ]; then`);
        lines.push(`  iptables -A INPUT -m geoip --src-cc ${codes} -j ACCEPT`);
        lines.push(`  iptables -A INPUT -m geoip ! --src-cc ${codes} -j DROP`);
        lines.push(`  echo "[Hoxta] GeoIP whitelist applied via xt_geoip: ${codes}"`);
        lines.push(`elif [ "$GEOIP_METHOD" = "ipset" ]; then`);
        lines.push(`  ipset destroy hoxta_geo_whitelist 2>/dev/null || true`);
        lines.push(`  ipset create hoxta_geo_whitelist hash:net family inet hashsize 65536 maxelem 1000000`);
        
        for (const cc of whitelistCountries) {
          lines.push(`  curl -sfL "https://www.ipdeny.com/ipblocks/data/aggregated/${cc.toLowerCase()}-aggregated.zone" 2>/dev/null | while read cidr; do`);
          lines.push(`    [ -n "$cidr" ] && ipset add hoxta_geo_whitelist "$cidr" 2>/dev/null || true`);
          lines.push(`  done`);
        }
        
        lines.push(`  iptables -A INPUT -m set --match-set hoxta_geo_whitelist src -j ACCEPT`);
        lines.push(`  iptables -A INPUT -m set ! --match-set hoxta_geo_whitelist src -j DROP`);
        lines.push(`  echo "[Hoxta] GeoIP whitelist applied via ipset: ${codes}"`);
        lines.push(`else`);
        lines.push(`  echo "[Hoxta] WARNING: No GeoIP method available."`);
        lines.push(`fi`);
        lines.push("");
      }
    }

    // ── Rate Limiting (iptables) ──
    lines.push("");
    lines.push("# ══════════════════════════════════════════");
    lines.push("# ── Rate Limiting (Anti-Flood) ──");
    lines.push("# ══════════════════════════════════════════");
    lines.push("");
    lines.push("# HTTP/HTTPS connection rate limiting");
    lines.push("iptables -A INPUT -p tcp --dport 80 -m conntrack --ctstate NEW -m recent --set --name HTTP");
    lines.push("iptables -A INPUT -p tcp --dport 80 -m conntrack --ctstate NEW -m recent --update --seconds 10 --hitcount 50 --name HTTP -j DROP");
    lines.push("iptables -A INPUT -p tcp --dport 443 -m conntrack --ctstate NEW -m recent --set --name HTTPS");
    lines.push("iptables -A INPUT -p tcp --dport 443 -m conntrack --ctstate NEW -m recent --update --seconds 10 --hitcount 50 --name HTTPS -j DROP");
    lines.push("");
    lines.push("# SSH brute-force rate limiting");
    lines.push("iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --set --name SSH");
    lines.push("iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --update --seconds 60 --hitcount 5 --name SSH -j DROP");
    lines.push("");
    lines.push("# Global per-IP new connection limit");
    lines.push("iptables -A INPUT -p tcp -m conntrack --ctstate NEW -m hashlimit --hashlimit-above 30/s --hashlimit-burst 50 --hashlimit-mode srcip --hashlimit-name global_rate -j DROP");
    lines.push("");

    // ── Fail2ban auto-install and config ──
    lines.push("# ══════════════════════════════════════════");
    lines.push("# ── Fail2ban (Auto-install & Configure) ──");
    lines.push("# ══════════════════════════════════════════");
    lines.push("");
    lines.push("if ! command -v fail2ban-server &>/dev/null; then");
    lines.push("  echo '[Hoxta] Installing fail2ban...'");
    lines.push("  apt-get update -qq && apt-get install -y fail2ban >/dev/null 2>&1 || {");
    lines.push("    yum install -y epel-release >/dev/null 2>&1 && yum install -y fail2ban >/dev/null 2>&1 || true");
    lines.push("  }");
    lines.push("fi");
    lines.push("");
    lines.push("if command -v fail2ban-server &>/dev/null; then");
    lines.push("  mkdir -p /etc/fail2ban");
    lines.push("  cat > /etc/fail2ban/jail.local << 'F2B_CONF'");
    lines.push("[DEFAULT]");
    lines.push("bantime = 3600");
    lines.push("findtime = 600");
    lines.push("maxretry = 5");
    lines.push("banaction = iptables-multiport");
    lines.push("");
    lines.push("[sshd]");
    lines.push("enabled = true");
    lines.push("port = ssh");
    lines.push("filter = sshd");
    lines.push("logpath = /var/log/auth.log");
    lines.push("maxretry = 3");
    lines.push("bantime = 7200");
    lines.push("");
    lines.push("[sshd-ddos]");
    lines.push("enabled = true");
    lines.push("port = ssh");
    lines.push("filter = sshd");
    lines.push("logpath = /var/log/auth.log");
    lines.push("maxretry = 6");
    lines.push("bantime = 3600");
    lines.push("");
    lines.push("[apache-auth]");
    lines.push("enabled = true");
    lines.push("port = http,https");
    lines.push("filter = apache-auth");
    lines.push("logpath = /var/log/apache2/*error.log");
    lines.push("maxretry = 5");
    lines.push("");
    lines.push("[nginx-http-auth]");
    lines.push("enabled = true");
    lines.push("port = http,https");
    lines.push("filter = nginx-http-auth");
    lines.push("logpath = /var/log/nginx/error.log");
    lines.push("maxretry = 5");
    lines.push("");
    lines.push("[nginx-botsearch]");
    lines.push("enabled = true");
    lines.push("port = http,https");
    lines.push("filter = nginx-botsearch");
    lines.push("logpath = /var/log/nginx/access.log");
    lines.push("maxretry = 2");
    lines.push("bantime = 86400");
    lines.push("");
    lines.push("[recidive]");
    lines.push("enabled = true");
    lines.push("filter = recidive");
    lines.push("logpath = /var/log/fail2ban.log");
    lines.push("bantime = 604800");
    lines.push("findtime = 86400");
    lines.push("maxretry = 3");
    lines.push("F2B_CONF");
    lines.push("");
    lines.push("  systemctl enable fail2ban 2>/dev/null || true");
    lines.push("  systemctl restart fail2ban 2>/dev/null || true");
    lines.push("  echo '[Hoxta] Fail2ban configured and started.'");
    lines.push("fi");
    lines.push("");

    // ── User-Agent Blocking ──
    const blockedAgents = (uaRules || []).map(r => r.pattern);
    if (blockedAgents.length > 0) {
      lines.push("# ══════════════════════════════════════════");
      lines.push("# ── User-Agent Blocking ──");
      lines.push("# ══════════════════════════════════════════");
      lines.push("");

      // Nginx config
      lines.push("# --- Nginx User-Agent blocking ---");
      lines.push("if [ -d /etc/nginx ]; then");
      lines.push("  cat > /etc/nginx/conf.d/hoxta-useragent-block.conf << 'NGINX_UA'");
      lines.push("map $http_user_agent $hoxta_block_ua {");
      lines.push("  default 0;");
      for (const ua of blockedAgents) {
        const escaped = ua.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        lines.push(`  "~*${escaped}" 1;`);
      }
      lines.push("}");
      lines.push("NGINX_UA");
      lines.push("");
      lines.push("  # Add to nginx server blocks if not already present");
      lines.push("  if ! grep -q 'hoxta_block_ua' /etc/nginx/nginx.conf 2>/dev/null; then");
      lines.push("    echo '[Hoxta] NOTE: Add this to your nginx server block:'");
      lines.push("    echo '  if ($hoxta_block_ua) { return 403; }'");
      lines.push("  fi");
      lines.push("  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true");
      lines.push("  echo '[Hoxta] Nginx User-Agent blocking configured.'");
      lines.push("fi");
      lines.push("");

      // Apache config
      lines.push("# --- Apache User-Agent blocking ---");
      lines.push("if [ -d /etc/apache2 ] || [ -d /etc/httpd ]; then");
      lines.push("  APACHE_CONF_DIR=\"/etc/apache2/conf-available\"");
      lines.push("  [ -d /etc/httpd/conf.d ] && APACHE_CONF_DIR=\"/etc/httpd/conf.d\"");
      lines.push("  cat > \"$APACHE_CONF_DIR/hoxta-useragent-block.conf\" << 'APACHE_UA'");
      lines.push("<IfModule mod_rewrite.c>");
      lines.push("  RewriteEngine On");
      for (const ua of blockedAgents) {
        const escaped = ua.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        lines.push(`  RewriteCond %{HTTP_USER_AGENT} "${escaped}" [NC,OR]`);
      }
      // Remove trailing OR from last line by adding a dummy always-false condition
      lines.push("  RewriteCond %{HTTP_USER_AGENT} \"^$\" [NC]");
      lines.push("  RewriteRule .* - [F,L]");
      lines.push("</IfModule>");
      lines.push("APACHE_UA");
      lines.push("  a2enconf hoxta-useragent-block 2>/dev/null || true");
      lines.push("  apachectl graceful 2>/dev/null || systemctl reload httpd 2>/dev/null || true");
      lines.push("  echo '[Hoxta] Apache User-Agent blocking configured.'");
      lines.push("fi");
      lines.push("");

      // iptables string match as universal fallback
      lines.push("# --- iptables string-match fallback for User-Agent blocking ---");
      lines.push("if iptables -m string --help 2>&1 | grep -q 'string'; then");
      for (const ua of blockedAgents) {
        lines.push(`  iptables -A INPUT -p tcp --dport 80 -m string --algo bm --string "${ua}" -j DROP 2>/dev/null || true`);
        lines.push(`  iptables -A INPUT -p tcp --dport 443 -m string --algo bm --string "${ua}" -j DROP 2>/dev/null || true`);
      }
      lines.push("  echo '[Hoxta] iptables User-Agent string matching applied.'");
      lines.push("fi");
      lines.push("");
    }

    lines.push("");
    lines.push("echo '[Hoxta] Firewall rules applied successfully.'")

    // Update server last sync
    await supabase.from("servers").update({
      status: "online",
      last_sync_at: new Date().toISOString(),
      last_sync_status: "ok",
    }).eq("id", server.id);

    // Return installer script or just the rules
    if (action === "installer") {
      const installerScript = `#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  Hoxta Firewall Agent Installer v2.0                       ║
# ║  Auto-detect: Virtualizor, cPanel/WHM, Pterodactyl,        ║
# ║  GameCP, Plesk, DirectAdmin, Proxmox, Dedicated             ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

SERVER_KEY="${serverKey}"
API_URL="${supabaseUrl}/functions/v1/agent-sync"
PANEL_TYPE="${server.panel_type || "auto"}"

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
CYAN='\\033[0;36m'
NC='\\033[0m'

echo -e "\${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🛡️  Hoxta Firewall Agent Installer v2.0                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "\${NC}"

# ── Step 1: Auto-detect panel type ──
echo -e "\${YELLOW}[1/6] Detectare tip server...\${NC}"

detect_panel() {
  if [ "\$PANEL_TYPE" != "auto" ] && [ -n "\$PANEL_TYPE" ]; then
    echo "\$PANEL_TYPE"
    return
  fi
  
  # Virtualizor KVM
  if [ -d "/usr/local/virtualizor" ] || [ -f "/usr/local/emps/bin/virtualizor" ]; then
    echo "virtualizor"; return
  fi
  # cPanel/WHM
  if [ -d "/usr/local/cpanel" ] || [ -f "/usr/local/cpanel/cpanel" ]; then
    echo "cpanel_whm"; return
  fi
  # Plesk
  if [ -d "/usr/local/psa" ] || command -v plesk &>/dev/null; then
    echo "plesk"; return
  fi
  # DirectAdmin
  if [ -d "/usr/local/directadmin" ]; then
    echo "directadmin"; return
  fi
  # Pterodactyl
  if [ -d "/var/www/pterodactyl" ] || [ -d "/srv/pterodactyl" ] || systemctl is-active --quiet wings 2>/dev/null; then
    echo "pterodactyl"; return
  fi
  # GameCP
  if [ -d "/home/gamecp" ] || [ -d "/var/www/gamecp" ] || [ -d "/usr/local/gamecp" ]; then
    echo "gamecp"; return
  fi
  # Proxmox
  if [ -f "/etc/pve/.version" ] || command -v pvesh &>/dev/null; then
    echo "proxmox"; return
  fi
  # SolusVM
  if [ -d "/usr/local/solusvm" ]; then
    echo "solusvm"; return
  fi
  # CyberPanel
  if [ -d "/usr/local/CyberCP" ]; then
    echo "cyberpanel"; return
  fi
  # HestiaCP
  if [ -d "/usr/local/hestia" ]; then
    echo "hestia"; return
  fi
  # CloudPanel
  if [ -f "/etc/cloudpanel/config.yml" ] || command -v clpctl &>/dev/null; then
    echo "cloudpanel"; return
  fi
  
  echo "dedicated"
}

DETECTED_PANEL=$(detect_panel)
echo -e "  \${GREEN}✅ Detectat: \${DETECTED_PANEL}\${NC}"

# ── Step 2: Install dependencies ──
echo -e "\${YELLOW}[2/6] Instalare dependințe...\${NC}"

# Detect package manager
if command -v apt-get &>/dev/null; then
  PKG_MGR="apt"
  apt-get update -qq
  apt-get install -y curl iptables iptables-persistent ipset fail2ban >/dev/null 2>&1 || true
elif command -v yum &>/dev/null; then
  PKG_MGR="yum"
  yum install -y curl iptables iptables-services ipset fail2ban epel-release >/dev/null 2>&1 || true
elif command -v dnf &>/dev/null; then
  PKG_MGR="dnf"
  dnf install -y curl iptables iptables-services ipset fail2ban >/dev/null 2>&1 || true
fi

echo -e "  \${GREEN}✅ Dependințe instalate\${NC}"

# ── Step 3: Panel-specific configuration ──
echo -e "\${YELLOW}[3/6] Configurare specifică: \${DETECTED_PANEL}...\${NC}"

case "\$DETECTED_PANEL" in
  virtualizor)
    echo -e "  📦 Virtualizor KVM detectat"
    # Allow Virtualizor admin port
    iptables -C INPUT -p tcp --dport 4085 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 4085 -j ACCEPT
    iptables -C INPUT -p tcp --dport 4083 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 4083 -j ACCEPT
    # Allow VNC range for KVM
    iptables -C INPUT -p tcp --dport 5900:6100 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 5900:6100 -j ACCEPT
    # Allow DHCP for VMs
    iptables -C INPUT -p udp --dport 67:68 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 67:68 -j ACCEPT
    # Don't block bridge traffic
    echo 0 > /proc/sys/net/bridge/bridge-nf-call-iptables 2>/dev/null || true
    echo -e "  \${GREEN}✅ Porturi Virtualizor protejate (4085, 4083, VNC 5900-6100)\${NC}"
    ;;
    
  cpanel_whm)
    echo -e "  📦 cPanel/WHM detectat"
    # Essential cPanel/WHM ports
    for port in 2082 2083 2086 2087 2095 2096; do
      iptables -C INPUT -p tcp --dport \$port -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport \$port -j ACCEPT
    done
    # Allow web traffic
    iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
    iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
    # Mail ports
    for port in 25 465 587 993 995 110 143; do
      iptables -C INPUT -p tcp --dport \$port -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport \$port -j ACCEPT
    done
    # FTP
    iptables -C INPUT -p tcp --dport 21 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 21 -j ACCEPT
    iptables -C INPUT -p tcp --dport 49152:65534 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 49152:65534 -j ACCEPT
    # DNS
    iptables -C INPUT -p tcp --dport 53 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 53 -j ACCEPT
    iptables -C INPUT -p udp --dport 53 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 53 -j ACCEPT
    # MySQL
    iptables -C INPUT -p tcp --dport 3306 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 3306 -j ACCEPT
    
    # Configure fail2ban for cPanel
    cat > /etc/fail2ban/jail.d/cpanel.conf << 'CPANEL_F2B'
[cpanel-login]
enabled = true
port = 2082,2083,2086,2087
filter = cpanel
logpath = /usr/local/cpanel/logs/login_log
maxretry = 5
bantime = 3600

[cpanel-smtp]
enabled = true
port = 25,465,587
filter = exim
logpath = /var/log/exim_mainlog
maxretry = 10
CPANEL_F2B
    
    echo -e "  \${GREEN}✅ cPanel/WHM porturi + fail2ban configurat\${NC}"
    ;;
    
  pterodactyl)
    echo -e "  📦 Pterodactyl detectat"
    # Wings daemon port
    iptables -C INPUT -p tcp --dport 8080 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 8080 -j ACCEPT
    # SFTP port
    iptables -C INPUT -p tcp --dport 2022 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 2022 -j ACCEPT
    # Game server port ranges (common)
    iptables -C INPUT -p tcp --dport 25565:25665 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 25565:25665 -j ACCEPT  # Minecraft
    iptables -C INPUT -p udp --dport 25565:25665 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 25565:25665 -j ACCEPT
    iptables -C INPUT -p udp --dport 27015:27050 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 27015:27050 -j ACCEPT  # Source/Steam
    iptables -C INPUT -p tcp --dport 27015:27050 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 27015:27050 -j ACCEPT
    iptables -C INPUT -p udp --dport 7777:7800 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 7777:7800 -j ACCEPT     # ARK/Unreal
    iptables -C INPUT -p udp --dport 19132:19133 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 19132:19133 -j ACCEPT  # Bedrock
    # Docker overlay
    echo 0 > /proc/sys/net/bridge/bridge-nf-call-iptables 2>/dev/null || true
    echo -e "  \${GREEN}✅ Pterodactyl + game ports protejate\${NC}"
    ;;
    
  gamecp)
    echo -e "  📦 GameCP detectat"
    # GameCP web panel
    iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
    iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
    # Game ports
    iptables -C INPUT -p udp --dport 27015:27050 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 27015:27050 -j ACCEPT  # CS/Source
    iptables -C INPUT -p tcp --dport 27015:27050 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 27015:27050 -j ACCEPT
    iptables -C INPUT -p tcp --dport 25565:25665 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 25565:25665 -j ACCEPT  # Minecraft
    iptables -C INPUT -p udp --dport 25565:25665 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 25565:25665 -j ACCEPT
    iptables -C INPUT -p udp --dport 7777:7800 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 7777:7800 -j ACCEPT     # ARK
    iptables -C INPUT -p udp --dport 2302:2310 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 2302:2310 -j ACCEPT     # DayZ/Arma
    iptables -C INPUT -p udp --dport 9987 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 9987 -j ACCEPT               # TeamSpeak
    iptables -C INPUT -p tcp --dport 30033 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 30033 -j ACCEPT              # TS file transfer
    iptables -C INPUT -p tcp --dport 10011 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 10011 -j ACCEPT              # TS query
    # FiveM/GTA
    iptables -C INPUT -p tcp --dport 30120:30130 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 30120:30130 -j ACCEPT
    iptables -C INPUT -p udp --dport 30120:30130 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 30120:30130 -j ACCEPT
    # Rust
    iptables -C INPUT -p tcp --dport 28015:28016 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 28015:28016 -j ACCEPT
    iptables -C INPUT -p udp --dport 28015:28016 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 28015:28016 -j ACCEPT
    echo -e "  \${GREEN}✅ GameCP + game server ports protejate\${NC}"
    ;;
    
  proxmox)
    echo -e "  📦 Proxmox VE detectat"
    iptables -C INPUT -p tcp --dport 8006 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 8006 -j ACCEPT   # Web UI
    iptables -C INPUT -p tcp --dport 5900:6100 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 5900:6100 -j ACCEPT  # VNC
    iptables -C INPUT -p tcp --dport 3128 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 3128 -j ACCEPT   # SPICE
    iptables -C INPUT -p udp --dport 5404:5405 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p udp --dport 5404:5405 -j ACCEPT  # Corosync
    iptables -C INPUT -p tcp --dport 111 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 111 -j ACCEPT     # rpcbind
    echo 0 > /proc/sys/net/bridge/bridge-nf-call-iptables 2>/dev/null || true
    echo -e "  \${GREEN}✅ Proxmox porturi protejate (8006, VNC, Corosync)\${NC}"
    ;;
    
  plesk)
    echo -e "  📦 Plesk detectat"
    for port in 8443 8447 8880; do
      iptables -C INPUT -p tcp --dport \$port -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport \$port -j ACCEPT
    done
    iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
    iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
    for port in 25 465 587 993 995 110 143; do
      iptables -C INPUT -p tcp --dport \$port -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport \$port -j ACCEPT
    done
    echo -e "  \${GREEN}✅ Plesk porturi protejate\${NC}"
    ;;
    
  directadmin)
    echo -e "  📦 DirectAdmin detectat"
    iptables -C INPUT -p tcp --dport 2222 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 2222 -j ACCEPT
    iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
    iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
    echo -e "  \${GREEN}✅ DirectAdmin porturi protejate\${NC}"
    ;;
    
  solusvm)
    echo -e "  📦 SolusVM detectat"
    iptables -C INPUT -p tcp --dport 5353 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 5353 -j ACCEPT
    iptables -C INPUT -p tcp --dport 5656 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 5656 -j ACCEPT
    iptables -C INPUT -p tcp --dport 5900:6100 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 5900:6100 -j ACCEPT
    echo 0 > /proc/sys/net/bridge/bridge-nf-call-iptables 2>/dev/null || true
    echo -e "  \${GREEN}✅ SolusVM porturi protejate\${NC}"
    ;;
    
  *)
    echo -e "  📦 Server dedicat / generic"
    iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
    iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
    echo -e "  \${GREEN}✅ Porturi web standard protejate\${NC}"
    ;;
esac

# ── Step 4: Install GeoIP dependencies ──
echo -e "\${YELLOW}[4/6] Instalare GeoIP...\${NC}"
if ! command -v ipset &>/dev/null; then
  if [ "\$PKG_MGR" = "apt" ]; then
    apt-get install -y ipset xtables-addons-common libtext-csv-xs-perl >/dev/null 2>&1 || true
  else
    yum install -y ipset xtables-addons >/dev/null 2>&1 || true
  fi
fi
if command -v ipset &>/dev/null; then
  echo -e "  \${GREEN}✅ ipset instalat\${NC}"
else
  echo -e "  \${YELLOW}⚠️ ipset nu a putut fi instalat\${NC}"
fi

# ── Step 5: Create agent script ──
echo -e "\${YELLOW}[5/6] Instalare agent sincronizare...\${NC}"

mkdir -p /opt/hoxta
cat > /opt/hoxta/sync.sh << 'AGENT_SCRIPT'
#!/bin/bash
# Hoxta Firewall Sync Agent
SERVER_KEY="__SERVER_KEY__"
API_URL="__API_URL__"
LOG_FILE="/var/log/hoxta-firewall.log"

sync_rules() {
  echo "[\$(date)] Syncing firewall rules..." >> "\$LOG_FILE"
  
  SCRIPT=\$(curl -sf -H "x-server-key: \$SERVER_KEY" "\$API_URL?action=get_script" 2>>"\$LOG_FILE")
  
  if [ \$? -ne 0 ] || [ -z "\$SCRIPT" ]; then
    echo "[\$(date)] ERROR: Failed to fetch rules" >> "\$LOG_FILE"
    curl -sf -X POST -H "x-server-key: \$SERVER_KEY" -H "Content-Type: application/json" \\
      -d '{"status":"error","sync_status":"fetch_failed"}' \\
      "\$API_URL?action=heartbeat" 2>/dev/null || true
    return 1
  fi

  # Apply rules
  echo "\$SCRIPT" | bash 2>>"\$LOG_FILE"
  
  if [ \$? -eq 0 ]; then
    echo "[\$(date)] Rules applied successfully" >> "\$LOG_FILE"
    
    # Save rules persistently
    if command -v iptables-save &>/dev/null; then
      iptables-save > /etc/iptables.rules 2>/dev/null || true
    fi
    if command -v netfilter-persistent &>/dev/null; then
      netfilter-persistent save 2>/dev/null || true
    fi
    
    # Report heartbeat
    OS_INFO=\$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo "Unknown")
    curl -sf -X POST -H "x-server-key: \$SERVER_KEY" -H "Content-Type: application/json" \\
      -d "{\\"status\\":\\"online\\",\\"sync_status\\":\\"ok\\",\\"os_info\\":\\"\$OS_INFO\\"}" \\
      "\$API_URL?action=heartbeat" 2>/dev/null || true
  else
    echo "[\$(date)] ERROR: Failed to apply rules" >> "\$LOG_FILE"
    curl -sf -X POST -H "x-server-key: \$SERVER_KEY" -H "Content-Type: application/json" \\
      -d '{"status":"error","sync_status":"apply_failed"}' \\
      "\$API_URL?action=heartbeat" 2>/dev/null || true
  fi
}

sync_rules
AGENT_SCRIPT

# Replace placeholders
sed -i "s|__SERVER_KEY__|$SERVER_KEY|g" /opt/hoxta/sync.sh
sed -i "s|__API_URL__|$API_URL|g" /opt/hoxta/sync.sh
chmod +x /opt/hoxta/sync.sh

# ── Step 6: Setup cron + first sync ──
echo -e "\${YELLOW}[6/6] Configurare cron + prima sincronizare...\${NC}"

CRON_LINE="*/5 * * * * /opt/hoxta/sync.sh"
(crontab -l 2>/dev/null | grep -v "hoxta/sync.sh"; echo "\$CRON_LINE") | crontab -

# Enable iptables persistence
if command -v netfilter-persistent &>/dev/null; then
  systemctl enable netfilter-persistent 2>/dev/null || true
fi
if command -v iptables-save &>/dev/null && [ -d /etc/sysconfig ]; then
  systemctl enable iptables 2>/dev/null || true
fi

# Run initial sync
/opt/hoxta/sync.sh

# Save iptables
iptables-save > /etc/iptables/rules.v4 2>/dev/null || iptables-save > /etc/sysconfig/iptables 2>/dev/null || true

echo ""
echo -e "\${GREEN}╔══════════════════════════════════════════════════════════════╗\${NC}"
echo -e "\${GREEN}║  ✅ Hoxta Agent instalat cu succes!                        ║\${NC}"
echo -e "\${GREEN}╚══════════════════════════════════════════════════════════════╝\${NC}"
echo ""
echo -e "  🖥️  Tip server:  \${CYAN}\${DETECTED_PANEL}\${NC}"
echo -e "  📁 Agent:       \${CYAN}/opt/hoxta/sync.sh\${NC}"
echo -e "  ⏰ Cron:        la fiecare 5 minute"
echo -e "  📋 Log:         \${CYAN}/var/log/hoxta-firewall.log\${NC}"
echo -e "  🔥 iptables:    \$(iptables -L INPUT -n 2>/dev/null | tail -n +3 | wc -l) reguli active"
echo -e "  🌍 ipset:       \$(command -v ipset &>/dev/null && echo 'instalat' || echo 'lipsă')"
echo -e "  🛡️ fail2ban:    \$(command -v fail2ban-server &>/dev/null && echo 'instalat' || echo 'lipsă')"
echo ""
echo -e "  \${YELLOW}Comenzi utile:\${NC}"
echo -e "  /opt/hoxta/sync.sh                    # Sync manual"
echo -e "  tail -f /var/log/hoxta-firewall.log   # Vezi loguri"
echo -e "  iptables -L -n --line-numbers         # Vezi reguli active"
echo -e "  fail2ban-client status                 # Status fail2ban"
echo -e "  ipset list                             # Vezi seturi GeoIP"
`;
      return new Response(installerScript, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return new Response(lines.join("\n"), {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
