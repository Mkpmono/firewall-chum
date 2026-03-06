import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type FirewallRule = Tables<"firewall_rules">;

interface RulesTableProps {
  rules: FirewallRule[];
  onEdit: (rule: FirewallRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  readOnly?: boolean;
}

const actionColors: Record<string, string> = {
  ACCEPT: "bg-primary/15 text-primary border-primary/30",
  DROP: "bg-destructive/15 text-destructive border-destructive/30",
  REJECT: "bg-warning/15 text-warning border-warning/30",
};

export function RulesTable({ rules, onEdit, onDelete, onToggle, readOnly }: RulesTableProps) {
  if (rules.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">Nicio regulă definită</p>
        <p className="text-sm mt-1">Adaugă prima ta regulă de firewall</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border/30 hover:bg-transparent">
            <TableHead className="text-xs text-muted-foreground font-medium">Status</TableHead>
            <TableHead className="text-xs text-muted-foreground font-medium">Pri</TableHead>
            <TableHead className="text-xs text-muted-foreground font-medium">Etichetă</TableHead>
            <TableHead className="text-xs text-muted-foreground font-medium">Direcție</TableHead>
            <TableHead className="text-xs text-muted-foreground font-medium">Protocol</TableHead>
            <TableHead className="text-xs text-muted-foreground font-medium">IP Sursă</TableHead>
            <TableHead className="text-xs text-muted-foreground font-medium">IP Dest.</TableHead>
            <TableHead className="text-xs text-muted-foreground font-medium">Port</TableHead>
            <TableHead className="text-xs text-muted-foreground font-medium">Acțiune</TableHead>
            {!readOnly && <TableHead className="text-xs text-muted-foreground font-medium text-right">Opțiuni</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow
              key={rule.id}
              className={`border-border/30 transition-opacity ${!rule.enabled ? "opacity-40" : ""}`}
            >
              <TableCell>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(v) => onToggle(rule.id, v)}
                  className="scale-75"
                  disabled={readOnly}
                />
              </TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">{rule.priority}</TableCell>
              <TableCell className="text-sm font-medium">{rule.label || "—"}</TableCell>
              <TableCell>
                <span className="text-xs px-2 py-1 rounded-lg bg-secondary text-secondary-foreground">
                  {rule.direction}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs uppercase text-muted-foreground">{rule.protocol}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{rule.source_ip}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{rule.destination_ip}</TableCell>
              <TableCell className="font-mono text-xs">
                {rule.port || rule.port_range || "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={`text-xs ${actionColors[rule.action] || ""}`}>
                  {rule.action}
                </Badge>
              </TableCell>
              {!readOnly && (
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(rule)} className="h-8 w-8 rounded-xl">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(rule.id)} className="h-8 w-8 rounded-xl text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
