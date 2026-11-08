DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_owner') THEN
    CREATE ROLE audit_owner WITH NOLOGIN;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              SERIAL PRIMARY KEY,
  table_name      VARCHAR(100) NOT NULL,
  record_key      JSONB NOT NULL,
  operation       VARCHAR(10) NOT NULL,
  old_data        JSONB,
  new_data        JSONB,
  changed_columns JSONB NOT NULL,
  db_user         VARCHAR(100),
  changed_at      TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_changed_at ON public.audit_logs(table_name, changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON public.audit_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation_changed_at ON public.audit_logs(operation, changed_at);

CREATE OR REPLACE FUNCTION public.audit_record_key(p_table_name text, p_record jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_table_name = 'teacher_activities' THEN
    RETURN jsonb_build_object(
      'employee_id', p_record->'employee_id',
      'activity_id', p_record->'activity_id'
    );
  ELSIF p_table_name = 'child_parents' THEN
    RETURN jsonb_build_object(
      'child_id', p_record->'child_id',
      'parent_id', p_record->'parent_id'
    );
  ELSE
    RETURN jsonb_build_object('id', p_record->'id');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_json jsonb;
  v_new_json jsonb;
  v_old_sanitized jsonb;
  v_new_sanitized jsonb;
  v_key jsonb;
  v_changed_columns jsonb := '[]'::jsonb;
  v_table_fullname text := 'public.' || TG_TABLE_NAME;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_json := to_jsonb(NEW);
    v_key := public.audit_record_key(TG_TABLE_NAME, v_new_json);
    v_new_sanitized := v_new_json - 'password_hash';

    INSERT INTO public.audit_logs (
      table_name, record_key, operation, old_data, new_data, changed_columns, db_user, changed_at
    ) VALUES (
      v_table_fullname, v_key, 'INSERT', NULL, v_new_sanitized, '[]'::jsonb, CURRENT_USER, NOW()
    );

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);

    SELECT jsonb_agg(key) INTO v_changed_columns
    FROM (
      SELECT key FROM jsonb_each(v_old_json)
      WHERE (v_old_json->key) IS DISTINCT FROM (v_new_json->key)
    ) t;

    IF v_changed_columns IS NULL OR jsonb_array_length(v_changed_columns) = 0 THEN
      RETURN NEW;
    END IF;

    v_key := public.audit_record_key(TG_TABLE_NAME, v_new_json);
    v_old_sanitized := v_old_json - 'password_hash';
    v_new_sanitized := v_new_json - 'password_hash';

    INSERT INTO public.audit_logs (
      table_name, record_key, operation, old_data, new_data, changed_columns, db_user, changed_at
    ) VALUES (
      v_table_fullname, v_key, 'UPDATE', v_old_sanitized, v_new_sanitized, v_changed_columns, CURRENT_USER, NOW()
    );

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_old_json := to_jsonb(OLD);
    v_key := public.audit_record_key(TG_TABLE_NAME, v_old_json);
    v_old_sanitized := v_old_json - 'password_hash';

    INSERT INTO public.audit_logs (
      table_name, record_key, operation, old_data, new_data, changed_columns, db_user, changed_at
    ) VALUES (
      v_table_fullname, v_key, 'DELETE', v_old_sanitized, NULL, '[]'::jsonb, CURRENT_USER, NOW()
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_before_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec record;
  v_rec_json jsonb;
  v_rec_sanitized jsonb;
  v_key jsonb;
  v_table_fullname text := 'public.' || TG_TABLE_NAME;
  v_query text;
BEGIN
  v_query := format('SELECT * FROM public.%I', TG_TABLE_NAME);

  FOR v_rec IN EXECUTE v_query LOOP
    v_rec_json := to_jsonb(v_rec);
    v_key := public.audit_record_key(TG_TABLE_NAME, v_rec_json);
    v_rec_sanitized := v_rec_json - 'password_hash';

    INSERT INTO public.audit_logs (
      table_name, record_key, operation, old_data, new_data, changed_columns, db_user, changed_at
    ) VALUES (
      v_table_fullname, v_key, 'TRUNCATE', v_rec_sanitized, NULL, '[]'::jsonb, CURRENT_USER, NOW()
    );
  END LOOP;

  RETURN NULL;
END;
$$;

DO $$
DECLARE
  v_tbl text;
  v_tables text[] := ARRAY[
    'roles', 'users', 'employees', 'parents', 'rooms', 'groups', 'children', 
    'discounts', 'activities', 'teacher_activities', 'schedules', 'staff_assignments', 
    'rules', 'charges', 'payments', 'refunds', 'tariffs', 'meal_rates', 
    'adjustments', 'subscriptions', 'child_benefits', 'meal_plans', 
    'pricing_plans', 'expenses', 'child_parents'
  ];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row_%I ON public.%I;', v_tbl, v_tbl);
    EXECUTE format('
      CREATE TRIGGER audit_row_%I
      AFTER INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
    ', v_tbl, v_tbl);

    EXECUTE format('DROP TRIGGER IF EXISTS audit_truncate_%I ON public.%I;', v_tbl, v_tbl);
    EXECUTE format('
      CREATE TRIGGER audit_truncate_%I
      BEFORE TRUNCATE ON public.%I
      FOR EACH STATEMENT EXECUTE FUNCTION public.audit_before_truncate();
    ', v_tbl, v_tbl);
  END LOOP;
END $$;

GRANT SELECT ON public.audit_logs TO anon, authenticated, service_role;
GRANT ALL ON public.audit_logs TO audit_owner;