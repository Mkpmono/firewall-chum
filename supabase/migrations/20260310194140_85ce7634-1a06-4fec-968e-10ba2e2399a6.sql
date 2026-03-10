
-- Create ip_bans table for manual IP banning from dashboard
CREATE TABLE public.ip_bans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ip_address text NOT NULL,
  reason text,
  banned_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ip_bans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own ip bans" ON public.ip_bans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own ip bans" ON public.ip_bans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ip bans" ON public.ip_bans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ip bans" ON public.ip_bans FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all ip bans" ON public.ip_bans FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
