import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAllProfiles, useClientIps, useAdminClientIps, useAllRulesForUser } from "@/hooks/useAdmin";
import { RulesTable } from "@/components/RulesTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, LogOut, Users, Plus, Trash2, Globe, ChevronRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const Admin = () => {
  const { user, signOut } = useAuth();
  const { data: profiles, isLoading: profilesLoading } = useAllProfiles();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  const selectedProfile = profiles?.find((p) => p.user_id === selectedUserId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 glass sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-9 w-9 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground text-lg">
              Ho<span className="gradient-text">x</span>ta
            </span>
            <Badge className="gradient-btn text-primary-foreground border-0 text-xs">Admin</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={() => signOut()} className="h-9 w-9 rounded-xl">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[350px_1fr] gap-6">
          {/* User list */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm text-foreground">Clienți</h2>
              <Badge variant="secondary" className="ml-auto text-xs">{profiles?.length || 0}</Badge>
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
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold text-foreground mb-1">
                    {selectedProfile?.display_name || "—"}
                  </h3>
                  <p className="text-xs text-muted-foreground">{selectedProfile?.email}</p>
                </div>

                <ClientIpsSection userId={selectedUserId} />
                <ClientRulesSection userId={selectedUserId} />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

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
            <Input
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              placeholder="ex: 192.168.1.100"
              className="bg-muted/50 border-border/50 text-sm rounded-xl"
            />
          </div>
          <div className="flex-1">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Etichetă (opțional)"
              className="bg-muted/50 border-border/50 text-sm rounded-xl"
            />
          </div>
          <Button size="sm" onClick={handleAdd} disabled={addIp.isPending} className="rounded-xl gradient-btn text-primary-foreground border-0">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adaugă
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

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Reguli Firewall</h3>
        <Badge variant="secondary" className="ml-auto text-xs">{rules?.length || 0}</Badge>
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse-glow">Se încarcă...</div>
      ) : (
        <RulesTable
          rules={rules || []}
          onEdit={() => {}}
          onDelete={() => {}}
          onToggle={() => {}}
          readOnly
        />
      )}
    </div>
  );
}

export default Admin;
