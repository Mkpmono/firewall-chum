import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PresetTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
}

export interface PresetTemplateRule {
  id: string;
  preset_id: string;
  label: string;
  port: number | null;
  port_range: string | null;
  protocol: string;
  direction: string;
  action: string;
  priority: number;
  notes: string | null;
  created_at: string;
}

export function usePresetTemplates() {
  return useQuery({
    queryKey: ["preset_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preset_templates")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      return data as PresetTemplate[];
    },
  });
}

export function usePresetTemplateRules(presetId?: string) {
  return useQuery({
    queryKey: ["preset_template_rules", presetId],
    enabled: !!presetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preset_template_rules")
        .select("*")
        .eq("preset_id", presetId!)
        .order("priority");
      if (error) throw error;
      return data as PresetTemplateRule[];
    },
  });
}

export function useAllPresetTemplatesWithRules() {
  return useQuery({
    queryKey: ["preset_templates_with_rules"],
    queryFn: async () => {
      const { data: presets, error: pe } = await supabase
        .from("preset_templates")
        .select("*")
        .order("category")
        .order("name");
      if (pe) throw pe;

      const { data: rules, error: re } = await supabase
        .from("preset_template_rules")
        .select("*")
        .order("priority");
      if (re) throw re;

      return (presets as PresetTemplate[]).map((p) => ({
        ...p,
        rules: (rules as PresetTemplateRule[]).filter((r) => r.preset_id === p.id),
      }));
    },
  });
}

export function useAdminPresetTemplates() {
  const queryClient = useQueryClient();

  const addPreset = useMutation({
    mutationFn: async (preset: { name: string; description?: string; category?: string; icon?: string; is_premium?: boolean }) => {
      const { data, error } = await supabase
        .from("preset_templates")
        .insert(preset)
        .select()
        .single();
      if (error) throw error;
      return data as PresetTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preset_templates"] });
      queryClient.invalidateQueries({ queryKey: ["preset_templates_with_rules"] });
    },
  });

  const updatePreset = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string; category?: string; icon?: string; is_premium?: boolean }) => {
      const { data, error } = await supabase
        .from("preset_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preset_templates"] });
      queryClient.invalidateQueries({ queryKey: ["preset_templates_with_rules"] });
    },
  });

  const deletePreset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("preset_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preset_templates"] });
      queryClient.invalidateQueries({ queryKey: ["preset_templates_with_rules"] });
    },
  });

  const addRule = useMutation({
    mutationFn: async (rule: { preset_id: string; label: string; port?: number | null; port_range?: string | null; protocol?: string; direction?: string; action?: string; priority?: number; notes?: string }) => {
      const { data, error } = await supabase
        .from("preset_template_rules")
        .insert(rule)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["preset_template_rules", vars.preset_id] });
      queryClient.invalidateQueries({ queryKey: ["preset_templates_with_rules"] });
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; label?: string; port?: number | null; port_range?: string | null; protocol?: string; direction?: string; action?: string; priority?: number; notes?: string }) => {
      const { data, error } = await supabase
        .from("preset_template_rules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preset_template_rules"] });
      queryClient.invalidateQueries({ queryKey: ["preset_templates_with_rules"] });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("preset_template_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preset_template_rules"] });
      queryClient.invalidateQueries({ queryKey: ["preset_templates_with_rules"] });
    },
  });

  return { addPreset, updatePreset, deletePreset, addRule, updateRule, deleteRule };
}
