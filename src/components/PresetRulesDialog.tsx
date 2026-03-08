import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyIps, useMyProfile } from "@/hooks/useAdmin";
import { useAllPresetTemplatesWithRules } from "@/hooks/usePresetTemplates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Server, Gamepad2, Monitor, Globe, Database, Mail, Shield, Layers, Cloud, Cpu, HardDrive, Radio, ShieldCheck, ShieldAlert } from "lucide-react";

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
  isPremium?: boolean;
  rules: PresetRule[];
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Server: <Server className="h-5 w-5" />,
  Monitor: <Monitor className="h-5 w-5" />,
  Layers: <Layers className="h-5 w-5" />,
  Cpu: <Cpu className="h-5 w-5" />,
  Gamepad2: <Gamepad2 className="h-5 w-5" />,
  Cloud: <Cloud className="h-5 w-5" />,
  Globe: <Globe className="h-5 w-5" />,
  Database: <Database className="h-5 w-5" />,
  Mail: <Mail className="h-5 w-5" />,
  HardDrive: <HardDrive className="h-5 w-5" />,
  Radio: <Radio className="h-5 w-5" />,
  Shield: <Shield className="h-5 w-5" />,
  ShieldCheck: <ShieldCheck className="h-5 w-5" />,
  ShieldAlert: <ShieldAlert className="h-5 w-5" />,
};

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
  const { data: myProfile } = useMyProfile();
  const { data: dbPresets, isLoading: presetsLoading } = useAllPresetTemplatesWithRules();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedIp, setSelectedIp] = useState<string>("");

  const hasPremiumDdos = (myProfile as any)?.ddos_protection === true;
  const hasIps = myIps && myIps.length > 0;

  const allPresets: Preset[] = useMemo(() => {
    return (dbPresets || []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      icon: ICON_MAP[p.icon] || <Shield className="h-5 w-5" />,
      category: p.category,
      isPremium: p.is_premium,
      rules: p.rules.map((r) => ({
        label: r.label,
        port: r.port,
        port_range: r.port_range,
        protocol: r.protocol,
        direction: r.direction,
        action: r.action,
        priority: r.priority,
        notes: r.notes || "",
      })),
    }));
  }, [dbPresets]);

  const allCategories = [...new Set(allPresets.map(p => p.category))];
  const preset = allPresets.find((p) => p.id === selectedPreset);
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
        ) : presetsLoading ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">Se încarcă preset-urile...</div>
        ) : !selectedPreset ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Selectează un set de reguli prestabilite:</p>
              <Badge variant="secondary" className="text-xs">
                {currentRuleCount}/{maxRules} reguli folosite
              </Badge>
            </div>
            {allCategories.map(cat => (
              <div key={cat}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {allPresets.filter(p => p.category === cat).map((p) => {
                    const tooMany = p.rules.length > remainingSlots;
                    const lockedPremium = p.isPremium && !hasPremiumDdos;
                    const disabled = tooMany || lockedPremium;
                    return (
                      <button
                        key={p.id}
                        onClick={() => !disabled && setSelectedPreset(p.id)}
                        disabled={disabled}
                        className={`flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-muted/30 transition-all text-left group ${
                          disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/60 hover:border-primary/40"
                        } ${p.isPremium ? "border-primary/20" : ""}`}
                      >
                        <div className={`mt-0.5 text-primary group-hover:scale-110 transition-transform`}>
                          {p.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            <Badge variant="secondary" className="text-[10px]">
                              {p.rules.length} reguli
                            </Badge>
                            {p.isPremium && (
                              <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">
                                PREMIUM
                              </Badge>
                            )}
                            {lockedPremium && (
                              <Badge variant="destructive" className="text-[10px]">
                                🔒 Necesită activare admin
                              </Badge>
                            )}
                            {tooMany && !lockedPremium && (
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
