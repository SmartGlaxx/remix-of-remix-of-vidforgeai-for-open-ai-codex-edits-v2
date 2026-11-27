ALTER TABLE public.explainer_exports DROP CONSTRAINT explainer_exports_owner_id_fkey;
CREATE INDEX explainer_exports_owner_format_created_idx ON public.explainer_exports (owner_id, format, created_at DESC);
NOTIFY pgrst, 'reload schema';