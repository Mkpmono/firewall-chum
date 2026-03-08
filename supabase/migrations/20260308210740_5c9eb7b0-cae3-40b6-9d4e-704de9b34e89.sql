
-- Presets table (admin-managed)
CREATE TABLE public.preset_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Custom',
  icon text NOT NULL DEFAULT 'Shield',
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Preset rules
CREATE TABLE public.preset_template_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES public.preset_templates(id) ON DELETE CASCADE,
  label text NOT NULL,
  port integer,
  port_range text,
  protocol text NOT NULL DEFAULT 'tcp',
  direction text NOT NULL DEFAULT 'INPUT',
  action text NOT NULL DEFAULT 'ACCEPT',
  priority integer NOT NULL DEFAULT 100,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.preset_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_template_rules ENABLE ROW LEVEL SECURITY;

-- Everyone can read presets
CREATE POLICY "Anyone authenticated can view presets"
ON public.preset_templates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Anyone authenticated can view preset rules"
ON public.preset_template_rules FOR SELECT TO authenticated
USING (true);

-- Only admins can manage
CREATE POLICY "Admins manage presets"
ON public.preset_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage preset rules"
ON public.preset_template_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
