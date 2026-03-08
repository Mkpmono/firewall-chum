import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bot, Plus, Trash2, Search, Shield, Zap } from "lucide-react";

const COMMON_BOTS = [
  { pattern: "AhrefsBot", label: "Ahrefs SEO Crawler" },
  { pattern: "SemrushBot", label: "Semrush SEO Bot" },
  { pattern: "MJ12bot", label: "Majestic SEO Bot" },
  { pattern: "DotBot", label: "DotBot Crawler" },
  { pattern: "BLEXBot", label: "BLEXBot Crawler" },
  { pattern: "PetalBot", label: "Huawei PetalBot" },
  { pattern: "YandexBot", label: "Yandex Crawler" },
  { pattern: "Baiduspider", label: "Baidu Spider" },
  { pattern: "MegaIndex", label: "MegaIndex Crawler" },
  { pattern: "Sogou", label: "Sogou Bot" },
  { pattern: "GPTBot", label: "OpenAI GPTBot" },
  { pattern: "CCBot", label: "Common Crawl Bot" },
  { pattern: "anthropic-ai", label: "Anthropic AI Bot" },
  { pattern: "ClaudeBot", label: "Claude AI Bot" },
  { pattern: "Google-Extended", label: "Google AI Training" },
  { pattern: "Bytespider", label: "ByteDance Spider" },
  { pattern: "Scrapy", label: "Scrapy Framework" },
  { pattern: "python-requests", label: "Python Requests" },
  { pattern: "Go-http-client", label: "Go HTTP Client" },
  { pattern: "curl/", label: "cURL" },
  { pattern: "wget/", label: "Wget" },
  { pattern: "nikto", label: "Nikto Scanner" },
  { pattern: "sqlmap", label: "SQLMap Scanner" },
  { pattern: "nmap", label: "Nmap Scanner" },
  { pattern: "masscan", label: "Masscan Scanner" },
  { pattern: "ZmEu", label: "ZmEu Exploit Bot" },
  { pattern: "Jorgee", label: "Jorgee Scanner" },
];

const QUICK_PRESETS = [
  {
    name: "🤖 Blochează AI Crawlers",
    patterns: ["GPTBot", "CCBot", "anthropic-ai", "ClaudeBot", "Google-Extended", "Bytespider"],
  },
  {
    name: "🔍 Blochează SEO Bots",
    patterns: ["AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "BLEXBot", "PetalBot", "MegaIndex"],
  },
  {
    name: "🛡️ Blochează Scannere",
    patterns: ["nikto", "sqlmap", "nmap", "masscan", "ZmEu", "Jorgee"],
  },
  {
    name: "🌏 Blochează Boți Non-US/EU",
    patterns: ["YandexBot", "Baiduspider", "Sogou", "Bytespider", "PetalBot"],
  },
];

export function UserAgentManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [customPattern, setCustomPattern] = useState("");
  const [customLabel, setCustomLabel] = useState("");

  const { data: rules, isLoading } = useQuery({
    queryKey: ["useragent_rules", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("useragent_rules")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addRule = useMutation({
    mutationFn: async ({ pattern, label }: { pattern: string; label?: string }) => {
      const { error } = await supabase
        .from("useragent_rules")
        .insert({ user_id: user!.id, pattern, label: label || null });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["useragent_rules"] }),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("useragent_rules")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["useragent_rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("useragent_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["useragent_rules"] }),
  });

  const existingPatterns = new Set(rules?.map((r) => r.pattern.toLowerCase()) || []);

  const handleAddBot = async (pattern: string, label?: string) => {
    if (existingPatterns.has(pattern.toLowerCase())) {
      toast({ title: "Deja adăugat", variant: "destructive" });
      return;
    }
    try {
      await addRule.mutateAsync({ pattern, label });
      toast({ title: `Bot blocat: ${pattern}` });
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    }
  };

  const handlePreset = async (preset: typeof QUICK_PRESETS[0]) => {
    let added = 0;
    for (const p of preset.patterns) {
      if (!existingPatterns.has(p.toLowerCase())) {
        const bot = COMMON_BOTS.find((b) => b.pattern === p);
        try {
          await addRule.mutateAsync({ pattern: p, label: bot?.label });
          added++;
        } catch { /* skip */ }
      }
    }
    toast({ title: `${added} reguli adăugate din "${preset.name}"` });
  };

  const handleCustomAdd = async () => {
    if (!customPattern.trim()) return;
    await handleAddBot(customPattern.trim(), customLabel.trim() || undefined);
    setCustomPattern("");
    setCustomLabel("");
  };

  const filteredBots = COMMON_BOTS.filter(
    (b) =>
      !existingPatterns.has(b.pattern.toLowerCase()) &&
      (b.pattern.toLowerCase().includes(search.toLowerCase()) ||
        b.label.toLowerCase().includes(search.toLowerCase()))
  );

  const activeCount = rules?.filter((r) => r.enabled).length || 0;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">User-Agent Blocking</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {activeCount} active
        </Badge>
      </div>

      {/* Quick Presets */}
      <div className="p-4 border-b border-border/30 bg-muted/10">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Preset-uri rapide:</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              onClick={() => handlePreset(preset)}
              disabled={addRule.isPending}
              className="rounded-xl text-xs h-8"
            >
              <Zap className="h-3 w-3 mr-1" />
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom add */}
      <div className="p-4 border-b border-border/30 bg-muted/20">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Adaugă pattern custom:</p>
        <div className="flex gap-2">
          <Input
            value={customPattern}
            onChange={(e) => setCustomPattern(e.target.value)}
            placeholder="ex: BadBot/1.0"
            className="bg-muted/50 border-border/50 text-sm rounded-xl flex-1"
          />
          <Input
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Etichetă (opțional)"
            className="bg-muted/50 border-border/50 text-sm rounded-xl flex-1"
          />
          <Button
            size="sm"
            onClick={handleCustomAdd}
            disabled={addRule.isPending || !customPattern.trim()}
            className="rounded-xl gradient-btn text-primary-foreground border-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adaugă
          </Button>
        </div>
      </div>

      {/* Active rules */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse-glow">Se încarcă...</div>
      ) : rules && rules.length > 0 ? (
        <div className="divide-y divide-border/20 max-h-64 overflow-y-auto">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-3 px-4 py-2.5 group hover:bg-muted/20 transition-colors">
              <Switch
                checked={rule.enabled}
                onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, enabled: checked })}
                className="scale-75"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-mono ${rule.enabled ? "text-foreground" : "text-muted-foreground line-through"}`}>
                  {rule.pattern}
                </p>
                {rule.label && (
                  <p className="text-xs text-muted-foreground">{rule.label}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteRule.mutate(rule.id)}
                className="h-7 w-7 text-destructive hover:text-destructive rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center text-muted-foreground text-sm">
          Niciun User-Agent blocat. Folosește preset-urile sau adaugă manual.
        </div>
      )}

      {/* Common bots library */}
      <div className="border-t border-border/50">
        <div className="p-3 bg-muted/10 flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-medium">Librărie boți cunoscuți</p>
          <div className="ml-auto relative">
            <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută..."
              className="h-7 pl-7 w-40 bg-muted/50 border-border/50 text-xs rounded-lg"
            />
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto divide-y divide-border/10">
          {filteredBots.map((bot) => (
            <div key={bot.pattern} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-foreground">{bot.pattern}</p>
                <p className="text-[10px] text-muted-foreground">{bot.label}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddBot(bot.pattern, bot.label)}
                disabled={addRule.isPending}
                className="h-6 text-[10px] rounded-md px-2"
              >
                <Plus className="h-2.5 w-2.5 mr-0.5" /> Blochează
              </Button>
            </div>
          ))}
          {filteredBots.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {search ? "Niciun rezultat" : "Toți boții sunt deja blocați! 🎉"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
