CREATE SCHEMA IF NOT EXISTS personal_booking;
CREATE TABLE IF NOT EXISTS personal_booking.hosts (
  id text PRIMARY KEY CHECK (id IN ('suleiman','saif')),
  enabled boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO personal_booking.hosts(id, settings) VALUES
 ('suleiman','{"timeZone":"Asia/Dubai","days":[0,1,2,3,4,5,6],"startHour":5,"endHour":26,"noticeHours":24,"bufferMinutes":0,"horizonDays":30}'),
 ('saif','{"timeZone":"Asia/Dubai","days":[0,1,2,3,4,5,6],"startHour":5,"endHour":26,"noticeHours":24,"bufferMinutes":0,"horizonDays":30}')
ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS personal_booking.reservations (
 id uuid PRIMARY KEY, host_id text NOT NULL REFERENCES personal_booking.hosts(id),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, busy_until timestamptz NOT NULL,
 duration integer NOT NULL CHECK (duration IN (30,60)), amount integer NOT NULL CHECK ((duration=30 AND amount=10000) OR (duration=60 AND amount=20000)),
 name text NOT NULL, email text NOT NULL, topic text NOT NULL, notes text NOT NULL DEFAULT '',
 time_zone text NOT NULL, locale text NOT NULL CHECK(locale IN ('en','ar')),
 status text NOT NULL DEFAULT 'holding' CHECK(status IN ('holding','processing','confirmed','expired','cancelled','payment_conflict')),
 stripe_session_id text UNIQUE, ip_hash text NOT NULL, expires_at timestamptz NOT NULL,
 paid_at timestamptz, notified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_at > starts_at AND busy_until >= ends_at)
);
CREATE INDEX IF NOT EXISTS booking_host_time ON personal_booking.reservations(host_id, starts_at);
CREATE INDEX IF NOT EXISTS booking_ip_time ON personal_booking.reservations(ip_hash, created_at);
CREATE TABLE IF NOT EXISTS personal_booking.blocks (id uuid PRIMARY KEY, host_id text NOT NULL REFERENCES personal_booking.hosts(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, CHECK(ends_at>starts_at));
CREATE TABLE IF NOT EXISTS personal_booking.rate_limits (key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);

CREATE OR REPLACE FUNCTION personal_booking.reserve_slot(
 p_id uuid, p_host text, p_start timestamptz, p_duration integer, p_name text, p_email text,
 p_topic text, p_notes text, p_zone text, p_locale text, p_ip text
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE h personal_booking.hosts; p_end timestamptz; p_busy timestamptz;
BEGIN
 SELECT * INTO h FROM personal_booking.hosts WHERE id=p_host FOR UPDATE;
 IF NOT FOUND OR NOT h.enabled THEN RAISE EXCEPTION 'BOOKING_PAUSED'; END IF;
 p_end := p_start + make_interval(mins=>p_duration);
 p_busy := p_end + make_interval(mins=>(h.settings->>'bufferMinutes')::integer);
 IF (SELECT count(*) FROM personal_booking.reservations WHERE ip_hash=p_ip AND created_at>now()-interval '1 hour') >= 8 THEN RAISE EXCEPTION 'BOOKING_RATE_LIMIT'; END IF;
 IF (SELECT count(*) FROM personal_booking.reservations WHERE ip_hash=p_ip AND status IN ('holding','processing') AND created_at>now()-interval '1 hour') >= 2 THEN RAISE EXCEPTION 'BOOKING_RATE_LIMIT'; END IF;
 IF EXISTS(SELECT 1 FROM personal_booking.reservations WHERE host_id=p_host AND status IN ('holding','processing','confirmed') AND starts_at<p_busy AND busy_until>p_start)
 OR EXISTS(SELECT 1 FROM personal_booking.blocks WHERE host_id=p_host AND starts_at<p_busy AND ends_at>p_start) THEN RAISE EXCEPTION 'BOOKING_SLOT_TAKEN'; END IF;
 INSERT INTO personal_booking.reservations(id,host_id,starts_at,ends_at,busy_until,duration,amount,name,email,topic,notes,time_zone,locale,ip_hash,expires_at)
 VALUES(p_id,p_host,p_start,p_end,p_busy,p_duration,CASE WHEN p_duration=30 THEN 10000 ELSE 20000 END,p_name,p_email,p_topic,p_notes,p_zone,p_locale,p_ip,now()+interval '35 minutes');
 RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION personal_booking.confirm_reservation(p_id uuid,p_session text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE r personal_booking.reservations; next_status text;
BEGIN
 SELECT * INTO r FROM personal_booking.reservations WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
 PERFORM 1 FROM personal_booking.hosts WHERE id=r.host_id FOR UPDATE;
 SELECT * INTO r FROM personal_booking.reservations WHERE id=p_id FOR UPDATE;
 IF r.paid_at IS NOT NULL THEN RETURN r.status; END IF;
 IF r.stripe_session_id IS NOT NULL AND r.stripe_session_id<>p_session THEN RAISE EXCEPTION 'BOOKING_SESSION_MISMATCH'; END IF;
 next_status := 'confirmed';
 IF r.starts_at<=now() OR r.status NOT IN ('holding','processing') OR EXISTS(SELECT 1 FROM personal_booking.reservations WHERE host_id=r.host_id AND id<>r.id AND status IN ('holding','processing','confirmed') AND starts_at<r.busy_until AND busy_until>r.starts_at) THEN next_status:='payment_conflict'; END IF;
 UPDATE personal_booking.reservations SET status=next_status,paid_at=now(),stripe_session_id=p_session WHERE id=p_id;
 RETURN next_status;
END $$;

CREATE OR REPLACE FUNCTION personal_booking.add_block(p_id uuid,p_host text,p_start timestamptz,p_end timestamptz)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM personal_booking.hosts WHERE id=p_host FOR UPDATE;
 IF EXISTS(SELECT 1 FROM personal_booking.reservations WHERE host_id=p_host AND status IN ('holding','processing','confirmed') AND starts_at<p_end AND busy_until>p_start) THEN RAISE EXCEPTION 'BLOCK_CONFLICT'; END IF;
 INSERT INTO personal_booking.blocks VALUES(p_id,p_host,p_start,p_end);
END $$;
