import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============ STANDARD DDoS Protection (toți clienții) ============
const DDOS_STANDARD_RULES = [
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Std] Drop Invalid Packets", notes: "-m state --state INVALID -j DROP", priority: 1 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Std] Block XMAS Packets", notes: "--tcp-flags ALL ALL -j DROP", priority: 2 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Std] Block NULL Packets", notes: "--tcp-flags ALL NONE -j DROP", priority: 3 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Std] SYN Limit", notes: "--syn -m limit --limit 5/s --limit-burst 10 -j ACCEPT", priority: 4 },
  { direction: "INPUT", protocol: "icmp", action: "DROP", label: "[DDoS-Std] ICMP Limit", notes: "--icmp-type echo-request -m limit --limit 2/s --limit-burst 5 -j ACCEPT", priority: 5 },
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Std] Block Bogons", notes: "-s 0.0.0.0/8 -j DROP; -s 224.0.0.0/4 -j DROP", priority: 6 },
];

// ============ PREMIUM DDoS Protection - Smart Rules ============
// Philosophy: Keep services alive. Per-IP rate limiting, sinkhole redirect,
// ESTABLISHED priority, SYN cookies, hashlimit instead of global limits
const DDOS_PREMIUM_RULES = [
  // Phase 1: Established connections ALWAYS pass
  { direction: "INPUT", protocol: "all", action: "ACCEPT", label: "[DDoS-Pro] Allow Established/Related", notes: "-m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT", priority: 1 },
  { direction: "INPUT", protocol: "all", action: "ACCEPT", label: "[DDoS-Pro] Allow Loopback", notes: "-i lo -j ACCEPT", priority: 2 },
  // Phase 2: Drop malformed
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Pro] Drop Invalid State", notes: "-m conntrack --ctstate INVALID -j DROP", priority: 3 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] Block XMAS Scan", notes: "--tcp-flags ALL ALL -j DROP", priority: 4 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] Block NULL Scan", notes: "--tcp-flags ALL NONE -j DROP", priority: 5 },
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Pro] Block Fragmented", notes: "-f -j DROP", priority: 6 },
  // Phase 3: Per-IP hashlimit
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] SYN Hashlimit /IP", notes: "hashlimit 15/s per src burst 30", priority: 7 },
  { direction: "INPUT", protocol: "icmp", action: "DROP", label: "[DDoS-Pro] ICMP Hashlimit /IP", notes: "hashlimit 5/s per src burst 10", priority: 8 },
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] UDP Hashlimit /IP", notes: "hashlimit 20/s per src burst 40", priority: 9 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] RST Hashlimit /IP", notes: "RST hashlimit 5/s per src", priority: 10 },
  // Phase 4: Connection limits per IP
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] Conn/IP Limit HTTP", notes: "connlimit 80/src port 80", priority: 11, port: 80 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] Conn/IP Limit HTTPS", notes: "connlimit 80/src port 443", priority: 12, port: 443 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] New Conn Rate /IP", notes: "hashlimit new 30/s per src", priority: 13 },
  // Phase 5: Sinkhole
  { direction: "PREROUTING", protocol: "tcp", action: "DNAT", label: "[DDoS-Pro] Sinkhole SYN Flood", notes: "DNAT to 192.0.2.1 excess SYN", priority: 14 },
  { direction: "PREROUTING", protocol: "udp", action: "DNAT", label: "[DDoS-Pro] Sinkhole UDP Flood", notes: "DNAT to 192.0.2.1 excess UDP", priority: 15 },
  // Phase 6: Anti-Slowloris
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] Slowloris /IP Protect", notes: "hashlimit new 20/s per src port 80", priority: 16, port: 80 },
  // Phase 7: Amplification
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] DNS Amplification", notes: "--sport 53 -m length --length 512:65535 -j DROP", priority: 17, port: 53 },
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] NTP Amplification", notes: "--sport 123 -m length --length 48:65535 -j DROP", priority: 18, port: 123 },
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] SSDP Block", notes: "--dport 1900 -j DROP", priority: 19, port: 1900 },
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] Chargen Block", notes: "--dport 19 -j DROP", priority: 20, port: 19 },
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] SNMP Amplification", notes: "--sport 161 -m length --length 200:65535 -j DROP", priority: 21, port: 161 },
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] Memcached Amplification", notes: "--dport 11211 -j DROP", priority: 22, port: 11211 },
  // Phase 8: Bogon
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Pro] Block Bogon 0/8", notes: "-s 0.0.0.0/8 -j DROP", priority: 23 },
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Pro] Block Bogon 127/8", notes: "-s 127.0.0.0/8 -j DROP", priority: 24 },
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Pro] Block Multicast", notes: "-s 224.0.0.0/4 -j DROP", priority: 25 },
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Pro] Block Reserved", notes: "-s 240.0.0.0/4 -j DROP", priority: 26 },
];

// Default Sinkhole IP - can be overridden per client via profiles.sinkhole_ip
const DEFAULT_SINKHOLE_IP = "192.0.2.1";

function generateStandardIptables(targetIp: string): string[] {
  return [
    `# --- Standard DDoS Protection for ${targetIp} ---`,
    `iptables -A INPUT -d ${targetIp} -m state --state INVALID -j DROP`,
    `iptables -A INPUT -d ${targetIp} -p tcp --tcp-flags ALL ALL -j DROP`,
    `iptables -A INPUT -d ${targetIp} -p tcp --tcp-flags ALL NONE -j DROP`,
    `iptables -A INPUT -d ${targetIp} -p tcp --syn -m limit --limit 5/s --limit-burst 10 -j ACCEPT`,
    `iptables -A INPUT -d ${targetIp} -p tcp --syn -j DROP`,
    `iptables -A INPUT -d ${targetIp} -p icmp --icmp-type echo-request -m limit --limit 2/s --limit-burst 5 -j ACCEPT`,
    `iptables -A INPUT -d ${targetIp} -p icmp --icmp-type echo-request -j DROP`,
    `iptables -A INPUT -d ${targetIp} -s 0.0.0.0/8 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -s 224.0.0.0/4 -j DROP`,
    `# --- End Standard DDoS for ${targetIp} ---`,
    "",
  ];
}

function generatePremiumIptables(targetIp: string, sinkholeIp?: string): string[] {
  const t = targetIp;
  const s = sinkholeIp || DEFAULT_SINKHOLE_IP;
  return [
    `# ╔══════════════════════════════════════════════════════════════╗`,
    `# ║  PREMIUM DDoS Smart Protection for ${t}`,
    `# ║  Strategy: Keep services alive, redirect attacks to sinkhole`,
    `# ╚══════════════════════════════════════════════════════════════╝`,
    "",
    "# ── Kernel tuning (SYN cookies + conntrack) ──",
    "sysctl -w net.ipv4.tcp_syncookies=1",
    "sysctl -w net.ipv4.tcp_timestamps=1",
    "sysctl -w net.ipv4.tcp_tw_reuse=1",
    "sysctl -w net.ipv4.tcp_fin_timeout=15",
    "sysctl -w net.ipv4.tcp_max_syn_backlog=8192",
    "sysctl -w net.netfilter.nf_conntrack_max=500000",
    "sysctl -w net.ipv4.tcp_keepalive_time=300",
    "sysctl -w net.ipv4.tcp_keepalive_intvl=15",
    "sysctl -w net.ipv4.tcp_keepalive_probes=5",
    "sysctl -w net.ipv4.conf.all.rp_filter=1",
    "sysctl -w net.ipv4.icmp_echo_ignore_broadcasts=1",
    "",
    "# ── Phase 1: ESTABLISHED/RELATED always pass (services stay alive) ──",
    `iptables -A INPUT -d ${t} -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`,
    `iptables -A INPUT -i lo -j ACCEPT`,
    "",
    "# ── Phase 2: Drop malformed packets ──",
    `iptables -A INPUT -d ${t} -m conntrack --ctstate INVALID -j DROP`,
    `iptables -A INPUT -d ${t} -p tcp --tcp-flags ALL ALL -j DROP`,
    `iptables -A INPUT -d ${t} -p tcp --tcp-flags ALL NONE -j DROP`,
    `iptables -A INPUT -d ${t} -p tcp --tcp-flags SYN,FIN SYN,FIN -j DROP`,
    `iptables -A INPUT -d ${t} -p tcp --tcp-flags SYN,RST SYN,RST -j DROP`,
    `iptables -A INPUT -d ${t} -f -j DROP`,
    "",
    "# ── Phase 3: Per-IP hashlimit (only blocks abusive source IPs) ──",
    `# SYN: allow 15/s per source IP, excess gets dropped`,
    `iptables -A INPUT -d ${t} -p tcp --syn -m hashlimit --hashlimit-above 15/s --hashlimit-burst 30 --hashlimit-mode srcip --hashlimit-name syn_${t.replace(/\./g, '_')} -j DROP`,
    `# ICMP: allow 5/s per source IP`,
    `iptables -A INPUT -d ${t} -p icmp --icmp-type echo-request -m hashlimit --hashlimit-above 5/s --hashlimit-burst 10 --hashlimit-mode srcip --hashlimit-name icmp_${t.replace(/\./g, '_')} -j DROP`,
    `# UDP: allow 20/s per source IP`,
    `iptables -A INPUT -d ${t} -p udp -m hashlimit --hashlimit-above 20/s --hashlimit-burst 40 --hashlimit-mode srcip --hashlimit-name udp_${t.replace(/\./g, '_')} -j DROP`,
    `# RST: allow 5/s per source IP`,
    `iptables -A INPUT -d ${t} -p tcp --tcp-flags RST RST -m hashlimit --hashlimit-above 5/s --hashlimit-burst 10 --hashlimit-mode srcip --hashlimit-name rst_${t.replace(/\./g, '_')} -j DROP`,
    "",
    "# ── Phase 4: Per-IP connection limits (not global) ──",
    `iptables -A INPUT -d ${t} -p tcp --dport 80 -m connlimit --connlimit-above 80 --connlimit-mask 32 -j DROP`,
    `iptables -A INPUT -d ${t} -p tcp --dport 443 -m connlimit --connlimit-above 80 --connlimit-mask 32 -j DROP`,
    `# New connection rate per source IP`,
    `iptables -A INPUT -d ${t} -p tcp -m conntrack --ctstate NEW -m hashlimit --hashlimit-above 30/s --hashlimit-burst 50 --hashlimit-mode srcip --hashlimit-name newconn_${t.replace(/\./g, '_')} -j DROP`,
    "",
    `# ── Phase 5: Sinkhole redirect (attack traffic → ${s}) ──`,
    `# Excess SYN flood traffic redirected to sinkhole instead of dropped`,
    `iptables -t nat -A PREROUTING -d ${t} -p tcp --syn -m hashlimit --hashlimit-above 50/s --hashlimit-burst 80 --hashlimit-mode srcip --hashlimit-name sink_syn_${t.replace(/\./g, '_')} -j DNAT --to-destination ${s}`,
    `# Excess UDP flood traffic redirected to sinkhole`,
    `iptables -t nat -A PREROUTING -d ${t} -p udp -m hashlimit --hashlimit-above 50/s --hashlimit-burst 80 --hashlimit-mode srcip --hashlimit-name sink_udp_${t.replace(/\./g, '_')} -j DNAT --to-destination ${s}`,
    `# Route sinkhole to blackhole`,
    `ip route add blackhole ${s}/32 2>/dev/null || true`,
    "",
    "# ── Phase 6: Anti-Slowloris per IP ──",
    `iptables -A INPUT -d ${t} -p tcp --dport 80 -m conntrack --ctstate NEW -m hashlimit --hashlimit-above 20/s --hashlimit-burst 30 --hashlimit-mode srcip --hashlimit-name slowloris_${t.replace(/\./g, '_')} -j DROP`,
    `iptables -A INPUT -d ${t} -p tcp --dport 443 -m conntrack --ctstate NEW -m hashlimit --hashlimit-above 20/s --hashlimit-burst 30 --hashlimit-mode srcip --hashlimit-name slowloris_s_${t.replace(/\./g, '_')} -j DROP`,
    "",
    "# ── Phase 7: Amplification attack protection ──",
    `iptables -A INPUT -d ${t} -p udp --sport 53 -m length --length 512:65535 -j DROP`,
    `iptables -A INPUT -d ${t} -p udp --sport 123 -m length --length 48:65535 -j DROP`,
    `iptables -A INPUT -d ${t} -p udp --dport 1900 -j DROP`,
    `iptables -A INPUT -d ${t} -p udp --dport 19 -j DROP`,
    `iptables -A INPUT -d ${t} -p udp --sport 161 -m length --length 200:65535 -j DROP`,
    `iptables -A INPUT -d ${t} -p udp --dport 11211 -j DROP`,
    "",
    "# ── Phase 8: Bogon/spoofed sources ──",
    `iptables -A INPUT -d ${t} -s 0.0.0.0/8 -j DROP`,
    `iptables -A INPUT -d ${t} -s 127.0.0.0/8 -j DROP`,
    `iptables -A INPUT -d ${t} -s 224.0.0.0/4 -j DROP`,
    `iptables -A INPUT -d ${t} -s 240.0.0.0/4 -j DROP`,
    `iptables -A INPUT -d ${t} -s 169.254.0.0/16 -j DROP`,
    `iptables -A INPUT -d ${t} -s 192.0.2.0/24 -j DROP`,
    `iptables -A INPUT -d ${t} -s 198.51.100.0/24 -j DROP`,
    `iptables -A INPUT -d ${t} -s 203.0.113.0/24 -j DROP`,
    "",
    `# ╔══════════════════════════════════════════════════════════════╗`,
    `# ║  End PREMIUM DDoS for ${t}`,
    `# ║  Services remain active — only abusive IPs get blocked/sinked`,
    `# ╚══════════════════════════════════════════════════════════════╝`,
    "",
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!apiKey || apiKey !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey!);

    const url = new URL(req.url);
    const ipFilter = url.searchParams.get("ip");
    const userId = url.searchParams.get("user_id");
    const format = url.searchParams.get("format") || "json";

    // Fetch user rules
    let query = supabase
      .from("firewall_rules")
      .select("*")
      .eq("enabled", true)
      .order("priority", { ascending: true });

    if (ipFilter) {
      query = query.or(`destination_ip.eq.${ipFilter},source_ip.eq.${ipFilter}`);
    }
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: rules, error } = await query;
    if (error) throw error;

    // Fetch profiles and IPs for DDoS tiers
    interface IpEntry { user_id: string; ip_address: string }
    let premiumIps: IpEntry[] = [];
    let standardIps: IpEntry[] = [];

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, ddos_protection")
        .eq("user_id", userId)
        .maybeSingle();
      const { data: ips } = await supabase
        .from("client_ips")
        .select("user_id, ip_address")
        .eq("user_id", userId);
      const userIps = ips || [];
      if (profile?.ddos_protection) {
        premiumIps = userIps;
      } else {
        standardIps = userIps;
      }
    } else {
      // All users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, ddos_protection");
      const premiumUserIds = (profiles || []).filter((p) => p.ddos_protection).map((p) => p.user_id);
      const standardUserIds = (profiles || []).filter((p) => !p.ddos_protection).map((p) => p.user_id);

      const { data: allIps } = await supabase
        .from("client_ips")
        .select("user_id, ip_address");

      for (const ip of allIps || []) {
        if (premiumUserIds.includes(ip.user_id)) {
          premiumIps.push(ip);
        } else if (standardUserIds.includes(ip.user_id)) {
          standardIps.push(ip);
        }
      }
    }

    if (format === "iptables") {
      const lines = [
        "#!/bin/bash",
        "# ╔══════════════════════════════════════════════════════════════╗",
        "# ║  Generated by Hoxta Firewall Manager                       ║",
        `# ║  Date: ${new Date().toISOString()}`,
        `# ║  User Rules: ${rules.length}`,
        `# ║  Standard DDoS IPs: ${standardIps.length}`,
        `# ║  Premium DDoS IPs: ${premiumIps.length}`,
        "# ╚══════════════════════════════════════════════════════════════╝",
        "",
        "set -e",
        "",
        "*filter",
        ":INPUT ACCEPT [0:0]",
        ":FORWARD ACCEPT [0:0]",
        ":OUTPUT ACCEPT [0:0]",
        "",
      ];

      // Premium DDoS first (smart protection - services stay alive)
      if (premiumIps.length > 0) {
        lines.push("# ╔══════════════════════════════════════════════════════════════╗");
        lines.push("# ║  PREMIUM DDOS SMART PROTECTION                             ║");
        lines.push("# ║  Per-IP rate limiting + sinkhole redirect + SYN cookies     ║");
        lines.push("# ╚══════════════════════════════════════════════════════════════╝");
        for (const ip of premiumIps) {
          lines.push(...generatePremiumIptables(ip.ip_address));
        }
      }

      // Standard DDoS for non-premium users
      if (standardIps.length > 0) {
        lines.push("# ========== STANDARD DDOS PROTECTION ==========");
        for (const ip of standardIps) {
          lines.push(...generateStandardIptables(ip.ip_address));
        }
        lines.push("# ========== END STANDARD DDOS ==========");
        lines.push("");
      }

      // Regular user rules
      lines.push("# ========== USER FIREWALL RULES ==========");
      for (const rule of rules) {
        let line = `iptables -A ${rule.direction}`;
        line += ` -p ${rule.protocol}`;
        if (rule.source_ip && rule.source_ip !== "0.0.0.0/0") {
          line += ` -s ${rule.source_ip}`;
        }
        if (rule.destination_ip && rule.destination_ip !== "0.0.0.0/0") {
          line += ` -d ${rule.destination_ip}`;
        }
        if (rule.port) {
          line += ` --dport ${rule.port}`;
        } else if (rule.port_range) {
          line += ` --dport ${rule.port_range}`;
        }
        line += ` -j ${rule.action}`;
        if (rule.label) {
          line += ` # ${rule.label}`;
        }
        lines.push(line);
      }

      lines.push("", "COMMIT");

      return new Response(lines.join("\n"), {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    // JSON format
    const standardDdosJson = standardIps.flatMap((ip) =>
      DDOS_STANDARD_RULES.map((r) => ({
        ...r,
        destination_ip: ip.ip_address,
        source_ip: "0.0.0.0/0",
        user_id: ip.user_id,
        tier: "standard",
      }))
    );

    const premiumDdosJson = premiumIps.flatMap((ip) =>
      DDOS_PREMIUM_RULES.map((r) => ({
        ...r,
        destination_ip: ip.ip_address,
        source_ip: "0.0.0.0/0",
        user_id: ip.user_id,
        tier: "premium",
        sinkhole_ip: SINKHOLE_IP,
      }))
    );

    return new Response(
      JSON.stringify({
        count: rules.length,
        ddos_standard_rules: standardDdosJson.length,
        ddos_premium_rules: premiumDdosJson.length,
        sinkhole_ip: SINKHOLE_IP,
        generated_at: new Date().toISOString(),
        protection_strategy: {
          premium: "Smart protection: per-IP hashlimit, sinkhole redirect, ESTABLISHED priority, SYN cookies. Services stay alive during attacks.",
          standard: "Basic protection: global rate limits, bogon blocking, invalid packet drops.",
        },
        ddos_standard: standardDdosJson,
        ddos_premium: premiumDdosJson,
        rules: rules.map((r) => ({
          id: r.id,
          direction: r.direction,
          protocol: r.protocol,
          source_ip: r.source_ip,
          destination_ip: r.destination_ip,
          port: r.port,
          port_range: r.port_range,
          action: r.action,
          priority: r.priority,
          label: r.label,
          notes: r.notes,
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
