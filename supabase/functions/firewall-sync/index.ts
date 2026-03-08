import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Premium DDoS protection rules - comprehensive anti-DDoS iptables ruleset
const DDOS_PROTECTION_RULES = [
  // SYN flood protection
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS] SYN Flood Protection", notes: "iptables -A INPUT -p tcp --syn -m limit --limit 1/s --limit-burst 3 -j ACCEPT", priority: 1 },
  // ICMP flood / ping of death
  { direction: "INPUT", protocol: "icmp", action: "DROP", label: "[DDoS] ICMP Flood Limit", notes: "iptables -A INPUT -p icmp --icmp-type echo-request -m limit --limit 1/s --limit-burst 4 -j ACCEPT", priority: 2 },
  // UDP flood protection
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS] UDP Flood Protection", notes: "iptables -A INPUT -p udp -m limit --limit 10/s --limit-burst 20 -j ACCEPT", priority: 3 },
  // Invalid packets
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS] Drop Invalid Packets", notes: "iptables -A INPUT -m state --state INVALID -j DROP", priority: 4 },
  // XMAS packets
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS] Block XMAS Packets", notes: "iptables -A INPUT -p tcp --tcp-flags ALL ALL -j DROP", priority: 5 },
  // NULL packets
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS] Block NULL Packets", notes: "iptables -A INPUT -p tcp --tcp-flags ALL NONE -j DROP", priority: 6 },
  // Fragmented packets
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS] Block Fragmented Packets", notes: "iptables -A INPUT -f -j DROP", priority: 7 },
  // Connection limit per IP
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS] Conn Limit /IP (80)", notes: "iptables -A INPUT -p tcp --dport 80 -m connlimit --connlimit-above 50 -j DROP", priority: 8 },
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS] Conn Limit /IP (443)", notes: "iptables -A INPUT -p tcp --dport 443 -m connlimit --connlimit-above 50 -j DROP", priority: 9 },
  // RST flood
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS] RST Flood Protection", notes: "iptables -A INPUT -p tcp --tcp-flags RST RST -m limit --limit 2/s --limit-burst 2 -j ACCEPT", priority: 10 },
  // Slowloris protection
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS] Slowloris Protection", notes: "iptables -A INPUT -p tcp --dport 80 -m conntrack --ctstate NEW -m limit --limit 60/s --limit-burst 20 -j ACCEPT", priority: 11 },
  // DNS amplification
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS] DNS Amplification Block", notes: "iptables -A INPUT -p udp --sport 53 -m length --length 512:65535 -j DROP", priority: 12, port: 53 },
  // NTP amplification
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS] NTP Amplification Block", notes: "iptables -A INPUT -p udp --sport 123 -m length --length 48:65535 -j DROP", priority: 13, port: 123 },
  // SSDP amplification
  { direction: "INPUT", protocol: "udp", action: "DROP", label: "[DDoS] SSDP Amplification Block", notes: "iptables -A INPUT -p udp --dport 1900 -j DROP", priority: 14, port: 1900 },
  // Rate limit new connections
  { direction: "INPUT", protocol: "tcp", action: "DROP", label: "[DDoS] New Conn Rate Limit", notes: "iptables -A INPUT -p tcp -m conntrack --ctstate NEW -m limit --limit 60/s --limit-burst 20 -j ACCEPT", priority: 15 },
  // Drop bogon/spoofed
  { direction: "INPUT", protocol: "all", action: "DROP", label: "[DDoS] Block Bogon Networks", notes: "iptables -A INPUT -s 0.0.0.0/8 -j DROP; iptables -A INPUT -s 127.0.0.0/8 -j DROP; iptables -A INPUT -s 224.0.0.0/4 -j DROP", priority: 16 },
];

function generateDdosIptables(targetIp: string): string[] {
  const lines: string[] = [
    `# === DDoS Full Protection for ${targetIp} ===`,
    "",
    "# Drop invalid packets",
    `iptables -A INPUT -d ${targetIp} -m state --state INVALID -j DROP`,
    "",
    "# Drop XMAS packets",
    `iptables -A INPUT -d ${targetIp} -p tcp --tcp-flags ALL ALL -j DROP`,
    "",
    "# Drop NULL packets",
    `iptables -A INPUT -d ${targetIp} -p tcp --tcp-flags ALL NONE -j DROP`,
    "",
    "# Drop fragmented packets",
    `iptables -A INPUT -d ${targetIp} -f -j DROP`,
    "",
    "# SYN flood protection",
    `iptables -A INPUT -d ${targetIp} -p tcp --syn -m limit --limit 1/s --limit-burst 3 -j ACCEPT`,
    `iptables -A INPUT -d ${targetIp} -p tcp --syn -j DROP`,
    "",
    "# ICMP rate limit",
    `iptables -A INPUT -d ${targetIp} -p icmp --icmp-type echo-request -m limit --limit 1/s --limit-burst 4 -j ACCEPT`,
    `iptables -A INPUT -d ${targetIp} -p icmp --icmp-type echo-request -j DROP`,
    "",
    "# UDP flood protection",
    `iptables -A INPUT -d ${targetIp} -p udp -m limit --limit 10/s --limit-burst 20 -j ACCEPT`,
    "",
    "# RST flood protection",
    `iptables -A INPUT -d ${targetIp} -p tcp --tcp-flags RST RST -m limit --limit 2/s --limit-burst 2 -j ACCEPT`,
    `iptables -A INPUT -d ${targetIp} -p tcp --tcp-flags RST RST -j DROP`,
    "",
    "# Connection limit per source IP (HTTP/HTTPS)",
    `iptables -A INPUT -d ${targetIp} -p tcp --dport 80 -m connlimit --connlimit-above 50 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -p tcp --dport 443 -m connlimit --connlimit-above 50 -j DROP`,
    "",
    "# Rate limit new connections",
    `iptables -A INPUT -d ${targetIp} -p tcp -m conntrack --ctstate NEW -m limit --limit 60/s --limit-burst 20 -j ACCEPT`,
    "",
    "# DNS amplification protection",
    `iptables -A INPUT -d ${targetIp} -p udp --sport 53 -m length --length 512:65535 -j DROP`,
    "",
    "# NTP amplification protection",
    `iptables -A INPUT -d ${targetIp} -p udp --sport 123 -m length --length 48:65535 -j DROP`,
    "",
    "# SSDP amplification protection",
    `iptables -A INPUT -d ${targetIp} -p udp --dport 1900 -j DROP`,
    "",
    "# Block bogon/spoofed sources",
    `iptables -A INPUT -d ${targetIp} -s 0.0.0.0/8 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -s 127.0.0.0/8 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -s 224.0.0.0/4 -j DROP`,
    `iptables -A INPUT -d ${targetIp} -s 240.0.0.0/4 -j DROP`,
    "",
    `# === End DDoS Protection for ${targetIp} ===`,
  ];
  return lines;
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

    // Check DDoS protection status for relevant users
    let ddosUsers: Record<string, boolean> = {};
    let ddosIps: { user_id: string; ip_address: string }[] = [];

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, ddos_protection")
        .eq("user_id", userId)
        .maybeSingle();
      if (profile?.ddos_protection) {
        ddosUsers[userId] = true;
        const { data: ips } = await supabase
          .from("client_ips")
          .select("user_id, ip_address")
          .eq("user_id", userId);
        ddosIps = ips || [];
      }
    } else {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, ddos_protection")
        .eq("ddos_protection", true);
      if (profiles && profiles.length > 0) {
        for (const p of profiles) {
          ddosUsers[p.user_id] = true;
        }
        const userIds = profiles.map((p) => p.user_id);
        const { data: ips } = await supabase
          .from("client_ips")
          .select("user_id, ip_address")
          .in("user_id", userIds);
        ddosIps = ips || [];
      }
    }

    if (format === "iptables") {
      const lines = [
        "#!/bin/bash",
        "# Generated by Hoxta Firewall Manager",
        `# Date: ${new Date().toISOString()}`,
        `# Rules: ${rules.length}`,
        `# DDoS Protected Users: ${Object.keys(ddosUsers).length}`,
        "",
        "*filter",
        ":INPUT ACCEPT [0:0]",
        ":FORWARD ACCEPT [0:0]",
        ":OUTPUT ACCEPT [0:0]",
        "",
      ];

      // DDoS protection rules first (highest priority)
      if (ddosIps.length > 0) {
        lines.push("# ========== PREMIUM DDOS PROTECTION ==========");
        for (const ipEntry of ddosIps) {
          lines.push(...generateDdosIptables(ipEntry.ip_address));
          lines.push("");
        }
        lines.push("# ========== END DDOS PROTECTION ==========");
        lines.push("");
      }

      // Regular rules
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
    const ddosRulesForJson = ddosIps.flatMap((ipEntry) =>
      DDOS_PROTECTION_RULES.map((r) => ({
        ...r,
        destination_ip: ipEntry.ip_address,
        source_ip: "0.0.0.0/0",
        user_id: ipEntry.user_id,
        is_ddos_protection: true,
      }))
    );

    return new Response(
      JSON.stringify({
        count: rules.length,
        ddos_protection_rules: ddosRulesForJson.length,
        generated_at: new Date().toISOString(),
        ddos_rules: ddosRulesForJson,
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
