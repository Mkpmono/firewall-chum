import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Ban,
  Plus,
  Trash2,
  ShieldOff,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const IpBanManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("permanent");

  const { data: bans, isLoading } = useQuery({
    queryKey: ["ip_bans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ip_bans" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const addBan = useMutation({
    mutationFn: async (ban: {
      ip_address: string;
      reason: string;
      expires_at: string | null;
    }) => {
      const { error } = await supabase.from("ip_bans" as any).insert({
        user_id: user!.id,
        ip_address: ban.ip_address,
        reason: ban.reason || null,
        expires_at: ban.expires_at,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip_bans"] });
      toast({ title: "IP banat cu succes!" });
      setDialogOpen(false);
      setNewIp("");
      setReason("");
      setDuration("permanent");
    },
    onError: (err: any) =>
      toast({
        title: "Eroare",
        description: err.message,
        variant: "destructive",
      }),
  });

  const deleteBan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ip_bans" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip_bans"] });
      toast({ title: "IP debanat!" });
    },
    onError: (err: any) =>
      toast({
        title: "Eroare",
        description: err.message,
        variant: "destructive",
      }),
  });

  const toggleBan = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("ip_bans" as any)
        .update({ enabled } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip_bans"] });
    },
    onError: (err: any) =>
      toast({
        title: "Eroare",
        description: err.message,
        variant: "destructive",
      }),
  });

  const handleAdd = () => {
    if (!newIp.trim()) {
      toast({
        title: "Introdu un IP",
        variant: "destructive",
      });
      return;
    }

    // Validate IP format
    const ipRegex =
      /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(newIp.trim())) {
      toast({
        title: "Format IP invalid",
        description: "Folosește format: 1.2.3.4 sau 1.2.3.0/24",
        variant: "destructive",
      });
      return;
    }

    let expiresAt: string | null = null;
    if (duration !== "permanent") {
      const hours = parseInt(duration);
      const d = new Date();
      d.setHours(d.getHours() + hours);
      expiresAt = d.toISOString();
    }

    addBan.mutate({
      ip_address: newIp.trim(),
      reason: reason.trim(),
      expires_at: expiresAt,
    });
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return "Permanent";
    const d = new Date(expiresAt);
    if (d < new Date()) return "Expirat";
    return d.toLocaleString("ro-RO");
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Ban className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">
            IP Ban / Unban (iptables)
          </h3>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="rounded-xl gradient-btn text-primary-foreground border-0 hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Ban IP
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        IP-urile banate vor fi aplicate automat prin iptables pe serverele
        conectate la următoarea sincronizare.
      </p>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground animate-pulse-glow">
          Se încarcă...
        </div>
      ) : !bans || bans.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <ShieldOff className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Niciun IP banat</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bans.map((ban: any) => (
            <div
              key={ban.id}
              className={`flex items-center justify-between p-3 rounded-xl border ${
                !ban.enabled || isExpired(ban.expires_at)
                  ? "border-border/30 opacity-60"
                  : "border-destructive/30 bg-destructive/5"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Switch
                  checked={ban.enabled && !isExpired(ban.expires_at)}
                  onCheckedChange={(checked) =>
                    toggleBan.mutate({ id: ban.id, enabled: checked })
                  }
                  disabled={isExpired(ban.expires_at)}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-foreground">
                      {ban.ip_address}
                    </code>
                    {isExpired(ban.expires_at) && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-muted-foreground/30"
                      >
                        EXPIRAT
                      </Badge>
                    )}
                    {ban.enabled && !isExpired(ban.expires_at) && (
                      <Badge
                        variant="destructive"
                        className="text-[10px]"
                      >
                        BANAT
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {ban.reason && <span>{ban.reason}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatExpiry(ban.expires_at)}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteBan.mutate(ban.id)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Ban Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Ban IP Address
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Adresă IP</Label>
              <Input
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                placeholder="ex: 192.168.1.100 sau 10.0.0.0/24"
                className="font-mono mt-1"
              />
            </div>

            <div>
              <Label>Motiv (opțional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ex: Atac brute-force, spam, etc."
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label>Durată ban</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 oră</SelectItem>
                  <SelectItem value="6">6 ore</SelectItem>
                  <SelectItem value="24">24 ore</SelectItem>
                  <SelectItem value="72">3 zile</SelectItem>
                  <SelectItem value="168">7 zile</SelectItem>
                  <SelectItem value="720">30 zile</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border/50">
              <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                IP-ul va fi blocat prin{" "}
                <code className="text-foreground">iptables -A INPUT -s IP -j DROP</code>{" "}
                pe toate serverele conectate la următoarea sincronizare (max 5 min).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl"
            >
              Anulează
            </Button>
            <Button
              onClick={handleAdd}
              disabled={addBan.isPending}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {addBan.isPending ? "Se banează..." : "Ban IP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IpBanManager;
