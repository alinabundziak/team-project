DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'audit_owner') THEN
        CREATE ROLE audit_owner;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id              SERIAL PRIMARY KEY,
    table_name      VARCHAR(100) NOT NULL,
    record_key      JSONB NOT NULL,
    operation       VARCHAR(10) NOT NULL,
    old_data        JSONB,
    new_data        JSONB,
    changed_columns JSONB NOT NULL,
    db_user         VARCHAR(100) DEFAULT SESSION_USER,
    changed_at      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.audit_logs OWNER TO audit_owner;

CREATE OR REPLACE FUNCTION public.audit_record_key(p_table text, p_row jsonb)
RETURNS jsonb AS $$
DECLARE
    v_pkey_col text;
    v_keys text[];
    v_result jsonb := '{}'::jsonb;
BEGIN
    SELECT c.column_name
    INTO v_pkey_col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage c
      ON c.constraint_name = tc.constraint_name
     AND c.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = p_table
    LIMIT 1;

    IF v_pkey_col IS NOT NULL THEN
        v_result := jsonb_build_object(v_pkey_col, p_row -> v_pkey_col);
    ELSE
        SELECT array_agg(attname::text)
        INTO v_keys
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = (quote_ident('public') || '.' || quote_ident(p_table))::regclass
          AND (i.indisprimary OR i.indisunique);

        IF v_keys IS NOT NULL THEN
            SELECT jsonb_object_agg(k, p_row -> k) INTO v_result
            FROM unnest(v_keys) k;
        ELSE
            v_result := p_row;
        END IF;
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.audit_record_key(text, jsonb) OWNER TO audit_owner;
REVOKE EXECUTE ON FUNCTION public.audit_record_key(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_record_key(text, jsonb) TO PUBLIC, postgres, authenticated, service_role, audit_owner;

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger AS $$
DECLARE
    v_old_data jsonb := NULL;
    v_new_data jsonb := NULL;
    v_changed_cols jsonb := '[]'::jsonb;
    v_record_key jsonb;
    v_op varchar(10);
BEGIN
    IF (TG_OP = 'INSERT') THEN
        v_op := 'INSERT';
        v_new_data := to_jsonb(NEW);
        v_record_key := public.audit_record_key(TG_TABLE_NAME, v_new_data);
        v_changed_cols := to_jsonb(array(SELECT jsonb_object_keys(v_new_data)));
        
        INSERT INTO public.audit_logs (table_name, record_key, operation, old_data, new_data, changed_columns)
        VALUES (TG_TABLE_NAME, v_record_key, v_op, NULL, v_new_data, v_changed_cols);
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        v_op := 'UPDATE';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_key := public.audit_record_key(TG_TABLE_NAME, v_new_data);
        
        SELECT coalesce(jsonb_agg(key), '[]'::jsonb)
        INTO v_changed_cols
        FROM jsonb_each(v_new_data) n
        WHERE n.value IS DISTINCT FROM (v_old_data -> n.key);

        IF jsonb_array_length(v_changed_cols) > 0 THEN
            INSERT INTO public.audit_logs (table_name, record_key, operation, old_data, new_data, changed_columns)
            VALUES (TG_TABLE_NAME, v_record_key, v_op, v_old_data, v_new_data, v_changed_cols);
        END IF;
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        v_op := 'DELETE';
        v_old_data := to_jsonb(OLD);
        v_record_key := public.audit_record_key(TG_TABLE_NAME, v_old_data);
        v_changed_cols := to_jsonb(array(SELECT jsonb_object_keys(v_old_data)));

        INSERT INTO public.audit_logs (table_name, record_key, operation, old_data, new_data, changed_columns)
        VALUES (TG_TABLE_NAME, v_record_key, v_op, v_old_data, NULL, v_changed_cols);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.audit_row_change() OWNER TO audit_owner;
REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_row_change() TO PUBLIC, postgres, authenticated, service_role, audit_owner;

CREATE OR REPLACE FUNCTION public.audit_before_truncate()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.audit_logs (table_name, record_key, operation, old_data, new_data, changed_columns)
    VALUES (TG_TABLE_NAME, '{}'::jsonb, 'TRUNCATE', NULL, NULL, '[]'::jsonb);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.audit_before_truncate() OWNER TO audit_owner;
REVOKE EXECUTE ON FUNCTION public.audit_before_truncate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_before_truncate() TO PUBLIC, postgres, authenticated, service_role, audit_owner;

GRANT USAGE ON SCHEMA public TO audit_owner;

GRANT SELECT ON 
    public.discounts,
    public.activities,
    public.teacher_activities,
    public.schedules,
    public.staff_assignments,
    public.rules,
    public.charges,
    public.payments,
    public.refunds,
    public.tariffs,
    public.meal_rates,
    public.adjustments,
    public.subscriptions,
    public.child_benefits,
    public.meal_plans,
    public.pricing_plans,
    public.expenses,
    public.child_parents,
    public.roles,
    public.users,
    public.employees,
    public.parents,
    public.rooms,
    public.groups,
    public.children
TO audit_owner;

DO $$
DECLARE
    tbl text;
    tbls text[] := ARRAY[
        'discounts', 'activities', 'teacher_activities', 'schedules', 'staff_assignments',
        'rules', 'charges', 'payments', 'refunds', 'tariffs',
        'meal_rates', 'adjustments', 'subscriptions', 'child_benefits', 'meal_plans',
        'pricing_plans', 'expenses', 'child_parents', 'roles', 'users',
        'employees', 'parents', 'rooms', 'groups', 'children'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbls
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_row_change ON public.%I;', tbl);
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_truncate ON public.%I;', tbl);

        EXECUTE format('
            CREATE TRIGGER trg_audit_row_change
            AFTER INSERT OR UPDATE OR DELETE ON public.%I
            FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
        ', tbl);

        EXECUTE format('
            CREATE TRIGGER trg_audit_truncate
            BEFORE TRUNCATE ON public.%I
            FOR EACH STATEMENT EXECUTE FUNCTION public.audit_before_truncate();
        ', tbl);
    END LOOP;
END
$$;
