
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can read their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- RLS: admins can manage all roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create client_ips table (admin assigns IPs to clients)
CREATE TABLE public.client_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ip_address text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_ips ENABLE ROW LEVEL SECURITY;

-- Clients can view their own IPs
CREATE POLICY "Users can view own IPs" ON public.client_ips
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can do everything on client_ips
CREATE POLICY "Admins manage all IPs" ON public.client_ips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all firewall rules
CREATE POLICY "Admins can view all rules" ON public.firewall_rules
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all firewall rules
CREATE POLICY "Admins can manage all rules" ON public.firewall_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
