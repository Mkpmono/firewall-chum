
-- GeoIP rules table
CREATE TABLE public.geoip_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    country_code text NOT NULL,
    country_name text NOT NULL,
    mode text NOT NULL DEFAULT 'blacklist',
    enabled boolean NOT NULL DEFAULT true,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id, country_code)
);

-- Enable RLS
ALTER TABLE public.geoip_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own geoip rules"
ON public.geoip_rules FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own geoip rules"
ON public.geoip_rules FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own geoip rules"
ON public.geoip_rules FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own geoip rules"
ON public.geoip_rules FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all geoip rules"
ON public.geoip_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
