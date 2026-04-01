import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Server, Plus, Trash2, Copy, Terminal, RefreshCw, CheckCircle, XCircle, Clock, HardDrive,
} from "lucide-react";

const PANEL_OPTIONS = [
  { id: "virtualizor", name: "Virtualizor KVM" },
  { id: "solusvm", name: "SolusVM" },
  { id: "proxmox", name: "Proxmox VE" },
  { id: "virtuozzo", name: "Virtuozzo" },
  { id: "xenorchestra", name: "XenOrchestra" },
  { id: "ovirt", name: "oVirt" },
  { id: "cpanel_whm", name: "cPanel/WHM" },
  { id: "plesk", name: "Plesk" },
  { id: "directadmin", name: "DirectAdmin" },
  { id: "cyberpanel", name: "CyberPanel" },
  { id: "hestia", name: "HestiaCP" },
  { id: "cloudpanel", name: "CloudPanel" },
  { id: "pterodactyl", name: "Pterodactyl" },
  { id: "gamecp", name: "GameCP" },
  { id: "dedicated", name: "Server Dedicat" },
  { id: "other", name: "Altul" },
];

function useClientServers(userId: string) {
  return useQuery({
    queryKey: ["servers", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servers")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function useServerMutations() {
  const qc = useQueryClient();

  const addServer = useMutation({
    mutationFn: async (server: { user_id: string; hostname: string; label?: string; panel_type: string }) => {
      const { data, error } = await supabase
        .from("servers")
        .insert(server)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["servers", v.user_id] }),
  });

  const deleteServer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("servers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers"] }),
  });

  return { addServer, deleteServer };
}

function StatusBadge({ status }: { status: string }) {
  if (status === "online") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" />Online</Badge>;
  if (status === "error") return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Eroare</Badge>;
  return <Badge variant="secondary" className="text-[10px]"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
}

export function ClientServersSection({ userId }: { userId: string }) {
  const { data: servers, isLoading } = useClientServers(userId);
  const { addServer, deleteServer } = useServerMutations();
  const [hostname, setHostname] = useState("");
  const [label, setLabel] = useState("");
  const [panelType, setPanelType] = useState("virtualizor");
  const [installDialog, setInstallDialog] = useState<string | null>(null);
  const { toast } = useToast();

  const selectedServer = servers?.find(s => s.id === installDialog);

  const handleAdd = async () => {
    if (!hostname.trim()) return;
    try {
      await addServer.mutateAsync({ user_id: userId, hostname: hostname.trim(), label: label.trim() || undefined, panel_type: panelType });
      setHostname("");
      setLabel("");
      toast({ title: "Server adăugat!" });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteServer.mutateAsync(id);
      toast({ title: "Server șters!" });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiat în clipboard!" });
  };

  const getInstallCommand = (apiKey: string) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "isexcruagudlsjpcutok";
    return `curl -sfL -H "x-server-key: ${apiKey}" "https://${projectId}.supabase.co/functions/v1/agent-sync?action=installer" | bash`;
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center gap-2">
        <Server className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Servere</h3>
        <Badge variant="secondary" className="ml-auto text-xs">{servers?.length || 0}</Badge>
      </div>

      {/* Add form */}
      <div className="p-4 border-b border-border/30 bg-muted/20">
        <div className="flex gap-2 flex-wrap">
          <Input value={hostname} onChange={e => setHostname(e.target.value)} placeholder="Hostname / IP server" className="bg-muted/50 border-border/50 text-sm rounded-xl flex-1 min-w-[140px]" />
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Etichetă (opțional)" className="bg-muted/50 border-border/50 text-sm rounded-xl flex-1 min-w-[120px]" />
          <Select value={panelType} onValueChange={setPanelType}>
            <SelectTrigger className="w-[180px] bg-muted/50 border-border/50 text-sm rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PANEL_OPTIONS.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAdd} disabled={addServer.isPending} className="rounded-xl gradient-btn text-primary-foreground border-0">
            <Plus className="h-3.5 w-3.5 mr-1" /> Adaugă
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse-glow">Se încarcă...</div>
      ) : !servers?.length ? (
        <div className="p-8 text-center text-muted-foreground text-sm">Niciun server adăugat</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="text-xs text-muted-foreground">Server</TableHead>
              <TableHead className="text-xs text-muted-foreground">Panou</TableHead>
              <TableHead className="text-xs text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs text-muted-foreground">Ultimul Sync</TableHead>
              <TableHead className="text-xs text-muted-foreground text-right">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servers.map(s => (
              <TableRow key={s.id} className="border-border/30">
                <TableCell>
                  <div>
                    <p className="font-mono text-sm text-primary">{s.hostname}</p>
                    {s.label && <p className="text-xs text-muted-foreground">{s.label}</p>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {PANEL_OPTIONS.find(p => p.id === s.panel_type)?.name || s.panel_type}
                  </Badge>
                </TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {s.last_sync_at ? new Date(s.last_sync_at).toLocaleString("ro-RO") : "—"}
                  {s.os_info && <p className="text-[10px] text-muted-foreground/70">{s.os_info}</p>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setInstallDialog(s.id)} className="h-8 w-8 rounded-xl" title="Instalare agent">
                      <Terminal className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive rounded-xl">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass border-border/50 rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Șterge serverul?</AlertDialogTitle>
                          <AlertDialogDescription>Agentul de pe server nu va mai primi reguli.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Anulare</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(s.id)} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Șterge</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Install dialog */}
      <Dialog open={!!installDialog} onOpenChange={() => setInstallDialog(null)}>
        <DialogContent className="glass border-border/50 rounded-2xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Instalare Agent - {selectedServer?.hostname}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Rulează această comandă pe server ca <code className="text-primary">root</code>:
              </p>
              <div className="bg-muted/50 rounded-xl p-3 font-mono text-xs break-all border border-border/50 relative">
                {selectedServer && getInstallCommand(selectedServer.api_key)}
                <Button
                  variant="ghost" size="icon"
                  className="absolute top-2 right-2 h-7 w-7 rounded-lg"
                  onClick={() => selectedServer && copyToClipboard(getInstallCommand(selectedServer.api_key))}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>✅ <strong>Auto-detect</strong> tipul serverului și configurare automată porturi</p>
              <p>✅ <strong>VPS</strong>: Virtualizor KVM, SolusVM, Proxmox, Virtuozzo, XenOrchestra, oVirt</p>
              <p>✅ <strong>Web Hosting</strong>: cPanel/WHM, Plesk, DirectAdmin, CyberPanel, HestiaCP, CloudPanel</p>
              <p>✅ <strong>Game Panels</strong>: Pterodactyl, GameCP (CS, Minecraft, FiveM, ARK, Rust, TeamSpeak)</p>
              <p>✅ <strong>Dedicated</strong>: Servere bare-metal din data center</p>
              <p className="mt-2">🔄 Agentul sincronizează regulile automat la fiecare <strong>5 minute</strong> via cron.</p>
              <p>📦 Instalare automată: iptables, ipset, fail2ban, GeoIP</p>
              <p>📋 Loguri: <code className="text-primary">/var/log/hoxta-firewall.log</code></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Server API Key:</p>
              <div className="flex items-center gap-2">
                <code className="bg-muted/50 rounded-lg px-2 py-1 text-xs font-mono text-primary border border-border/50 flex-1 truncate">
                  {selectedServer?.api_key}
                </code>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg shrink-0" onClick={() => selectedServer && copyToClipboard(selectedServer.api_key)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
