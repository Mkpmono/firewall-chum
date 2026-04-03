import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Activity, Globe, ArrowDownRight, Ban, Zap } from "lucide-react";

interface DdosEvent {
  id: string;
  user_id: string;
  ip_address: string;
  attack_type: string;
  source_ips: string[];
  packets_blocked: number;
  packets_redirected: number;
  severity: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

export function DdosMonitoring() {
  const { user } = useAuth();
  const { data: myProfile } = useMyProfile();
  const [events, setEvents] = useState<DdosEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDdos = (myProfile as any)?.ddos_protection === true;
  const ddosTier = (myProfile as any)?.ddos_tier || "standard";
  const isPremium = ddosTier === "premium";
  

  useEffect(() => {
    if (!user) return;
    const fetchEvents = async () => {
      const { data } = await supabase
        .from("ddos_events")
        .select("*")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(50);
      setEvents((data as any) || []);
      setLoading(false);
    };
    fetchEvents();

    const channel = supabase
      .channel("ddos-monitor")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ddos_events", filter: `user_id=eq.${user.id}` },
        () => fetchEvents()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const activeAttacks = events.filter((e) => e.status === "active");
  const totalBlocked = events.reduce((sum, e) => sum + (e.packets_blocked || 0), 0);
  const totalRedirected = events.reduce((sum, e) => sum + (e.packets_redirected || 0), 0);
  const uniqueSourceIps = new Set(events.flatMap((e) => e.source_ips || [])).size;

  const severityColor = (s: string) => {
    if (s === "critical") return "bg-destructive text-destructive-foreground";
    if (s === "high") return "bg-[hsl(var(--warning))] text-primary-foreground";
    if (s === "medium") return "bg-secondary text-secondary-foreground";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">DDoS Monitoring</h2>
        <Badge className={isPremium ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : hasDdos ? "gradient-btn text-primary-foreground border-0" : "bg-muted text-muted-foreground border-border/50"}>
          {isPremium ? "⭐ PREMIUM" : hasDdos ? "STANDARD" : "INACTIV"}
        </Badge>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="glass border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Atacuri Active</span>
            </div>
            <p className={`text-2xl font-bold ${activeAttacks.length > 0 ? "text-destructive" : "text-foreground"}`}>
              {activeAttacks.length}
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Ban className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Pachete Blocate</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalBlocked.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="glass border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Null-Route Auto</span>
            </div>
            <p className={`text-2xl font-bold ${hasDdos ? "text-primary" : "text-muted-foreground"}`}>
              {hasDdos ? "ON" : "OFF"}
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">IP-uri Sursă</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{uniqueSourceIps}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sinkhole info removed - visible only in admin panel */}

      {/* Events list */}
      <Card className="glass border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Istoric Evenimente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground animate-pulse-glow py-4 text-center">Se încarcă...</p>
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck className="h-10 w-10 text-primary/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Niciun eveniment DDoS detectat</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Sistemul monitorizează traficul în timp real</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge className={severityColor(ev.severity)} variant="secondary">
                      {ev.severity}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ev.attack_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {ev.ip_address} • {new Date(ev.started_at).toLocaleString("ro-RO")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs text-muted-foreground">{(ev.packets_blocked || 0).toLocaleString()} blocate</p>
                    <Badge variant={ev.status === "active" ? "destructive" : "secondary"} className="text-[10px]">
                      {ev.status === "active" ? "ACTIV" : "REZOLVAT"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
