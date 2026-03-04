import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useFirewallRules } from "@/hooks/useFirewallRules";
import { RulesTable } from "@/components/RulesTable";
import { RuleFormDialog } from "@/components/RuleFormDialog";
import { Button } from "@/components/ui/button";
import { Shield, Plus, LogOut, RefreshCw, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type FirewallRule = Tables<"firewall_rules">;

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const { data: rules, isLoading, refetch, addRule, updateRule, deleteRule, toggleRule } = useFirewallRules();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null);
  const { toast } = useToast();

  const handleAdd = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleEdit = (rule: FirewallRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingRule) {
        await updateRule.mutateAsync({ id: editingRule.id, ...data });
        toast({ title: "Regulă actualizată!" });
      } else {
        await addRule.mutateAsync(data);
        toast({ title: "Regulă adăugată!" });
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRule.mutateAsync(id);
      toast({ title: "Regulă ștearsă!" });
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleRule.mutateAsync({ id, enabled });
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    }
  };

  const activeCount = rules?.filter((r) => r.enabled).length || 0;
  const totalCount = rules?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-mono font-bold text-foreground text-sm">
              FIREWALL<span className="text-primary">PANEL</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground hidden sm:block">
              {user?.email}
            </span>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")} className="font-mono text-xs">
                <Settings className="h-3.5 w-3.5 mr-1" />
                ADMIN
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => signOut()} className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-mono text-muted-foreground">TOTAL REGULI</p>
            <p className="text-2xl font-mono font-bold text-foreground">{totalCount}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-mono text-muted-foreground">ACTIVE</p>
            <p className="text-2xl font-mono font-bold text-primary">{activeCount}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 hidden sm:block">
            <p className="text-xs font-mono text-muted-foreground">INACTIVE</p>
            <p className="text-2xl font-mono font-bold text-muted-foreground">{totalCount - activeCount}</p>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-mono font-semibold text-foreground">Reguli Firewall</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="font-mono">
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              REFRESH
            </Button>
            <Button size="sm" onClick={handleAdd} className="font-mono">
              <Plus className="h-3.5 w-3.5 mr-1" />
              REGULĂ NOUĂ
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground font-mono animate-pulse-glow">
              Se încarcă...
            </div>
          ) : (
            <RulesTable
              rules={rules || []}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          )}
        </div>
      </main>

      {/* Dialog */}
      <RuleFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        editRule={editingRule}
        loading={addRule.isPending || updateRule.isPending}
      />
    </div>
  );
};

export default Dashboard;
