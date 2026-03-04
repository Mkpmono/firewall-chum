import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAllProfiles, useClientIps, useAdminClientIps, useAllRulesForUser } from "@/hooks/useAdmin";
import { RulesTable } from "@/components/RulesTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, LogOut, Users, Plus, Trash2, Globe, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const Admin = () => {
  const { user, signOut } = useAuth();
  const { data: profiles, isLoading: profilesLoading } = useAllProfiles();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const selectedProfile = profiles?.find((p) => p.user_id === selectedUserId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-mono font-bold text-foreground text-sm">
              FIREWALL<span className="text-primary">PANEL</span>
              <Badge variant="outline" className="ml-2 text-xs font-mono border-primary/50 text-primary">ADMIN</Badge>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={() => signOut()} className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[350px_1fr] gap-6">
          {/* User list */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="font-mono font-semibold text-sm text-foreground">CLIENȚI</h2>
              <Badge variant="secondary" className="ml-auto font-mono text-xs">{profiles?.length || 0}</Badge>
            </div>
            {profilesLoading ? (
              <div className="p-8 text-center font-mono text-muted-foreground animate-pulse-glow">Se încarcă...</div>
            ) : (
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                {profiles?.map((profile) => (
                  <button
                    key={profile.user_id}
                    onClick={() => setSelectedUserId(profile.user_id)}
                    className={`w-full text-left px-4 py-3 border-b border-border/50 flex items-center gap-3 transition-colors hover:bg-muted/50 ${
                      selectedUserId === profile.user_id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm text-foreground truncate">{profile.display_name || "—"}</p>
                      <p className="font-mono text-xs text-muted-foreground truncate">{profile.email}</p>
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
              <div className="bg-card border border-border rounded-lg p-16 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="font-mono text-muted-foreground">Selectează un client din lista din stânga</p>
              </div>
            ) : (
              <>
                {/* Client info */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="font-mono font-semibold text-foreground text-sm mb-1">
                    {selectedProfile?.display_name || "—"}
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground">{selectedProfile?.email}</p>
                </div>

                {/* IPs section */}
                <ClientIpsSection userId={selectedUserId} />

                {/* Rules section */}
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
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Globe className="h-4 w-4 text-primary" />
        <h3 className="font-mono font-semibold text-sm text-foreground">IP-URI ALOCATE</h3>
        <Badge variant="secondary" className="ml-auto font-mono text-xs">{ips?.length || 0}</Badge>
      </div>

      {/* Add IP form */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              placeholder="ex: 192.168.1.100"
              className="bg-muted border-border font-mono text-sm"
            />
          </div>
          <div className="flex-1">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Etichetă (opțional)"
              className="bg-muted border-border font-mono text-sm"
            />
          </div>
          <Button size="sm" onClick={handleAdd} disabled={addIp.isPending} className="font-mono">
            <Plus className="h-3.5 w-3.5 mr-1" />
            ADAUGĂ
          </Button>
        </div>
      </div>

      {/* IP list */}
      {isLoading ? (
        <div className="p-8 text-center font-mono text-muted-foreground animate-pulse-glow">Se încarcă...</div>
      ) : !ips?.length ? (
        <div className="p-8 text-center font-mono text-muted-foreground text-sm">Niciun IP alocat</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-mono text-xs text-muted-foreground">IP</TableHead>
              <TableHead className="font-mono text-xs text-muted-foreground">ETICHETĂ</TableHead>
              <TableHead className="font-mono text-xs text-muted-foreground text-right">ACȚIUNI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ips.map((ip) => (
              <TableRow key={ip.id} className="border-border">
                <TableCell className="font-mono text-sm text-primary">{ip.ip_address}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{ip.label || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(ip.id)} className="h-7 w-7 text-destructive hover:text-destructive">
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
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="font-mono font-semibold text-sm text-foreground">REGULI FIREWALL</h3>
        <Badge variant="secondary" className="ml-auto font-mono text-xs">{rules?.length || 0}</Badge>
      </div>
      {isLoading ? (
        <div className="p-8 text-center font-mono text-muted-foreground animate-pulse-glow">Se încarcă...</div>
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
