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
  source_ip: "0.0.0.0/0",
  destination_ip: "0.0.0.0/0",
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
      setForm(defaults);
    }
  }, [editRule, open]);

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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-foreground">
            {editRule ? "EDITARE REGULĂ" : "REGULĂ NOUĂ"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Label */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground">ETICHETĂ</Label>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="mt-1 bg-muted border-border font-mono text-sm"
              placeholder="ex: Allow SSH"
            />
          </div>

          {/* IPs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">IP SURSĂ</Label>
              <Input
                value={form.source_ip}
                onChange={(e) => setForm({ ...form, source_ip: e.target.value })}
                className="mt-1 bg-muted border-border font-mono text-sm"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">IP DESTINAȚIE</Label>
              <Input
                value={form.destination_ip}
                onChange={(e) => setForm({ ...form, destination_ip: e.target.value })}
                className="mt-1 bg-muted border-border font-mono text-sm"
                required
              />
            </div>
          </div>

          {/* Port */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">PORT</Label>
              <Input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
                className="mt-1 bg-muted border-border font-mono text-sm"
                placeholder="ex: 22"
              />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">INTERVAL PORTURI</Label>
              <Input
                value={form.port_range}
                onChange={(e) => setForm({ ...form, port_range: e.target.value })}
                className="mt-1 bg-muted border-border font-mono text-sm"
                placeholder="ex: 8000-9000"
              />
            </div>
          </div>

          {/* Protocol, Direction, Action */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">PROTOCOL</Label>
              <Select value={form.protocol} onValueChange={(v) => setForm({ ...form, protocol: v })}>
                <SelectTrigger className="mt-1 bg-muted border-border font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="udp">UDP</SelectItem>
                  <SelectItem value="icmp">ICMP</SelectItem>
                  <SelectItem value="all">ALL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">DIRECȚIE</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                <SelectTrigger className="mt-1 bg-muted border-border font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="INPUT">INPUT</SelectItem>
                  <SelectItem value="OUTPUT">OUTPUT</SelectItem>
                  <SelectItem value="FORWARD">FORWARD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">ACȚIUNE</Label>
              <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                <SelectTrigger className="mt-1 bg-muted border-border font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="ACCEPT">ACCEPT</SelectItem>
                  <SelectItem value="DROP">DROP</SelectItem>
                  <SelectItem value="REJECT">REJECT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority + Enabled */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">PRIORITATE</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                className="mt-1 bg-muted border-border font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
              <Label className="text-xs font-mono text-muted-foreground">ACTIVĂ</Label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground">NOTE</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 bg-muted border-border font-mono text-sm"
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 font-mono">
              ANULARE
            </Button>
            <Button type="submit" className="flex-1 font-mono" disabled={loading}>
              {loading ? "..." : editRule ? "SALVARE" : "ADAUGĂ"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
