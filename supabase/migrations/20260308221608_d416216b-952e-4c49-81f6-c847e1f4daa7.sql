
-- Servers table: tracks each server per client with unique API key for agent sync
CREATE TABLE public.servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  hostname TEXT NOT NULL,
  label TEXT,
  panel_type TEXT NOT NULL DEFAULT 'other',
  api_key UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_status TEXT,
  os_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(api_key)
);

-- Enable RLS
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- Admins manage all servers
CREATE POLICY "Admins manage all servers"
  ON public.servers FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own servers
CREATE POLICY "Users view own servers"
  ON public.servers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Update trigger
CREATE TRIGGER update_servers_updated_at
  BEFORE UPDATE ON public.servers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.servers;
