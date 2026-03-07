import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyIps } from "@/hooks/useAdmin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Server, Gamepad2, Monitor, Globe, Database, Mail, Shield, Layers, Cloud, Cpu, HardDrive, Radio } from "lucide-react";

interface PresetRule {
  label: string;
  port: number | null;
  port_range: string | null;
  protocol: string;
  direction: string;
  action: string;
  priority: number;
  notes: string;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  rules: PresetRule[];
}

const PRESETS: Preset[] = [
  {
    id: "cpanel",
    name: "cPanel / WHM",
    description: "Hosting cPanel (HTTP, HTTPS, WHM, FTP, SSH, DNS, Mail)",
    icon: <Server className="h-5 w-5" />,
    category: "Hosting",
    rules: [
      { label: "cPanel - HTTP", port: 80, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 10, notes: "HTTP web traffic" },
      { label: "cPanel - HTTPS", port: 443, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 11, notes: "HTTPS web traffic" },
      { label: "cPanel - WHM", port: 2087, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 12, notes: "WHM admin panel" },
      { label: "cPanel - Panel", port: 2083, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 13, notes: "cPanel user panel" },
      { label: "cPanel - Webmail", port: 2096, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 14, notes: "Webmail access" },
      { label: "cPanel - SSH", port: 22, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 15, notes: "SSH access" },
      { label: "cPanel - FTP", port: 21, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 16, notes: "FTP control" },
      { label: "cPanel - FTP Passive", port: null, port_range: "49152-65534", protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 17, notes: "FTP passive range" },
      { label: "cPanel - DNS", port: 53, port_range: null, protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 18, notes: "DNS queries" },
      { label: "cPanel - DNS TCP", port: 53, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 19, notes: "DNS zone transfers" },
      { label: "cPanel - SMTP", port: 25, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 20, notes: "SMTP mail" },
      { label: "cPanel - SMTPS", port: 465, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 21, notes: "SMTP over SSL" },
      { label: "cPanel - IMAP", port: 993, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 22, notes: "IMAP over SSL" },
      { label: "cPanel - POP3", port: 995, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 23, notes: "POP3 over SSL" },
      { label: "cPanel - MySQL", port: 3306, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 24, notes: "MySQL database" },
    ],
  },
  {
    id: "sonicpanel",
    name: "SonicPanel",
    description: "SonicPanel hosting (HTTP, HTTPS, Panel, SSH, FTP, DNS, Mail)",
    icon: <Monitor className="h-5 w-5" />,
    category: "Hosting",
    rules: [
      { label: "SonicPanel - HTTP", port: 80, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 10, notes: "HTTP web traffic" },
      { label: "SonicPanel - HTTPS", port: 443, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 11, notes: "HTTPS web traffic" },
      { label: "SonicPanel - Panel", port: 8443, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 12, notes: "SonicPanel admin" },
      { label: "SonicPanel - SSH", port: 22, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 13, notes: "SSH access" },
      { label: "SonicPanel - FTP", port: 21, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 14, notes: "FTP control" },
      { label: "SonicPanel - DNS", port: 53, port_range: null, protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 15, notes: "DNS queries" },
      { label: "SonicPanel - SMTP", port: 25, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 16, notes: "SMTP mail" },
      { label: "SonicPanel - SMTPS", port: 465, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 17, notes: "SMTP over SSL" },
      { label: "SonicPanel - IMAP", port: 993, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 18, notes: "IMAP over SSL" },
      { label: "SonicPanel - MySQL", port: 3306, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 19, notes: "MySQL database" },
    ],
  },
  {
    id: "plesk",
    name: "Plesk",
    description: "Plesk hosting panel complet",
    icon: <Layers className="h-5 w-5" />,
    category: "Hosting",
    rules: [
      { label: "Plesk - HTTP", port: 80, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 10, notes: "HTTP" },
      { label: "Plesk - HTTPS", port: 443, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 11, notes: "HTTPS" },
      { label: "Plesk - Panel", port: 8443, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 12, notes: "Plesk panel" },
      { label: "Plesk - Panel HTTP", port: 8880, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 13, notes: "Plesk panel HTTP" },
      { label: "Plesk - SSH", port: 22, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 14, notes: "SSH" },
      { label: "Plesk - FTP", port: 21, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 15, notes: "FTP" },
      { label: "Plesk - DNS", port: 53, port_range: null, protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 16, notes: "DNS" },
      { label: "Plesk - SMTP", port: 25, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 17, notes: "SMTP" },
      { label: "Plesk - SMTPS", port: 465, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 18, notes: "SMTPS" },
      { label: "Plesk - IMAPS", port: 993, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 19, notes: "IMAPS" },
      { label: "Plesk - MySQL", port: 3306, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 20, notes: "MySQL" },
    ],
  },
  {
    id: "pterodactyl",
    name: "Pterodactyl Panel",
    description: "Panou de administrare servere de jocuri Pterodactyl",
    icon: <Cpu className="h-5 w-5" />,
    category: "Game Panels",
    rules: [
      { label: "Ptero - HTTP", port: 80, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 10, notes: "HTTP panel" },
      { label: "Ptero - HTTPS", port: 443, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 11, notes: "HTTPS panel" },
      { label: "Ptero - Daemon", port: 8080, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 12, notes: "Wings daemon" },
      { label: "Ptero - Daemon SFTP", port: 2022, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 13, notes: "Wings SFTP" },
      { label: "Ptero - SSH", port: 22, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 14, notes: "SSH access" },
      { label: "Ptero - Game Ports", port: null, port_range: "25565-25665", protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 15, notes: "Minecraft range" },
      { label: "Ptero - Game Ports UDP", port: null, port_range: "25565-25665", protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 16, notes: "Game UDP range" },
      { label: "Ptero - Extra Ports", port: null, port_range: "27015-27050", protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 17, notes: "Source engine TCP" },
      { label: "Ptero - Extra Ports UDP", port: null, port_range: "27015-27050", protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 18, notes: "Source engine UDP" },
    ],
  },
  {
    id: "gamecp",
    name: "GameCP",
    description: "Game Control Panel - gestionare servere de jocuri",
    icon: <Gamepad2 className="h-5 w-5" />,
    category: "Game Panels",
    rules: [
      { label: "GameCP - HTTP", port: 80, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 10, notes: "HTTP panel" },
      { label: "GameCP - HTTPS", port: 443, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 11, notes: "HTTPS panel" },
      { label: "GameCP - Panel", port: 8888, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 12, notes: "GameCP panel port" },
      { label: "GameCP - SSH", port: 22, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 13, notes: "SSH access" },
      { label: "GameCP - FTP", port: 21, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 14, notes: "FTP" },
      { label: "GameCP - Game Range", port: null, port_range: "25565-25665", protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 15, notes: "Minecraft range" },
      { label: "GameCP - Game Range UDP", port: null, port_range: "25565-25665", protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 16, notes: "Game UDP" },
      { label: "GameCP - Source Engine", port: null, port_range: "27015-27050", protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 17, notes: "Source engine" },
      { label: "GameCP - FiveM", port: 30120, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 18, notes: "FiveM" },
      { label: "GameCP - FiveM UDP", port: 30120, port_range: null, protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 19, notes: "FiveM UDP" },
    ],
  },
  {
    id: "gameserver",
    name: "Servere de Jocuri",
    description: "Minecraft, CS2, FiveM, Rust, ARK, TeamSpeak, Garry's Mod",
    icon: <Gamepad2 className="h-5 w-5" />,
    category: "Game Panels",
    rules: [
      { label: "Game - SSH", port: 22, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 10, notes: "SSH access" },
      { label: "Game - Minecraft", port: 25565, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 11, notes: "Minecraft server" },
      { label: "Game - CS2", port: 27015, port_range: null, protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 12, notes: "CS2 game port" },
      { label: "Game - CS2 RCON", port: 27015, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 13, notes: "CS2 RCON" },
      { label: "Game - FiveM", port: 30120, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 14, notes: "FiveM server" },
      { label: "Game - FiveM UDP", port: 30120, port_range: null, protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 15, notes: "FiveM UDP" },
      { label: "Game - Rust", port: 28015, port_range: null, protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 16, notes: "Rust game port" },
      { label: "Game - Rust RCON", port: 28016, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 17, notes: "Rust RCON" },
      { label: "Game - ARK", port: 7777, port_range: null, protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 18, notes: "ARK game port" },
      { label: "Game - ARK Query", port: 27015, port_range: null, protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 19, notes: "ARK query" },
      { label: "Game - TeamSpeak", port: 9987, port_range: null, protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 20, notes: "TeamSpeak voice" },
      { label: "Game - TS Query", port: 10011, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 21, notes: "TeamSpeak query" },
      { label: "Game - Garry's Mod", port: 27015, port_range: null, protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 22, notes: "GMod" },
    ],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    description: "Permite doar trafic de la IP-urile Cloudflare (proxy HTTP/HTTPS)",
    icon: <Cloud className="h-5 w-5" />,
    category: "CDN & Security",
    rules: [
      { label: "CF - HTTP", port: 80, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 10, notes: "HTTP via Cloudflare" },
      { label: "CF - HTTPS", port: 443, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 11, notes: "HTTPS via Cloudflare" },
      { label: "CF - Alt HTTPS 1", port: 2053, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 12, notes: "Cloudflare alt port" },
      { label: "CF - Alt HTTPS 2", port: 2083, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 13, notes: "Cloudflare alt port" },
      { label: "CF - Alt HTTPS 3", port: 2087, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 14, notes: "Cloudflare alt port" },
      { label: "CF - Alt HTTPS 4", port: 2096, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 15, notes: "Cloudflare alt port" },
      { label: "CF - Alt HTTP 1", port: 8080, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 16, notes: "Cloudflare alt port" },
      { label: "CF - Alt HTTP 2", port: 8880, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 17, notes: "Cloudflare alt port" },
      { label: "CF - SSH", port: 22, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 18, notes: "SSH access" },
    ],
  },
  {
    id: "webserver",
    name: "Web Server",
    description: "Reguli de bază (HTTP, HTTPS, SSH)",
    icon: <Globe className="h-5 w-5" />,
    category: "Servere",
    rules: [
      { label: "Web - HTTP", port: 80, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 10, notes: "HTTP traffic" },
      { label: "Web - HTTPS", port: 443, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 11, notes: "HTTPS traffic" },
      { label: "Web - SSH", port: 22, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 12, notes: "SSH access" },
    ],
  },
  {
    id: "database",
    name: "Database Server",
    description: "MySQL, PostgreSQL, Redis, MongoDB",
    icon: <Database className="h-5 w-5" />,
    category: "Servere",
    rules: [
      { label: "DB - SSH", port: 22, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 10, notes: "SSH access" },
      { label: "DB - MySQL", port: 3306, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 11, notes: "MySQL" },
      { label: "DB - PostgreSQL", port: 5432, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 12, notes: "PostgreSQL" },
      { label: "DB - Redis", port: 6379, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 13, notes: "Redis" },
      { label: "DB - MongoDB", port: 27017, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 14, notes: "MongoDB" },
    ],
  },
  {
    id: "mailserver",
    name: "Mail Server",
    description: "SMTP, IMAP, POP3, Submission",
    icon: <Mail className="h-5 w-5" />,
    category: "Servere",
    rules: [
      { label: "Mail - SSH", port: 22, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 10, notes: "SSH access" },
      { label: "Mail - SMTP", port: 25, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 11, notes: "SMTP" },
      { label: "Mail - Submission", port: 587, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 12, notes: "Mail submission" },
      { label: "Mail - SMTPS", port: 465, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 13, notes: "SMTP over SSL" },
      { label: "Mail - IMAPS", port: 993, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 14, notes: "IMAP over SSL" },
      { label: "Mail - POP3S", port: 995, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 15, notes: "POP3 over SSL" },
    ],
  },
  {
    id: "docker",
    name: "Docker / Portainer",
    description: "Docker daemon, Portainer UI, registre",
    icon: <HardDrive className="h-5 w-5" />,
    category: "Servere",
    rules: [
      { label: "Docker - SSH", port: 22, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 10, notes: "SSH access" },
      { label: "Docker - Portainer", port: 9443, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 11, notes: "Portainer HTTPS" },
      { label: "Docker - Portainer HTTP", port: 9000, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 12, notes: "Portainer HTTP" },
      { label: "Docker - API", port: 2375, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 13, notes: "Docker API" },
      { label: "Docker - API TLS", port: 2376, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 14, notes: "Docker API TLS" },
      { label: "Docker - Registry", port: 5000, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 15, notes: "Docker Registry" },
    ],
  },
  {
    id: "voip",
    name: "VoIP / SIP",
    description: "Asterisk, FreePBX, SIP, RTP",
    icon: <Radio className="h-5 w-5" />,
    category: "Servere",
    rules: [
      { label: "VoIP - SSH", port: 22, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 10, notes: "SSH" },
      { label: "VoIP - SIP", port: 5060, port_range: null, protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 11, notes: "SIP UDP" },
      { label: "VoIP - SIP TCP", port: 5060, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 12, notes: "SIP TCP" },
      { label: "VoIP - SIP TLS", port: 5061, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 13, notes: "SIP TLS" },
      { label: "VoIP - RTP", port: null, port_range: "10000-20000", protocol: "udp", direction: "INPUT", action: "ACCEPT", priority: 14, notes: "RTP media" },
      { label: "VoIP - FreePBX", port: 80, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 15, notes: "FreePBX HTTP" },
      { label: "VoIP - FreePBX HTTPS", port: 443, port_range: null, protocol: "tcp", direction: "INPUT", action: "ACCEPT", priority: 16, notes: "FreePBX HTTPS" },
    ],
  },
];

const CATEGORIES = [...new Set(PRESETS.map(p => p.category))];

interface PresetRulesDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (rules: Omit<PresetRule, "">[], selectedIp: string) => void;
  loading?: boolean;
  currentRuleCount?: number;
  maxRules?: number;
}

export function PresetRulesDialog({ open, onClose, onApply, loading, currentRuleCount = 0, maxRules = 20 }: PresetRulesDialogProps) {
  const { data: myIps } = useMyIps();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedIp, setSelectedIp] = useState<string>("");

  const hasIps = myIps && myIps.length > 0;
  const preset = PRESETS.find((p) => p.id === selectedPreset);
  const remainingSlots = maxRules - currentRuleCount;
  const wouldExceed = preset ? preset.rules.length > remainingSlots : false;

  const handleApply = () => {
    if (!preset || !selectedIp || wouldExceed) return;
    onApply(preset.rules, selectedIp);
    setSelectedPreset(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Reguli Prestabilite
          </DialogTitle>
        </DialogHeader>

        {!hasIps ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground text-sm">Nu ai IP-uri alocate.</p>
            <p className="text-muted-foreground text-xs mt-1">Contactează administratorul.</p>
          </div>
        ) : !selectedPreset ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Selectează un set de reguli prestabilite:</p>
              <Badge variant="secondary" className="text-xs">
                {currentRuleCount}/{maxRules} reguli folosite
              </Badge>
            </div>
            {CATEGORIES.map(cat => (
              <div key={cat}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {PRESETS.filter(p => p.category === cat).map((p) => {
                    const tooMany = p.rules.length > remainingSlots;
                    return (
                      <button
                        key={p.id}
                        onClick={() => !tooMany && setSelectedPreset(p.id)}
                        disabled={tooMany}
                        className={`flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-muted/30 transition-all text-left group ${
                          tooMany ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/60 hover:border-primary/40"
                        }`}
                      >
                        <div className="mt-0.5 text-primary group-hover:scale-110 transition-transform">
                          {p.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
                          <div className="flex gap-1.5 mt-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {p.rules.length} reguli
                            </Badge>
                            {tooMany && (
                              <Badge variant="destructive" className="text-[10px]">
                                Depășește limita
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedPreset(null)}
              className="text-xs text-primary hover:underline"
            >
              ← Înapoi la lista de preset-uri
            </button>

            <div className="flex items-center gap-3">
              <div className="text-primary">{preset?.icon}</div>
              <div>
                <p className="font-bold text-foreground">{preset?.name}</p>
                <p className="text-xs text-muted-foreground">{preset?.description}</p>
              </div>
            </div>

            {wouldExceed && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                Acest preset adaugă {preset?.rules.length} reguli, dar mai ai doar {remainingSlots} sloturi disponibile.
                Contactează administratorul pentru a crește limita.
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">Selectează IP-ul</Label>
              <Select value={selectedIp} onValueChange={setSelectedIp}>
                <SelectTrigger className="mt-1.5 bg-muted/50 border-border/50 text-sm rounded-xl">
                  <SelectValue placeholder="Alege IP-ul pentru reguli" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50 rounded-xl">
                  {myIps?.map((ip) => (
                    <SelectItem key={ip.id} value={ip.ip_address}>
                      {ip.ip_address} {ip.label ? `(${ip.label})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Reguli care vor fi adăugate ({preset?.rules.length}):</p>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-border/30 rounded-xl p-2 bg-muted/20">
                {preset?.rules.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-muted/40">
                    <span className="text-foreground">{r.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{r.protocol.toUpperCase()}</span>
                      <span className="text-primary font-mono">{r.port || r.port_range}</span>
                      <Badge variant={r.action === "ACCEPT" ? "default" : "destructive"} className="text-[10px]">
                        {r.action}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
                Anulare
              </Button>
              <Button onClick={handleApply} className="flex-1 rounded-xl gradient-btn text-primary-foreground border-0 hover:opacity-90" disabled={loading || !selectedIp || wouldExceed}>
                {loading ? "Se aplică..." : `Aplică ${preset?.rules.length} Reguli`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
