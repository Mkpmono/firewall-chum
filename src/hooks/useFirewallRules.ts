import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type FirewallRuleInsert = TablesInsert<"firewall_rules">;
type FirewallRuleUpdate = TablesUpdate<"firewall_rules">;

export function useFirewallRules() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["firewall_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("firewall_rules")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addRule = useMutation({
    mutationFn: async (rule: Omit<FirewallRuleInsert, "user_id">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("firewall_rules")
        .insert({ ...rule, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firewall_rules"] }),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: FirewallRuleUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("firewall_rules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firewall_rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("firewall_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firewall_rules"] }),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("firewall_rules")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firewall_rules"] }),
  });

  return { ...query, addRule, updateRule, deleteRule, toggleRule };
}
