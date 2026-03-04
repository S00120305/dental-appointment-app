-- Additional FK indexes flagged by Supabase advisor (App B tables only)

-- appointment_tag_links.tag_id: FK to appointment_tags
CREATE INDEX IF NOT EXISTS idx_appointment_tag_links_tag_id
  ON appointment_tag_links (tag_id);

-- appointments.lab_order_id: FK to lab_orders (used in tech-item lookup)
CREATE INDEX IF NOT EXISTS idx_appointments_lab_order_id
  ON appointments (lab_order_id)
  WHERE lab_order_id IS NOT NULL;

-- booking_tokens.booking_type_id: FK to booking_types
CREATE INDEX IF NOT EXISTS idx_booking_tokens_booking_type_id
  ON booking_tokens (booking_type_id);

-- booking_tokens.staff_id: FK to users
CREATE INDEX IF NOT EXISTS idx_booking_tokens_staff_id
  ON booking_tokens (staff_id)
  WHERE staff_id IS NOT NULL;

-- booking_tokens.created_by: FK to users
CREATE INDEX IF NOT EXISTS idx_booking_tokens_created_by
  ON booking_tokens (created_by);

-- blocked_slots.created_by: FK to users
CREATE INDEX IF NOT EXISTS idx_blocked_slots_created_by
  ON blocked_slots (created_by);

-- appointment_settings.updated_by: FK to users
CREATE INDEX IF NOT EXISTS idx_appointment_settings_updated_by
  ON appointment_settings (updated_by)
  WHERE updated_by IS NOT NULL;
