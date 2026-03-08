import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin, useMyProfile } from "@/hooks/useAdmin";
import { useFirewallRules } from "@/hooks/useFirewallRules";
import { RulesTable } from "@/components/RulesTable";
import { RuleFormDialog } from "@/components/RuleFormDialog";
import { PresetRulesDialog } from "@/components/PresetRulesDialog";
import { DdosMonitoring } from "@/components/DdosMonitoring";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Plus, LogOut, RefreshCw, Settings, Zap, AlertTriangle, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type FirewallRule = Tables<"firewall_rules">;

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: myProfile } = useMyProfile();
  const navigate = useNavigate();
  const { data: rules, isLoading, refetch, addRule, updateRule, deleteRule, toggleRule } = useFirewallRules();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null);
  const { toast } = useToast();

  const maxRules = (myProfile as any)?.max_rules ?? 20;
  const hasDdos = (myProfile as any)?.ddos_protection === true;
  const totalCount = rules?.length || 0;
  const activeCount = rules?.filter((r) => r.enabled).length || 0;
  const atLimit = totalCount >= maxRules;

  const handleApplyPreset = async (presetRules: any[], selectedIp: string) => {
    if (totalCount + presetRules.length > maxRules) {
      toast({
        title: "Limită depășită",
        description: `Ai ${totalCount}/${maxRules} reguli. Contactează administratorul pentru mai multe.`,
        variant: "destructive",
      });
      return;
    }
    setPresetLoading(true);
    try {
      for (const rule of presetRules) {
        await addRule.mutateAsync({
          ...rule,
          source_ip: "0.0.0.0/0",
          destination_ip: selectedIp,
        });
      }
      toast({ title: `${presetRules.length} reguli adăugate cu succes!` });
      setPresetOpen(false);
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    } finally {
      setPresetLoading(false);
    }
  };

  const handleAdd = () => {
    if (atLimit) {
      toast({
        title: "Limită atinsă",
        description: `Ai deja ${maxRules} reguli. Contactează administratorul pentru a crește limita.`,
        variant: "destructive",
      });
      return;
    }
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
        if (totalCount >= maxRules) {
          toast({ title: "Limită atinsă", description: "Contactează administratorul.", variant: "destructive" });
          return;
        }
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
        {/* Limit warning */}
        {atLimit && (
          <div className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Limită de reguli atinsă ({maxRules}/{maxRules})</p>
              <p className="text-xs text-destructive/80">Contactează administratorul pentru a crește limita.</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Total Reguli</p>
            <p className="text-3xl font-bold text-foreground">{totalCount}</p>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Active</p>
            <p className="text-3xl font-bold gradient-text">{activeCount}</p>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Inactive</p>
            <p className="text-3xl font-bold text-muted-foreground">{totalCount - activeCount}</p>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Limită</p>
            <p className={`text-3xl font-bold ${atLimit ? "text-destructive" : "text-foreground"}`}>
              {totalCount}<span className="text-lg text-muted-foreground">/{maxRules}</span>
            </p>
          </div>
          <div className={`glass rounded-2xl p-5 ${hasDdos ? "border border-primary/30" : "border border-border/30"}`}>
            <p className="text-xs text-muted-foreground mb-1">DDoS Protection</p>
            {hasDdos ? (
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  <span className="text-lg font-bold text-primary">PREMIUM</span>
                </div>
                <p className="text-xs text-primary/70 mt-0.5">16+ reguli avansate active</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <span className="text-lg font-bold text-foreground">STANDARD</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Upgrade la Premium — contactează admin</p>
              </div>
            )}
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
            <Button variant="outline" size="sm" onClick={() => setPresetOpen(true)} className="rounded-xl" disabled={atLimit}>
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Preset-uri
            </Button>
            <Button size="sm" onClick={handleAdd} className="rounded-xl gradient-btn text-primary-foreground border-0 hover:opacity-90" disabled={atLimit}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Regulă Nouă
            </Button>
          </div>
        </div>

        {/* DDoS Monitoring */}
        <div className="mb-8">
          <DdosMonitoring />
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
        currentRuleCount={totalCount}
        maxRules={maxRules}
      />
    </div>
  );
};

export default Dashboard;
