CREATE TABLE public.product_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  description TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit suggestions"
  ON public.product_suggestions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view suggestions"
  ON public.product_suggestions
  FOR SELECT
  USING (auth.role() = 'authenticated');