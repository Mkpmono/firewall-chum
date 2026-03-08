import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Plus, Trash2, Search, Shield, ShieldOff, Zap,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Full country list with ISO 3166-1 alpha-2 codes
const COUNTRIES = [
  { code: "AF", name: "Afghanistan" }, { code: "AL", name: "Albania" }, { code: "DZ", name: "Algeria" },
  { code: "AD", name: "Andorra" }, { code: "AO", name: "Angola" }, { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" }, { code: "AU", name: "Australia" }, { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" }, { code: "BS", name: "Bahamas" }, { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" }, { code: "BY", name: "Belarus" }, { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" }, { code: "BJ", name: "Benin" }, { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia" }, { code: "BW", name: "Botswana" }, { code: "BR", name: "Brazil" },
  { code: "BN", name: "Brunei" }, { code: "BG", name: "Bulgaria" }, { code: "BF", name: "Burkina Faso" },
  { code: "KH", name: "Cambodia" }, { code: "CM", name: "Cameroon" }, { code: "CA", name: "Canada" },
  { code: "CF", name: "Central African Rep." }, { code: "TD", name: "Chad" }, { code: "CL", name: "Chile" },
  { code: "CN", name: "China" }, { code: "CO", name: "Colombia" }, { code: "CD", name: "Congo (DRC)" },
  { code: "CR", name: "Costa Rica" }, { code: "HR", name: "Croatia" }, { code: "CU", name: "Cuba" },
  { code: "CY", name: "Cyprus" }, { code: "CZ", name: "Czech Republic" }, { code: "DK", name: "Denmark" },
  { code: "DO", name: "Dominican Rep." }, { code: "EC", name: "Ecuador" }, { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" }, { code: "EE", name: "Estonia" }, { code: "ET", name: "Ethiopia" },
  { code: "FI", name: "Finland" }, { code: "FR", name: "France" }, { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" }, { code: "GH", name: "Ghana" }, { code: "GR", name: "Greece" },
  { code: "GT", name: "Guatemala" }, { code: "HN", name: "Honduras" }, { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" }, { code: "IS", name: "Iceland" }, { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" }, { code: "IR", name: "Iran" }, { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" }, { code: "IL", name: "Israel" }, { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" }, { code: "JP", name: "Japan" }, { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" }, { code: "KE", name: "Kenya" }, { code: "KP", name: "North Korea" },
  { code: "KR", name: "South Korea" }, { code: "KW", name: "Kuwait" }, { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Laos" }, { code: "LV", name: "Latvia" }, { code: "LB", name: "Lebanon" },
  { code: "LY", name: "Libya" }, { code: "LT", name: "Lithuania" }, { code: "LU", name: "Luxembourg" },
  { code: "MO", name: "Macau" }, { code: "MK", name: "North Macedonia" }, { code: "MG", name: "Madagascar" },
  { code: "MY", name: "Malaysia" }, { code: "MV", name: "Maldives" }, { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" }, { code: "MX", name: "Mexico" }, { code: "MD", name: "Moldova" },
  { code: "MN", name: "Mongolia" }, { code: "ME", name: "Montenegro" }, { code: "MA", name: "Morocco" },
  { code: "MZ", name: "Mozambique" }, { code: "MM", name: "Myanmar" }, { code: "NA", name: "Namibia" },
  { code: "NP", name: "Nepal" }, { code: "NL", name: "Netherlands" }, { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" }, { code: "NE", name: "Niger" }, { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norway" }, { code: "OM", name: "Oman" }, { code: "PK", name: "Pakistan" },
  { code: "PA", name: "Panama" }, { code: "PY", name: "Paraguay" }, { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" }, { code: "PL", name: "Poland" }, { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" }, { code: "RO", name: "Romania" }, { code: "RU", name: "Russia" },
  { code: "RW", name: "Rwanda" }, { code: "SA", name: "Saudi Arabia" }, { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" }, { code: "SG", name: "Singapore" }, { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" }, { code: "SO", name: "Somalia" }, { code: "ZA", name: "South Africa" },
  { code: "ES", name: "Spain" }, { code: "LK", name: "Sri Lanka" }, { code: "SD", name: "Sudan" },
  { code: "SE", name: "Sweden" }, { code: "CH", name: "Switzerland" }, { code: "SY", name: "Syria" },
  { code: "TW", name: "Taiwan" }, { code: "TJ", name: "Tajikistan" }, { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand" }, { code: "TN", name: "Tunisia" }, { code: "TR", name: "Turkey" },
  { code: "TM", name: "Turkmenistan" }, { code: "UA", name: "Ukraine" }, { code: "AE", name: "UAE" },
  { code: "GB", name: "United Kingdom" }, { code: "US", name: "United States" }, { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" }, { code: "VE", name: "Venezuela" }, { code: "VN", name: "Vietnam" },
  { code: "YE", name: "Yemen" }, { code: "ZM", name: "Zambia" }, { code: "ZW", name: "Zimbabwe" },
];

// Common presets
const PRESETS = {
  "Block common attack origins": {
    mode: "blacklist" as const,
    countries: ["CN", "RU", "KP", "IR", "VN", "BD", "PK", "IN", "BR", "NG"],
  },
  "Europe only (whitelist)": {
    mode: "whitelist" as const,
    countries: ["DE", "FR", "GB", "NL", "IT", "ES", "PL", "RO", "SE", "NO", "DK", "FI", "BE", "AT", "CH", "PT", "CZ", "HU", "GR", "IE", "BG", "HR", "SK", "SI", "LT", "LV", "EE", "LU", "MT", "CY"],
  },
  "US + EU only": {
    mode: "whitelist" as const,
    countries: ["US", "CA", "DE", "FR", "GB", "NL", "IT", "ES", "PL", "RO", "SE", "NO", "DK", "FI", "BE", "AT", "CH"],
  },
};

const flagEmoji = (code: string) => {
  const base = 127397;
  return String.fromCodePoint(...code.toUpperCase().split("").map(c => c.charCodeAt(0) + base));
};

export const GeoIpManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addMode, setAddMode] = useState<"blacklist" | "whitelist">("blacklist");
  const [expanded, setExpanded] = useState(true);

  const { data: geoRules, isLoading } = useQuery({
    queryKey: ["geoip_rules", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("geoip_rules")
        .select("*")
        .order("country_name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addRule = useMutation({
    mutationFn: async ({ country_code, country_name, mode }: { country_code: string; country_name: string; mode: string }) => {
      const { error } = await supabase.from("geoip_rules").insert({
        user_id: user!.id,
        country_code,
        country_name,
        mode,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["geoip_rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("geoip_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["geoip_rules"] }),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("geoip_rules").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["geoip_rules"] }),
  });

  const addCountry = async (code: string, name: string) => {
    const exists = geoRules?.find(r => r.country_code === code);
    if (exists) {
      toast({ title: `${name} e deja în listă`, variant: "destructive" });
      return;
    }
    try {
      await addRule.mutateAsync({ country_code: code, country_name: name, mode: addMode });
      toast({ title: `${flagEmoji(code)} ${name} adăugat (${addMode})` });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    }
  };

  const applyPreset = async (presetName: string) => {
    const preset = PRESETS[presetName as keyof typeof PRESETS];
    if (!preset) return;

    let added = 0;
    for (const code of preset.countries) {
      const country = COUNTRIES.find(c => c.code === code);
      if (!country) continue;
      const exists = geoRules?.find(r => r.country_code === code);
      if (exists) continue;
      try {
        await addRule.mutateAsync({ country_code: code, country_name: country.name, mode: preset.mode });
        added++;
      } catch { /* skip duplicates */ }
    }
    toast({ title: `${added} țări adăugate din preset "${presetName}"` });
  };

  const blacklistRules = geoRules?.filter(r => r.mode === "blacklist") || [];
  const whitelistRules = geoRules?.filter(r => r.mode === "whitelist") || [];
  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  ).filter(c => !geoRules?.find(r => r.country_code === c.code));

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-2 hover:bg-muted/30 transition-colors"
      >
        <Globe className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">GeoIP Blocking</h3>
        <Badge variant="secondary" className="ml-1 text-xs">{geoRules?.length || 0} țări</Badge>
        {blacklistRules.length > 0 && (
          <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-xs">
            <ShieldOff className="h-3 w-3 mr-1" /> {blacklistRules.length} blocate
          </Badge>
        )}
        {whitelistRules.length > 0 && (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
            <Shield className="h-3 w-3 mr-1" /> {whitelistRules.length} permise
          </Badge>
        )}
        <div className="ml-auto">
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Info */}
          <div className="bg-muted/20 rounded-xl p-3 border border-border/30 text-xs text-muted-foreground">
            <strong className="text-foreground">Cum funcționează:</strong> Agentul instalează automat <code className="text-primary">ipset</code> + <code className="text-primary">xtables-addons-common</code> pe server.
            Țările în <span className="text-destructive font-medium">blacklist</span> sunt blocate complet.
            Dacă ai reguli <span className="text-emerald-400 font-medium">whitelist</span>, DOAR acele țări sunt permise.
          </div>

          {/* Quick presets */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Preset-uri rapide:</p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(PRESETS).map(name => (
                <Button key={name} size="sm" variant="outline" onClick={() => applyPreset(name)} className="rounded-xl text-xs">
                  <Zap className="h-3 w-3 mr-1" /> {name}
                </Button>
              ))}
            </div>
          </div>

          {/* Add country */}
          <div className="bg-muted/20 rounded-xl p-3 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex bg-muted rounded-lg p-0.5 text-xs">
                <button
                  className={`px-3 py-1.5 rounded-md transition-all ${addMode === "blacklist" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground"}`}
                  onClick={() => setAddMode("blacklist")}
                >
                  Blacklist
                </button>
                <button
                  className={`px-3 py-1.5 rounded-md transition-all ${addMode === "whitelist" ? "bg-emerald-600 text-white" : "text-muted-foreground"}`}
                  onClick={() => setAddMode("whitelist")}
                >
                  Whitelist
                </button>
              </div>
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Caută țară..."
                  className="pl-8 bg-muted/50 border-border/50 text-sm rounded-xl h-8"
                />
              </div>
            </div>

            {search && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredCountries.slice(0, 20).map(c => (
                  <button
                    key={c.code}
                    onClick={() => addCountry(c.code, c.name)}
                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-2 text-sm"
                  >
                    <span className="text-lg">{flagEmoji(c.code)}</span>
                    <span className="text-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.code}</span>
                    <Badge className={`ml-auto text-xs ${addMode === "blacklist" ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"}`}>
                      {addMode}
                    </Badge>
                  </button>
                ))}
                {filteredCountries.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nicio țară găsită</p>
                )}
              </div>
            )}
          </div>

          {/* Current rules */}
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground animate-pulse-glow text-sm">Se încarcă...</div>
          ) : !geoRules?.length ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nicio regulă GeoIP. Caută o țară mai sus sau folosește un preset.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-xs text-muted-foreground w-10"></TableHead>
                  <TableHead className="text-xs text-muted-foreground">Țara</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Cod</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Mod</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {geoRules.map(rule => (
                  <TableRow key={rule.id} className="border-border/30">
                    <TableCell className="text-lg">{flagEmoji(rule.country_code)}</TableCell>
                    <TableCell className="text-sm text-foreground">{rule.country_name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{rule.country_code}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${rule.mode === "blacklist" ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"}`}>
                        {rule.mode === "blacklist" ? "🚫 Blacklist" : "✅ Whitelist"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleRule.mutate({ id: rule.id, enabled: !rule.enabled })}
                        className="flex items-center gap-1"
                      >
                        {rule.enabled ? (
                          <ToggleRight className="h-5 w-5 text-primary" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className={`text-xs ${rule.enabled ? "text-primary" : "text-muted-foreground"}`}>
                          {rule.enabled ? "Activ" : "Inactiv"}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => deleteRule.mutate(rule.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive rounded-xl"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
};
