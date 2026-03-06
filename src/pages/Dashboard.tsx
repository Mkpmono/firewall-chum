import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useFirewallRules } from "@/hooks/useFirewallRules";
import { RulesTable } from "@/components/RulesTable";
import { RuleFormDialog } from "@/components/RuleFormDialog";
import { PresetRulesDialog } from "@/components/PresetRulesDialog";
import { Button } from "@/components/ui/button";
import { Shield, Plus, LogOut, RefreshCw, Settings, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type FirewallRule = Tables<"firewall_rules">;

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const { data: rules, isLoading, refetch, addRule, updateRule, deleteRule, toggleRule } = useFirewallRules();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null);
  const { toast } = useToast();

  const handleApplyPreset = async (rules: any[], selectedIp: string) => {
    setPresetLoading(true);
    try {
      for (const rule of rules) {
        await addRule.mutateAsync({
          ...rule,
          source_ip: "0.0.0.0/0",
          destination_ip: selectedIp,
        });
      }
      toast({ title: `${rules.length} reguli adăugate cu succes!` });
      setPresetOpen(false);
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    } finally {
      setPresetLoading(false);
    }
  };

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
      <header className="border-b border-border/50 glass sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground text-lg">
              Ho<span className="gradient-text">x</span>ta
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {user?.email}
            </span>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")} className="rounded-xl text-xs">
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Admin
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => signOut()} className="h-9 w-9 rounded-xl">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Total Reguli</p>
            <p className="text-3xl font-bold text-foreground">{totalCount}</p>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Active</p>
            <p className="text-3xl font-bold gradient-text">{activeCount}</p>
          </div>
          <div className="glass rounded-2xl p-5 hidden sm:block">
            <p className="text-xs text-muted-foreground mb-1">Inactive</p>
            <p className="text-3xl font-bold text-muted-foreground">{totalCount - activeCount}</p>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Reguli Firewall</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-xl">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPresetOpen(true)} className="rounded-xl">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Preset-uri
            </Button>
            <Button size="sm" onClick={handleAdd} className="rounded-xl gradient-btn text-primary-foreground border-0 hover:opacity-90">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Regulă Nouă
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground animate-pulse-glow">
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

      <RuleFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        editRule={editingRule}
        loading={addRule.isPending || updateRule.isPending}
      />

      <PresetRulesDialog
        open={presetOpen}
        onClose={() => setPresetOpen(false)}
        onApply={handleApplyPreset}
        loading={presetLoading}
      />
    </div>
  );
};

export default Dashboard;
