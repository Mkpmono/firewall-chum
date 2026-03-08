
-- Add sinkhole_ip to profiles (configurable per client)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sinkhole_ip text DEFAULT '192.0.2.1';

-- Create ddos_events table for monitoring
CREATE TABLE IF NOT EXISTS public.ddos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_address text NOT NULL,
  attack_type text NOT NULL DEFAULT 'unknown',
  source_ips text[] DEFAULT '{}',
  packets_blocked bigint DEFAULT 0,
  packets_redirected bigint DEFAULT 0,
  severity text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.ddos_events ENABLE ROW LEVEL SECURITY;

-- Admins can manage all events
CREATE POLICY "Admins manage ddos events" ON public.ddos_events
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view own events
CREATE POLICY "Users view own ddos events" ON public.ddos_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for ddos_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.ddos_events;
