import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAllProfiles, useClientIps, useAdminClientIps, useAllRulesForUser, useAdminProfiles, useAdminRules } from "@/hooks/useAdmin";
import { RulesTable } from "@/components/RulesTable";
import { AdminRuleFormDialog } from "@/components/AdminRuleFormDialog";
import { AdminPresetsManager } from "@/components/AdminPresetsManager";
import { ClientServersSection } from "@/components/ClientServersSection";
import { WhmcsModule } from "@/components/WhmcsModule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, LogOut, Users, Plus, Trash2, Globe, ChevronRight, ArrowLeft, Pencil, Save, X, ShieldCheck, ShieldOff, HardDrive, Server, KeyRound, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type FirewallRule = Tables<"firewall_rules">;

const Admin = () => {
  const { user, signOut } = useAuth();
  const { data: profiles, isLoading: profilesLoading } = useAllProfiles();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showWhmcs, setShowWhmcs] = useState(false);
  const [whmcsSecret, setWhmcsSecret] = useState("");
  const navigate = useNavigate();

  const selectedProfile = profiles?.find((p) => p.user_id === selectedUserId);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 glass sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground text-lg">
              Ho<span className="gradient-text">x</span>ta
            </span>
            <Badge className="gradient-btn text-primary-foreground border-0 text-xs">Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-xl text-xs">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Client
            </Button>
            <Button variant={showWhmcs ? "default" : "outline"} size="sm" onClick={() => setShowWhmcs(!showWhmcs)} className="rounded-xl text-xs">
              <Server className="h-3.5 w-3.5 mr-1.5" />
              WHMCS
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/self-host")} className="rounded-xl text-xs">
              <HardDrive className="h-3.5 w-3.5 mr-1.5" />
              Self-Host
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={() => signOut()} className="h-9 w-9 rounded-xl">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {showWhmcs ? (
          <WhmcsModule whmcsApiSecret={whmcsSecret} onSecretChange={setWhmcsSecret} />
        ) : (
          <>
            <div className="grid lg:grid-cols-[350px_1fr] gap-6">
              {/* User list */}
              <div className="glass rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border/50 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-sm text-foreground">Clienți</h2>
                  <Badge variant="secondary" className="ml-auto text-xs">{profiles?.length || 0}</Badge>
                  <CreateAccountButton />
                </div>
                {profilesLoading ? (
                  <div className="p-8 text-center text-muted-foreground animate-pulse-glow">Se încarcă...</div>
                ) : (
                  <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                    {profiles?.map((profile) => (
                      <button
                        key={profile.user_id}
                        onClick={() => setSelectedUserId(profile.user_id)}
                        className={`w-full text-left px-4 py-3 border-b border-border/30 flex items-center gap-3 transition-all hover:bg-muted/50 ${
                          selectedUserId === profile.user_id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate font-medium">{profile.display_name || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* User details */}
              <div className="space-y-6">
                {!selectedUserId ? (
                  <div className="glass rounded-2xl p-16 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">Selectează un client din lista din stânga</p>
                  </div>
                ) : (
                  <>
                    <ClientProfileSection userId={selectedUserId} profile={selectedProfile} onDeleted={() => setSelectedUserId(null)} />
                    <ClientServersSection userId={selectedUserId} />
                    <ClientIpsSection userId={selectedUserId} />
                    <ClientRulesSection userId={selectedUserId} />
                  </>
                )}
              </div>
            </div>

            {/* Presets Manager - always visible */}
            <div className="mt-8">
              <AdminPresetsManager />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

function ClientProfileSection({ userId, profile, onDeleted }: { userId: string; profile: any; onDeleted: () => void }) {
  const { updateProfile, deleteProfile } = useAdminProfiles();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [maxRulesVal, setMaxRulesVal] = useState(20);
  const { toast } = useToast();
  
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const startEdit = () => {
    setDisplayName(profile?.display_name || "");
    setEmail(profile?.email || "");
    setMaxRulesVal(profile?.max_rules ?? 20);
    
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        user_id: userId,
        display_name: displayName.trim() || null,
        email: email.trim() || null,
        max_rules: maxRulesVal,
      });
      toast({ title: "Profil actualizat!" });
      setEditing(false);
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProfile.mutateAsync(userId);
      toast({ title: "Profil șters!" });
      onDeleted();
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      toast({ title: "Eroare", description: "Parola trebuie să aibă cel puțin 6 caractere.", variant: "destructive" });
      return;
    }
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { target_user_id: userId, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "🔑 Parola a fost resetată!", description: `Parola clientului ${profile?.display_name || profile?.email || ""} a fost schimbată.` });
      setNewPassword("");
      setResetOpen(false);
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Nume</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 bg-muted/50 border-border/50 text-sm rounded-xl" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-muted/50 border-border/50 text-sm rounded-xl" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Limită Reguli</label>
            <Input type="number" value={maxRulesVal} onChange={(e) => setMaxRulesVal(parseInt(e.target.value) || 0)} className="mt-1 bg-muted/50 border-border/50 text-sm rounded-xl w-32" />
          </div>


          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={updateProfile.isPending} className="rounded-xl gradient-btn text-primary-foreground border-0">
              <Save className="h-3.5 w-3.5 mr-1" /> Salvează
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="rounded-xl">
              <X className="h-3.5 w-3.5 mr-1" /> Anulare
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-foreground">{profile?.display_name || "—"}</h3>
            <p className="text-xs text-muted-foreground">{profile?.email}</p>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-xs text-muted-foreground">Limită reguli: <span className="text-primary font-medium">{profile?.max_rules ?? 20}</span></p>
              <DdosToggle userId={userId} profile={profile} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={startEdit} className="rounded-xl">
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editează
            </Button>
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="rounded-xl text-primary hover:text-primary">
                  <KeyRound className="h-3.5 w-3.5 mr-1" /> Resetează Parola
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass border-border/50 rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Resetează parola</AlertDialogTitle>
                  <AlertDialogDescription>
                    Introdu noua parolă pentru <strong>{profile?.display_name || profile?.email || "client"}</strong>. Minimum 6 caractere.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  type="password"
                  placeholder="Noua parolă..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-muted/50 border-border/50 text-sm rounded-xl"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl" onClick={() => setNewPassword("")}>Anulare</AlertDialogCancel>
                  <Button
                    onClick={handleResetPassword}
                    disabled={resetting || newPassword.length < 6}
                    className="rounded-xl gradient-btn text-primary-foreground border-0"
                  >
                    {resetting ? "Se resetează..." : "Resetează"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="rounded-xl text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Șterge
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass border-border/50 rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Ești sigur?</AlertDialogTitle>
                  <AlertDialogDescription>Profilul va fi șters permanent.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Anulare</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Șterge</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientIpsSection({ userId }: { userId: string }) {
  const { data: ips, isLoading } = useClientIps(userId);
  const { addIp, deleteIp } = useAdminClientIps();
  const [newIp, setNewIp] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!newIp.trim()) return;
    try {
      await addIp.mutateAsync({ user_id: userId, ip_address: newIp.trim(), label: newLabel.trim() || undefined });
      setNewIp("");
      setNewLabel("");
      toast({ title: "IP adăugat!" });
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIp.mutateAsync(id);
      toast({ title: "IP șters!" });
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center gap-2">
        <Globe className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">IP-uri Alocate</h3>
        <Badge variant="secondary" className="ml-auto text-xs">{ips?.length || 0}</Badge>
      </div>

      <div className="p-4 border-b border-border/30 bg-muted/20">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="ex: 192.168.1.100" className="bg-muted/50 border-border/50 text-sm rounded-xl" />
          </div>
          <div className="flex-1">
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Etichetă (opțional)" className="bg-muted/50 border-border/50 text-sm rounded-xl" />
          </div>
          <Button size="sm" onClick={handleAdd} disabled={addIp.isPending} className="rounded-xl gradient-btn text-primary-foreground border-0">
            <Plus className="h-3.5 w-3.5 mr-1" /> Adaugă
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse-glow">Se încarcă...</div>
      ) : !ips?.length ? (
        <div className="p-8 text-center text-muted-foreground text-sm">Niciun IP alocat</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="text-xs text-muted-foreground">IP</TableHead>
              <TableHead className="text-xs text-muted-foreground">Etichetă</TableHead>
              <TableHead className="text-xs text-muted-foreground text-right">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ips.map((ip) => (
              <TableRow key={ip.id} className="border-border/30">
                <TableCell className="font-mono text-sm text-primary">{ip.ip_address}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{ip.label || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(ip.id)} className="h-8 w-8 text-destructive hover:text-destructive rounded-xl">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ClientRulesSection({ userId }: { userId: string }) {
  const { data: rules, isLoading } = useAllRulesForUser(userId);
  const { addRule, updateRule, deleteRule, toggleRule } = useAdminRules();
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
        await addRule.mutateAsync({ user_id: userId, ...data });
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
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Reguli Firewall</h3>
        <Badge variant="secondary" className="ml-auto text-xs">{rules?.length || 0}</Badge>
        <Button size="sm" onClick={handleAdd} className="rounded-xl gradient-btn text-primary-foreground border-0 ml-2">
          <Plus className="h-3.5 w-3.5 mr-1" /> Adaugă
        </Button>
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse-glow">Se încarcă...</div>
      ) : (
        <RulesTable
          rules={rules || []}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggle={handleToggle}
        />
      )}

      <AdminRuleFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        editRule={editingRule}
        loading={addRule.isPending || updateRule.isPending}
        userId={userId}
      />
    </div>
  );
}

function CreateAccountButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!email.trim() || !password.trim()) {
      toast({ title: "Eroare", description: "Email și parola sunt obligatorii.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Eroare", description: "Parola trebuie să aibă cel puțin 6 caractere.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: email.trim(), password, display_name: displayName.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "✅ Cont creat!", description: `Contul ${email} a fost creat cu succes.` });
      setEmail("");
      setPassword("");
      setDisplayName("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin_profiles"] });
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" className="rounded-xl gradient-btn text-primary-foreground border-0">
          <UserPlus className="h-3.5 w-3.5 mr-1" /> Adaugă
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="glass border-border/50 rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Adaugă cont nou</AlertDialogTitle>
          <AlertDialogDescription>Creează un cont nou de client.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Nume (opțional)</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ion Popescu" className="mt-1 bg-muted/50 border-border/50 text-sm rounded-xl" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email *</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@exemplu.com" className="mt-1 bg-muted/50 border-border/50 text-sm rounded-xl" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Parolă * (min. 6 caractere)</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" className="mt-1 bg-muted/50 border-border/50 text-sm rounded-xl" />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl" onClick={() => { setEmail(""); setPassword(""); setDisplayName(""); }}>Anulare</AlertDialogCancel>
          <Button onClick={handleCreate} disabled={loading || !email.trim() || password.length < 6} className="rounded-xl gradient-btn text-primary-foreground border-0">
            {loading ? "Se creează..." : "Creează cont"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DdosToggle({ userId, profile }: { userId: string; profile: any }) {
  const { updateProfile } = useAdminProfiles();
  const { toast } = useToast();
  const isActive = profile?.ddos_protection === true;

  const handleToggle = async () => {
    try {
      await updateProfile.mutateAsync({
        user_id: userId,
        ddos_protection: !isActive,
      });
      toast({
        title: !isActive ? "🛡️ Null-Route Auto activat!" : "Null-Route Auto dezactivat",
        description: !isActive 
          ? "Când se detectează un atac DDoS, IP-ul atacat va fi null-routed automat prin iptables (DROP all traffic)." 
          : "Protecția null-route automată a fost dezactivată.",
      });
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={updateProfile.isPending}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all ${
        isActive
          ? "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25"
          : "bg-muted/50 text-muted-foreground border border-border/50 hover:bg-muted"
      }`}
    >
      {isActive ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
      {isActive ? "NULL-ROUTE ON" : "NULL-ROUTE OFF"}
    </button>
  );
}

export default Admin;
