import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMyIps } from "@/hooks/useAdmin";
import type { Tables } from "@/integrations/supabase/types";

type FirewallRule = Tables<"firewall_rules">;

interface RuleFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (rule: any) => void;
  editRule?: FirewallRule | null;
  loading?: boolean;
}

const defaults = {
  label: "",
  source_ip: "",
  destination_ip: "",
  port: "",
  port_range: "",
  protocol: "tcp",
  direction: "INPUT",
  action: "ACCEPT",
  priority: 100,
  enabled: true,
  notes: "",
};

export function RuleFormDialog({ open, onClose, onSubmit, editRule, loading }: RuleFormDialogProps) {
  const [form, setForm] = useState(defaults);
  const { data: myIps } = useMyIps();

  useEffect(() => {
    if (editRule) {
      setForm({
        label: editRule.label || "",
        source_ip: editRule.source_ip,
        destination_ip: editRule.destination_ip,
        port: editRule.port?.toString() || "",
        port_range: editRule.port_range || "",
        protocol: editRule.protocol,
        direction: editRule.direction,
        action: editRule.action,
        priority: editRule.priority,
        enabled: editRule.enabled,
        notes: editRule.notes || "",
      });
    } else {
      setForm({
        ...defaults,
        source_ip: myIps?.[0]?.ip_address || "",
        destination_ip: myIps?.[0]?.ip_address || "",
      });
    }
  }, [editRule, open, myIps]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...form,
      port: form.port ? parseInt(form.port) : null,
      port_range: form.port_range || null,
      label: form.label || null,
      notes: form.notes || null,
    });
  };

  const hasIps = myIps && myIps.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass border-border/50 max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground font-semibold">
            {editRule ? "Editare Regulă" : "Regulă Nouă"}
          </DialogTitle>
        </DialogHeader>

        {!hasIps ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground text-sm">Nu ai IP-uri alocate.</p>
            <p className="text-muted-foreground text-xs mt-1">Contactează administratorul pentru a primi IP-uri.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Etichetă</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="mt-1.5 bg-muted/50 border-border/50 text-sm rounded-xl"
                placeholder="ex: Allow SSH"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">IP Sursă</Label>
                <Select value={form.source_ip} onValueChange={(v) => setForm({ ...form, source_ip: v })}>
                  <SelectTrigger className="mt-1.5 bg-muted/50 border-border/50 text-sm rounded-xl">
                    <SelectValue placeholder="Selectează IP" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50 rounded-xl">
                    <SelectItem value="0.0.0.0/0">0.0.0.0/0 (Orice)</SelectItem>
                    {myIps?.map((ip) => (
                      <SelectItem key={ip.id} value={ip.ip_address}>
                        {ip.ip_address} {ip.label ? `(${ip.label})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">IP Destinație</Label>
                <Select value={form.destination_ip} onValueChange={(v) => setForm({ ...form, destination_ip: v })}>
                  <SelectTrigger className="mt-1.5 bg-muted/50 border-border/50 text-sm rounded-xl">
                    <SelectValue placeholder="Selectează IP" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50 rounded-xl">
                    <SelectItem value="0.0.0.0/0">0.0.0.0/0 (Orice)</SelectItem>
                    {myIps?.map((ip) => (
                      <SelectItem key={ip.id} value={ip.ip_address}>
                        {ip.ip_address} {ip.label ? `(${ip.label})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Port</Label>
                <Input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: e.target.value })}
                  className="mt-1.5 bg-muted/50 border-border/50 text-sm rounded-xl"
                  placeholder="ex: 22"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Interval Porturi</Label>
                <Input
                  value={form.port_range}
                  onChange={(e) => setForm({ ...form, port_range: e.target.value })}
                  className="mt-1.5 bg-muted/50 border-border/50 text-sm rounded-xl"
                  placeholder="ex: 8000-9000"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Protocol</Label>
                <Select value={form.protocol} onValueChange={(v) => setForm({ ...form, protocol: v })}>
                  <SelectTrigger className="mt-1.5 bg-muted/50 border-border/50 text-sm rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50 rounded-xl">
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="udp">UDP</SelectItem>
                    <SelectItem value="icmp">ICMP</SelectItem>
                    <SelectItem value="all">ALL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Direcție</Label>
                <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                  <SelectTrigger className="mt-1.5 bg-muted/50 border-border/50 text-sm rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50 rounded-xl">
                    <SelectItem value="INPUT">INPUT</SelectItem>
                    <SelectItem value="OUTPUT">OUTPUT</SelectItem>
                    <SelectItem value="FORWARD">FORWARD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Acțiune</Label>
                <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                  <SelectTrigger className="mt-1.5 bg-muted/50 border-border/50 text-sm rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50 rounded-xl">
                    <SelectItem value="ACCEPT">ACCEPT</SelectItem>
                    <SelectItem value="DROP">DROP</SelectItem>
                    <SelectItem value="REJECT">REJECT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label className="text-xs text-muted-foreground">Prioritate</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                  className="mt-1.5 bg-muted/50 border-border/50 text-sm rounded-xl"
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                />
                <Label className="text-xs text-muted-foreground">Activă</Label>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Note</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1.5 bg-muted/50 border-border/50 text-sm rounded-xl"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">
                Anulare
              </Button>
              <Button type="submit" className="flex-1 rounded-xl gradient-btn text-primary-foreground border-0 hover:opacity-90" disabled={loading}>
                {loading ? "..." : editRule ? "Salvare" : "Adaugă"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
