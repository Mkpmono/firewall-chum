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

// ============ PREMIUM DDoS Protection (activare admin) ============
const DDOS_PREMIUM_RULES = [
  // Toate regulile standard, plus:
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Pro] Drop Invalid Packets", notes: "-m state --state INVALID -j DROP", priority: 1 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] Block XMAS Packets", notes: "--tcp-flags ALL ALL -j DROP", priority: 2 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] Block NULL Packets", notes: "--tcp-flags ALL NONE -j DROP", priority: 3 },
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Pro] Block Fragmented", notes: "-f -j DROP", priority: 4 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] SYN Flood Protect", notes: "--syn -m limit --limit 1/s --limit-burst 3 -j ACCEPT", priority: 5 },
  { direction: "INPUT", protocol: "icmp", action: "DROP", label: "[DDoS-Pro] ICMP Flood Limit", notes: "--icmp-type echo-request -m limit --limit 1/s --limit-burst 4 -j ACCEPT", priority: 6 },
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] UDP Flood Protect", notes: "-m limit --limit 10/s --limit-burst 20 -j ACCEPT", priority: 7 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] RST Flood Protect", notes: "--tcp-flags RST RST -m limit --limit 2/s --limit-burst 2 -j ACCEPT", priority: 8 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] Conn Limit HTTP", notes: "--dport 80 -m connlimit --connlimit-above 50 -j DROP", priority: 9, port: 80 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] Conn Limit HTTPS", notes: "--dport 443 -m connlimit --connlimit-above 50 -j DROP", priority: 10, port: 443 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] Slowloris Protect", notes: "--dport 80 -m conntrack --ctstate NEW -m limit --limit 60/s --limit-burst 20 -j ACCEPT", priority: 11 },
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] DNS Amplification", notes: "--sport 53 -m length --length 512:65535 -j DROP", priority: 12, port: 53 },
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] NTP Amplification", notes: "--sport 123 -m length --length 48:65535 -j DROP", priority: 13, port: 123 },
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] SSDP Block", notes: "--dport 1900 -j DROP", priority: 14, port: 1900 },
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] Chargen Block", notes: "--dport 19 -j DROP", priority: 15, port: 19 },
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS-Pro] SNMP Amplification", notes: "--sport 161 -m length --length 200:65535 -j DROP", priority: 16, port: 161 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS-Pro] New Conn Rate Limit", notes: "-m conntrack --ctstate NEW -m limit --limit 60/s --limit-burst 20 -j ACCEPT", priority: 17 },
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Pro] Block Bogon 0/8", notes: "-s 0.0.0.0/8 -j DROP", priority: 18 },
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Pro] Block Bogon 127/8", notes: "-s 127.0.0.0/8 -j DROP", priority: 19 },
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Pro] Block Multicast", notes: "-s 224.0.0.0/4 -j DROP", priority: 20 },
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS-Pro] Block Reserved", notes: "-s 240.0.0.0/4 -j DROP", priority: 21 },
];

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

function generatePremiumIptables(targetIp: string): string[] {
  return [
    `# === PREMIUM DDoS Full Protection for ${targetIp} ===`,
    "",
    "# Invalid/malformed packets",
    `iptables -A INPUT -d ${targetIp} -m state --state INVALID -j DROP`,
    `iptables -A INPUT -d ${targetIp} -p tcp --tcp-flags ALL ALL -j DROP`,
    `iptables -A INPUT -d ${targetIp} -p tcp --tcp-flags ALL NONE -j DROP`,
    `iptables -A INPUT -d ${targetIp} -f -j DROP`,
    "",
    "# SYN flood (agresiv)",
    `iptables -A INPUT -d ${targetIp} -p tcp --syn -m limit --limit 1/s --limit-burst 3 -j ACCEPT`,
    `iptables -A INPUT -d ${targetIp} -p tcp --syn -j DROP`,
    "",
    "# ICMP flood",
    `iptables -A INPUT -d ${targetIp} -p icmp --icmp-type echo-request -m limit --limit 1/s --limit-burst 4 -j ACCEPT`,
    `iptables -A INPUT -d ${targetIp} -p icmp --icmp-type echo-request -j DROP`,
    "",
    "# UDP flood",
    `iptables -A INPUT -d ${targetIp} -p udp -m limit --limit 10/s --limit-burst 20 -j ACCEPT`,
    "",
    "# RST flood",
    `iptables -A INPUT -d ${targetIp} -p tcp --tcp-flags RST RST -m limit --limit 2/s --limit-burst 2 -j ACCEPT`,
    `iptables -A INPUT -d ${targetIp} -p tcp --tcp-flags RST RST -j DROP`,
    "",
    "# Connection limits HTTP/HTTPS",
    `iptables -A INPUT -d ${targetIp} -p tcp --dport 80 -m connlimit --connlimit-above 50 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -p tcp --dport 443 -m connlimit --connlimit-above 50 -j DROP`,
    "",
    "# Slowloris",
    `iptables -A INPUT -d ${targetIp} -p tcp --dport 80 -m conntrack --ctstate NEW -m limit --limit 60/s --limit-burst 20 -j ACCEPT`,
    "",
    "# New connection rate limit",
    `iptables -A INPUT -d ${targetIp} -p tcp -m conntrack --ctstate NEW -m limit --limit 60/s --limit-burst 20 -j ACCEPT`,
    "",
    "# Amplification attacks",
    `iptables -A INPUT -d ${targetIp} -p udp --sport 53 -m length --length 512:65535 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -p udp --sport 123 -m length --length 48:65535 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -p udp --dport 1900 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -p udp --dport 19 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -p udp --sport 161 -m length --length 200:65535 -j DROP`,
    "",
    "# Bogon/spoofed sources",
    `iptables -A INPUT -d ${targetIp} -s 0.0.0.0/8 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -s 127.0.0.0/8 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -s 224.0.0.0/4 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -s 240.0.0.0/4 -j DROP`,
    "",
    `# === End PREMIUM DDoS for ${targetIp} ===`,
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
        "# Generated by Hoxta Firewall Manager",
        `# Date: ${new Date().toISOString()}`,
        `# User Rules: ${rules.length}`,
        `# Standard DDoS IPs: ${standardIps.length}`,
        `# Premium DDoS IPs: ${premiumIps.length}`,
        "",
        "*filter",
        ":INPUT ACCEPT [0:0]",
        ":FORWARD ACCEPT [0:0]",
        ":OUTPUT ACCEPT [0:0]",
        "",
      ];

      // Premium DDoS first (highest priority, fullest protection)
      if (premiumIps.length > 0) {
        lines.push("# ========== PREMIUM DDOS PROTECTION ==========");
        for (const ip of premiumIps) {
          lines.push(...generatePremiumIptables(ip.ip_address));
        }
        lines.push("# ========== END PREMIUM DDOS ==========");
        lines.push("");
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
      }))
    );

    return new Response(
      JSON.stringify({
        count: rules.length,
        ddos_standard_rules: standardDdosJson.length,
        ddos_premium_rules: premiumDdosJson.length,
        generated_at: new Date().toISOString(),
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
