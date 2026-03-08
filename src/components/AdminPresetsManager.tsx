import { useState } from "react";
import { usePresetTemplates, usePresetTemplateRules, useAdminPresetTemplates } from "@/hooks/usePresetTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Save, X, Shield, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export function AdminPresetsManager() {
  const { data: presets, isLoading } = usePresetTemplates();
  const { addPreset, deletePreset, updatePreset } = useAdminPresetTemplates();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("Custom");
  const [newPremium, setNewPremium] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await addPreset.mutateAsync({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        category: newCategory.trim() || "Custom",
        is_premium: newPremium,
      });
      toast({ title: "Preset creat!" });
      setNewName("");
      setNewDesc("");
      setNewCategory("Custom");
      setNewPremium(false);
      setShowAdd(false);
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePreset.mutateAsync(id);
      toast({ title: "Preset șters!" });
      if (expandedId === id) setExpandedId(null);
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    }
  };

  const categories = [...new Set(presets?.map((p) => p.category) || [])];

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Preset-uri Personalizate</h3>
        <Badge variant="secondary" className="ml-auto text-xs">{presets?.length || 0}</Badge>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="rounded-xl gradient-btn text-primary-foreground border-0 ml-2">
          <Plus className="h-3.5 w-3.5 mr-1" /> Preset Nou
        </Button>
      </div>

      {showAdd && (
        <div className="p-4 border-b border-border/30 bg-muted/20 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Nume</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ex: Minecraft Server" className="mt-1 bg-muted/50 border-border/50 text-sm rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Categorie</label>
              <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="ex: Game Panels" className="mt-1 bg-muted/50 border-border/50 text-sm rounded-xl" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Descriere</label>
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Descriere scurtă..." className="mt-1 bg-muted/50 border-border/50 text-sm rounded-xl" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={newPremium} onCheckedChange={setNewPremium} />
            <label className="text-xs text-muted-foreground">Premium (necesită activare admin)</label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={addPreset.isPending || !newName.trim()} className="rounded-xl gradient-btn text-primary-foreground border-0">
              <Save className="h-3.5 w-3.5 mr-1" /> Creează
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} className="rounded-xl">
              <X className="h-3.5 w-3.5 mr-1" /> Anulare
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse-glow">Se încarcă...</div>
      ) : !presets?.length ? (
        <div className="p-8 text-center text-muted-foreground text-sm">Niciun preset personalizat. Apasă "Preset Nou" pentru a crea.</div>
      ) : (
        <div>
          {categories.map((cat) => (
            <div key={cat}>
              <div className="px-4 py-2 bg-muted/10 border-b border-border/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat}</p>
              </div>
              {presets.filter((p) => p.category === cat).map((preset) => (
                <div key={preset.id} className="border-b border-border/30">
                  <button
                    onClick={() => setExpandedId(expandedId === preset.id ? null : preset.id)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-all"
                  >
                    {expandedId === preset.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{preset.name}</p>
                        {preset.is_premium && (
                          <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">PREMIUM</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{preset.description || "—"}</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive rounded-xl" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass border-border/50 rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Șterge preset "{preset.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>Preset-ul și toate regulile asociate vor fi șterse permanent.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Anulare</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(preset.id)} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Șterge</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </button>
                  {expandedId === preset.id && (
                    <PresetRulesEditor presetId={preset.id} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PresetRulesEditor({ presetId }: { presetId: string }) {
  const { data: rules, isLoading } = usePresetTemplateRules(presetId);
  const { addRule, deleteRule, updateRule } = useAdminPresetTemplates();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New rule form
  const [label, setLabel] = useState("");
  const [port, setPort] = useState("");
  const [portRange, setPortRange] = useState("");
  const [protocol, setProtocol] = useState("tcp");
  const [direction, setDirection] = useState("INPUT");
  const [action, setAction] = useState("ACCEPT");
  const [priority, setPriority] = useState("100");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setLabel(""); setPort(""); setPortRange(""); setProtocol("tcp");
    setDirection("INPUT"); setAction("ACCEPT"); setPriority("100"); setNotes("");
  };

  const startEdit = (rule: any) => {
    setEditingId(rule.id);
    setLabel(rule.label);
    setPort(rule.port?.toString() || "");
    setPortRange(rule.port_range || "");
    setProtocol(rule.protocol);
    setDirection(rule.direction);
    setAction(rule.action);
    setPriority(rule.priority.toString());
    setNotes(rule.notes || "");
  };

  const handleAdd = async () => {
    if (!label.trim()) return;
    try {
      await addRule.mutateAsync({
        preset_id: presetId,
        label: label.trim(),
        port: port ? parseInt(port) : null,
        port_range: portRange || null,
        protocol,
        direction,
        action,
        priority: parseInt(priority) || 100,
        notes: notes || undefined,
      });
      toast({ title: "Regulă adăugată!" });
      resetForm();
      setShowAdd(false);
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !label.trim()) return;
    try {
      await updateRule.mutateAsync({
        id: editingId,
        label: label.trim(),
        port: port ? parseInt(port) : null,
        port_range: portRange || null,
        protocol,
        direction,
        action,
        priority: parseInt(priority) || 100,
        notes: notes || undefined,
      });
      toast({ title: "Regulă actualizată!" });
      setEditingId(null);
      resetForm();
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

  const RuleForm = ({ isEdit }: { isEdit: boolean }) => (
    <div className="p-3 bg-muted/30 rounded-xl space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Etichetă</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: Allow SSH" className="h-8 bg-muted/50 border-border/50 text-xs rounded-lg" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Note</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opțional" className="h-8 bg-muted/50 border-border/50 text-xs rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Port</label>
          <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="22" className="h-8 bg-muted/50 border-border/50 text-xs rounded-lg" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Port Range</label>
          <Input value={portRange} onChange={(e) => setPortRange(e.target.value)} placeholder="8000-9000" className="h-8 bg-muted/50 border-border/50 text-xs rounded-lg" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Protocol</label>
          <Select value={protocol} onValueChange={setProtocol}>
            <SelectTrigger className="h-8 bg-muted/50 border-border/50 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border/50 rounded-xl">
              <SelectItem value="tcp">TCP</SelectItem>
              <SelectItem value="udp">UDP</SelectItem>
              <SelectItem value="icmp">ICMP</SelectItem>
              <SelectItem value="all">ALL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Direcție</label>
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger className="h-8 bg-muted/50 border-border/50 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border/50 rounded-xl">
              <SelectItem value="INPUT">INPUT</SelectItem>
              <SelectItem value="OUTPUT">OUTPUT</SelectItem>
              <SelectItem value="FORWARD">FORWARD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Acțiune</label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-8 bg-muted/50 border-border/50 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border/50 rounded-xl">
              <SelectItem value="ACCEPT">ACCEPT</SelectItem>
              <SelectItem value="DROP">DROP</SelectItem>
              <SelectItem value="REJECT">REJECT</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-20">
          <label className="text-[10px] text-muted-foreground">Prioritate</label>
          <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} className="h-8 bg-muted/50 border-border/50 text-xs rounded-lg" />
        </div>
        <div className="flex gap-2 ml-auto pt-3">
          <Button size="sm" onClick={isEdit ? handleUpdate : handleAdd} disabled={!label.trim()} className="h-7 text-xs rounded-lg gradient-btn text-primary-foreground border-0">
            <Save className="h-3 w-3 mr-1" /> {isEdit ? "Salvează" : "Adaugă"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { isEdit ? setEditingId(null) : setShowAdd(false); resetForm(); }} className="h-7 text-xs rounded-lg">
            <X className="h-3 w-3 mr-1" /> Anulare
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="px-4 pb-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Reguli ({rules?.length || 0})</p>
        {!showAdd && !editingId && (
          <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowAdd(true); }} className="h-7 text-xs rounded-lg">
            <Plus className="h-3 w-3 mr-1" /> Regulă
          </Button>
        )}
      </div>

      {showAdd && <RuleForm isEdit={false} />}

      {isLoading ? (
        <p className="text-xs text-muted-foreground animate-pulse-glow">Se încarcă...</p>
      ) : (
        <div className="space-y-1">
          {rules?.map((rule) =>
            editingId === rule.id ? (
              <RuleForm key={rule.id} isEdit />
            ) : (
              <div key={rule.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-muted/20 text-xs group">
                <span className="text-foreground font-medium flex-1 truncate">{rule.label}</span>
                <span className="text-muted-foreground">{rule.protocol.toUpperCase()}</span>
                <span className="text-primary font-mono">{rule.port || rule.port_range || "—"}</span>
                <Badge variant={rule.action === "ACCEPT" ? "default" : "destructive"} className="text-[10px]">
                  {rule.action}
                </Badge>
                <span className="text-muted-foreground">{rule.direction}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => startEdit(rule)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md text-destructive hover:text-destructive" onClick={() => handleDelete(rule.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
