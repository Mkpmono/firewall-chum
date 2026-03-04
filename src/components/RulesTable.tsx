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
  ACCEPT: "bg-primary/20 text-primary border-primary/30",
  DROP: "bg-destructive/20 text-destructive border-destructive/30",
  REJECT: "bg-warning/20 text-warning border-warning/30",
};

export function RulesTable({ rules, onEdit, onDelete, onToggle, readOnly }: RulesTableProps) {
  if (rules.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground font-mono">
        <p className="text-lg">Nicio regulă definită</p>
        <p className="text-sm mt-1">Adaugă prima ta regulă de firewall</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="font-mono text-xs text-muted-foreground">STATUS</TableHead>
            <TableHead className="font-mono text-xs text-muted-foreground">PRI</TableHead>
            <TableHead className="font-mono text-xs text-muted-foreground">ETICHETĂ</TableHead>
            <TableHead className="font-mono text-xs text-muted-foreground">DIRECȚIE</TableHead>
            <TableHead className="font-mono text-xs text-muted-foreground">PROTOCOL</TableHead>
            <TableHead className="font-mono text-xs text-muted-foreground">IP SURSĂ</TableHead>
            <TableHead className="font-mono text-xs text-muted-foreground">IP DEST.</TableHead>
            <TableHead className="font-mono text-xs text-muted-foreground">PORT</TableHead>
            <TableHead className="font-mono text-xs text-muted-foreground">ACȚIUNE</TableHead>
            {!readOnly && <TableHead className="font-mono text-xs text-muted-foreground text-right">OPȚIUNI</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow
              key={rule.id}
              className={`border-border transition-opacity ${!rule.enabled ? "opacity-40" : ""}`}
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
              <TableCell className="font-mono text-sm">{rule.label || "—"}</TableCell>
              <TableCell>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  {rule.direction}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs uppercase">{rule.protocol}</TableCell>
              <TableCell className="font-mono text-xs">{rule.source_ip}</TableCell>
              <TableCell className="font-mono text-xs">{rule.destination_ip}</TableCell>
              <TableCell className="font-mono text-xs">
                {rule.port || rule.port_range || "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={`font-mono text-xs ${actionColors[rule.action] || ""}`}>
                  {rule.action}
                </Badge>
              </TableCell>
              {!readOnly && (
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(rule)} className="h-7 w-7">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(rule.id)} className="h-7 w-7 text-destructive hover:text-destructive">
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
