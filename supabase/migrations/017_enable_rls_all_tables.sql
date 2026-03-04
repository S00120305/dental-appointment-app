-- Enable RLS on all App B tables that are missing it.
-- No permissive policies needed: service_role_key bypasses RLS.
-- This blocks direct anon/authenticated access as defense-in-depth.

-- Tables created in migrations without RLS
ALTER TABLE IF EXISTS booking_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS line_pending_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS appointment_logs ENABLE ROW LEVEL SECURITY;

-- Tables created outside migrations (Phase D-H)
ALTER TABLE IF EXISTS appointment_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS appointment_tag_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clinic_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS booking_tokens ENABLE ROW LEVEL SECURITY;
