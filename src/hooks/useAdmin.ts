import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useAllProfiles() {
  return useQuery({
    queryKey: ["admin_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminProfiles() {
  const queryClient = useQueryClient();

  const updateProfile = useMutation({
    mutationFn: async ({ user_id, display_name, email }: { user_id: string; display_name: string | null; email: string | null }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ display_name, email })
        .eq("user_id", user_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_profiles"] });
    },
  });

  const deleteProfile = useMutation({
    mutationFn: async (user_id: string) => {
      const { error } = await supabase.from("profiles").delete().eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_profiles"] });
    },
  });

  return { updateProfile, deleteProfile };
}

export function useClientIps(userId?: string) {
  return useQuery({
    queryKey: ["client_ips", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_ips")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMyIps() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my_ips", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_ips")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminClientIps() {
  const queryClient = useQueryClient();

  const addIp = useMutation({
    mutationFn: async ({ user_id, ip_address, label }: { user_id: string; ip_address: string; label?: string }) => {
      const { data, error } = await supabase
        .from("client_ips")
        .insert({ user_id, ip_address, label: label || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["client_ips", vars.user_id] });
    },
  });

  const deleteIp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_ips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_ips"] });
    },
  });

  return { addIp, deleteIp };
}

export function useAllRulesForUser(userId?: string) {
  return useQuery({
    queryKey: ["admin_rules", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("firewall_rules")
        .select("*")
        .eq("user_id", userId!)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminRules() {
  const queryClient = useQueryClient();

  const addRule = useMutation({
    mutationFn: async (rule: {
      user_id: string;
      label?: string | null;
      source_ip?: string;
      destination_ip?: string;
      port?: number | null;
      port_range?: string | null;
      protocol?: string;
      direction?: string;
      action?: string;
      priority?: number;
      enabled?: boolean;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("firewall_rules")
        .insert(rule)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin_rules", vars.user_id] });
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from("firewall_rules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_rules"] });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("firewall_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_rules"] });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("firewall_rules")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_rules"] });
    },
  });

  return { addRule, updateRule, deleteRule, toggleRule };
}
