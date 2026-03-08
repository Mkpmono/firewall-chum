
-- User-Agent blocking rules table
CREATE TABLE public.useragent_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pattern TEXT NOT NULL,
  label TEXT,
  block_type TEXT NOT NULL DEFAULT 'block',
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.useragent_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ua rules" ON public.useragent_rules
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own ua rules" ON public.useragent_rules
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ua rules" ON public.useragent_rules
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ua rules" ON public.useragent_rules
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all ua rules" ON public.useragent_rules
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
