-- Stepped sequence padding (4 -> 6 -> 8 digits) and prevent LPAD truncation after 9999
CREATE OR REPLACE FUNCTION public.get_next_sequence(p_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_prefix TEXT;
    v_padding INT;
    v_next_val BIGINT;
    v_len INT;
    v_target_pad INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 1. First try atomic UPDATE on existing sequence row for this user
    UPDATE public.sequences
    SET current_val = COALESCE(current_val, 0) + 1,
        updated_at = now()
    WHERE user_id = v_user_id
      AND UPPER(key) = UPPER(p_key)
    RETURNING prefix, padding, current_val INTO v_prefix, v_padding, v_next_val;

    -- 2. If no sequence row exists yet for this user & key, insert initial row
    IF v_prefix IS NULL THEN
        INSERT INTO public.sequences (user_id, key, prefix, padding, current_val)
        VALUES (v_user_id, UPPER(p_key), UPPER(LEFT(p_key, 3)), 4, 1)
        RETURNING prefix, padding, current_val INTO v_prefix, v_padding, v_next_val;
    END IF;

    IF v_prefix IS NULL THEN
        v_prefix := UPPER(LEFT(p_key, 3));
        v_padding := 4;
        v_next_val := 1;
    END IF;

    v_len := LENGTH(v_next_val::text);
    v_target_pad := GREATEST(
        COALESCE(v_padding, 4),
        CASE
            WHEN v_len <= 4 THEN 4
            WHEN v_len <= 6 THEN 6
            WHEN v_len <= 8 THEN 8
            ELSE v_len
        END
    );

    RETURN v_prefix || '-' || LPAD(v_next_val::text, v_target_pad, '0');
END;
$function$;
