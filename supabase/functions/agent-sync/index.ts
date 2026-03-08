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

    const sinkholeIp = profile?.sinkhole_ip || "192.0.2.1";
    const hasPremiumDdos = profile?.ddos_protection === true;
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
      const projectId = Deno.env.get("SUPABASE_URL")!.replace("https://", "").replace(".supabase.co", "");
      const installerScript = `#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  Hoxta Firewall Agent Installer                            ║
# ║  Compatible: Virtualizor, SolusVM, Proxmox, Virtuozzo,     ║
# ║  XenOrchestra, oVirt, cPanel/WHM, Plesk, DirectAdmin,      ║
# ║  CyberPanel, HestiaCP, CloudPanel, Pterodactyl, Dedicated  ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

SERVER_KEY="${serverKey}"
API_URL="${supabaseUrl}/functions/v1/agent-sync"

echo "🛡️  Hoxta Firewall Agent Installer"
echo "=================================="

# Create agent directory
mkdir -p /opt/hoxta
cat > /opt/hoxta/sync.sh << 'AGENT_SCRIPT'
#!/bin/bash
# Hoxta Firewall Sync Agent
SERVER_KEY="__SERVER_KEY__"
API_URL="__API_URL__"
LOG_FILE="/var/log/hoxta-firewall.log"

sync_rules() {
  echo "[$(date)] Syncing firewall rules..." >> "$LOG_FILE"
  
  SCRIPT=$(curl -sf -H "x-server-key: $SERVER_KEY" "$API_URL?action=get_script" 2>>"$LOG_FILE")
  
  if [ $? -ne 0 ] || [ -z "$SCRIPT" ]; then
    echo "[$(date)] ERROR: Failed to fetch rules" >> "$LOG_FILE"
    curl -sf -X POST -H "x-server-key: $SERVER_KEY" -H "Content-Type: application/json" \\
      -d '{"status":"error","sync_status":"fetch_failed"}' \\
      "$API_URL?action=heartbeat" 2>/dev/null || true
    return 1
  fi

  # Apply rules
  echo "$SCRIPT" | bash 2>>"$LOG_FILE"
  
  if [ $? -eq 0 ]; then
    echo "[$(date)] Rules applied successfully" >> "$LOG_FILE"
    
    # Save rules persistently
    if command -v iptables-save &>/dev/null; then
      iptables-save > /etc/iptables.rules 2>/dev/null || true
    fi
    if command -v netfilter-persistent &>/dev/null; then
      netfilter-persistent save 2>/dev/null || true
    fi
    
    # Report heartbeat
    OS_INFO=$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo "Unknown")
    curl -sf -X POST -H "x-server-key: $SERVER_KEY" -H "Content-Type: application/json" \\
      -d "{\\"status\\":\\"online\\",\\"sync_status\\":\\"ok\\",\\"os_info\\":\\"$OS_INFO\\"}" \\
      "$API_URL?action=heartbeat" 2>/dev/null || true
  else
    echo "[$(date)] ERROR: Failed to apply rules" >> "$LOG_FILE"
    curl -sf -X POST -H "x-server-key: $SERVER_KEY" -H "Content-Type: application/json" \\
      -d '{"status":"error","sync_status":"apply_failed"}' \\
      "$API_URL?action=heartbeat" 2>/dev/null || true
  fi
}

sync_rules
AGENT_SCRIPT

# Replace placeholders
sed -i "s|__SERVER_KEY__|$SERVER_KEY|g" /opt/hoxta/sync.sh
sed -i "s|__API_URL__|$API_URL|g" /opt/hoxta/sync.sh
chmod +x /opt/hoxta/sync.sh

# Setup cron (every 5 minutes)
CRON_LINE="*/5 * * * * /opt/hoxta/sync.sh"
(crontab -l 2>/dev/null | grep -v "hoxta/sync.sh"; echo "$CRON_LINE") | crontab -

# Run initial sync
/opt/hoxta/sync.sh

echo ""
echo "✅ Hoxta Agent instalat cu succes!"
echo "   📁 Script: /opt/hoxta/sync.sh"
echo "   ⏰ Cron: la fiecare 5 minute"
echo "   📋 Log: /var/log/hoxta-firewall.log"
echo ""
echo "Comenzi utile:"
echo "   /opt/hoxta/sync.sh          # Sync manual"
echo "   tail -f /var/log/hoxta-firewall.log  # Vezi loguri"
echo "   crontab -e                   # Editează cron"
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
