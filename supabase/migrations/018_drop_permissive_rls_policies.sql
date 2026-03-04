-- Drop overly permissive USING(true) policies.
-- service_role_key bypasses RLS, so no policies are needed.
DROP POLICY IF EXISTS "Allow all for appointment_tags" ON appointment_tags;
DROP POLICY IF EXISTS "Allow all for appointment_tag_links" ON appointment_tag_links;
