-- FK indexes for frequently-queried columns
-- appointments.staff_id: used in JOIN (users!staff_id) on every calendar query
CREATE INDEX IF NOT EXISTS idx_appointments_staff_id
  ON appointments (staff_id);

-- appointments.booking_type_id: used in reserve/change/token routes
CREATE INDEX IF NOT EXISTS idx_appointments_booking_type_id
  ON appointments (booking_type_id)
  WHERE booking_type_id IS NOT NULL;

-- appointments.booking_source: used in pending count badge (status + booking_source filter)
CREATE INDEX IF NOT EXISTS idx_appointments_booking_source
  ON appointments (booking_source, status)
  WHERE is_deleted = false;

-- notification_logs.appointment_id: used in duplicate-send check
CREATE INDEX IF NOT EXISTS idx_notification_logs_appointment_id
  ON notification_logs (appointment_id);

-- booking_tokens.patient_id: used in patient token lookup
CREATE INDEX IF NOT EXISTS idx_booking_tokens_patient_id
  ON booking_tokens (patient_id)
  WHERE status = 'active';

-- booking_tokens.appointment_id: used in token-appointment join
CREATE INDEX IF NOT EXISTS idx_booking_tokens_appointment_id
  ON booking_tokens (appointment_id)
  WHERE appointment_id IS NOT NULL;

-- appointment_tag_links.appointment_id: used in tag sync (delete + insert)
CREATE INDEX IF NOT EXISTS idx_appointment_tag_links_appointment_id
  ON appointment_tag_links (appointment_id);

-- staff_holidays.user_id + holiday_date: used in UPSERT check
CREATE INDEX IF NOT EXISTS idx_staff_holidays_user_date
  ON staff_holidays (user_id, holiday_date)
  WHERE is_deleted = false;
