--
-- PostgreSQL database dump
--

\restrict w92ZF3lsw9YDUnxRcbxa3DPJv00uLneu9yPIlXKCW6tjsHmweOKmUMKaRgFsAaZ

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


--
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;


--
-- Name: EXTENSION pg_net; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_net IS 'Async HTTP';


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: http; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA public;


--
-- Name: EXTENSION http; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION http IS 'HTTP client for PostgreSQL, allows web page retrieval inside the database.';


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: campaign_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.campaign_type AS ENUM (
    'linkedin_connection',
    'linkedin_dm',
    'email'
);


--
-- Name: reply_intent; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reply_intent AS ENUM (
    'interested',
    'curious',
    'objection',
    'timing',
    'wrong_person',
    'not_interested',
    'question',
    'vague_positive'
);


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: approve_comment_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_comment_by_token(p_token text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_post RECORD;
BEGIN
  SELECT id, approval_status, ai_comment, post_url INTO v_post
  FROM linkedin_posts_discovered WHERE approval_token = p_token;
  IF v_post IS NULL THEN RETURN json_build_object('success', false, 'error', 'Invalid token'); END IF;
  IF v_post.approval_status != 'pending' THEN RETURN json_build_object('success', false, 'error', 'Already processed', 'status', v_post.approval_status); END IF;
  UPDATE linkedin_posts_discovered SET approval_status = 'approved', approved_at = NOW(), updated_at = NOW() WHERE approval_token = p_token;
  RETURN json_build_object('success', true, 'post_id', v_post.id, 'comment', v_post.ai_comment, 'post_url', v_post.post_url);
END; $$;


--
-- Name: associate_account_atomic(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.associate_account_atomic(p_user_id uuid, p_workspace_id uuid, p_unipile_account_id text, p_account_data jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result JSONB;
  v_account_name TEXT;
  v_account_email TEXT;
  v_account_type TEXT;
  v_platform TEXT;
  v_linkedin_account_type TEXT;
  v_unipile_type TEXT;
  v_account_identifier TEXT;
BEGIN
  -- Validate required inputs
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'workspace_id cannot be null - account connections require workspace context';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;

  IF p_unipile_account_id IS NULL OR p_unipile_account_id = '' THEN
    RAISE EXCEPTION 'unipile_account_id cannot be null or empty';
  END IF;

  -- Detect account type from Unipile data
  v_unipile_type := UPPER(COALESCE(p_account_data->>'type', ''));

  -- Map Unipile type to our account_type and platform
  IF v_unipile_type = 'LINKEDIN' THEN
    v_account_type := 'linkedin';
    v_platform := 'LINKEDIN';
  ELSIF v_unipile_type LIKE '%GOOGLE%' OR v_unipile_type LIKE '%GMAIL%' THEN
    v_account_type := 'email';
    v_platform := 'GOOGLE';
  ELSIF v_unipile_type LIKE '%OUTLOOK%' OR v_unipile_type LIKE '%MICROSOFT%' OR v_unipile_type LIKE '%OFFICE365%' THEN
    v_account_type := 'email';
    v_platform := 'OUTLOOK';
  ELSIF v_unipile_type = 'MESSAGING' OR v_unipile_type = 'SMTP' THEN
    v_account_type := 'email';
    v_platform := 'SMTP';
  ELSE
    -- Default to email for unknown types
    v_account_type := 'email';
    v_platform := v_unipile_type;
  END IF;

  -- Extract account details from JSON
  v_account_name := COALESCE(
    p_account_data->>'name',
    p_account_data->>'display_name',
    p_account_data->'connection_params'->'im'->>'email',
    p_account_data->'connection_params'->>'email',
    p_account_data->>'email',
    'Account'
  );

  v_account_email := COALESCE(
    p_account_data->'connection_params'->'im'->>'email',
    p_account_data->'connection_params'->>'email',
    p_account_data->>'email',
    p_account_data->>'identifier'
  );

  -- Account identifier (email or LinkedIn URL)
  v_account_identifier := COALESCE(v_account_email, p_unipile_account_id);

  -- LinkedIn-specific type
  v_linkedin_account_type := CASE
    WHEN v_account_type = 'linkedin' THEN COALESCE(p_account_data->>'account_type', 'personal')
    ELSE NULL
  END;

  -- ATOMIC OPERATION: Insert/update both tables in single transaction

  -- 1. Insert into user_unipile_accounts (user's personal account list)
  INSERT INTO user_unipile_accounts (
    user_id,
    unipile_account_id,
    platform,
    account_name,
    account_email,
    linkedin_account_type,
    connection_status,
    account_metadata,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_unipile_account_id,
    v_platform,
    v_account_name,
    v_account_email,
    v_linkedin_account_type,
    'active',
    p_account_data,
    NOW(),
    NOW()
  )
  ON CONFLICT (unipile_account_id) DO UPDATE SET
    connection_status = 'active',
    account_name = EXCLUDED.account_name,
    account_email = EXCLUDED.account_email,
    linkedin_account_type = EXCLUDED.linkedin_account_type,
    account_metadata = EXCLUDED.account_metadata,
    updated_at = NOW();

  -- 2. Insert into workspace_accounts (workspace's accessible accounts for campaigns)
  INSERT INTO workspace_accounts (
    workspace_id,
    user_id,
    account_type,
    account_identifier,
    account_name,
    unipile_account_id,
    connection_status,
    connected_at,
    is_active,
    account_metadata,
    created_at,
    updated_at
  ) VALUES (
    p_workspace_id,
    p_user_id,
    v_account_type,
    v_account_identifier,
    v_account_name,
    p_unipile_account_id,
    'connected',
    NOW(),
    TRUE,
    p_account_data,
    NOW(),
    NOW()
  )
  ON CONFLICT (workspace_id, user_id, account_type, account_identifier) DO UPDATE SET
    unipile_account_id = EXCLUDED.unipile_account_id,
    connection_status = 'connected',
    connected_at = NOW(),
    is_active = TRUE,
    account_name = EXCLUDED.account_name,
    account_metadata = EXCLUDED.account_metadata,
    updated_at = NOW();

  -- Return success result
  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', p_user_id,
    'workspace_id', p_workspace_id,
    'unipile_account_id', p_unipile_account_id,
    'account_type', v_account_type,
    'platform', v_platform,
    'account_name', v_account_name,
    'message', format('%s account associated successfully with both user and workspace', UPPER(v_account_type))
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Automatic rollback on ANY error
    RAISE EXCEPTION 'Failed to associate account: %', SQLERRM;
END;
$$;


--
-- Name: FUNCTION associate_account_atomic(p_user_id uuid, p_workspace_id uuid, p_unipile_account_id text, p_account_data jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.associate_account_atomic(p_user_id uuid, p_workspace_id uuid, p_unipile_account_id text, p_account_data jsonb) IS 'Atomically associates a Unipile account (LinkedIn or Email) with both user_unipile_accounts and workspace_accounts tables.
Supports LinkedIn, Google, Outlook, and SMTP accounts.
Prevents silent failures and table drift by ensuring both operations succeed or both fail.
Used by OAuth callback handlers to ensure data consistency.';


--
-- Name: associate_linkedin_account_atomic(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.associate_linkedin_account_atomic(p_user_id uuid, p_workspace_id uuid, p_unipile_account_id text, p_account_data jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_result JSONB;
    v_account_name TEXT;
    v_account_email TEXT;
    v_linkedin_account_type TEXT;
  BEGIN
    IF p_workspace_id IS NULL THEN
      RAISE EXCEPTION 'workspace_id cannot be null - account connections require workspace context';
    END IF;

    IF p_user_id IS NULL THEN
      RAISE EXCEPTION 'user_id cannot be null';
    END IF;

    IF p_unipile_account_id IS NULL OR p_unipile_account_id = '' THEN
      RAISE EXCEPTION 'unipile_account_id cannot be null or empty';
    END IF;

    v_account_name := COALESCE(
      p_account_data->>'name',
      p_account_data->>'display_name',
      p_account_data->>'email',
      'LinkedIn Account'
    );

    v_account_email := COALESCE(
      p_account_data->'connection_params'->'im'->>'email',
      p_account_data->>'email',
      p_account_data->>'identifier'
    );

    v_linkedin_account_type := COALESCE(
      p_account_data->>'account_type',
      'personal'
    );

    INSERT INTO user_unipile_accounts (
      user_id,
      unipile_account_id,
      platform,
      account_name,
      account_email,
      linkedin_account_type,
      connection_status,
      account_metadata,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      p_unipile_account_id,
      'LINKEDIN',
      v_account_name,
      v_account_email,
      v_linkedin_account_type,
      'active',
      p_account_data,
      NOW(),
      NOW()
    )
    ON CONFLICT (unipile_account_id) DO UPDATE SET
      connection_status = 'active',
      account_name = EXCLUDED.account_name,
      account_email = EXCLUDED.account_email,
      linkedin_account_type = EXCLUDED.linkedin_account_type,
      account_metadata = EXCLUDED.account_metadata,
      updated_at = NOW();

    INSERT INTO workspace_accounts (
      workspace_id,
      user_id,
      account_type,
      account_identifier,
      account_name,
      unipile_account_id,
      connection_status,
      connected_at,
      is_active,
      account_metadata,
      created_at,
      updated_at
    ) VALUES (
      p_workspace_id,
      p_user_id,
      'linkedin',
      COALESCE(v_account_email, p_unipile_account_id),
      v_account_name,
      p_unipile_account_id,
      'connected',
      NOW(),
      TRUE,
      p_account_data,
      NOW(),
      NOW()
    )
    ON CONFLICT (workspace_id, user_id, account_type, account_identifier) DO UPDATE SET
      unipile_account_id = EXCLUDED.unipile_account_id,
      connection_status = 'connected',
      connected_at = NOW(),
      is_active = TRUE,
      account_name = EXCLUDED.account_name,
      account_metadata = EXCLUDED.account_metadata,
      updated_at = NOW();

    RETURN jsonb_build_object(
      'success', TRUE,
      'user_id', p_user_id,
      'workspace_id', p_workspace_id,
      'unipile_account_id', p_unipile_account_id,
      'account_name', v_account_name,
      'message', 'LinkedIn account associated successfully with both user and workspace'
    );

  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to associate LinkedIn account: %', SQLERRM;
  END;
  $$;


--
-- Name: auto_assign_client_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_assign_client_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only assign if client_code is NULL or empty
  IF NEW.client_code IS NULL OR TRIM(NEW.client_code) = '' THEN
    NEW.client_code := derive_client_code(NEW.name);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: auto_cleanup_stale_executions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_cleanup_stale_executions() RETURNS TABLE(reset_count integer, affected_campaigns text[])
    LANGUAGE plpgsql
    AS $$
  DECLARE
    v_reset_count INTEGER;
    v_campaign_names TEXT[];
  BEGIN
    -- Reset prospects stuck in queued_in_n8n for more than 2 hours
    WITH updated AS (
      UPDATE campaign_prospects cp
      SET
        status = 'pending',
        updated_at = NOW()
      WHERE
        cp.status = 'queued_in_n8n'
        AND cp.updated_at < NOW() - INTERVAL '2 hours'
      RETURNING cp.id, cp.campaign_id
    ),
    campaign_info AS (
      SELECT DISTINCT c.name
      FROM updated u
      JOIN campaigns c ON c.id = u.campaign_id
    )
    SELECT
      COUNT(*)::INTEGER,
      ARRAY_AGG(name)
    INTO v_reset_count, v_campaign_names
    FROM campaign_info;

    -- Log the action
    IF v_reset_count > 0 THEN
      RAISE NOTICE 'Auto-cleanup: Reset % stale prospects from campaigns: %',
        v_reset_count, v_campaign_names;
    END IF;

    RETURN QUERY SELECT v_reset_count, v_campaign_names;
  END;
  $$;


--
-- Name: FUNCTION auto_cleanup_stale_executions(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_cleanup_stale_executions() IS 'Resets prospects stuck in queued_in_n8n for >2 hours';


--
-- Name: auto_delete_expired_prospects(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_delete_expired_prospects(p_batch_size integer DEFAULT 100) RETURNS TABLE(deleted_count integer, workspace_id text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_workspace_id TEXT;
  v_deleted INTEGER;
BEGIN
  -- Process each workspace
  FOR v_workspace_id IN
    SELECT DISTINCT wp.workspace_id
    FROM workspace_prospects wp
    WHERE wp.scheduled_deletion_date <= NOW()
      AND wp.scheduled_deletion_date IS NOT NULL
    LIMIT p_batch_size
  LOOP
    -- Delete expired prospects
    DELETE FROM workspace_prospects
    WHERE workspace_id = v_workspace_id
      AND scheduled_deletion_date <= NOW()
      AND scheduled_deletion_date IS NOT NULL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    IF v_deleted > 0 THEN
      RETURN QUERY SELECT v_deleted, v_workspace_id;
    END IF;
  END LOOP;
END;
$$;


--
-- Name: FUNCTION auto_delete_expired_prospects(p_batch_size integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_delete_expired_prospects(p_batch_size integer) IS 'Automatically deletes prospects past retention period (run via cron)';


--
-- Name: auto_pause_failing_campaigns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_pause_failing_campaigns() RETURNS TABLE(paused_count integer, paused_campaigns jsonb)
    LANGUAGE plpgsql
    AS $$
  DECLARE
    v_paused_count INTEGER := 0;
    v_paused_campaigns JSONB := '[]'::JSONB;
  BEGIN
    -- Find campaigns with high failure rates
    WITH campaign_stats AS (
      SELECT
        c.id,
        c.name,
        c.workspace_id,
        COUNT(*) FILTER (WHERE cp.status IN ('failed', 'error')) as failed_count,
        COUNT(*) as total_count,
        (COUNT(*) FILTER (WHERE cp.status IN ('failed', 'error'))::FLOAT /
         NULLIF(COUNT(*), 0)::FLOAT) as failure_rate
      FROM campaigns c
      JOIN campaign_prospects cp ON cp.campaign_id = c.id
      WHERE
        c.status = 'active'
        AND cp.updated_at > NOW() - INTERVAL '24 hours'
      GROUP BY c.id, c.name, c.workspace_id
      HAVING
        COUNT(*) >= 10  -- At least 10 prospects attempted
        AND (COUNT(*) FILTER (WHERE cp.status IN ('failed', 'error'))::FLOAT /
             NULLIF(COUNT(*), 0)::FLOAT) > 0.5  -- >50% failure rate
    ),
    paused AS (
      UPDATE campaigns c
      SET
        status = 'paused',
        updated_at = NOW()
      FROM campaign_stats cs
      WHERE c.id = cs.id
      RETURNING
        c.id,
        c.name,
        cs.failure_rate,
        cs.failed_count,
        cs.total_count
    )
    SELECT
      COUNT(*)::INTEGER,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', id,
          'name', name,
          'failure_rate', ROUND(failure_rate::NUMERIC, 2),
          'failed', failed_count,
          'total', total_count
        )
      )
    INTO v_paused_count, v_paused_campaigns
    FROM paused;

    -- Log the action
    IF v_paused_count > 0 THEN
      RAISE NOTICE 'Auto-pause: Paused % failing campaigns: %',
        v_paused_count, v_paused_campaigns;
    END IF;

    RETURN QUERY SELECT v_paused_count, v_paused_campaigns;
  END;
  $$;


--
-- Name: FUNCTION auto_pause_failing_campaigns(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_pause_failing_campaigns() IS 'Pauses campaigns with >50% failure rate in last 24 hours';


--
-- Name: auto_resume_after_rate_limits(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_resume_after_rate_limits() RETURNS TABLE(resumed_count integer, resumed_campaigns text[])
    LANGUAGE plpgsql
    AS $$
  DECLARE
    v_resumed_count INTEGER := 0;
    v_campaign_names TEXT[];
  BEGIN
    -- Find campaigns that were auto-paused and can be resumed
    -- (No rate_limited prospects in last 24 hours)
    WITH safe_campaigns AS (
      SELECT DISTINCT c.id, c.name
      FROM campaigns c
      WHERE
        c.status = 'paused'
        AND c.updated_at > NOW() - INTERVAL '7 days'  -- Recently paused (within a week)
        AND NOT EXISTS (
          SELECT 1
          FROM campaign_prospects cp
          WHERE
            cp.campaign_id = c.id
            AND cp.status = 'rate_limited'
            AND cp.updated_at > NOW() - INTERVAL '24 hours'  -- FIXED: Was 30 minutes
        )
        AND EXISTS (
          SELECT 1
          FROM campaign_prospects cp
          WHERE cp.campaign_id = c.id AND cp.status = 'pending'
          LIMIT 1
        )
    ),
    resumed AS (
      UPDATE campaigns c
      SET
        status = 'active',
        updated_at = NOW()
      FROM safe_campaigns sc
      WHERE c.id = sc.id
      RETURNING c.id, c.name
    )
    SELECT
      COUNT(*)::INTEGER,
      ARRAY_AGG(name)
    INTO v_resumed_count, v_campaign_names
    FROM resumed;

    -- Log the action
    IF v_resumed_count > 0 THEN
      RAISE NOTICE 'Auto-resume: Resumed % campaigns after 24 hour rate limit period: %',
        v_resumed_count, v_campaign_names;
    END IF;

    RETURN QUERY SELECT v_resumed_count, v_campaign_names;
  END;
  $$;


--
-- Name: FUNCTION auto_resume_after_rate_limits(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_resume_after_rate_limits() IS 'Resumes paused campaigns after 24 hour rate limit period';


--
-- Name: auto_retry_rate_limited_prospects(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_retry_rate_limited_prospects() RETURNS TABLE(reset_count integer, campaign_ids uuid[])
    LANGUAGE plpgsql
    AS $$
  DECLARE
    v_reset_count INTEGER;
    v_campaign_ids UUID[];
  BEGIN
    -- Reset prospects that were rate limited more than 24 hours ago
    WITH updated AS (
      UPDATE campaign_prospects
      SET
        status = 'pending',
        updated_at = NOW()
      WHERE
        status = 'rate_limited'
        AND updated_at < NOW() - INTERVAL '24 hours'  -- FIXED: Was 30 minutes
      RETURNING id, campaign_id
    )
    SELECT
      COUNT(*)::INTEGER,
      ARRAY_AGG(DISTINCT campaign_id)
    INTO v_reset_count, v_campaign_ids
    FROM updated;

    -- Log the action
    IF v_reset_count > 0 THEN
      RAISE NOTICE 'Auto-retry: Reset % rate-limited prospects from % campaigns after 24 hour 
  wait',
        v_reset_count, ARRAY_LENGTH(v_campaign_ids, 1);
    END IF;

    RETURN QUERY SELECT v_reset_count, v_campaign_ids;
  END;
  $$;


--
-- Name: FUNCTION auto_retry_rate_limited_prospects(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_retry_rate_limited_prospects() IS 'Automatically retries prospects that were rate limited >24 hours ago';


--
-- Name: block_duplicate_prospects(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.block_duplicate_prospects(p_campaign_id uuid, p_workspace_id uuid) RETURNS TABLE(blocked_count integer, blocked_prospects jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_blocked_count INTEGER := 0;
    v_blocked_list JSONB := '[]'::JSONB;
    v_contacted_urls TEXT[];
    v_contacted_emails TEXT[];
  BEGIN
    -- Step 1: Get all LinkedIn URLs and emails that have been contacted in this workspace
    SELECT
      ARRAY_AGG(DISTINCT LOWER(TRIM(TRAILING '/' FROM linkedin_url))) FILTER (WHERE linkedin_url IS NOT NULL),
      ARRAY_AGG(DISTINCT LOWER(TRIM(email))) FILTER (WHERE email IS NOT NULL)
    INTO v_contacted_urls, v_contacted_emails
    FROM campaign_prospects
    WHERE workspace_id = p_workspace_id
      AND (status = 'connection_requested' OR contacted_at IS NOT NULL)
      AND campaign_id != p_campaign_id; -- Exclude current campaign (allow retries within same campaign)

    -- Step 2: Find prospects in current campaign that match already-contacted URLs/emails
    WITH duplicates AS (
      SELECT
        id,
        first_name,
        last_name,
        linkedin_url,
        email,
        CASE
          WHEN LOWER(TRIM(TRAILING '/' FROM linkedin_url)) = ANY(v_contacted_urls) THEN 'linkedin_url'
          WHEN LOWER(TRIM(email)) = ANY(v_contacted_emails) THEN 'email'
          ELSE NULL
        END as duplicate_reason
      FROM campaign_prospects
      WHERE campaign_id = p_campaign_id
        AND status IN ('pending', 'approved', 'ready_to_message')
        AND (
          LOWER(TRIM(TRAILING '/' FROM linkedin_url)) = ANY(v_contacted_urls)
          OR LOWER(TRIM(email)) = ANY(v_contacted_emails)
        )
    )
    -- Step 3: Update duplicates to 'duplicate_blocked' status
    UPDATE campaign_prospects cp
    SET
      status = 'duplicate_blocked',
      updated_at = NOW(),
      personalization_data = COALESCE(cp.personalization_data, '{}'::JSONB) ||
        jsonb_build_object(
          'blocked_reason', d.duplicate_reason,
          'blocked_at', NOW()::TEXT,
          'blocked_by', 'duplicate_prevention_system'
        )
    FROM duplicates d
    WHERE cp.id = d.id
    RETURNING cp.id, cp.first_name, cp.last_name, cp.linkedin_url, d.duplicate_reason
    INTO v_blocked_count, v_blocked_list;

    -- Step 4: Return count and list of blocked prospects
    RETURN QUERY
    SELECT
      COALESCE(v_blocked_count, 0)::INTEGER as blocked_count,
      COALESCE(v_blocked_list, '[]'::JSONB) as blocked_prospects;
  END;
  $$;


--
-- Name: FUNCTION block_duplicate_prospects(p_campaign_id uuid, p_workspace_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.block_duplicate_prospects(p_campaign_id uuid, p_workspace_id uuid) IS 'Marks prospects as duplicate_blocked if their LinkedIn URL or email has already been contacted in another campaign.
  Call this BEFORE triggering N8N workflows to prevent duplicate LinkedIn API calls and rate limiting.';


--
-- Name: calculate_scheduled_deletion_date(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_scheduled_deletion_date(p_prospect_id uuid) RETURNS timestamp with time zone
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_workspace_id TEXT;
  v_retention_days INTEGER;
  v_last_activity_date TIMESTAMPTZ;
  v_is_eu BOOLEAN;
BEGIN
  -- Get prospect details
  SELECT
    workspace_id::uuid,
    is_eu_resident,
    data_retention_days,
    GREATEST(created_at, updated_at, COALESCE(consent_date, created_at))
  INTO v_workspace_id, v_is_eu, v_retention_days, v_last_activity_date
  FROM workspace_prospects
  WHERE id = p_prospect_id;

  -- Get workspace retention policy
  IF v_is_eu = true THEN
    SELECT eu_resident_retention_days INTO v_retention_days
    FROM data_retention_policies
    WHERE workspace_id = v_workspace_id
      AND is_active = true
    LIMIT 1;
  ELSE
    SELECT non_eu_retention_days INTO v_retention_days
    FROM data_retention_policies
    WHERE workspace_id = v_workspace_id
      AND is_active = true
    LIMIT 1;
  END IF;

  -- Default to 2 years if no policy
  v_retention_days := COALESCE(v_retention_days, 730);

  RETURN v_last_activity_date + (v_retention_days || ' days')::INTERVAL;
END;
$$;


--
-- Name: can_send_cr(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_send_cr(p_account_id text, p_daily_limit integer DEFAULT 20) RETURNS TABLE(can_send boolean, sent_today integer, remaining integer, limit_reached boolean)
    LANGUAGE plpgsql
    AS $$
  DECLARE
    v_sent_today INTEGER;
    v_remaining INTEGER;
  BEGIN
    v_sent_today := get_daily_cr_count(p_account_id);
    v_remaining := GREATEST(0, p_daily_limit - v_sent_today);

    RETURN QUERY SELECT
      (v_sent_today < p_daily_limit)::BOOLEAN as can_send,
      v_sent_today,
      v_remaining,
      (v_sent_today >= p_daily_limit)::BOOLEAN as limit_reached;
  END;
  $$;


--
-- Name: check_integration_health_daily(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_integration_health_daily() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
     DECLARE
       v_total_accounts INTEGER;
       v_active_accounts INTEGER;
       v_inactive_accounts INTEGER;
       v_status TEXT := 'success';
     BEGIN
       -- Count workspace accounts
       SELECT
         COUNT(*) INTO v_total_accounts
       FROM workspace_accounts;

       SELECT
         COUNT(*) FILTER (WHERE is_active = true) INTO v_active_accounts
       FROM workspace_accounts;

       v_inactive_accounts := v_total_accounts - v_active_accounts;

       -- Log results
       INSERT INTO public.cron_job_logs (job_name, status, details)
       VALUES (
         'check_integration_health',
         v_status,
         jsonb_build_object(
           'total_accounts', v_total_accounts,
           'active_accounts', v_active_accounts,
           'inactive_accounts', v_inactive_accounts
         )
       );
     END;
     $$;


--
-- Name: check_lead_search_quota(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_lead_search_quota(p_workspace_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_tier_record workspace_tiers%ROWTYPE;
  v_quota_available INTEGER;
BEGIN
  -- Get workspace tier info
  SELECT * INTO v_tier_record
  FROM workspace_tiers
  WHERE workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_quota', false,
      'reason', 'no_tier_configured',
      'quota_remaining', 0
    );
  END IF;

  -- Check if quota needs reset (monthly)
  IF v_tier_record.search_quota_reset_date < CURRENT_DATE THEN
    -- Reset quota
    UPDATE workspace_tiers
    SET
      monthly_lead_searches_used = 0,
      search_quota_reset_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE workspace_id = p_workspace_id;

    v_tier_record.monthly_lead_searches_used := 0;
  END IF;

  -- Calculate remaining quota
  v_quota_available := v_tier_record.monthly_lead_search_quota - v_tier_record.monthly_lead_searches_used;

  IF v_quota_available <= 0 THEN
    RETURN jsonb_build_object(
      'has_quota', false,
      'reason', 'quota_exceeded',
      'quota_used', v_tier_record.monthly_lead_searches_used,
      'quota_limit', v_tier_record.monthly_lead_search_quota,
      'quota_remaining', 0,
      'tier', v_tier_record.tier,
      'search_tier', v_tier_record.lead_search_tier
    );
  END IF;

  RETURN jsonb_build_object(
    'has_quota', true,
    'quota_used', v_tier_record.monthly_lead_searches_used,
    'quota_limit', v_tier_record.monthly_lead_search_quota,
    'quota_remaining', v_quota_available,
    'tier', v_tier_record.tier,
    'search_tier', v_tier_record.lead_search_tier,
    'reset_date', v_tier_record.search_quota_reset_date
  );
END;
$$;


--
-- Name: FUNCTION check_lead_search_quota(p_workspace_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_lead_search_quota(p_workspace_id uuid) IS 'Checks if workspace has remaining lead search quota for the current month';


--
-- Name: check_linkedin_comment_rate_limit(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_linkedin_comment_rate_limit(p_workspace_id uuid, p_period_hours integer DEFAULT 1) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  comments_in_period INTEGER;
  hourly_limit INTEGER := 10;
  daily_limit INTEGER := 50;
  result JSONB;
BEGIN
  SELECT COUNT(*) INTO comments_in_period
  FROM linkedin_comments_posted
  WHERE workspace_id = p_workspace_id
    AND posted_at > NOW() - (p_period_hours || ' hours')::INTERVAL;

  result := jsonb_build_object(
    'within_limits', CASE
      WHEN p_period_hours = 1 THEN comments_in_period < hourly_limit
      WHEN p_period_hours = 24 THEN comments_in_period < daily_limit
      ELSE true
    END,
    'count', comments_in_period,
    'limit', CASE
      WHEN p_period_hours = 1 THEN hourly_limit
      WHEN p_period_hours = 24 THEN daily_limit
      ELSE 0
    END,
    'remaining', CASE
      WHEN p_period_hours = 1 THEN GREATEST(0, hourly_limit - comments_in_period)
      WHEN p_period_hours = 24 THEN GREATEST(0, daily_limit - comments_in_period)
      ELSE 0
    END
  );

  RETURN result;
END;
$$;


--
-- Name: check_linkedin_search_quota(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_linkedin_search_quota(p_account_id text) RETURNS TABLE(usage_last_24h integer, daily_limit integer, remaining integer, is_blocked boolean, account_type text)
    LANGUAGE plpgsql
    AS $$
DECLARE 
    v_usage INTEGER;
    v_limit INTEGER;
    v_account_type TEXT;
BEGIN 
    SELECT 
        CASE
            WHEN (account_metadata->'connection_params'->'im'->'premiumFeatures') ? 'sales_navigator' THEN 'sales_navigator'
            WHEN (account_metadata->'connection_params'->'im'->'premiumFeatures') ? 'recruiter' THEN 'recruiter'
            ELSE 'classic'
        END INTO v_account_type
    FROM public.workspace_accounts
    WHERE unipile_account_id = p_account_id;

    v_limit := CASE WHEN v_account_type IN ('sales_navigator', 'recruiter') THEN 5000 ELSE 1000 END;

    SELECT COALESCE(SUM(results_count), 0) INTO v_usage
    FROM public.linkedin_searches
    WHERE unipile_account_id = p_account_id AND searched_at > NOW() - INTERVAL '24 hours';

    RETURN QUERY SELECT v_usage, v_limit, GREATEST(0, v_limit - v_usage), (v_usage >= v_limit), v_account_type;
END; $$;


--
-- Name: check_orphaned_data_daily(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_orphaned_data_daily() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
     DECLARE
       v_orphaned_campaigns INTEGER;
       v_orphaned_prospects INTEGER;
       v_orphaned_sessions INTEGER;
       v_status TEXT := 'success';
     BEGIN
       -- Count orphaned campaigns
       SELECT COUNT(*) INTO v_orphaned_campaigns
       FROM campaigns
       WHERE workspace_id IS NULL;

       -- Count orphaned prospects
       SELECT COUNT(*) INTO v_orphaned_prospects
       FROM campaign_prospects
       WHERE campaign_id NOT IN (SELECT id FROM campaigns);

       -- Count orphaned approval sessions
       SELECT COUNT(*) INTO v_orphaned_sessions
       FROM prospect_approval_sessions
       WHERE workspace_id IS NULL;

       -- Set status
       IF v_orphaned_campaigns > 0 OR v_orphaned_prospects > 0 OR v_orphaned_sessions > 0 THEN
         v_status := 'warning';
       END IF;

       -- Log results
       INSERT INTO public.cron_job_logs (job_name, status, details)
       VALUES (
         'check_orphaned_data',
         v_status,
         jsonb_build_object(
           'orphaned_campaigns', v_orphaned_campaigns,
           'orphaned_prospects', v_orphaned_prospects,
           'orphaned_sessions', v_orphaned_sessions
         )
       );
     END;
     $$;


--
-- Name: check_workspace_health_daily(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_workspace_health_daily() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
     DECLARE
       v_workspaces_without_owners INTEGER;
       v_workspaces_without_members INTEGER;
       v_status TEXT := 'success';
     BEGIN
       -- Count workspaces without owners
       SELECT COUNT(*) INTO v_workspaces_without_owners
       FROM workspaces w
       WHERE NOT EXISTS (
         SELECT 1 FROM workspace_members wm
         WHERE wm.workspace_id = w.id
           AND wm.role = 'owner'
           AND wm.status = 'active'
       );

       -- Count workspaces without any members
       SELECT COUNT(*) INTO v_workspaces_without_members
       FROM workspaces w
       WHERE NOT EXISTS (
         SELECT 1 FROM workspace_members wm
         WHERE wm.workspace_id = w.id
           AND wm.status = 'active'
       );

       -- Set status
       IF v_workspaces_without_owners > 0 OR v_workspaces_without_members > 0 THEN
         v_status := 'warning';
       END IF;

       -- Log results
       INSERT INTO public.cron_job_logs (job_name, status, details)
       VALUES (
         'check_workspace_health',
         v_status,
         jsonb_build_object(
           'workspaces_without_owners', v_workspaces_without_owners,
           'workspaces_without_members', v_workspaces_without_members
         )
       );
     END;
     $$;


--
-- Name: cleanup_corrupted_prospect_statuses(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_corrupted_prospect_statuses() RETURNS TABLE(fixed_count bigint, campaign_ids text[])
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_fixed_count BIGINT;
  v_campaign_ids TEXT[];
BEGIN
  -- Get list of affected campaigns before fix
  SELECT ARRAY_AGG(DISTINCT campaign_id::TEXT)
  INTO v_campaign_ids
  FROM campaign_prospects
  WHERE status = 'connection_request_sent'
  AND contacted_at IS NULL;

  -- Fix prospects marked as "sent" but never actually sent
  UPDATE campaign_prospects
  SET 
    status = 'pending',
    updated_at = NOW()
  WHERE status = 'connection_request_sent'
  AND contacted_at IS NULL;

  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;

  RETURN QUERY SELECT v_fixed_count, v_campaign_ids;
END;
$$;


--
-- Name: cleanup_expired_oauth_states(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_oauth_states() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$;


--
-- Name: cleanup_old_enrichment_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_enrichment_jobs() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM enrichment_jobs
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND completed_at < NOW() - INTERVAL '7 days';
END;
$$;


--
-- Name: cleanup_old_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_logs() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
     DECLARE
       v_deleted INTEGER;
     BEGIN
       -- Delete logs older than 30 days
       DELETE FROM public.cron_job_logs
       WHERE created_at < NOW() - INTERVAL '30 days';

       GET DIAGNOSTICS v_deleted = ROW_COUNT;

       -- Log the cleanup
       INSERT INTO public.cron_job_logs (job_name, status, details)
       VALUES (
         'cleanup_old_logs',
         'success',
         jsonb_build_object('deleted_logs', v_deleted)
       );
     END;
     $$;


--
-- Name: cleanup_orphaned_kb_entries(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_orphaned_kb_entries() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete sam_icp_knowledge_entries with no source and no session
    DELETE FROM public.sam_icp_knowledge_entries
    WHERE source_attachment_id IS NULL
    AND discovery_session_id IS NULL
    AND created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$;


--
-- Name: create_campaign(uuid, text, text, text, jsonb, text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_campaign(p_workspace_id uuid, p_name text, p_description text DEFAULT NULL::text, p_campaign_type text DEFAULT 'multi_channel'::text, p_target_icp jsonb DEFAULT '{}'::jsonb, p_ab_test_variant text DEFAULT NULL::text, p_message_templates jsonb DEFAULT '{}'::jsonb, p_created_by uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_campaign_id UUID;
    v_user_id UUID;
BEGIN
    -- Get user ID directly from auth.uid()
    v_user_id := COALESCE(p_created_by, auth.uid());

    INSERT INTO campaigns (
        workspace_id, name, description, campaign_type,
        target_icp, ab_test_variant, message_templates, created_by
    ) VALUES (
        p_workspace_id, p_name, p_description, p_campaign_type,
        p_target_icp, p_ab_test_variant, p_message_templates, v_user_id
    ) RETURNING id INTO v_campaign_id;

    RETURN v_campaign_id;
END;
$$;


--
-- Name: FUNCTION create_campaign(p_workspace_id uuid, p_name text, p_description text, p_campaign_type text, p_target_icp jsonb, p_ab_test_variant text, p_message_templates jsonb, p_created_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_campaign(p_workspace_id uuid, p_name text, p_description text, p_campaign_type text, p_target_icp jsonb, p_ab_test_variant text, p_message_templates jsonb, p_created_by uuid) IS 'Create campaign using Supabase auth';


--
-- Name: create_gdpr_deletion_request(text, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_gdpr_deletion_request(p_workspace_id text, p_prospect_id uuid, p_request_type text DEFAULT 'right_to_be_forgotten'::text, p_request_source text DEFAULT 'prospect_request'::text, p_notes text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_request_id UUID;
  v_prospect workspace_prospects%ROWTYPE;
BEGIN
  -- Get prospect details
  SELECT * INTO v_prospect
  FROM workspace_prospects
  WHERE id = p_prospect_id
    AND workspace_id = p_workspace_id::text;

  IF v_prospect.id IS NULL THEN
    RAISE EXCEPTION 'Prospect not found';
  END IF;

  -- Create deletion request
  INSERT INTO gdpr_deletion_requests (
    workspace_id,
    prospect_id,
    email_address,
    linkedin_profile_url,
    full_name,
    request_type,
    request_source,
    notes,
    scheduled_execution_date
  )
  VALUES (
    p_workspace_id,
    p_prospect_id,
    v_prospect.email_address,
    v_prospect.linkedin_profile_url,
    v_prospect.first_name || ' ' || v_prospect.last_name,
    p_request_type,
    p_request_source,
    p_notes,
    NOW() + INTERVAL '30 days' -- 30 day grace period
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;


--
-- Name: FUNCTION create_gdpr_deletion_request(p_workspace_id text, p_prospect_id uuid, p_request_type text, p_request_source text, p_notes text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_gdpr_deletion_request(p_workspace_id text, p_prospect_id uuid, p_request_type text, p_request_source text, p_notes text) IS 'Creates new GDPR deletion request with 30-day grace period';


--
-- Name: create_memory_snapshot(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_memory_snapshot(p_user_id uuid, p_workspace_id uuid, p_days_back integer DEFAULT 7) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  snapshot_id UUID;
  thread_data JSONB;
  thread_ids_array UUID[];
  thread_count_val INTEGER;
  message_count_val INTEGER;
  memory_summary TEXT;
BEGIN
  -- Get threads from the specified period
  SELECT
    array_agg(t.id),
    count(DISTINCT t.id),
    jsonb_agg(
      jsonb_build_object(
        'thread_id', t.id,
        'title', t.title,
        'thread_type', t.thread_type,
        'created_at', t.created_at,
        'prospect_name', t.prospect_name,
        'prospect_company', t.prospect_company,
        'tags', t.tags,
        'messages', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'role', m.role,
              'content', m.content,
              'message_order', m.message_order,
              'created_at', m.created_at
            ) ORDER BY m.message_order
          )
          FROM sam_conversation_messages m
          WHERE m.thread_id = t.id
        )
      )
    ),
    count(m.id)
  INTO thread_ids_array, thread_count_val, thread_data, message_count_val
  FROM sam_conversation_threads t
  LEFT JOIN sam_conversation_messages m ON m.thread_id = t.id
  WHERE t.user_id = p_user_id
    AND (t.workspace_id = p_workspace_id OR (t.workspace_id IS NULL AND p_workspace_id IS NULL))
    AND t.created_at >= NOW() - INTERVAL '1 day' * p_days_back
    AND COALESCE(t.memory_archived, FALSE) = FALSE
  GROUP BY t.user_id;

  IF thread_count_val = 0 OR thread_count_val IS NULL THEN
    RAISE NOTICE 'No threads found for memory snapshot';
    RETURN NULL;
  END IF;

  -- Generate memory summary
  memory_summary := format(
    'Memory snapshot from %s days ago containing %s threads with %s total messages.',
    p_days_back,
    thread_count_val,
    COALESCE(message_count_val, 0)
  );

  -- Create snapshot
  INSERT INTO memory_snapshots (
    user_id,
    workspace_id,
    thread_count,
    message_count,
    memory_summary,
    thread_ids,
    archived_threads,
    importance_score
  ) VALUES (
    p_user_id,
    p_workspace_id,
    thread_count_val,
    COALESCE(message_count_val, 0),
    memory_summary,
    thread_ids_array,
    thread_data,
    5
  ) RETURNING id INTO snapshot_id;

  -- Mark threads as archived
  UPDATE sam_conversation_threads
  SET memory_archived = TRUE,
      memory_archive_date = NOW(),
      updated_at = NOW()
  WHERE id = ANY(thread_ids_array);

  RETURN snapshot_id;
END;
$$;


--
-- Name: FUNCTION create_memory_snapshot(p_user_id uuid, p_workspace_id uuid, p_days_back integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_memory_snapshot(p_user_id uuid, p_workspace_id uuid, p_days_back integer) IS 'Creates a memory snapshot from recent conversation threads';


--
-- Name: create_system_alert(text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_system_alert(p_alert_type text, p_component text, p_title text, p_message text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO system_alerts (
    alert_type,
    component,
    title,
    message,
    metadata
  ) VALUES (
    p_alert_type,
    p_component,
    p_title,
    p_message,
    p_metadata
  )
  RETURNING id INTO v_alert_id;
  
  RETURN v_alert_id;
END;
$$;


--
-- Name: create_user_association(uuid, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_user_association(p_user_id uuid, p_unipile_account_id text, p_platform text, p_account_name text, p_account_email text, p_linkedin_public_identifier text, p_linkedin_profile_url text, p_connection_status text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    result_id UUID;
  BEGIN
    INSERT INTO user_unipile_accounts (
      user_id,
      unipile_account_id,
      platform,
      account_name,
      account_email,
      linkedin_public_identifier,
      linkedin_profile_url,
      connection_status,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      p_unipile_account_id,
      p_platform,
      p_account_name,
      p_account_email,
      p_linkedin_public_identifier,
      p_linkedin_profile_url,
      p_connection_status,
      NOW(),
      NOW()
    )
    ON CONFLICT (unipile_account_id)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      platform = EXCLUDED.platform,
      account_name = EXCLUDED.account_name,
      account_email = EXCLUDED.account_email,
      linkedin_public_identifier = EXCLUDED.linkedin_public_identifier,
      linkedin_profile_url = EXCLUDED.linkedin_profile_url,
      connection_status = EXCLUDED.connection_status,
      updated_at = NOW()
    RETURNING id INTO result_id;

    RETURN result_id;
  END;
  $$;


--
-- Name: FUNCTION create_user_association(p_user_id uuid, p_unipile_account_id text, p_platform text, p_account_name text, p_account_email text, p_linkedin_public_identifier text, p_linkedin_profile_url text, p_connection_status text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_user_association(p_user_id uuid, p_unipile_account_id text, p_platform text, p_account_name text, p_account_email text, p_linkedin_public_identifier text, p_linkedin_profile_url text, p_connection_status text) IS 'Helper function to create or update 
  user-Unipile account associations';


--
-- Name: decrypt_pii(text, bytea); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrypt_pii(p_workspace_id text, p_ciphertext bytea) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_ciphertext IS NULL THEN
    RETURN NULL;
  END IF;

  v_key := get_workspace_encryption_key(p_workspace_id);

  -- Decrypt using AES-256-GCM
  RETURN pgp_sym_decrypt(p_ciphertext, v_key);
EXCEPTION
  WHEN OTHERS THEN
    -- Log decryption failure
    RAISE WARNING 'Failed to decrypt PII for workspace %: %', p_workspace_id, SQLERRM;
    RETURN NULL;
END;
$$;


--
-- Name: FUNCTION decrypt_pii(p_workspace_id text, p_ciphertext bytea); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.decrypt_pii(p_workspace_id text, p_ciphertext bytea) IS 'Decrypts PII field using workspace-specific key';


--
-- Name: derive_client_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.derive_client_code(workspace_name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  words text[];
  word text;
  code text := '';
  first_char text;
BEGIN
  words := STRING_TO_ARRAY(REGEXP_REPLACE(workspace_name, '[-_]+', ' ', 'g'), ' ');
  FOREACH word IN ARRAY words LOOP
    IF LENGTH(word) > 0 THEN
      first_char := UPPER(SUBSTRING(word, 1, 1));
      IF first_char ~ '[A-Z0-9]' THEN
        code := code || first_char;
      END IF;
    END IF;
  END LOOP;
  IF LENGTH(code) < 2 THEN
    code := UPPER(SUBSTRING(REGEXP_REPLACE(workspace_name, '[^A-Za-z0-9]', '', 'g'), 1, 3));
  END IF;
  RETURN SUBSTRING(code, 1, 5);
END;
$$;


--
-- Name: encrypt_pii(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.encrypt_pii(p_workspace_id text, p_plaintext text) RETURNS bytea
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_plaintext IS NULL OR p_plaintext = '' THEN
    RETURN NULL;
  END IF;

  v_key := get_workspace_encryption_key(p_workspace_id);

  -- Encrypt using AES-256-GCM
  RETURN pgp_sym_encrypt(p_plaintext, v_key, 'compress-algo=0, cipher-algo=aes256');
END;
$$;


--
-- Name: FUNCTION encrypt_pii(p_workspace_id text, p_plaintext text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.encrypt_pii(p_workspace_id text, p_plaintext text) IS 'Encrypts PII field using workspace-specific key (AES-256-GCM)';


--
-- Name: ensure_single_default_icp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_single_default_icp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE workspace_icp
    SET is_default = false
    WHERE workspace_id = NEW.workspace_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: execute_gdpr_deletion(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.execute_gdpr_deletion(p_request_id uuid, p_executed_by uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_request gdpr_deletion_requests%ROWTYPE;
  v_deletion_scope JSONB := '{}';
  v_deleted_count INTEGER;
BEGIN
  -- Get request details
  SELECT * INTO v_request
  FROM gdpr_deletion_requests
  WHERE id = p_request_id
    AND status = 'approved';

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or not approved');
  END IF;

  -- Delete from workspace_prospects
  IF v_request.prospect_id IS NOT NULL THEN
    DELETE FROM workspace_prospects
    WHERE id = v_request.prospect_id;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_deletion_scope := jsonb_set(v_deletion_scope, '{workspace_prospects}', to_jsonb(v_deleted_count));
  END IF;

  -- Delete from campaign_prospects (cascades automatically, but log it)
  DELETE FROM campaign_prospects
  WHERE prospect_id = v_request.prospect_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deletion_scope := jsonb_set(v_deletion_scope, '{campaign_prospects}', to_jsonb(v_deleted_count));

  -- Delete from linkedin_contacts
  DELETE FROM linkedin_contacts
  WHERE linkedin_profile_url = v_request.linkedin_profile_url;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deletion_scope := jsonb_set(v_deletion_scope, '{linkedin_contacts}', to_jsonb(v_deleted_count));

  -- Update request status
  UPDATE gdpr_deletion_requests
  SET
    status = 'completed',
    executed_at = NOW(),
    executed_by = p_executed_by,
    completed_at = NOW(),
    deletion_scope = v_deletion_scope
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'deletion_scope', v_deletion_scope
  );
END;
$$;


--
-- Name: FUNCTION execute_gdpr_deletion(p_request_id uuid, p_executed_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.execute_gdpr_deletion(p_request_id uuid, p_executed_by uuid) IS 'Executes approved GDPR deletion request (deletes prospect and related data)';


--
-- Name: expire_commenting_content(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_commenting_content() RETURNS TABLE(posts_expired integer, comments_expired integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
  p_count INTEGER := 0;
  c_count INTEGER := 0;
BEGIN
  -- Expire discovered posts that haven't been commented on
  WITH expired_posts AS (
    UPDATE linkedin_posts_discovered
    SET
      status = 'expired',
      expired_at = NOW()
    WHERE
      status = 'discovered'
      AND expires_at IS NOT NULL
      AND expires_at <= NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO p_count FROM expired_posts;

  -- Expire pending/scheduled comments that weren't approved
  WITH expired_comments AS (
    UPDATE linkedin_post_comments
    SET
      status = 'expired',
      expired_at = NOW()
    WHERE
      status IN ('pending_approval', 'scheduled')
      AND expires_at IS NOT NULL
      AND expires_at <= NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO c_count FROM expired_comments;

  -- Return counts
  RETURN QUERY SELECT p_count, c_count;
END;
$$;


--
-- Name: FUNCTION expire_commenting_content(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.expire_commenting_content() IS 'Expires posts and comments that have passed their expiration time. Called by cron job.';


--
-- Name: find_email_duplicates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_email_duplicates() RETURNS TABLE(id uuid, user_id uuid, unipile_account_id text, platform text, account_email text, created_at timestamp with time zone, row_num bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  WITH email_dupes AS (
    SELECT
      uua.id,
      uua.user_id,
      uua.unipile_account_id,
      uua.platform,
      uua.account_email,
      uua.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY uua.user_id, uua.platform, LOWER(uua.account_email)
        ORDER BY uua.created_at ASC
      ) as row_num
    FROM user_unipile_accounts uua
    WHERE uua.platform IN ('GOOGLE', 'OUTLOOK', 'MESSAGING')
      AND uua.connection_status = 'active'
      AND uua.account_email IS NOT NULL
  )
  SELECT
    ed.id,
    ed.user_id,
    ed.unipile_account_id,
    ed.platform,
    ed.account_email,
    ed.created_at,
    ed.row_num
  FROM email_dupes ed
  WHERE ed.row_num > 1  -- Only return duplicates (keep first, remove others)
  ORDER BY ed.created_at;
END;
$$;


--
-- Name: generate_approval_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_approval_token() RETURNS text
    LANGUAGE sql
    AS $$
  SELECT encode(gen_random_bytes(16), 'hex');
$$;


--
-- Name: generate_invitation_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invitation_token() RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$;


--
-- Name: FUNCTION generate_invitation_token(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_invitation_token() IS 'Generates a secure random token for workspace invitations';


--
-- Name: generate_short_code(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_short_code(length integer DEFAULT 8) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  chars TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';  -- No confusing chars (0,o,1,l,i)
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;


--
-- Name: get_account_usage_today(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_account_usage_today() RETURNS TABLE(account_id text, account_name text, workspace_name text, crs_sent_today integer, messages_sent_today integer, daily_cr_limit integer, remaining_crs integer, is_available boolean, usage_percentage numeric)
    LANGUAGE plpgsql
    AS $$
  BEGIN
    RETURN QUERY
    SELECT
      wa.unipile_account_id as account_id,
      wa.account_name,
      w.name as workspace_name,
      -- CRs sent today
      COUNT(CASE
        WHEN cp.status IN ('connection_requested', 'accepted', 'replied', 'completed_no_reply')
          AND cp.contacted_at::DATE = CURRENT_DATE
        THEN 1
      END)::INTEGER as crs_sent_today,
      -- Messages sent today (after connection)
      COUNT(CASE
        WHEN cp.status IN ('message_sent', 'replied', 'completed_no_reply')
          AND cp.contacted_at::DATE = CURRENT_DATE
          AND cp.contacted_at IS NOT NULL
        THEN 1
      END)::INTEGER as messages_sent_today,
      -- Daily limit: hardcoded to 20
      20 as daily_cr_limit,
      -- Remaining sends
      GREATEST(0, 20 - COUNT(CASE
          WHEN cp.status IN ('connection_requested', 'accepted', 'replied',
  'completed_no_reply')
            AND cp.contacted_at::DATE = CURRENT_DATE
          THEN 1
        END)
      )::INTEGER as remaining_crs,
      -- Is account available?
      (
        -- Not rate limited
        NOT EXISTS (
          SELECT 1 FROM campaign_prospects cp2
          WHERE cp2.unipile_account_id = wa.unipile_account_id
            AND cp2.status = 'rate_limited_cr'
            AND cp2.updated_at > NOW() - INTERVAL '24 hours'
        )
        AND
        -- Under daily limit
        COUNT(CASE
          WHEN cp.status IN ('connection_requested', 'accepted', 'replied',
  'completed_no_reply')
            AND cp.contacted_at::DATE = CURRENT_DATE
          THEN 1
        END) < 20
      ) as is_available,
      -- Usage percentage
      ROUND(
        (COUNT(CASE
          WHEN cp.status IN ('connection_requested', 'accepted', 'replied',
  'completed_no_reply')
            AND cp.contacted_at::DATE = CURRENT_DATE
          THEN 1
        END)::NUMERIC / 20.0) * 100,
        1
      ) as usage_percentage
    FROM workspace_accounts wa
    JOIN workspaces w ON w.id = wa.workspace_id
    LEFT JOIN campaign_prospects cp ON cp.unipile_account_id = wa.unipile_account_id
    WHERE wa.unipile_account_id IS NOT NULL
    GROUP BY wa.unipile_account_id, wa.account_name, w.name
    ORDER BY is_available DESC, remaining_crs DESC;
  END;
  $$;


--
-- Name: get_automation_health(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_automation_health() RETURNS TABLE(metric text, value integer, details jsonb)
    LANGUAGE plpgsql
    AS $$
  BEGIN
    RETURN QUERY
    -- Rate limited prospects
    SELECT
      'rate_limited_prospects'::TEXT,
      COUNT(*)::INTEGER,
      JSONB_BUILD_OBJECT(
        'oldest', MIN(updated_at),
        'newest', MAX(updated_at)
      )
    FROM campaign_prospects
    WHERE status = 'rate_limited'

    UNION ALL

    -- Stale queued prospects
    SELECT
      'stale_queued_prospects'::TEXT,
      COUNT(*)::INTEGER,
      JSONB_BUILD_OBJECT(
        'oldest', MIN(updated_at),
        'hours_stuck', EXTRACT(EPOCH FROM (NOW() - MIN(updated_at)))/3600
      )
    FROM campaign_prospects
    WHERE
      status = 'queued_in_n8n'
      AND updated_at < NOW() - INTERVAL '2 hours'

    UNION ALL

    -- Failing campaigns
    SELECT
      'high_failure_campaigns'::TEXT,
      COUNT(DISTINCT c.id)::INTEGER,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'name', c.name,
          'failure_rate',
            ROUND((COUNT(*) FILTER (WHERE cp.status IN ('failed', 'error'))::FLOAT /
                   NULLIF(COUNT(*), 0)::FLOAT)::NUMERIC, 2)
        )
      )
    FROM campaigns c
    JOIN campaign_prospects cp ON cp.campaign_id = c.id
    WHERE
      c.status = 'active'
      AND cp.updated_at > NOW() - INTERVAL '24 hours'
    GROUP BY c.id, c.name
    HAVING
      COUNT(*) >= 10
      AND (COUNT(*) FILTER (WHERE cp.status IN ('failed', 'error'))::FLOAT /
           NULLIF(COUNT(*), 0)::FLOAT) > 0.5;
  END;
  $$;


--
-- Name: FUNCTION get_automation_health(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_automation_health() IS 'Returns metrics about automation system health';


--
-- Name: get_daily_cr_count(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_daily_cr_count(p_account_id text, p_date date DEFAULT CURRENT_DATE) RETURNS integer
    LANGUAGE plpgsql
    AS $$
  DECLARE
    v_count INTEGER;
  BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM campaign_prospects
    WHERE unipile_account_id = p_account_id
      AND status IN ('connection_requested', 'accepted', 'replied', 'completed_no_reply')
      AND contacted_at::DATE = p_date;

    RETURN COALESCE(v_count, 0);
  END;
  $$;


--
-- Name: get_discovered_posts(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_discovered_posts(limit_count integer DEFAULT 10) RETURNS TABLE(id uuid, workspace_id uuid, monitor_id uuid, social_id character varying, share_url text, post_content text, author_name character varying, author_profile_id character varying, hashtags text[], post_date timestamp without time zone, status character varying, created_at timestamp without time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    RETURN QUERY
    SELECT
      pd.id,
      pd.workspace_id,
      pd.monitor_id,
      pd.social_id,
      pd.share_url,
      pd.post_content,
      pd.author_name,
      pd.author_profile_id,
      pd.hashtags,
      pd.post_date,
      pd.status,
      pd.created_at
    FROM linkedin_posts_discovered pd
    JOIN linkedin_post_monitors pm ON pd.monitor_id = pm.id
    WHERE pd.status = 'discovered'
      AND pm.status = 'active'
    ORDER BY pd.post_date DESC
    LIMIT limit_count;
  END;
  $$;


--
-- Name: get_discovery_qa_history(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_discovery_qa_history(p_discovery_session_id uuid) RETURNS TABLE(question_id text, question_text text, answer_text text, stage text, category text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.question_id,
        e.question_text,
        e.answer_text,
        e.stage,
        e.category,
        e.created_at
    FROM public.sam_icp_knowledge_entries e
    WHERE e.discovery_session_id = p_discovery_session_id
    ORDER BY e.created_at ASC;
END;
$$;


--
-- Name: get_document_usage_analytics(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_document_usage_analytics(p_workspace_id uuid, p_days integer DEFAULT 30) RETURNS TABLE(document_id uuid, document_title text, section text, total_uses integer, unique_threads integer, avg_relevance numeric, last_used_at timestamp with time zone, days_since_last_use integer, usage_trend text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id AS document_id,
        d.filename AS document_title,
        d.section_id AS section,
        COUNT(u.id)::INTEGER AS total_uses,
        COUNT(DISTINCT u.thread_id)::INTEGER AS unique_threads,
        AVG(u.relevance_score) AS avg_relevance,
        MAX(u.used_at) AS last_used_at,
        EXTRACT(DAY FROM NOW() - MAX(u.used_at))::INTEGER AS days_since_last_use,
        CASE
            WHEN COUNT(u.id) FILTER (WHERE u.used_at >= NOW() - INTERVAL '7 days') >
                 COUNT(u.id) FILTER (WHERE u.used_at >= NOW() - INTERVAL '14 days' AND u.used_at < NOW() - INTERVAL '7 days')
            THEN 'increasing'
            WHEN COUNT(u.id) FILTER (WHERE u.used_at >= NOW() - INTERVAL '7 days') <
                 COUNT(u.id) FILTER (WHERE u.used_at >= NOW() - INTERVAL '14 days' AND u.used_at < NOW() - INTERVAL '7 days')
            THEN 'decreasing'
            ELSE 'stable'
        END AS usage_trend
    FROM public.knowledge_base_documents d
    LEFT JOIN public.knowledge_base_document_usage u
        ON d.id = u.document_id
        AND u.used_at >= NOW() - (p_days || ' days')::INTERVAL
    WHERE d.workspace_id = p_workspace_id
        AND d.is_active = true
    GROUP BY d.id, d.filename, d.section_id
    ORDER BY total_uses DESC NULLS LAST;
END;
$$;


--
-- Name: FUNCTION get_document_usage_analytics(p_workspace_id uuid, p_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_document_usage_analytics(p_workspace_id uuid, p_days integer) IS 'Returns usage analytics for all documents in a workspace';


--
-- Name: get_duplicate_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_duplicate_stats() RETURNS TABLE(total_accounts bigint, active_accounts bigint, duplicate_removed_accounts bigint, linkedin_duplicates bigint, email_duplicates bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM user_unipile_accounts) as total_accounts,
    (SELECT COUNT(*) FROM user_unipile_accounts WHERE connection_status = 'active') as active_accounts,
    (SELECT COUNT(*) FROM user_unipile_accounts WHERE connection_status = 'duplicate_removed') as duplicate_removed_accounts,
    (SELECT COUNT(*) FROM find_linkedin_duplicates()) as linkedin_duplicates,
    (SELECT COUNT(*) FROM find_email_duplicates()) as email_duplicates;
END;
$$;


--
-- Name: get_kb_entries_by_source(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_kb_entries_by_source(attachment_id uuid) RETURNS TABLE(entry_type text, entry_id uuid, title text, category text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Get entries from sam_icp_knowledge_entries
    RETURN QUERY
    SELECT
        'icp_knowledge'::TEXT as entry_type,
        id as entry_id,
        question_text as title,
        category,
        created_at
    FROM public.sam_icp_knowledge_entries
    WHERE source_attachment_id = attachment_id;

    -- Get entries from knowledge_base
    RETURN QUERY
    SELECT
        'knowledge_base'::TEXT as entry_type,
        id as entry_id,
        title,
        category,
        created_at
    FROM public.knowledge_base
    WHERE source_attachment_id = attachment_id;
END;
$$;


--
-- Name: FUNCTION get_kb_entries_by_source(attachment_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_kb_entries_by_source(attachment_id uuid) IS 'Returns all knowledge base entries (from both tables) that were extracted from a specific document attachment.';


--
-- Name: get_latest_cron_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_latest_cron_status() RETURNS TABLE(job_name text, last_run timestamp with time zone, status text, details jsonb)
    LANGUAGE sql SECURITY DEFINER
    AS $$
       SELECT DISTINCT ON (job_name)
         job_name,
         run_at as last_run,
         status,
         details
       FROM public.cron_job_logs
       ORDER BY job_name, run_at DESC;
     $$;


--
-- Name: get_linkedin_commenting_analytics(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_linkedin_commenting_analytics(p_workspace_id uuid, p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_comments_posted', COUNT(*)::INTEGER,
    'avg_confidence_score', ROUND(AVG(cq.confidence_score)::NUMERIC, 2),
    'auto_posted_count', COUNT(*) FILTER (WHERE cq.requires_approval = false)::INTEGER,
    'manually_approved_count', COUNT(*) FILTER (WHERE cq.requires_approval = true)::INTEGER,
    'author_replies', COUNT(*) FILTER (WHERE cp.author_replied = true)::INTEGER,
    'author_likes', COUNT(*) FILTER (WHERE cp.author_liked = true)::INTEGER,
    'engagement_rate', ROUND(
      (COUNT(*) FILTER (WHERE cp.author_replied = true OR cp.author_liked = true)::NUMERIC /
       NULLIF(COUNT(*), 0)) * 100, 2
    ),
    'avg_likes_per_comment', ROUND(AVG(cp.likes_count)::NUMERIC, 1),
    'avg_replies_per_comment', ROUND(AVG(cp.replies_count)::NUMERIC, 1)
  )
  INTO result
  FROM linkedin_comments_posted cp
  JOIN linkedin_comment_queue cq ON cp.comment_queue_id = cq.id
  WHERE cp.workspace_id = p_workspace_id
    AND cp.posted_at > NOW() - (p_days || ' days')::INTERVAL;

  RETURN result;
END;
$$;


--
-- Name: get_next_available_account(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_available_account(p_workspace_id uuid) RETURNS TABLE(account_id text, account_name text, remaining_crs integer)
    LANGUAGE plpgsql
    AS $$
  BEGIN
    RETURN QUERY
    SELECT
      wa.unipile_account_id as account_id,
      wa.account_name,
      GREATEST(0, 20 - COUNT(CASE
          WHEN cp.status IN ('connection_requested', 'accepted', 'replied',
  'completed_no_reply')
            AND cp.contacted_at::DATE = CURRENT_DATE
          THEN 1
        END)
      )::INTEGER as remaining_crs
    FROM workspace_accounts wa
    LEFT JOIN campaign_prospects cp ON cp.unipile_account_id = wa.unipile_account_id
    WHERE wa.workspace_id = p_workspace_id
      AND wa.unipile_account_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM campaign_prospects cp2
        WHERE cp2.unipile_account_id = wa.unipile_account_id
          AND cp2.status = 'rate_limited_cr'
          AND cp2.updated_at > NOW() - INTERVAL '24 hours'
      )
    GROUP BY wa.unipile_account_id, wa.account_name
    HAVING COUNT(CASE
      WHEN cp.status IN ('connection_requested', 'accepted', 'replied', 'completed_no_reply')
        AND cp.contacted_at::DATE = CURRENT_DATE
      THEN 1
    END) < 20
    ORDER BY remaining_crs DESC
    LIMIT 1;
  END;
  $$;


--
-- Name: get_next_business_day_6am_utc(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_business_day_6am_utc(from_timestamp timestamp with time zone DEFAULT now()) RETURNS timestamp with time zone
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  next_day TIMESTAMPTZ;
  day_of_week INTEGER;
BEGIN
  -- Start with tomorrow at 6 AM UTC
  next_day := DATE_TRUNC('day', from_timestamp AT TIME ZONE 'UTC') + INTERVAL '1 day' + INTERVAL '6 hours';

  -- Get day of week (0=Sunday, 6=Saturday)
  day_of_week := EXTRACT(DOW FROM next_day);

  -- If Saturday (6), move to Monday
  IF day_of_week = 6 THEN
    next_day := next_day + INTERVAL '2 days';
  -- If Sunday (0), move to Monday
  ELSIF day_of_week = 0 THEN
    next_day := next_day + INTERVAL '1 day';
  END IF;

  RETURN next_day;
END;
$$;


--
-- Name: FUNCTION get_next_business_day_6am_utc(from_timestamp timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_next_business_day_6am_utc(from_timestamp timestamp with time zone) IS 'Returns 6 AM UTC on the next business day (Mon-Fri)';


--
-- Name: get_next_pending_executions(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_pending_executions(p_limit integer DEFAULT 10) RETURNS TABLE(state_id uuid, campaign_id uuid, prospect_id uuid, current_step integer, status text, next_execution_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    cpes.campaign_id,
    cpes.prospect_id,
    cpes.current_step,
    cpes.status,
    cpes.next_execution_at
  FROM campaign_prospect_execution_state cpes
  WHERE
    cpes.status IN ('pending', 'waiting_trigger')
    AND cpes.next_execution_at <= NOW()
  ORDER BY cpes.next_execution_at ASC
  LIMIT p_limit;
END;
$$;


--
-- Name: FUNCTION get_next_pending_executions(p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_next_pending_executions(p_limit integer) IS 'Get next prospects ready for execution. Used by N8N scheduler to find work.';


--
-- Name: get_or_create_slack_channel(uuid, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_slack_channel(p_workspace_id uuid, p_channel_id character varying, p_channel_name character varying DEFAULT NULL::character varying, p_channel_type character varying DEFAULT 'public'::character varying) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM slack_channels WHERE workspace_id = p_workspace_id AND channel_id = p_channel_id;
  IF v_id IS NULL THEN
    INSERT INTO slack_channels (workspace_id, channel_id, channel_name, channel_type)
    VALUES (p_workspace_id, p_channel_id, p_channel_name, p_channel_type)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;


--
-- Name: get_posts_needing_comments(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_posts_needing_comments(p_workspace_id uuid) RETURNS TABLE(id uuid, social_id text, share_url text, post_content text, author_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
    SELECT
      lpd.id,
      lpd.social_id::text,
      lpd.share_url::text,
      lpd.post_content::text,
      lpd.author_name::text
    FROM linkedin_posts_discovered lpd
    WHERE lpd.workspace_id = p_workspace_id
      AND lpd.status = 'discovered'
    ORDER BY lpd.created_at ASC
    LIMIT 1;
END;
$$;


--
-- Name: get_profiles_to_scrape(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_profiles_to_scrape(p_workspace_id uuid) RETURNS TABLE(id uuid, vanity_name text, provider_id text, keywords text[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
    SELECT
      m.id,
      -- Extract vanity from hashtags array (format: PROFILE:vanity_name)
      REPLACE(m.hashtags[1], 'PROFILE:', '')::text as vanity_name,
      NULL::text as provider_id,
      m.keywords
    FROM linkedin_post_monitors m
    WHERE m.workspace_id = p_workspace_id
      AND m.status = 'active'
      AND m.hashtags[1] LIKE 'PROFILE:%'
    ORDER BY m.updated_at ASC NULLS FIRST
    LIMIT 20;
END;
$$;


--
-- Name: get_recent_cron_results(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recent_cron_results(days integer DEFAULT 7) RETURNS TABLE(job_name text, run_at timestamp with time zone, status text, details jsonb)
    LANGUAGE sql SECURITY DEFINER
    AS $$
       SELECT
         job_name,
         run_at,
         status,
         details
       FROM public.cron_job_logs
       WHERE created_at > NOW() - (days || ' days')::INTERVAL
       ORDER BY run_at DESC;
     $$;


--
-- Name: get_remaining_apify_calls(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_remaining_apify_calls(p_workspace_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_current_count INTEGER;
  v_reset_date DATE;
  v_max_calls INTEGER := 25;
BEGIN
  SELECT apify_calls_today, apify_calls_reset_date
  INTO v_current_count, v_reset_date
  FROM linkedin_brand_guidelines
  WHERE workspace_id = p_workspace_id;

  IF v_current_count IS NULL THEN
    RETURN v_max_calls;
  END IF;

  IF v_reset_date IS NULL OR v_reset_date < CURRENT_DATE THEN
    RETURN v_max_calls;
  END IF;

  RETURN GREATEST(0, v_max_calls - v_current_count);
END;
$$;


--
-- Name: get_section_usage_summary(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_section_usage_summary(p_workspace_id uuid, p_days integer DEFAULT 30) RETURNS TABLE(section text, total_documents integer, documents_used integer, total_uses integer, avg_uses_per_doc numeric, usage_rate numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(d.section_id, 'unspecified') AS section,
        COUNT(DISTINCT d.id)::INTEGER AS total_documents,
        COUNT(DISTINCT CASE WHEN u.id IS NOT NULL THEN d.id END)::INTEGER AS documents_used,
        COUNT(u.id)::INTEGER AS total_uses,
        ROUND(COUNT(u.id)::NUMERIC / NULLIF(COUNT(DISTINCT d.id), 0), 2) AS avg_uses_per_doc,
        ROUND(
            COUNT(DISTINCT CASE WHEN u.id IS NOT NULL THEN d.id END)::NUMERIC * 100.0 /
            NULLIF(COUNT(DISTINCT d.id), 0),
            1
        ) AS usage_rate
    FROM public.knowledge_base_documents d
    LEFT JOIN public.knowledge_base_document_usage u
        ON d.id = u.document_id
        AND u.used_at >= NOW() - (p_days || ' days')::INTERVAL
    WHERE d.workspace_id = p_workspace_id
        AND d.is_active = true
    GROUP BY d.section_id
    ORDER BY total_uses DESC;
END;
$$;


--
-- Name: FUNCTION get_section_usage_summary(p_workspace_id uuid, p_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_section_usage_summary(p_workspace_id uuid, p_days integer) IS 'Returns aggregated usage stats by KB section';


--
-- Name: get_templates_by_criteria(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_templates_by_criteria(p_workspace_id text, p_industry text DEFAULT NULL::text, p_role text DEFAULT NULL::text, p_campaign_type text DEFAULT NULL::text) RETURNS TABLE(id uuid, template_name text, campaign_type text, industry text, target_role text, connection_message text, alternative_message text, follow_up_messages jsonb, avg_response_rate numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mt.id,
    mt.template_name,
    mt.campaign_type,
    mt.industry,
    mt.target_role,
    mt.connection_message,
    mt.alternative_message,
    mt.follow_up_messages,
    COALESCE(AVG(tp.response_rate), 0.00) as avg_response_rate
  FROM messaging_templates mt
  LEFT JOIN template_performance tp ON mt.id = tp.template_id
  WHERE mt.workspace_id = p_workspace_id
    AND mt.is_active = true
    AND (p_industry IS NULL OR mt.industry = p_industry)
    AND (p_role IS NULL OR mt.target_role = p_role)
    AND (p_campaign_type IS NULL OR mt.campaign_type = p_campaign_type)
  GROUP BY mt.id, mt.template_name, mt.campaign_type, mt.industry, mt.target_role, 
           mt.connection_message, mt.alternative_message, mt.follow_up_messages
  ORDER BY avg_response_rate DESC, mt.created_at DESC;
END;
$$;


--
-- Name: get_website_request_stats(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_website_request_stats(start_date timestamp with time zone DEFAULT (now() - '30 days'::interval), end_date timestamp with time zone DEFAULT now()) RETURNS TABLE(total_requests bigint, new_leads bigint, contacted_leads bigint, qualified_leads bigint, converted_leads bigint, conversion_rate numeric, avg_seo_score numeric, avg_geo_score numeric, avg_response_time_hours numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_requests,
    COUNT(*) FILTER (WHERE lead_status = 'new')::BIGINT as new_leads,
    COUNT(*) FILTER (WHERE lead_status = 'contacted')::BIGINT as contacted_leads,
    COUNT(*) FILTER (WHERE lead_status = 'qualified')::BIGINT as qualified_leads,
    COUNT(*) FILTER (WHERE converted_to_client = TRUE)::BIGINT as converted_leads,
    ROUND(
      (COUNT(*) FILTER (WHERE converted_to_client = TRUE)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
      2
    ) as conversion_rate,
    ROUND(AVG(seo_score), 1) as avg_seo_score,
    ROUND(AVG(geo_score), 1) as avg_geo_score,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (contacted_at - created_at)) / 3600.0), 
      1
    ) as avg_response_time_hours
  FROM website_requests
  WHERE created_at BETWEEN start_date AND end_date;
END;
$$;


--
-- Name: get_workspace_encryption_key(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_workspace_encryption_key(p_workspace_id text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- In production, this should decrypt the workspace key
  -- For now, using a deterministic key derivation
  SELECT encrypted_key INTO v_key
  FROM workspace_encryption_keys
  WHERE workspace_id = p_workspace_id
    AND is_active = true
  LIMIT 1;

  -- If no key exists, create one
  IF v_key IS NULL THEN
    INSERT INTO workspace_encryption_keys (workspace_id, encrypted_key)
    VALUES (p_workspace_id, encode(gen_random_bytes(32), 'hex'))
    RETURNING encrypted_key INTO v_key;
  END IF;

  RETURN v_key;
END;
$$;


--
-- Name: increment_apify_call_counter(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_apify_call_counter(p_workspace_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_current_count INTEGER;
  v_reset_date DATE;
  v_max_calls INTEGER := 25;
BEGIN
  INSERT INTO linkedin_brand_guidelines (workspace_id, apify_calls_today, apify_calls_reset_date)
  VALUES (p_workspace_id, 0, CURRENT_DATE)
  ON CONFLICT (workspace_id) DO NOTHING;

  SELECT apify_calls_today, apify_calls_reset_date
  INTO v_current_count, v_reset_date
  FROM linkedin_brand_guidelines
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;

  IF v_reset_date IS NULL OR v_reset_date < CURRENT_DATE THEN
    v_current_count := 0;
  END IF;

  IF v_current_count >= v_max_calls THEN
    RETURN FALSE;
  END IF;

  UPDATE linkedin_brand_guidelines
  SET apify_calls_today = v_current_count + 1,
      apify_calls_reset_date = CURRENT_DATE
  WHERE workspace_id = p_workspace_id;

  RETURN TRUE;
END;
$$;


--
-- Name: increment_enrichment_failed(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_enrichment_failed(p_job_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE enrichment_jobs
  SET
    failed_count = failed_count + 1,
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;


--
-- Name: FUNCTION increment_enrichment_failed(p_job_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.increment_enrichment_failed(p_job_id uuid) IS 'Atomically increment failed count for enrichment jobs';


--
-- Name: increment_enrichment_processed(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_enrichment_processed(p_job_id uuid, p_result jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE enrichment_jobs
  SET
    processed_count = processed_count + 1,
    enrichment_results = enrichment_results || jsonb_build_array(p_result),
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;


--
-- Name: FUNCTION increment_enrichment_processed(p_job_id uuid, p_result jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.increment_enrichment_processed(p_job_id uuid, p_result jsonb) IS 'Atomically increment processed count and append result to enrichment_results array';


--
-- Name: increment_lead_search_usage(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_lead_search_usage(p_workspace_id uuid, p_search_count integer DEFAULT 1) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE workspace_tiers
  SET
    monthly_lead_searches_used = monthly_lead_searches_used + p_search_count,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id;

  RETURN FOUND;
END;
$$;


--
-- Name: FUNCTION increment_lead_search_usage(p_workspace_id uuid, p_search_count integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.increment_lead_search_usage(p_workspace_id uuid, p_search_count integer) IS 'Increments lead search usage counter for workspace';


--
-- Name: increment_link_clicks(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_link_clicks(prospect_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE campaign_prospects
  SET total_link_clicks = COALESCE(total_link_clicks, 0) + 1
  WHERE id = prospect_id;
END;
$$;


--
-- Name: initialize_execution_state(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_execution_state(p_campaign_id uuid, p_prospect_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_state_id UUID;
BEGIN
  INSERT INTO campaign_prospect_execution_state (
    campaign_id,
    prospect_id,
    current_step,
    status,
    next_execution_at
  ) VALUES (
    p_campaign_id,
    p_prospect_id,
    1,
    'pending',
    NOW() -- Execute immediately for step 1
  )
  ON CONFLICT (campaign_id, prospect_id)
  DO UPDATE SET
    updated_at = NOW()
  RETURNING id INTO v_state_id;

  RETURN v_state_id;
END;
$$;


--
-- Name: FUNCTION initialize_execution_state(p_campaign_id uuid, p_prospect_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.initialize_execution_state(p_campaign_id uuid, p_prospect_id uuid) IS 'Initialize execution state for a new campaign prospect. Called when prospects are uploaded to a campaign.';


--
-- Name: initialize_knowledge_base_sections(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_knowledge_base_sections(p_workspace_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO public.knowledge_base_sections (workspace_id, section_id, title, description, icon, sort_order) VALUES
    (p_workspace_id, 'overview', 'Overview', 'Company overview, mission, and core value propositions', 'Building2', 1),
    (p_workspace_id, 'icp', 'ICP Config', 'Define your ideal customer profiles with detailed targeting criteria', 'Target', 2),
    (p_workspace_id, 'products', 'Products', 'Upload comprehensive product documentation and specifications', 'Package', 3),
    (p_workspace_id, 'competition', 'Competition', 'Track competitors and your competitive positioning', 'Zap', 4),
    (p_workspace_id, 'messaging', 'Messaging', 'Configure communication templates and messaging frameworks', 'MessageSquare', 5),
    (p_workspace_id, 'tone', 'Tone of Voice', 'Define your brand voice and communication style', 'Volume2', 6),
    (p_workspace_id, 'company', 'Company Info', 'Team information, company culture, and organizational details', 'Users', 7),
    (p_workspace_id, 'stories', 'Success Stories', 'Customer case studies and success metrics', 'Trophy', 8),
    (p_workspace_id, 'process', 'Buying Process', 'Sales process, stages, and qualification criteria', 'GitBranch', 9),
    (p_workspace_id, 'compliance', 'Compliance', 'Industry regulations and compliance requirements', 'Shield', 10),
    (p_workspace_id, 'personas', 'Personas & Roles', 'Buyer personas and decision-maker profiles', 'UserCheck', 11),
    (p_workspace_id, 'objections', 'Objections', 'Common objections and proven response strategies', 'HelpCircle', 12),
    (p_workspace_id, 'pricing', 'Pricing', 'Pricing models, packages, and value propositions', 'DollarSign', 13),
    (p_workspace_id, 'metrics', 'Success Metrics', 'KPIs, success metrics, and ROI calculations', 'TrendingUp', 14),
    (p_workspace_id, 'documents', 'Documents', 'Upload and organize supporting documents', 'FileText', 15)
    ON CONFLICT (workspace_id, section_id) DO NOTHING;
END;
$$;


--
-- Name: is_invitation_valid(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_invitation_valid(invitation_token text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  invitation_record workspace_invitations;
BEGIN
  SELECT * INTO invitation_record
  FROM workspace_invitations
  WHERE token = invitation_token
  AND status = 'pending'
  AND expires_at > NOW();

  RETURN FOUND;
END;
$$;


--
-- Name: FUNCTION is_invitation_valid(invitation_token text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_invitation_valid(invitation_token text) IS 'Checks if an invitation token is valid and not expired';


--
-- Name: is_prospect_blacklisted(uuid, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_prospect_blacklisted(p_workspace_id uuid, p_company_name text DEFAULT NULL::text, p_first_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_job_title text DEFAULT NULL::text, p_profile_link text DEFAULT NULL::text, p_linkedin_account_id text DEFAULT NULL::text) RETURNS TABLE(is_blacklisted boolean, matching_rule_id uuid, matching_type text, matching_keyword text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE as is_blacklisted,
    bl.id as matching_rule_id,
    bl.blacklist_type as matching_type,
    bl.keyword as matching_keyword
  FROM workspace_blacklists bl
  WHERE bl.workspace_id = p_workspace_id
    AND (bl.linkedin_account_id IS NULL OR bl.linkedin_account_id = p_linkedin_account_id)
    AND (
      -- Company name checks
      (bl.blacklist_type = 'company_name' AND p_company_name IS NOT NULL AND (
        (bl.comparison_type = 'contains' AND LOWER(p_company_name) LIKE '%' || LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'equals' AND LOWER(p_company_name) = LOWER(bl.keyword)) OR
        (bl.comparison_type = 'starts_with' AND LOWER(p_company_name) LIKE LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'ends_with' AND LOWER(p_company_name) LIKE '%' || LOWER(bl.keyword))
      ))
      OR
      -- First name checks
      (bl.blacklist_type = 'first_name' AND p_first_name IS NOT NULL AND (
        (bl.comparison_type = 'contains' AND LOWER(p_first_name) LIKE '%' || LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'equals' AND LOWER(p_first_name) = LOWER(bl.keyword)) OR
        (bl.comparison_type = 'starts_with' AND LOWER(p_first_name) LIKE LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'ends_with' AND LOWER(p_first_name) LIKE '%' || LOWER(bl.keyword))
      ))
      OR
      -- Last name checks
      (bl.blacklist_type = 'last_name' AND p_last_name IS NOT NULL AND (
        (bl.comparison_type = 'contains' AND LOWER(p_last_name) LIKE '%' || LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'equals' AND LOWER(p_last_name) = LOWER(bl.keyword)) OR
        (bl.comparison_type = 'starts_with' AND LOWER(p_last_name) LIKE LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'ends_with' AND LOWER(p_last_name) LIKE '%' || LOWER(bl.keyword))
      ))
      OR
      -- Job title checks
      (bl.blacklist_type = 'job_title' AND p_job_title IS NOT NULL AND (
        (bl.comparison_type = 'contains' AND LOWER(p_job_title) LIKE '%' || LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'equals' AND LOWER(p_job_title) = LOWER(bl.keyword)) OR
        (bl.comparison_type = 'starts_with' AND LOWER(p_job_title) LIKE LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'ends_with' AND LOWER(p_job_title) LIKE '%' || LOWER(bl.keyword))
      ))
      OR
      -- Profile link checks
      (bl.blacklist_type = 'profile_link' AND p_profile_link IS NOT NULL AND (
        (bl.comparison_type = 'contains' AND LOWER(p_profile_link) LIKE '%' || LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'equals' AND LOWER(p_profile_link) = LOWER(bl.keyword)) OR
        (bl.comparison_type = 'starts_with' AND LOWER(p_profile_link) LIKE LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'ends_with' AND LOWER(p_profile_link) LIKE '%' || LOWER(bl.keyword))
      ))
    )
  LIMIT 1;

  -- If no match found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT;
  END IF;
END;
$$;


--
-- Name: log_pii_access(text, text, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_pii_access(p_workspace_id text, p_table_name text, p_record_id uuid, p_field_name text, p_access_type text, p_access_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO pii_access_log (
    workspace_id,
    user_id,
    table_name,
    record_id,
    field_name,
    access_type,
    access_reason
  )
  VALUES (
    p_workspace_id,
    auth.uid(),
    p_table_name,
    p_record_id,
    p_field_name,
    p_access_type,
    p_access_reason
  );
END;
$$;


--
-- Name: log_slack_message(uuid, character varying, character varying, character varying, character varying, text, character varying, character varying, character varying, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_slack_message(p_workspace_id uuid, p_channel_id character varying, p_message_ts character varying, p_direction character varying, p_sender_type character varying, p_content text, p_sender_id character varying DEFAULT NULL::character varying, p_sender_name character varying DEFAULT NULL::character varying, p_thread_ts character varying DEFAULT NULL::character varying, p_raw_event jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO slack_messages (workspace_id, channel_id, message_ts, direction, sender_type, content, sender_id, sender_name, thread_ts, raw_event)
  VALUES (p_workspace_id, p_channel_id, p_message_ts, p_direction, p_sender_type, p_content, p_sender_id, p_sender_name, p_thread_ts, p_raw_event)
  ON CONFLICT (workspace_id, message_ts) DO UPDATE SET content = EXCLUDED.content
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


--
-- Name: log_system_health(text, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_system_health(p_component text, p_status text, p_response_time_ms integer DEFAULT NULL::integer, p_error_message text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO system_health_logs (
    component,
    status,
    response_time_ms,
    error_message
  ) VALUES (
    p_component,
    p_status,
    p_response_time_ms,
    p_error_message
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;


--
-- Name: mark_prospects_for_deletion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_prospects_for_deletion() RETURNS TABLE(prospect_id uuid, workspace_id text, scheduled_date timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Update prospects that have passed retention period
  UPDATE workspace_prospects wp
  SET scheduled_deletion_date = calculate_scheduled_deletion_date(wp.id)
  WHERE wp.scheduled_deletion_date IS NULL
    AND wp.consent_withdrawn_at IS NULL
    AND wp.created_at < (NOW() - INTERVAL '30 days') -- At least 30 days old
  RETURNING wp.id, wp.workspace_id, wp.scheduled_deletion_date;
END;
$$;


--
-- Name: match_customer_insights(public.vector, double precision, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_customer_insights(p_query_embedding public.vector, p_match_threshold double precision, p_match_count integer) RETURNS TABLE(id uuid, insight_type text, description text, frequency_score integer, similarity double precision)
    LANGUAGE plpgsql STABLE
    AS $$ BEGIN RETURN QUERY
SELECT i.id,
    i.insight_type,
    i.description,
    i.frequency_score,
    1 - (i.embedding <=> p_query_embedding) AS similarity
FROM public.customer_insight_patterns i
WHERE 1 - (i.embedding <=> p_query_embedding) >= p_match_threshold
ORDER BY i.embedding <->p_query_embedding
LIMIT p_match_count;
END;
$$;


--
-- Name: match_knowledge_gaps(public.vector, double precision, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_knowledge_gaps(p_query_embedding public.vector, p_match_threshold double precision, p_match_count integer) RETURNS TABLE(id uuid, category text, missing_info text, impact_level text, status text, similarity double precision)
    LANGUAGE plpgsql STABLE
    AS $$ BEGIN RETURN QUERY
SELECT g.id,
    g.category,
    g.missing_info,
    g.impact_level,
    g.status,
    1 - (g.embedding <=> p_query_embedding) AS similarity
FROM public.knowledge_gap_tracking g
WHERE 1 - (g.embedding <=> p_query_embedding) >= p_match_threshold
ORDER BY g.embedding <->p_query_embedding
LIMIT p_match_count;
END;
$$;


--
-- Name: match_prospect_research(public.vector, uuid, double precision, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_prospect_research(query_embedding public.vector, match_workspace_id uuid, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 5) RETURNS TABLE(id uuid, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    kbv.document_id as id,
    kbv.content,
    kbv.metadata,
    1 - (kbv.embedding <=> query_embedding) as similarity
  FROM knowledge_base_vectors kbv
  JOIN knowledge_base kb ON kb.id = kbv.document_id
  WHERE
    kbv.workspace_id = match_workspace_id
    AND kb.category = 'prospect_research'
    AND kb.is_active = true
    AND 1 - (kbv.embedding <=> query_embedding) > match_threshold
  ORDER BY kbv.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


--
-- Name: match_reply_conversations(public.vector, uuid, double precision, integer, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_reply_conversations(query_embedding public.vector, match_workspace_id uuid, match_threshold double precision, match_count integer, filter_tags text[] DEFAULT NULL::text[]) RETURNS TABLE(id uuid, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql STABLE
    AS $$ BEGIN RETURN QUERY
SELECT kbv.document_id as id,
    kbv.content,
    kbv.metadata,
    1 - (kbv.embedding <=> query_embedding) AS similarity
FROM public.knowledge_base_vectors kbv
WHERE kbv.workspace_id = match_workspace_id
    AND (
        filter_tags IS NULL
        OR kbv.tags @> filter_tags
    )
    AND (1 - (kbv.embedding <=> query_embedding)) >= match_threshold
ORDER BY kbv.embedding <->query_embedding
LIMIT match_count;
END;
$$;


--
-- Name: match_workspace_knowledge(uuid, public.vector, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_workspace_knowledge(p_workspace_id uuid, p_query_embedding public.vector, p_section text DEFAULT NULL::text, p_limit integer DEFAULT 5) RETURNS TABLE(document_id uuid, section_id text, content text, tags text[], metadata jsonb, similarity double precision)
    LANGUAGE plpgsql STABLE
    AS $$ BEGIN RETURN QUERY
SELECT kbv.document_id,
    kbv.section_id,
    kbv.content,
    kbv.tags,
    kbv.metadata,
    1 - (kbv.embedding <=> p_query_embedding) AS similarity
FROM public.knowledge_base_vectors kbv
WHERE kbv.workspace_id = p_workspace_id
    AND (
        p_section IS NULL
        OR kbv.section_id = p_section
    )
ORDER BY kbv.embedding <->p_query_embedding
LIMIT COALESCE(p_limit, 5);
END;
$$;


--
-- Name: match_workspace_knowledge(uuid, public.vector, text, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_workspace_knowledge(p_workspace_id uuid, p_query_embedding public.vector, p_section text DEFAULT NULL::text, p_limit integer DEFAULT 5, p_icp_id uuid DEFAULT NULL::uuid) RETURNS TABLE(document_id uuid, section_id text, content text, tags text[], metadata jsonb, similarity double precision)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        kbv.document_id,
        kbv.section_id,
        kbv.content,
        kbv.tags,
        kbv.metadata,
        1 - (kbv.embedding <=> p_query_embedding) AS similarity
    FROM knowledge_base_vectors kbv
    WHERE kbv.workspace_id = p_workspace_id
      AND (p_section IS NULL OR kbv.section_id = p_section)
      AND (p_icp_id IS NULL OR kbv.icp_id IS NULL OR kbv.icp_id = p_icp_id)
    ORDER BY kbv.embedding <-> p_query_embedding
    LIMIT COALESCE(p_limit, 5);
END;
$$;


--
-- Name: migrate_workspace_prospects_to_encrypted(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.migrate_workspace_prospects_to_encrypted(p_workspace_id text DEFAULT NULL::text, p_batch_size integer DEFAULT 100) RETURNS TABLE(workspace_id text, migrated_count integer, error_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_workspace_id TEXT;
  v_migrated INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  -- If specific workspace provided, migrate only that workspace
  -- Otherwise migrate all workspaces
  FOR v_workspace_id IN
    SELECT DISTINCT wp.workspace_id::uuid
    FROM workspace_prospects wp
    WHERE wp.pii_is_encrypted = false
      AND (p_workspace_id IS NULL OR wp.workspace_id = p_workspace_id::text)
    LIMIT p_batch_size
  LOOP
    BEGIN
      -- Encrypt PII for this workspace
      UPDATE workspace_prospects
      SET
        email_address_encrypted = encrypt_pii(v_workspace_id, email_address),
        phone_number_encrypted = encrypt_pii(v_workspace_id, phone_number),
        linkedin_profile_url_encrypted = encrypt_pii(v_workspace_id, linkedin_profile_url),
        pii_is_encrypted = true,
        pii_encrypted_at = NOW(),
        pii_encryption_version = 1
      WHERE workspace_id = v_workspace_id::text
        AND pii_is_encrypted = false;

      GET DIAGNOSTICS v_migrated = ROW_COUNT;

      RETURN QUERY SELECT v_workspace_id, v_migrated, 0;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'Failed to encrypt workspace % PII: %', v_workspace_id, SQLERRM;
      RETURN QUERY SELECT v_workspace_id, 0, 1;
    END;
  END LOOP;
END;
$$;


--
-- Name: FUNCTION migrate_workspace_prospects_to_encrypted(p_workspace_id text, p_batch_size integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.migrate_workspace_prospects_to_encrypted(p_workspace_id text, p_batch_size integer) IS 'Migrates existing plain-text PII to encrypted format (run in batches)';


--
-- Name: normalize_company_display_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_company_display_name(company_name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE
  result TEXT;
  prev_result TEXT;
BEGIN
  IF company_name IS NULL OR company_name = '' THEN
    RETURN '';
  END IF;

  result := TRIM(company_name);

  -- Strip "The" from start
  result := REGEXP_REPLACE(result, '^The\s+', '', 'i');

  -- Remove parenthetical content
  result := REGEXP_REPLACE(result, '\s*\([^)]*\)', '', 'g');

  -- Loop: strip suffixes until no more changes
  LOOP
    prev_result := result;

    -- 1. Multi-word international suffixes FIRST (order matters!)
    -- Mexico
    result := REGEXP_REPLACE(result, '[,\s]+SAB\s+de\s+CV\s*$', '', 'i');
    result := REGEXP_REPLACE(result, '[,\s]+SA\s+de\s+CV\s*$', '', 'i');
    result := REGEXP_REPLACE(result, '[,\s]+S\s+de\s+RL\s*$', '', 'i');
    -- Poland
    result := REGEXP_REPLACE(result, '[,\s]+Sp\.\s*z\s*o\.o\.\s*$', '', 'i');
    result := REGEXP_REPLACE(result, '[,\s]+z\s*o\.o\.\s*$', '', 'i');
    -- Australia/India/Singapore
    result := REGEXP_REPLACE(result, '[,\s]+Pty\.?\s+Ltd\.?\s*$', '', 'i');
    result := REGEXP_REPLACE(result, '[,\s]+Pvt\.?\s+Ltd\.?\s*$', '', 'i');
    result := REGEXP_REPLACE(result, '[,\s]+Pte\.?\s+Ltd\.?\s*$', '', 'i');
    -- Japan
    result := REGEXP_REPLACE(result, '[,\s]+Godo\s+Kaisha\s*$', '', 'i');
    result := REGEXP_REPLACE(result, '[,\s]+Co\.,?\s*Ltd\.?\s*$', '', 'i');
    -- UAE
    result := REGEXP_REPLACE(result, '[,\s]+FZ-LLC\s*$', '', 'i');

    -- 2. Single-word legal suffixes (international)
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(Incorporated|Corporation|Inc|LLC|LLP|Ltd|Limited|plc|PLC|Co|Corp)\s*\.?$', '', 'i');
    -- Germany/Austria/Switzerland
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(GmbH|KGaA|OHG|AG|KG|SE|eG|e\.V\.)\s*\.?$', '', 'i');
    -- France
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(SAS|SARL|EURL|SCA|SA)\s*\.?$', '', 'i');
    -- Netherlands/Belgium
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(BVBA|B\.V\.?|BV|N\.V\.?|NV|CV)\s*\.?$', '', 'i');
    -- Spain
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(SLU|SL)\s*\.?$', '', 'i');
    -- Italy
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(SpA|Srl|SaS)\s*\.?$', '', 'i');
    -- Scandinavia
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(AB|ASA|AS|A/S|ApS|Oyj|Oy)\s*\.?$', '', 'i');
    -- Japan
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(K\.K\.?|KK|Y\.K\.?)\s*\.?$', '', 'i');
    -- India/Singapore/Australia
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(Pty|Pvt|Pte)\s*\.?$', '', 'i');
    -- Brazil
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(Ltda|EIRELI)\s*\.?$', '', 'i');
    -- Mexico
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(SAPI)\s*\.?$', '', 'i');
    -- UAE
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(PJSC|FZE|FZC)\s*\.?$', '', 'i');
    -- Ireland
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(DAC|CLG)\s*\.?$', '', 'i');

    -- 3. Compound Tech patterns FIRST (before stripping "Solutions" alone)
    result := REGEXP_REPLACE(result, '\s+Tech\s+(Solutions|Services|Group|Systems|Consulting)\s*$', '', 'i');

    -- 4. Then individual business descriptors
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(International|Technologies|Technology|Consulting|Consultants|Solutions|Holdings|Services|Partners|Partnership|Company|Global|Worldwide|Agency|Enterprises|Ventures|Studios|Studio|Labs|Lab|Digital|Media|Software|Systems)\s*\.?$', '', 'i');

    -- 5. "Group" at end
    result := REGEXP_REPLACE(result, '\s+Group\s*$', '', 'i');

    -- Strip trailing punctuation
    result := REGEXP_REPLACE(result, '[,.\s&]+$', '');

    EXIT WHEN result = prev_result OR LENGTH(result) < 2;
  END LOOP;

  -- Safety: if result is too short, be conservative
  IF LENGTH(result) < 2 THEN
    result := REGEXP_REPLACE(TRIM(company_name), '\s*[,.]?\s*(Inc|LLC|Ltd|Corp|plc|GmbH|AG|BV|AB)\s*\.?$', '', 'i');
    result := TRIM(result);
  END IF;

  RETURN result;
END;
$_$;


--
-- Name: FUNCTION normalize_company_display_name(company_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.normalize_company_display_name(company_name text) IS 'Normalizes company names by removing international legal suffixes (Inc, LLC, GmbH, SA, AB, etc.), parenthetical content, and The prefix';


--
-- Name: normalize_company_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_company_name(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
BEGIN
  IF name IS NULL OR TRIM(name) = '' THEN
    RETURN NULL;
  END IF;

  RETURN LOWER(TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(name, '\s*\([^)]*\)', '', 'g'),
          '\s*(Inc\.?|Corp\.?|LLC|Ltd\.?|GmbH|S\.A\.|Co\.?|Company|Group|Holdings|Solutions|Technologies|International|Services|Consulting|Partners|Agency|Global|Limited|PLC|LLP|Pty|Pvt|B\.V\.|N\.V\.)$', '', 'i'
        ),
        '^The\s+', '', 'i'
      ),
      '[,.]$', ''
    )
  ));
END;
$_$;


--
-- Name: normalize_location(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_location(loc text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
BEGIN
  IF loc IS NULL OR TRIM(loc) = '' THEN
    RETURN NULL;
  END IF;

  RETURN TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(loc, '\s+Area$', '', 'i'),
          '^Greater\s+', '', 'i'
        ),
        '\s+Metropolitan$', '', 'i'
      ),
      '\s+Metro$', '', 'i'
    )
  );
END;
$_$;


--
-- Name: FUNCTION normalize_location(loc text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.normalize_location(loc text) IS 'Normalizes locations by removing Area, Greater, Metropolitan, Metro suffixes';


--
-- Name: normalize_prospect_identifiers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_prospect_identifiers() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
  IF NEW.linkedin_url IS NOT NULL THEN
    NEW.linkedin_url_hash := LOWER(TRIM(
      REGEXP_REPLACE(
        REGEXP_REPLACE(NEW.linkedin_url, '^https?://(www\.)?linkedin\.com/in/', '', 'i'),
        '/.*$', '', 'i'
      )
    ));
    NEW.linkedin_url_hash := SPLIT_PART(NEW.linkedin_url_hash, '?', 1);
  ELSE
    NEW.linkedin_url_hash := NULL;
  END IF;

  IF NEW.email IS NOT NULL THEN
    NEW.email_hash := LOWER(TRIM(NEW.email));
  ELSE
    NEW.email_hash := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$_$;


--
-- Name: normalize_title(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_title(title text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  IF title IS NULL OR TRIM(title) = '' THEN
    RETURN NULL;
  END IF;

  RETURN TRIM(title);
END;
$$;


--
-- Name: FUNCTION normalize_title(title text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.normalize_title(title text) IS 'Normalizes job titles (basic trim for now)';


--
-- Name: process_qualification_response(uuid, uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_qualification_response(p_execution_id uuid, p_message_id uuid, p_prospect_id uuid, p_qualification_option text, p_response_content text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_action TEXT;
  v_follow_up_date TIMESTAMP WITH TIME ZONE;
  result JSONB;
BEGIN
  CASE p_qualification_option
    WHEN 'a' THEN 
      v_action := 'schedule_follow_up';
      v_follow_up_date := NOW() + INTERVAL '3 weeks';
    WHEN 'b' THEN 
      v_action := 'mark_dnc';
    WHEN 'c' THEN 
      v_action := 'send_calendar_link';
    WHEN 'd' THEN 
      v_action := 'mark_dnc_and_unsubscribe';
    ELSE
      v_action := 'requires_manual_review';
  END CASE;

  INSERT INTO sam_funnel_responses (
    execution_id,
    message_id,
    prospect_id,
    response_type,
    response_content,
    qualification_option,
    qualification_meaning,
    action_taken,
    follow_up_scheduled_date,
    requires_approval
  ) VALUES (
    p_execution_id,
    p_message_id,
    p_prospect_id,
    'qualification',
    p_response_content,
    p_qualification_option,
    CASE p_qualification_option
      WHEN 'a' THEN 'Not right time - follow up later'
      WHEN 'b' THEN 'Has solution - remove from list'
      WHEN 'c' THEN 'Interested - schedule meeting'
      WHEN 'd' THEN 'Not interested - opt out'
    END,
    v_action,
    v_follow_up_date,
    p_qualification_option = 'c'
  );

  UPDATE campaign_prospects 
  SET 
    status = CASE 
      WHEN p_qualification_option = 'a' THEN 'follow_up_scheduled'
      WHEN p_qualification_option = 'b' THEN 'dnc'
      WHEN p_qualification_option = 'c' THEN 'meeting_requested'
      WHEN p_qualification_option = 'd' THEN 'opted_out'
    END,
    follow_up_date = v_follow_up_date,
    updated_at = NOW()
  WHERE id = p_prospect_id;

  result := jsonb_build_object(
    'action', v_action,
    'follow_up_date', v_follow_up_date,
    'requires_approval', p_qualification_option = 'c'
  );

  RETURN result;
END;
$$;


--
-- Name: record_document_usage(uuid, uuid, uuid, uuid, integer, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_document_usage(p_workspace_id uuid, p_document_id uuid, p_thread_id uuid DEFAULT NULL::uuid, p_message_id uuid DEFAULT NULL::uuid, p_chunks_used integer DEFAULT 1, p_relevance_score numeric DEFAULT NULL::numeric, p_query_context text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Insert usage record
    INSERT INTO public.knowledge_base_document_usage (
        workspace_id,
        document_id,
        thread_id,
        message_id,
        user_id,
        chunks_used,
        relevance_score,
        query_context
    ) VALUES (
        p_workspace_id,
        p_document_id,
        p_thread_id,
        p_message_id,
        auth.uid(),
        p_chunks_used,
        p_relevance_score,
        p_query_context
    );

    -- Update document usage stats
    UPDATE public.knowledge_base_documents
    SET
        usage_count = COALESCE(usage_count, 0) + 1,
        last_used_at = NOW(),
        last_used_in_thread_id = p_thread_id,
        first_used_at = COALESCE(first_used_at, NOW())
    WHERE id = p_document_id AND workspace_id = p_workspace_id;
END;
$$;


--
-- Name: FUNCTION record_document_usage(p_workspace_id uuid, p_document_id uuid, p_thread_id uuid, p_message_id uuid, p_chunks_used integer, p_relevance_score numeric, p_query_context text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_document_usage(p_workspace_id uuid, p_document_id uuid, p_thread_id uuid, p_message_id uuid, p_chunks_used integer, p_relevance_score numeric, p_query_context text) IS 'Call this function whenever SAM retrieves and uses a document';


--
-- Name: reject_comment_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_comment_by_token(p_token text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_post RECORD;
BEGIN
  SELECT id, approval_status INTO v_post FROM linkedin_posts_discovered WHERE approval_token = p_token;
  IF v_post IS NULL THEN RETURN json_build_object('success', false, 'error', 'Invalid token'); END IF;
  IF v_post.approval_status != 'pending' THEN RETURN json_build_object('success', false, 'error', 'Already processed', 'status', v_post.approval_status); END IF;
  UPDATE linkedin_posts_discovered SET approval_status = 'rejected', rejected_at = NOW(), updated_at = NOW() WHERE approval_token = p_token;
  RETURN json_build_object('success', true, 'post_id', v_post.id);
END; $$;


--
-- Name: restore_memory_snapshot(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_memory_snapshot(p_snapshot_id uuid, p_user_id uuid) RETURNS TABLE(thread_data jsonb)
    LANGUAGE plpgsql
    AS $$
DECLARE
  snapshot RECORD;
BEGIN
  SELECT * INTO snapshot FROM memory_snapshots
  WHERE id = p_snapshot_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Memory snapshot not found or access denied';
  END IF;

  -- Update restore statistics
  UPDATE memory_snapshots
  SET restore_count = restore_count + 1,
      last_restored_at = NOW(),
      updated_at = NOW()
  WHERE id = p_snapshot_id;

  -- Return thread data
  RETURN QUERY SELECT snapshot.archived_threads;
END;
$$;


--
-- Name: FUNCTION restore_memory_snapshot(p_snapshot_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.restore_memory_snapshot(p_snapshot_id uuid, p_user_id uuid) IS 'Restores thread data from a memory snapshot';


--
-- Name: search_icp_knowledge(uuid, public.vector, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_icp_knowledge(p_workspace_id uuid, p_query_embedding public.vector, p_stage text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_limit integer DEFAULT 5) RETURNS TABLE(question_id text, question_text text, answer_text text, answer_structured jsonb, stage text, category text, confidence_score numeric, similarity double precision)
    LANGUAGE plpgsql STABLE
    AS $$ BEGIN RETURN QUERY
SELECT e.question_id,
    e.question_text,
    e.answer_text,
    e.answer_structured,
    e.stage,
    e.category,
    e.confidence_score,
    1 - (e.embedding <=> p_query_embedding) AS similarity
FROM public.sam_icp_knowledge_entries e
WHERE e.workspace_id = p_workspace_id
    AND (
        p_stage IS NULL
        OR e.stage = p_stage
    )
    AND (
        p_category IS NULL
        OR e.category = p_category
    )
    AND e.indexed_for_rag = true
ORDER BY e.embedding <->p_query_embedding
LIMIT COALESCE(p_limit, 5);
END;
$$;


--
-- Name: send_daily_health_report_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_daily_health_report_email() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_function_url TEXT;
    v_response TEXT;
  BEGIN
    -- Edge Function URL
    v_function_url := 'https://latxadqrvrrrcvkktrog.supabase.co/functions/v1/send-daily-health-report';

    -- Call the Edge Function using http extension
    SELECT content::text INTO v_response
    FROM http_post(
      v_function_url,
      '{}',
      'application/json'
    );

    -- Log that email was sent
    INSERT INTO public.cron_job_logs (job_name, status, details)
    VALUES (
      'send_daily_email_report',
      'success',
      jsonb_build_object(
        'email_sent', true,
        'response', v_response
      )
    );

  EXCEPTION WHEN OTHERS THEN
    -- Log error if email fails
    INSERT INTO public.cron_job_logs (job_name, status, details)
    VALUES (
      'send_daily_email_report',
      'error',
      jsonb_build_object(
        'error', SQLERRM
      )
    );
  END;
  $$;


--
-- Name: set_comment_expiration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_comment_expiration() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only set expires_at if not already set and status is pending_approval
  IF NEW.expires_at IS NULL AND NEW.status = 'pending_approval' THEN
    NEW.expires_at := get_next_business_day_6am_utc(NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_post_expiration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_post_expiration() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only set expires_at if not already set
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := get_next_business_day_6am_utc(NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_prospect_deletion_date(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_prospect_deletion_date() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.scheduled_deletion_date IS NULL THEN
    NEW.scheduled_deletion_date := calculate_scheduled_deletion_date(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_unipile_to_workspace_accounts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_unipile_to_workspace_accounts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM workspace_accounts WHERE unipile_account_id = NEW.unipile_account_id) THEN
    UPDATE workspace_accounts SET
      account_name = NEW.account_name,
      connection_status = CASE WHEN NEW.connection_status = 'active' THEN 'connected' ELSE COALESCE(NEW.connection_status, 'connected') END,
      is_active = NEW.connection_status IN ('active', 'connected'),
      updated_at = NOW()
    WHERE unipile_account_id = NEW.unipile_account_id;
  ELSE
    INSERT INTO workspace_accounts (id, workspace_id, user_id, account_type, account_identifier, account_name, unipile_account_id, connection_status, connected_at, is_active, created_at, updated_at)
    VALUES (
      NEW.id, NEW.workspace_id, NEW.user_id,
      CASE WHEN NEW.platform = 'LINKEDIN' THEN 'linkedin' WHEN NEW.platform IN ('GOOGLE_OAUTH', 'MAIL') THEN 'email' ELSE LOWER(COALESCE(NEW.platform, 'linkedin')) END,
      COALESCE(NEW.account_email, NEW.unipile_account_id), NEW.account_name, NEW.unipile_account_id,
      CASE WHEN NEW.connection_status = 'active' THEN 'connected' ELSE COALESCE(NEW.connection_status, 'connected') END,
      NOW(), NEW.connection_status IN ('active', 'connected'), NOW(), NOW()
    ) ON CONFLICT (id) DO UPDATE SET account_name = EXCLUDED.account_name, connection_status = EXCLUDED.connection_status, is_active = EXCLUDED.is_active, updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: track_conversation_analytics(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_conversation_analytics(p_thread_id uuid, p_persona_used text, p_industry text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_analytics_id UUID;
  v_workspace_id UUID;
  v_user_id UUID;
  v_message_count INTEGER;
BEGIN
  -- Get thread details
  SELECT 
    user_id,
    organization_id
  INTO v_user_id, v_workspace_id
  FROM sam_conversation_threads
  WHERE id = p_thread_id;
  
  -- Count messages
  SELECT COUNT(*)
  INTO v_message_count
  FROM sam_conversation_messages
  WHERE thread_id = p_thread_id;
  
  -- Insert or update analytics
  INSERT INTO conversation_analytics (
    thread_id,
    workspace_id,
    user_id,
    message_count,
    persona_used,
    industry,
    completion_status
  ) VALUES (
    p_thread_id,
    v_workspace_id,
    v_user_id,
    v_message_count,
    p_persona_used,
    p_industry,
    'in_progress'
  )
  ON CONFLICT (thread_id) DO UPDATE SET
    message_count = v_message_count,
    updated_at = NOW()
  RETURNING id INTO v_analytics_id;
  
  RETURN v_analytics_id;
END;
$$;


--
-- Name: trg_normalize_campaign_prospect(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_normalize_campaign_prospect() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Normalize company name
  IF NEW.company_name IS DISTINCT FROM OLD.company_name OR TG_OP = 'INSERT' THEN
    NEW.company_name_normalized := normalize_company_display_name(NEW.company_name);
  END IF;

  -- Normalize location
  IF NEW.location IS DISTINCT FROM OLD.location OR TG_OP = 'INSERT' THEN
    NEW.location_normalized := normalize_location(NEW.location);
  END IF;

  -- Normalize title
  IF NEW.title IS DISTINCT FROM OLD.title OR TG_OP = 'INSERT' THEN
    NEW.title_normalized := normalize_title(NEW.title);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: trg_normalize_workspace_prospect(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_normalize_workspace_prospect() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Normalize company name
  IF NEW.company_name IS DISTINCT FROM OLD.company_name OR TG_OP = 'INSERT' THEN
    NEW.company_name_normalized := normalize_company_display_name(NEW.company_name);
  END IF;

  -- Normalize location
  IF NEW.location IS DISTINCT FROM OLD.location OR TG_OP = 'INSERT' THEN
    NEW.location_normalized := normalize_location(NEW.location);
  END IF;

  -- Normalize title (workspace_prospects uses job_title column)
  IF NEW.job_title IS DISTINCT FROM OLD.job_title OR TG_OP = 'INSERT' THEN
    NEW.title_normalized := normalize_title(NEW.job_title);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: trigger_update_execution_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_update_execution_metrics() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM update_sam_funnel_execution_metrics(NEW.execution_id);
  RETURN NEW;
END;
$$;


--
-- Name: update_api_keys_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_api_keys_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_attachment_processing_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_attachment_processing_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.processing_status = 'completed' AND OLD.processing_status != 'completed' THEN
        NEW.processed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: update_author_relationship_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_author_relationship_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_campaign_replies_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_campaign_replies_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_campaign_schedules_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_campaign_schedules_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_crm_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_crm_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_email_responses_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_email_responses_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_enrichment_job_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_enrichment_job_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_execution_state_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_execution_state_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_follow_up_drafts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_follow_up_drafts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_funnel_performance_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_funnel_performance_metrics() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update core funnel template metrics
  IF TG_TABLE_NAME = 'core_funnel_executions' AND NEW.status = 'completed' THEN
    UPDATE core_funnel_templates 
    SET 
      total_executions = total_executions + 1,
      avg_response_rate = (
        SELECT AVG((prospects_responded::DECIMAL / prospects_contacted::DECIMAL) * 100)
        FROM core_funnel_executions 
        WHERE template_id = NEW.template_id AND status = 'completed' AND prospects_contacted > 0
      ),
      avg_conversion_rate = (
        SELECT AVG((meetings_booked::DECIMAL / prospects_responded::DECIMAL) * 100)
        FROM core_funnel_executions 
        WHERE template_id = NEW.template_id AND status = 'completed' AND prospects_responded > 0
      ),
      updated_at = NOW()
    WHERE id = NEW.template_id;
  END IF;
  
  -- Update dynamic funnel definition metrics
  IF TG_TABLE_NAME = 'dynamic_funnel_executions' AND NEW.status = 'completed' THEN
    UPDATE dynamic_funnel_definitions 
    SET 
      execution_count = execution_count + 1,
      avg_performance_score = COALESCE(NEW.overall_performance_score, avg_performance_score),
      updated_at = NOW()
    WHERE id = NEW.funnel_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_linkedin_commenting_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_linkedin_commenting_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_linkedin_messages_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_linkedin_messages_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_meetings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_meetings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_message_outbox_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_message_outbox_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_reply_agent_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_reply_agent_metrics() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Insert or update daily metrics when a reply is processed
  INSERT INTO reply_agent_metrics (
    workspace_id,
    date,
    replies_received,
    drafts_generated,
    intent_interested,
    intent_curious,
    intent_objection,
    intent_timing,
    intent_wrong_person,
    intent_not_interested,
    intent_question,
    intent_vague_positive
  )
  SELECT
    c.workspace_id,
    CURRENT_DATE,
    1,
    CASE WHEN NEW.ai_suggested_response IS NOT NULL THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'interested' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'curious' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'objection' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'timing' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'wrong_person' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'not_interested' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'question' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'vague_positive' THEN 1 ELSE 0 END
  FROM campaigns c
  WHERE c.id = NEW.campaign_id
  ON CONFLICT (workspace_id, date) DO UPDATE SET
    replies_received = reply_agent_metrics.replies_received + 1,
    drafts_generated = reply_agent_metrics.drafts_generated +
      CASE WHEN NEW.ai_suggested_response IS NOT NULL THEN 1 ELSE 0 END,
    intent_interested = reply_agent_metrics.intent_interested +
      CASE WHEN NEW.intent = 'interested' THEN 1 ELSE 0 END,
    intent_curious = reply_agent_metrics.intent_curious +
      CASE WHEN NEW.intent = 'curious' THEN 1 ELSE 0 END,
    intent_objection = reply_agent_metrics.intent_objection +
      CASE WHEN NEW.intent = 'objection' THEN 1 ELSE 0 END,
    intent_timing = reply_agent_metrics.intent_timing +
      CASE WHEN NEW.intent = 'timing' THEN 1 ELSE 0 END,
    intent_wrong_person = reply_agent_metrics.intent_wrong_person +
      CASE WHEN NEW.intent = 'wrong_person' THEN 1 ELSE 0 END,
    intent_not_interested = reply_agent_metrics.intent_not_interested +
      CASE WHEN NEW.intent = 'not_interested' THEN 1 ELSE 0 END,
    intent_question = reply_agent_metrics.intent_question +
      CASE WHEN NEW.intent = 'question' THEN 1 ELSE 0 END,
    intent_vague_positive = reply_agent_metrics.intent_vague_positive +
      CASE WHEN NEW.intent = 'vague_positive' THEN 1 ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;


--
-- Name: update_sam_funnel_execution_metrics(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_sam_funnel_execution_metrics(p_execution_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_prospects_responded INTEGER;
  v_prospects_converted INTEGER;
  v_prospects_total INTEGER;
  v_response_rate DECIMAL(5,2);
  v_conversion_rate DECIMAL(5,2);
BEGIN
  SELECT 
    COUNT(DISTINCT CASE WHEN sfr.response_type IS NOT NULL THEN sfr.prospect_id END),
    COUNT(DISTINCT CASE WHEN sfr.response_type = 'positive' THEN sfr.prospect_id END),
    sfe.prospects_total
  INTO v_prospects_responded, v_prospects_converted, v_prospects_total
  FROM sam_funnel_executions sfe
  LEFT JOIN sam_funnel_responses sfr ON sfe.id = sfr.execution_id
  WHERE sfe.id = p_execution_id
  GROUP BY sfe.prospects_total;

  v_response_rate := CASE WHEN v_prospects_total > 0 
    THEN (v_prospects_responded::DECIMAL / v_prospects_total::DECIMAL) * 100 
    ELSE 0 END;
  
  v_conversion_rate := CASE WHEN v_prospects_responded > 0 
    THEN (v_prospects_converted::DECIMAL / v_prospects_responded::DECIMAL) * 100 
    ELSE 0 END;

  UPDATE sam_funnel_executions 
  SET 
    prospects_responded = v_prospects_responded,
    response_rate = v_response_rate,
    conversion_rate = v_conversion_rate,
    updated_at = NOW()
  WHERE id = p_execution_id;
END;
$$;


--
-- Name: update_sam_funnel_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_sam_funnel_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_sam_icp_knowledge_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_sam_icp_knowledge_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_template_performance(uuid, uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_template_performance(p_template_id uuid, p_campaign_id uuid, p_sent integer, p_responses integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_response_rate DECIMAL(5,2);
BEGIN
  v_response_rate := CASE WHEN p_sent > 0 THEN (p_responses::DECIMAL / p_sent::DECIMAL) * 100 ELSE 0 END;
  
  INSERT INTO template_performance (
    template_id, campaign_id, total_sent, total_responses, response_rate, date_start, date_end
  ) VALUES (
    p_template_id, p_campaign_id, p_sent, p_responses, v_response_rate, CURRENT_DATE, CURRENT_DATE
  )
  ON CONFLICT (template_id, campaign_id) DO UPDATE SET
    total_sent = EXCLUDED.total_sent,
    total_responses = EXCLUDED.total_responses,
    response_rate = EXCLUDED.response_rate,
    date_end = CURRENT_DATE;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_workspace_icp_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workspace_icp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: validate_prospect_status_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_prospect_status_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Rule 1: If status is being set to "connection_request_sent", contacted_at MUST be set
  IF NEW.status = 'connection_request_sent' AND NEW.contacted_at IS NULL THEN
    RAISE EXCEPTION 'Cannot set status to connection_request_sent without contacted_at timestamp';
  END IF;

  -- Rule 2: If contacted_at is being set, status MUST be one of the "contacted" statuses
  IF NEW.contacted_at IS NOT NULL AND OLD.contacted_at IS NULL THEN
    IF NEW.status NOT IN ('connection_request_sent', 'connected', 'messaging', 'replied', 'failed') THEN
      RAISE EXCEPTION 'Setting contacted_at requires status to be connection_request_sent, connected, messaging, replied, or failed';
    END IF;
  END IF;

  -- Rule 3: Cannot remove contacted_at once set (data integrity)
  IF OLD.contacted_at IS NOT NULL AND NEW.contacted_at IS NULL THEN
    RAISE EXCEPTION 'Cannot remove contacted_at timestamp once set';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: verify_rls_status_daily(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_rls_status_daily() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
     DECLARE
       v_expected_enabled TEXT[] := ARRAY[
         'workspaces',
         'workspace_members',
         'campaigns',
         'campaign_prospects',
         'prospect_approval_sessions'
       ];
       v_expected_disabled TEXT[] := ARRAY[
         'workspace_accounts',
         'linkedin_proxy_assignments',
         'user_unipile_accounts'
       ];
       v_table_name TEXT;
       v_rls_enabled BOOLEAN;
       v_issues JSONB := '[]'::jsonb;
       v_status TEXT := 'success';
     BEGIN
       -- Check tables that should have RLS enabled
       FOREACH v_table_name IN ARRAY v_expected_enabled
       LOOP
         SELECT rowsecurity INTO v_rls_enabled
         FROM pg_tables
         WHERE tablename = v_table_name;

         IF NOT COALESCE(v_rls_enabled, false) THEN
           v_status := 'error';
           v_issues := v_issues || jsonb_build_object(
             'table', v_table_name,
             'issue', 'RLS should be ENABLED but is DISABLED'
           );
         END IF;
       END LOOP;

       -- Check tables that should have RLS disabled
       FOREACH v_table_name IN ARRAY v_expected_disabled
       LOOP
         SELECT rowsecurity INTO v_rls_enabled
         FROM pg_tables
         WHERE tablename = v_table_name;

         IF COALESCE(v_rls_enabled, false) THEN
           v_status := 'warning';
           v_issues := v_issues || jsonb_build_object(
             'table', v_table_name,
             'issue', 'RLS should be DISABLED but is ENABLED'
           );
         END IF;
       END LOOP;

       -- Log the results
       INSERT INTO public.cron_job_logs (job_name, status, details)
       VALUES (
         'verify_rls_status',
         v_status,
         jsonb_build_object(
           'issues_found', jsonb_array_length(v_issues),
           'issues', v_issues
         )
       );
     END;
     $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    date date NOT NULL,
    daily_cr_sent integer DEFAULT 0,
    weekly_cr_sent integer DEFAULT 0,
    daily_messages_sent integer DEFAULT 0,
    status character varying(20) DEFAULT 'healthy'::character varying,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: workflow_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_name text DEFAULT 'SAM_MASTER_CAMPAIGN_WORKFLOW'::text NOT NULL,
    template_version text NOT NULL,
    n8n_workflow_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    customization_points jsonb DEFAULT '{}'::jsonb NOT NULL,
    required_credentials text[] DEFAULT ARRAY[]::text[],
    min_n8n_version text DEFAULT '1.0.0'::text,
    required_integrations text[] DEFAULT ARRAY['unipile'::text, 'email_provider'::text],
    compatibility_matrix jsonb DEFAULT '{}'::jsonb,
    description text,
    changelog text,
    status text DEFAULT 'draft'::text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    activated_at timestamp with time zone,
    deprecated_at timestamp with time zone,
    CONSTRAINT workflow_templates_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text])))
);


--
-- Name: workspace_n8n_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_n8n_workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id text NOT NULL,
    user_id text NOT NULL,
    n8n_instance_url text DEFAULT 'https://workflows.innovareai.com'::text NOT NULL,
    deployed_workflow_id text NOT NULL,
    master_template_version text DEFAULT 'v1.0'::text,
    deployment_status text DEFAULT 'pending'::text,
    last_deployment_attempt timestamp with time zone DEFAULT now(),
    deployment_error text,
    workspace_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    channel_preferences jsonb DEFAULT '{"email_enabled": true, "linkedin_enabled": true, "execution_sequence": "email_first", "delay_between_channels": 24}'::jsonb NOT NULL,
    email_config jsonb DEFAULT '{"enabled": true, "reply_to": "", "from_name": "", "sequences": [], "from_email": "", "personalization_enabled": true}'::jsonb,
    linkedin_config jsonb DEFAULT '{"enabled": true, "account_id": "", "inmails_enabled": false, "response_handling": "auto_classify", "connection_requests_enabled": true}'::jsonb,
    reply_handling_config jsonb DEFAULT '{"auto_response_enabled": true, "classification_enabled": true, "human_handoff_triggers": ["complex_question", "objection", "pricing_inquiry"], "negative_reply_actions": ["remove_from_sequence", "add_to_suppression"], "positive_reply_actions": ["schedule_meeting", "notify_sales_rep"]}'::jsonb,
    credentials_config jsonb DEFAULT '{}'::jsonb,
    integration_status jsonb DEFAULT '{"unipile_connected": false, "calendar_connected": false, "email_provider_connected": false}'::jsonb,
    total_executions integer DEFAULT 0,
    successful_executions integer DEFAULT 0,
    failed_executions integer DEFAULT 0,
    last_execution_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workspace_n8n_workflows_deployment_status_check CHECK ((deployment_status = ANY (ARRAY['pending'::text, 'deploying'::text, 'active'::text, 'failed'::text, 'archived'::text])))
);


--
-- Name: active_workspace_workflows; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_workspace_workflows AS
 SELECT wnw.id,
    wnw.workspace_id,
    wnw.user_id,
    wnw.n8n_instance_url,
    wnw.deployed_workflow_id,
    wnw.master_template_version,
    wnw.deployment_status,
    wnw.last_deployment_attempt,
    wnw.deployment_error,
    wnw.workspace_config,
    wnw.channel_preferences,
    wnw.email_config,
    wnw.linkedin_config,
    wnw.reply_handling_config,
    wnw.credentials_config,
    wnw.integration_status,
    wnw.total_executions,
    wnw.successful_executions,
    wnw.failed_executions,
    wnw.last_execution_at,
    wnw.created_at,
    wnw.updated_at,
    wt.template_name,
    wt.description AS template_description
   FROM (public.workspace_n8n_workflows wnw
     LEFT JOIN public.workflow_templates wt ON ((wnw.master_template_version = wt.template_version)))
  WHERE (wnw.deployment_status = 'active'::text);


--
-- Name: agent_fix_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_fix_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    health_check_id uuid,
    issue_type character varying(100) NOT NULL,
    issue_description text NOT NULL,
    file_path text,
    proposed_fix text,
    confidence_score numeric(3,2),
    status character varying(50) DEFAULT 'proposed'::character varying,
    applied_at timestamp with time zone,
    applied_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    key_hash text NOT NULL,
    key_prefix text NOT NULL,
    last_used_at timestamp with time zone,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    scopes text[] DEFAULT ARRAY['linkedin:comment:generate'::text],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE api_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.api_keys IS 'API keys for external integrations like Chrome extension';


--
-- Name: COLUMN api_keys.key_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hash of the full API key';


--
-- Name: COLUMN api_keys.key_prefix; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.key_prefix IS 'First 8 characters of key for identification (e.g., sk_live_abc123de)';


--
-- Name: COLUMN api_keys.scopes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.scopes IS 'Permission scopes for this API key';


--
-- Name: booking_platforms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_platforms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform_name text NOT NULL,
    url_pattern text NOT NULL,
    scrape_enabled boolean DEFAULT true,
    booking_enabled boolean DEFAULT true,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE booking_platforms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_platforms IS 'Supported booking platforms with URL detection patterns';


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    name text NOT NULL,
    description text,
    campaign_type text DEFAULT 'linkedin_only'::text,
    status text DEFAULT 'draft'::text,
    channel_preferences jsonb DEFAULT '{"email": false, "linkedin": true}'::jsonb,
    linkedin_config jsonb,
    email_config jsonb,
    n8n_execution_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    launched_at timestamp with time zone,
    completed_at timestamp with time zone,
    type text,
    target_criteria jsonb DEFAULT '{}'::jsonb,
    execution_preferences jsonb DEFAULT '{}'::jsonb,
    template_id uuid,
    funnel_type text,
    core_template_id uuid,
    dynamic_definition_id uuid,
    n8n_workflow_id text,
    funnel_configuration jsonb DEFAULT '{}'::jsonb,
    campaign_name text,
    current_step integer DEFAULT 1,
    connection_message text,
    alternative_message text,
    follow_up_messages jsonb DEFAULT '[]'::jsonb,
    draft_data jsonb DEFAULT '{}'::jsonb,
    funnel_id uuid,
    target_icp jsonb,
    ab_test_variant text,
    message_templates jsonb,
    created_by uuid,
    send_schedule jsonb DEFAULT '{"enabled": false, "end_time": "17:00", "timezone": "America/New_York", "start_time": "09:00", "business_days": [1, 2, 3, 4, 5], "allow_weekends": false}'::jsonb,
    next_execution_time timestamp with time zone,
    auto_execute boolean DEFAULT true,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    working_hours_start integer DEFAULT 7,
    working_hours_end integer DEFAULT 18,
    skip_weekends boolean DEFAULT true,
    skip_holidays boolean DEFAULT true,
    country_code character varying(2) DEFAULT 'US'::character varying,
    flow_settings jsonb DEFAULT '{"messages": {"goodbye": null, "message_1": null, "message_2": null, "message_3": null, "message_4": null, "message_5": null, "message_6": null, "message_7": null, "message_8": null, "message_9": null, "message_10": null, "follow_up_1": null, "follow_up_2": null, "follow_up_3": null, "follow_up_4": null, "follow_up_5": null, "follow_up_6": null, "connection_request": null}, "campaign_type": "linkedin_connection", "message_wait_days": 5, "followup_wait_days": 5, "connection_wait_hours": 36}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    linkedin_account_id uuid,
    n8n_webhook_url text,
    schedule_settings jsonb,
    message_sequence jsonb,
    reachinbox_campaign_id text,
    total_emails_sent integer DEFAULT 0,
    total_emails_opened integer DEFAULT 0,
    total_emails_replied integer DEFAULT 0,
    total_emails_bounced integer DEFAULT 0,
    total_link_clicked integer DEFAULT 0,
    leads_count integer DEFAULT 0,
    CONSTRAINT campaigns_campaign_type_check CHECK ((campaign_type = ANY (ARRAY['connector'::text, 'messenger'::text, 'email'::text, 'multi_channel'::text, 'builder'::text, 'inbound'::text, 'company_follow'::text, 'open_inmail'::text, 'group'::text, 'event_invite'::text, 'event_participants'::text, 'recovery'::text, 'linkedin'::text]))),
    CONSTRAINT campaigns_funnel_type_check CHECK ((funnel_type = ANY (ARRAY['core'::text, 'dynamic'::text]))),
    CONSTRAINT campaigns_type_check CHECK ((type = ANY (ARRAY['sam_signature'::text, 'event_invitation'::text, 'product_launch'::text, 'partnership'::text, 'custom'::text, 'linkedin'::text, 'email'::text])))
);


--
-- Name: COLUMN campaigns.campaign_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.campaign_type IS 'Type of campaign: connector (sends CR + follow-ups), messenger (sends messages to connected prospects only), email, etc.';


--
-- Name: COLUMN campaigns.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.type IS 'Sam AI campaign type - maps to template selection';


--
-- Name: COLUMN campaigns.target_criteria; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.target_criteria IS 'JSON targeting criteria: industry, role, company_size, location';


--
-- Name: COLUMN campaigns.execution_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.execution_preferences IS 'JSON execution settings: daily_limit, personalization_level, channels';


--
-- Name: COLUMN campaigns.template_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.template_id IS 'Reference to messaging template used for this campaign';


--
-- Name: COLUMN campaigns.campaign_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.campaign_name IS 'Full campaign name in format YYYYMMDD-CODE-CampaignName';


--
-- Name: COLUMN campaigns.current_step; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.current_step IS 'Current step in campaign creation process (1-3)';


--
-- Name: COLUMN campaigns.connection_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.connection_message IS 'Primary connection request message template';


--
-- Name: COLUMN campaigns.alternative_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.alternative_message IS 'Alternative message if connection exists';


--
-- Name: COLUMN campaigns.follow_up_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.follow_up_messages IS 'Array of follow-up message templates';


--
-- Name: COLUMN campaigns.draft_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.draft_data IS 'Additional draft data (CSV data, temporary settings, etc.)';


--
-- Name: COLUMN campaigns.send_schedule; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.send_schedule IS 'Business hours scheduling configuration. Format: {
  "enabled": boolean,
  "timezone": string (IANA timezone),
  "business_days": number[] (0=Sunday, 1=Monday, etc.),
  "start_time": string (HH:MM 24-hour format),
  "end_time": string (HH:MM 24-hour format),
  "allow_weekends": boolean
}';


--
-- Name: COLUMN campaigns.next_execution_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.next_execution_time IS 'Scheduled time for next prospect execution (2-30 minute 
  randomized delays)';


--
-- Name: COLUMN campaigns.auto_execute; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.auto_execute IS 'Whether to automatically execute remaining prospects';


--
-- Name: COLUMN campaigns.timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.timezone IS 'Timezone for campaign execution (default UTC, supports IANA timezone
   names)';


--
-- Name: COLUMN campaigns.working_hours_start; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.working_hours_start IS 'Start of working hours (0-23, default 7 = 7 AM)';


--
-- Name: COLUMN campaigns.working_hours_end; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.working_hours_end IS 'End of working hours (0-23, default 18 = 6 PM)';


--
-- Name: COLUMN campaigns.skip_weekends; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.skip_weekends IS 'Skip execution on Saturday and Sunday (default true)';


--
-- Name: COLUMN campaigns.skip_holidays; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.skip_holidays IS 'Skip execution on public holidays (default true)';


--
-- Name: COLUMN campaigns.country_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.country_code IS 'Country code for holiday calendar (default US)';


--
-- Name: COLUMN campaigns.flow_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.flow_settings IS 'Dynamic flow configuration: 
  connection_wait_hours (12-96), followup_wait_days (1-30), and messages object with up to 6 
  follow-ups plus goodbye';


--
-- Name: COLUMN campaigns.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.metadata IS 'Campaign metadata including ab_test_group and 
  variant for A/B testing';


--
-- Name: COLUMN campaigns.schedule_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.schedule_settings IS 'Configuration for campaign schedule: timezone, working_hours, skip_weekends, etc.';


--
-- Name: COLUMN campaigns.message_sequence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaigns.message_sequence IS 'Stores the array of message objects for the campaign, including connection request and follow-ups with 
  timestamps.';


--
-- Name: core_funnel_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_funnel_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    funnel_type text NOT NULL,
    name text NOT NULL,
    description text,
    industry text,
    target_role text,
    company_size text,
    n8n_workflow_id text NOT NULL,
    n8n_workflow_json jsonb,
    total_executions integer DEFAULT 0,
    avg_response_rate numeric(5,2) DEFAULT 0,
    avg_conversion_rate numeric(5,2) DEFAULT 0,
    avg_completion_time interval,
    step_count integer NOT NULL,
    default_timing jsonb,
    message_templates jsonb,
    personalization_variables jsonb,
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    created_by text,
    tags text[],
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    workspace_id uuid NOT NULL,
    CONSTRAINT core_funnel_templates_funnel_type_check CHECK ((funnel_type = ANY (ARRAY['sam_signature'::text, 'event_invitation'::text, 'product_launch'::text, 'partnership'::text, 'nurture_sequence'::text])))
);


--
-- Name: dynamic_funnel_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dynamic_funnel_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    name text NOT NULL,
    description text,
    ai_prompt text NOT NULL,
    target_persona jsonb NOT NULL,
    business_objective text NOT NULL,
    value_proposition text,
    funnel_logic jsonb NOT NULL,
    adaptation_rules jsonb,
    n8n_workflow_json jsonb NOT NULL,
    n8n_workflow_id text,
    created_by_sam boolean DEFAULT true,
    ai_model_used text,
    confidence_score numeric(3,2),
    generation_reasoning text,
    execution_count integer DEFAULT 0,
    adaptation_count integer DEFAULT 0,
    avg_performance_score numeric(3,2),
    is_active boolean DEFAULT true,
    is_experimental boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    workspace_id uuid NOT NULL
);


--
-- Name: funnel_performance_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funnel_performance_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    funnel_type text NOT NULL,
    template_or_definition_id uuid NOT NULL,
    execution_id uuid,
    prospects_total integer NOT NULL,
    prospects_contacted integer DEFAULT 0,
    prospects_responded integer DEFAULT 0,
    prospects_converted integer DEFAULT 0,
    prospects_unsubscribed integer DEFAULT 0,
    response_rate numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN (prospects_contacted > 0) THEN (((prospects_responded)::numeric / (prospects_contacted)::numeric) * (100)::numeric)
    ELSE (0)::numeric
END) STORED,
    conversion_rate numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN (prospects_responded > 0) THEN (((prospects_converted)::numeric / (prospects_responded)::numeric) * (100)::numeric)
    ELSE (0)::numeric
END) STORED,
    unsubscribe_rate numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN (prospects_contacted > 0) THEN (((prospects_unsubscribed)::numeric / (prospects_contacted)::numeric) * (100)::numeric)
    ELSE (0)::numeric
END) STORED,
    step_performance jsonb DEFAULT '{}'::jsonb,
    avg_response_time interval,
    avg_conversion_time interval,
    funnel_completion_rate numeric(5,2),
    response_sentiment_scores jsonb,
    message_quality_scores jsonb,
    personalization_effectiveness numeric(3,2),
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    workspace_id uuid NOT NULL,
    CONSTRAINT funnel_performance_metrics_funnel_type_check CHECK ((funnel_type = ANY (ARRAY['core'::text, 'dynamic'::text])))
);


--
-- Name: campaign_funnel_overview; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.campaign_funnel_overview AS
 SELECT c.id AS campaign_id,
    c.name AS campaign_name,
    c.funnel_type,
        CASE
            WHEN (c.funnel_type = 'core'::text) THEN ct.name
            WHEN (c.funnel_type = 'dynamic'::text) THEN dd.name
            ELSE 'Unknown'::text
        END AS funnel_name,
    c.status AS campaign_status,
    c.n8n_workflow_id,
    c.n8n_execution_id,
    pm.prospects_total,
    pm.prospects_contacted,
    pm.prospects_responded,
    pm.prospects_converted,
    pm.response_rate,
    pm.conversion_rate,
    c.created_at AS campaign_created_at,
    c.updated_at AS campaign_updated_at
   FROM (((public.campaigns c
     LEFT JOIN public.core_funnel_templates ct ON ((c.core_template_id = ct.id)))
     LEFT JOIN public.dynamic_funnel_definitions dd ON ((c.dynamic_definition_id = dd.id)))
     LEFT JOIN public.funnel_performance_metrics pm ON ((c.id = pm.campaign_id)))
  WHERE (c.funnel_type IS NOT NULL);


--
-- Name: user_unipile_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_unipile_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    unipile_account_id text NOT NULL,
    platform text DEFAULT 'LINKEDIN'::text NOT NULL,
    account_name text,
    account_email text,
    linkedin_public_identifier text,
    linkedin_profile_url text,
    connection_status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    linkedin_account_type text,
    account_features jsonb DEFAULT '{}'::jsonb,
    workspace_id uuid,
    account_metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT user_unipile_accounts_linkedin_account_type_check CHECK ((linkedin_account_type = ANY (ARRAY['classic'::text, 'premium'::text, 'premium_career'::text, 'premium_business'::text, 'sales_navigator'::text, 'recruiter_lite'::text, 'unknown'::text])))
);


--
-- Name: TABLE user_unipile_accounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_unipile_accounts IS 'Links SAM AI users to their Unipile LinkedIn 
  accounts for authentication and messaging';


--
-- Name: COLUMN user_unipile_accounts.connection_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_unipile_accounts.connection_status IS 'Status: active, inactive, error, duplicate_removed, cancelled, payment_failed, requires_action, deleted';


--
-- Name: COLUMN user_unipile_accounts.linkedin_account_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_unipile_accounts.linkedin_account_type IS 'Type of LinkedIn account: classic (free), premium (Career/Business), sales_navigator (Sales Nav), or unknown';


--
-- Name: COLUMN user_unipile_accounts.account_features; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_unipile_accounts.account_features IS 'Features detected from Unipile account data (used to determine account type)';


--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    linkedin_unipile_account_id text,
    status text DEFAULT 'active'::text
);


--
-- Name: COLUMN workspace_members.linkedin_unipile_account_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_members.linkedin_unipile_account_id IS 'Primary LinkedIn account for this workspace member to use in campaigns';


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    owner_id uuid NOT NULL,
    organization_id uuid,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    trial_ends_at timestamp with time zone,
    billing_starts_at timestamp with time zone,
    tenant text DEFAULT 'innovareai'::text,
    company_url text,
    detected_industry text,
    company_description text,
    target_personas text[],
    pain_points text[],
    value_proposition text,
    key_competitors text[],
    pricing_model text,
    website_analysis_status text DEFAULT 'pending'::text,
    website_analyzed_at timestamp with time zone,
    manual_overrides jsonb DEFAULT '{}'::jsonb,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'active'::text,
    subscription_cancelled_at timestamp with time zone,
    subscription_cancel_at timestamp with time zone,
    is_active boolean DEFAULT true,
    client_code character varying(3),
    reseller_affiliation text,
    commenting_agent_enabled boolean DEFAULT false,
    CONSTRAINT workspaces_reseller_affiliation_check CHECK ((reseller_affiliation = ANY (ARRAY['3cubed'::text, 'innovareai'::text, 'direct'::text]))),
    CONSTRAINT workspaces_tenant_check CHECK ((tenant = ANY (ARRAY['innovareai'::text, 'alekh'::text, 'rony'::text, 'asphericon'::text, 'brian'::text, 'charissa'::text, 'chona'::text, 'irish'::text, 'jennifer'::text, 'michelle'::text, 'samantha'::text, 'stan'::text, 'thorsten'::text]))),
    CONSTRAINT workspaces_website_analysis_status_check CHECK ((website_analysis_status = ANY (ARRAY['pending'::text, 'analyzing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: COLUMN workspaces.tenant; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.tenant IS 'Tenant identifier: innovareai (InnovareAI), 3cubed (3cubed), sendingcell (Sendingcell), truepeople (True People Consulting), wtmatchmaker (WT Matchmaker), bluelabel (Blue Label Labs)';


--
-- Name: COLUMN workspaces.company_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.company_url IS 'Website URL provided during signup, used for AI analysis of company information';


--
-- Name: COLUMN workspaces.detected_industry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.detected_industry IS 'Industry detected from website analysis, maps to industry blueprints (cybersecurity, saas, fintech, etc.)';


--
-- Name: COLUMN workspaces.company_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.company_description IS 'AI-extracted description of what the company does (used in SAM context)';


--
-- Name: COLUMN workspaces.target_personas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.target_personas IS 'AI-detected target customer personas (e.g., ["CISO", "SOC Manager"])';


--
-- Name: COLUMN workspaces.pain_points; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.pain_points IS 'Key pain points the company solves (extracted from website)';


--
-- Name: COLUMN workspaces.value_proposition; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.value_proposition IS 'Company value proposition (extracted from website hero/about sections)';


--
-- Name: COLUMN workspaces.key_competitors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.key_competitors IS 'Competitors mentioned on website (from competitive analysis pages)';


--
-- Name: COLUMN workspaces.pricing_model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.pricing_model IS 'Pricing model detected (per-seat, tiered, enterprise, freemium, etc.)';


--
-- Name: COLUMN workspaces.website_analysis_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.website_analysis_status IS 'Status of website analysis: pending (not started), analyzing (in progress), completed (success), failed (error)';


--
-- Name: COLUMN workspaces.website_analyzed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.website_analyzed_at IS 'Timestamp when website was last analyzed by AI';


--
-- Name: COLUMN workspaces.manual_overrides; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.manual_overrides IS 'Tracks which fields were manually edited by user (JSON object with field names as keys)';


--
-- Name: COLUMN workspaces.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.is_active IS 'Controls workspace access. Set to false when payment fails or subscription cancelled to restrict user access.';


--
-- Name: COLUMN workspaces.client_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.client_code IS '3-character client identifier for campaign naming (e.g., IAI for InnovareAI)';


--
-- Name: COLUMN workspaces.reseller_affiliation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.reseller_affiliation IS 'Signup method: 3cubed (invite-only super admin), innovareai (Stripe self-service), direct (reserved)';


--
-- Name: campaign_linkedin_accounts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.campaign_linkedin_accounts WITH (security_invoker='true') AS
 SELECT w.id AS workspace_id,
    w.name AS workspace_name,
    wm.user_id,
    u.email AS user_email,
    wm.role AS member_role,
    ua.unipile_account_id,
    ua.account_name AS linkedin_account_name,
    ua.linkedin_public_identifier,
    ua.linkedin_profile_url,
    ua.connection_status,
    (ua.connection_status = 'active'::text) AS is_available_for_campaigns
   FROM (((public.workspaces w
     JOIN public.workspace_members wm ON ((w.id = wm.workspace_id)))
     JOIN auth.users u ON ((wm.user_id = u.id)))
     JOIN public.user_unipile_accounts ua ON ((wm.user_id = ua.user_id)))
  WHERE ((ua.platform = 'LINKEDIN'::text) AND (wm.linkedin_unipile_account_id = ua.unipile_account_id));


--
-- Name: VIEW campaign_linkedin_accounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.campaign_linkedin_accounts IS 'Simplified access to LinkedIn accounts available for campaign execution by workspace';


--
-- Name: campaign_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    platform text NOT NULL,
    platform_message_id text NOT NULL,
    conversation_id text,
    thread_id text,
    recipient_email text,
    recipient_linkedin_profile text,
    recipient_name text,
    prospect_id uuid,
    subject_line text,
    message_content text NOT NULL,
    message_template_variant text,
    sent_at timestamp with time zone NOT NULL,
    sent_via text,
    sender_account text,
    expects_reply boolean DEFAULT true,
    reply_received_at timestamp with time zone,
    reply_count integer DEFAULT 0,
    last_reply_at timestamp with time zone,
    delivery_status text DEFAULT 'sent'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT campaign_messages_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'bounced'::text, 'failed'::text]))),
    CONSTRAINT campaign_messages_platform_check CHECK ((platform = ANY (ARRAY['linkedin'::text, 'email'::text, 'whatsapp'::text, 'instagram'::text])))
);


--
-- Name: TABLE campaign_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.campaign_messages IS 'All outbound messages sent as part of campaigns';


--
-- Name: campaign_optimizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_optimizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    suggestions jsonb DEFAULT '[]'::jsonb NOT NULL,
    applied_suggestions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: campaign_prospects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_prospects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    company_name text,
    linkedin_url text,
    linkedin_user_id text,
    title text,
    phone text,
    location text,
    industry text,
    status text DEFAULT 'pending'::text,
    notes text,
    personalization_data jsonb DEFAULT '{}'::jsonb,
    n8n_execution_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    contacted_at timestamp with time zone,
    responded_at timestamp with time zone,
    workspace_id uuid,
    added_by uuid,
    added_by_unipile_account text,
    connection_accepted_at timestamp with time zone,
    follow_up_due_at timestamp with time zone,
    follow_up_sequence_index integer DEFAULT 0,
    last_follow_up_at timestamp with time zone,
    unipile_account_id text,
    scheduled_send_at timestamp with time zone,
    engagement_score integer,
    priority_level character varying(20),
    scoring_metadata jsonb,
    validation_status character varying(20) DEFAULT 'valid'::character varying,
    validation_errors jsonb DEFAULT '[]'::jsonb,
    validation_warnings jsonb DEFAULT '[]'::jsonb,
    has_previous_contact boolean DEFAULT false,
    previous_contact_status text,
    validated_at timestamp with time zone,
    connection_degree character varying(20),
    master_prospect_id uuid,
    linkedin_url_hash text,
    company_website text,
    company_name_normalized text,
    title_normalized text,
    location_normalized text,
    ab_variant character varying(10),
    last_processed_message_id text,
    meeting_id uuid,
    meeting_scheduled_at timestamp with time zone,
    meeting_status text,
    reply_sentiment text,
    meeting_booked boolean DEFAULT false,
    meeting_booked_at timestamp with time zone,
    trial_signup boolean DEFAULT false,
    trial_signup_at timestamp with time zone,
    converted_to_mrr boolean DEFAULT false,
    mrr_converted_at timestamp with time zone,
    mrr_value numeric(10,2),
    sam_reply_sent_at timestamp with time zone,
    sam_reply_included_calendar boolean DEFAULT false,
    prospect_calendar_link text,
    follow_up_trigger text,
    calendar_follow_up_due_at timestamp with time zone,
    conversation_stage text DEFAULT 'initial_outreach'::text,
    first_calendar_click_at timestamp with time zone,
    first_demo_click_at timestamp with time zone,
    first_pdf_click_at timestamp with time zone,
    total_link_clicks integer DEFAULT 0,
    last_link_click_at timestamp with time zone,
    CONSTRAINT campaign_prospects_linkedin_user_id_no_urls CHECK ((linkedin_user_id !~~ '%linkedin.com%'::text)),
    CONSTRAINT campaign_prospects_reply_sentiment_check CHECK ((reply_sentiment = ANY (ARRAY['positive'::text, 'negative'::text, 'neutral'::text]))),
    CONSTRAINT campaign_prospects_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'ready_to_message'::text, 'queued_in_n8n'::text, 'contacted'::text, 'connection_requested'::text, 'connection_request_sent'::text, 'connected'::text, 'messaging'::text, 'message_sent'::text, 'followed_up'::text, 'replied'::text, 'completed'::text, 'converted'::text, 'failed'::text, 'error'::text, 'bounced'::text, 'already_invited'::text, 'invitation_declined'::text, 'rate_limited'::text, 'rate_limited_cr'::text, 'rate_limited_message'::text, 'not_interested'::text, 'opted_out'::text, 'paused'::text, 'excluded'::text, 'duplicate_blocked'::text]))),
    CONSTRAINT campaign_prospects_validation_status_check CHECK (((validation_status)::text = ANY ((ARRAY['valid'::character varying, 'warning'::character varying, 'error'::character varying, 'blocked'::character varying])::text[])))
);


--
-- Name: COLUMN campaign_prospects.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.status IS 'Current status: pending, approved, ready_to_message, queued_in_n8n,
   contacted, replied, not_interested, failed, error';


--
-- Name: COLUMN campaign_prospects.personalization_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.personalization_data IS 'JSONB field storing campaign execution metadata: 
  unipile_message_id, contacted_via, enrichment data, etc.';


--
-- Name: COLUMN campaign_prospects.contacted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.contacted_at IS 'Timestamp when prospect was first contacted via LinkedIn/email';


--
-- Name: COLUMN campaign_prospects.added_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.added_by IS 'User who added
   this prospect to campaign - REQUIRED for LinkedIn TOS 
  compliance. Prevents account sharing violations.';


--
-- Name: COLUMN campaign_prospects.connection_accepted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.connection_accepted_at IS 'Timestamp 
  when LinkedIn connection was accepted';


--
-- Name: COLUMN campaign_prospects.follow_up_due_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.follow_up_due_at IS 'Timestamp when next follow-up message is due';


--
-- Name: COLUMN campaign_prospects.follow_up_sequence_index; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.follow_up_sequence_index IS 'Index of 
  next follow-up message to send (0 = first)';


--
-- Name: COLUMN campaign_prospects.last_follow_up_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.last_follow_up_at IS 'Timestamp of last follow-up message sent';


--
-- Name: COLUMN campaign_prospects.validation_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.validation_status IS 'Data quality status: valid (can campaign), warning (missing optional data), error (missing required data), blocked (previous contact/failed)';


--
-- Name: COLUMN campaign_prospects.validation_errors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.validation_errors IS 'Array of error messages preventing campaign inclusion';


--
-- Name: COLUMN campaign_prospects.validation_warnings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.validation_warnings IS 'Array of warning messages for incomplete data';


--
-- Name: COLUMN campaign_prospects.has_previous_contact; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.has_previous_contact IS 'TRUE if prospect was previously contacted in another campaign';


--
-- Name: COLUMN campaign_prospects.previous_contact_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.previous_contact_status IS 'Status from previous campaign contact attempt';


--
-- Name: COLUMN campaign_prospects.connection_degree; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.connection_degree IS 'LinkedIn connection degree at time of import. Values: 1st, 2nd, 3rd, OUT_OF_NETWORK, NULL';


--
-- Name: COLUMN campaign_prospects.company_name_normalized; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.company_name_normalized IS 'Lowercase normalized company name without legal suffixes (Inc, LLC, etc.) for deduplication';


--
-- Name: COLUMN campaign_prospects.title_normalized; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.title_normalized IS 'Normalized job title with standardized abbreviations';


--
-- Name: COLUMN campaign_prospects.location_normalized; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.location_normalized IS 'Normalized location without Area/Greater/Metropolitan suffixes';


--
-- Name: COLUMN campaign_prospects.sam_reply_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.sam_reply_sent_at IS 'Timestamp when Reply Agent (SAM) sent a response to this prospect. Used by Follow-up Agent to calculate follow-up timing.';


--
-- Name: COLUMN campaign_prospects.sam_reply_included_calendar; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.sam_reply_included_calendar IS 'Whether SAM''s reply included a calendar booking link. If true, Calendar Agent monitors for booking.';


--
-- Name: COLUMN campaign_prospects.prospect_calendar_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.prospect_calendar_link IS 'Calendar link sent BY the prospect (e.g., Calendly, Cal.com). System should check OUR availability and respond.';


--
-- Name: COLUMN campaign_prospects.follow_up_trigger; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.follow_up_trigger IS 'What triggered the Follow-up Agent for this prospect: no_meeting_booked, meeting_cancelled, meeting_no_show, no_response, manual';


--
-- Name: COLUMN campaign_prospects.calendar_follow_up_due_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.calendar_follow_up_due_at IS 'When Follow-up Agent should check if meeting was booked. Typically set to sam_reply_sent_at + 3 days.';


--
-- Name: COLUMN campaign_prospects.conversation_stage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.conversation_stage IS 'Stages: initial_outreach, awaiting_response, awaiting_booking, prospect_shared_calendar, availability_ready, meeting_scheduled, meeting_completed, meeting_cancelled, no_show_follow_up, follow_up_needed, calendar_clicked_pending_booking, engaged_watching_demo, engaged_researching, trial_started, closed';


--
-- Name: COLUMN campaign_prospects.first_calendar_click_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.first_calendar_click_at IS 'First time prospect clicked a calendar link - high intent signal';


--
-- Name: COLUMN campaign_prospects.first_demo_click_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.first_demo_click_at IS 'First time prospect clicked demo video - interest signal';


--
-- Name: COLUMN campaign_prospects.first_pdf_click_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.first_pdf_click_at IS 'First time prospect clicked PDF/one-pager - research signal';


--
-- Name: COLUMN campaign_prospects.total_link_clicks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospects.total_link_clicks IS 'Total number of tracked link clicks by this prospect';


--
-- Name: campaign_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    workspace_id uuid,
    prospect_id uuid,
    reply_text text,
    platform text DEFAULT 'email'::text,
    sender_email text,
    sender_name text,
    received_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    requires_review boolean DEFAULT true,
    sentiment text,
    status text DEFAULT 'pending'::text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    ai_suggested_response text,
    final_message text,
    draft_generated_at timestamp with time zone,
    priority text DEFAULT 'normal'::text,
    email_response_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    campaign_message_id uuid,
    conversation_id text,
    thread_id text,
    reply_type text DEFAULT 'text'::text,
    has_attachments boolean DEFAULT false,
    sender_linkedin_profile text,
    reply_sentiment text,
    requires_action boolean DEFAULT true,
    reply_priority text DEFAULT 'medium'::text,
    action_taken boolean DEFAULT false,
    response_time_hours numeric,
    is_processed boolean DEFAULT false,
    processed_by uuid,
    intent character varying(30),
    intent_confidence numeric(3,2),
    intent_reasoning text,
    feedback character varying(20),
    feedback_reason text,
    feedback_at timestamp with time zone,
    feedback_by uuid,
    original_draft text,
    draft_edited boolean DEFAULT false,
    reply_channel character varying(20) DEFAULT 'email'::character varying,
    classification character varying(50),
    classification_confidence numeric(3,2),
    classification_metadata jsonb,
    requires_human_review boolean DEFAULT false,
    CONSTRAINT campaign_replies_reply_priority_check CHECK ((reply_priority = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT campaign_replies_reply_sentiment_check CHECK ((reply_sentiment = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text, 'interested'::text, 'not_interested'::text]))),
    CONSTRAINT campaign_replies_reply_type_check CHECK ((reply_type = ANY (ARRAY['text'::text, 'attachment'::text, 'emoji'::text, 'link'::text])))
);


--
-- Name: TABLE campaign_replies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.campaign_replies IS 'All replies received to campaign messages';


--
-- Name: COLUMN campaign_replies.requires_review; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_replies.requires_review IS 'Whether this reply requires HITL review';


--
-- Name: COLUMN campaign_replies.sentiment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_replies.sentiment IS 'Detected sentiment: positive, negative, neutral';


--
-- Name: COLUMN campaign_replies.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_replies.status IS 'HITL workflow status: pending, approved, edited, refused';


--
-- Name: COLUMN campaign_replies.ai_suggested_response; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_replies.ai_suggested_response IS 'SAM AI generated draft response';


--
-- Name: COLUMN campaign_replies.final_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_replies.final_message IS 'Final message content (SAM draft or HITL edited version)';


--
-- Name: COLUMN campaign_replies.priority; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_replies.priority IS 'Reply priority: normal, urgent';


--
-- Name: campaign_performance_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.campaign_performance_summary AS
 SELECT c.id AS campaign_id,
    c.workspace_id,
    c.name AS campaign_name,
    c.status,
    c.campaign_type,
    c.ab_test_variant,
    c.launched_at,
    c.created_by,
    count(DISTINCT cp.id) AS total_prospects,
    count(DISTINCT
        CASE
            WHEN (cp.status = ANY (ARRAY['connection_request_sent'::text, 'connected'::text, 'replied'::text, 'follow_up_sent'::text, 'follow_up_2_sent'::text, 'follow_up_3_sent'::text])) THEN cp.id
            ELSE NULL::uuid
        END) AS messages_sent,
    count(DISTINCT
        CASE
            WHEN (cp.status = 'replied'::text) THEN cp.id
            ELSE NULL::uuid
        END) AS replies_received,
        CASE
            WHEN (count(DISTINCT
            CASE
                WHEN (cp.status = ANY (ARRAY['connection_request_sent'::text, 'connected'::text, 'replied'::text, 'follow_up_sent'::text, 'follow_up_2_sent'::text, 'follow_up_3_sent'::text])) THEN cp.id
                ELSE NULL::uuid
            END) > 0) THEN round((((count(DISTINCT
            CASE
                WHEN (cp.status = 'replied'::text) THEN cp.id
                ELSE NULL::uuid
            END))::numeric / (count(DISTINCT
            CASE
                WHEN (cp.status = ANY (ARRAY['connection_request_sent'::text, 'connected'::text, 'replied'::text, 'follow_up_sent'::text, 'follow_up_2_sent'::text, 'follow_up_3_sent'::text])) THEN cp.id
                ELSE NULL::uuid
            END))::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS reply_rate_percent,
    NULL::numeric AS avg_response_time_hours,
    (COALESCE(( SELECT count(DISTINCT cr.id) AS count
           FROM public.campaign_replies cr
          WHERE ((cr.campaign_id = c.id) AND (cr.reply_sentiment = 'positive'::text))), (0)::bigint))::integer AS positive_replies,
    (COALESCE(( SELECT count(DISTINCT cr.id) AS count
           FROM public.campaign_replies cr
          WHERE ((cr.campaign_id = c.id) AND (cr.reply_sentiment = 'interested'::text))), (0)::bigint))::integer AS interested_replies,
    (COALESCE(( SELECT count(DISTINCT cr.id) AS count
           FROM public.campaign_replies cr
          WHERE ((cr.campaign_id = c.id) AND (cr.requires_action = true) AND (cr.is_processed = false))), (0)::bigint))::integer AS pending_replies,
    0 AS meetings_booked
   FROM (public.campaigns c
     LEFT JOIN public.campaign_prospects cp ON ((c.id = cp.campaign_id)))
  GROUP BY c.id, c.workspace_id, c.name, c.status, c.campaign_type, c.ab_test_variant, c.launched_at, c.created_by;


--
-- Name: campaign_prospect_execution_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_prospect_execution_state (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    prospect_id uuid NOT NULL,
    current_step integer DEFAULT 1,
    status text DEFAULT 'pending'::text,
    completed_steps integer[] DEFAULT '{}'::integer[],
    failed_steps integer[] DEFAULT '{}'::integer[],
    skipped_steps integer[] DEFAULT '{}'::integer[],
    linkedin_state jsonb DEFAULT '{}'::jsonb,
    email_state jsonb DEFAULT '{}'::jsonb,
    whatsapp_state jsonb DEFAULT '{}'::jsonb,
    waiting_for_trigger text,
    trigger_check_count integer DEFAULT 0,
    trigger_max_checks integer DEFAULT 168,
    next_check_at timestamp without time zone,
    n8n_execution_id text,
    last_executed_at timestamp without time zone DEFAULT now(),
    next_execution_at timestamp without time zone,
    last_error text,
    error_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE campaign_prospect_execution_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.campaign_prospect_execution_state IS 'Tracks multi-channel campaign execution state for each prospect. Supports LinkedIn, Email, WhatsApp orchestration.';


--
-- Name: COLUMN campaign_prospect_execution_state.current_step; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospect_execution_state.current_step IS 'Current step number in the campaign flow_settings.steps array';


--
-- Name: COLUMN campaign_prospect_execution_state.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospect_execution_state.status IS 'Execution status: pending (not started), executing (currently running), waiting_trigger (waiting for LinkedIn acceptance), completed (all steps done), failed (permanent error), paused (user paused or HITL approval needed)';


--
-- Name: COLUMN campaign_prospect_execution_state.waiting_for_trigger; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospect_execution_state.waiting_for_trigger IS 'Trigger type being waited for: connection_accepted (LinkedIn), null (no waiting)';


--
-- Name: COLUMN campaign_prospect_execution_state.next_execution_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_prospect_execution_state.next_execution_at IS 'Scheduled time for next step execution. N8N polls this to find ready prospects.';


--
-- Name: campaign_prospects_backup_20241124; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_prospects_backup_20241124 (
    id uuid,
    campaign_id uuid,
    first_name text,
    last_name text,
    email text,
    company_name text,
    linkedin_url text,
    linkedin_user_id text,
    title text,
    phone text,
    location text,
    industry text,
    status text,
    notes text,
    personalization_data jsonb,
    n8n_execution_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    contacted_at timestamp with time zone,
    responded_at timestamp with time zone,
    workspace_id uuid,
    added_by uuid,
    added_by_unipile_account text,
    connection_accepted_at timestamp with time zone,
    follow_up_due_at timestamp with time zone,
    follow_up_sequence_index integer,
    last_follow_up_at timestamp with time zone,
    unipile_account_id text,
    scheduled_send_at timestamp with time zone
);


--
-- Name: campaign_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    scheduled_start_time timestamp with time zone NOT NULL,
    scheduled_end_time timestamp with time zone,
    timezone text DEFAULT 'UTC'::text,
    repeat_frequency text DEFAULT 'none'::text,
    repeat_until timestamp with time zone,
    priority text DEFAULT 'normal'::text,
    max_daily_messages integer,
    schedule_status text DEFAULT 'scheduled'::text,
    actual_start_time timestamp with time zone,
    paused_at timestamp with time zone,
    resumed_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    workspace_id uuid NOT NULL,
    CONSTRAINT campaign_schedules_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text]))),
    CONSTRAINT campaign_schedules_repeat_frequency_check CHECK ((repeat_frequency = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text, 'monthly'::text]))),
    CONSTRAINT campaign_schedules_schedule_status_check CHECK ((schedule_status = ANY (ARRAY['scheduled'::text, 'active'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: TABLE campaign_schedules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.campaign_schedules IS 'Scheduling information for campaigns';


--
-- Name: COLUMN campaign_schedules.campaign_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_schedules.campaign_id IS 'The campaign being scheduled';


--
-- Name: COLUMN campaign_schedules.scheduled_start_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_schedules.scheduled_start_time IS 'When the campaign should start';


--
-- Name: COLUMN campaign_schedules.scheduled_end_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_schedules.scheduled_end_time IS 'When the campaign should end (optional)';


--
-- Name: COLUMN campaign_schedules.repeat_frequency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_schedules.repeat_frequency IS 'How often the campaign repeats';


--
-- Name: COLUMN campaign_schedules.schedule_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_schedules.schedule_status IS 'Current status of the schedule';


--
-- Name: campaign_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid,
    campaign_id uuid,
    connection_request_delay text DEFAULT '1-3 hours'::text,
    follow_up_delay text DEFAULT '2-3 days'::text,
    max_messages_per_day integer DEFAULT 20,
    preferred_send_times text[] DEFAULT ARRAY['9-11 AM'::text, '1-3 PM'::text],
    active_days text[] DEFAULT ARRAY['Monday-Friday'::text],
    timezone text DEFAULT 'ET (Eastern Time)'::text,
    auto_insert_company_name boolean DEFAULT true,
    use_job_title boolean DEFAULT true,
    include_industry_insights boolean DEFAULT false,
    reference_mutual_connections boolean DEFAULT false,
    daily_connection_limit integer DEFAULT 100,
    respect_do_not_contact boolean DEFAULT true,
    auto_pause_high_rejection boolean DEFAULT true,
    require_message_approval boolean DEFAULT false,
    scope text DEFAULT 'workspace'::text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT campaign_settings_scope_check CHECK ((scope = ANY (ARRAY['workspace'::text, 'user'::text, 'campaign'::text])))
);


--
-- Name: campaigns_backup_20241124; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns_backup_20241124 (
    id uuid,
    workspace_id uuid,
    name text,
    description text,
    campaign_type text,
    status text,
    channel_preferences jsonb,
    linkedin_config jsonb,
    email_config jsonb,
    n8n_execution_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    launched_at timestamp with time zone,
    completed_at timestamp with time zone,
    type text,
    target_criteria jsonb,
    execution_preferences jsonb,
    template_id uuid,
    funnel_type text,
    core_template_id uuid,
    dynamic_definition_id uuid,
    n8n_workflow_id text,
    funnel_configuration jsonb,
    campaign_name text,
    current_step integer,
    connection_message text,
    alternative_message text,
    follow_up_messages jsonb,
    draft_data jsonb,
    funnel_id uuid,
    target_icp jsonb,
    ab_test_variant text,
    message_templates jsonb,
    created_by uuid,
    send_schedule jsonb,
    next_execution_time timestamp with time zone,
    auto_execute boolean,
    timezone character varying(100),
    working_hours_start integer,
    working_hours_end integer,
    skip_weekends boolean,
    skip_holidays boolean,
    country_code character varying(2),
    flow_settings jsonb,
    metadata jsonb,
    linkedin_account_id uuid,
    n8n_webhook_url text,
    schedule_settings jsonb,
    message_sequence jsonb
);


--
-- Name: competitive_intelligence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitive_intelligence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competitor_name text NOT NULL,
    first_mentioned timestamp with time zone DEFAULT now(),
    last_mentioned timestamp with time zone DEFAULT now(),
    mention_context text,
    positioning_notes text,
    source text,
    status text DEFAULT 'auto_detected'::text,
    embedding public.vector(768),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: conversation_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid,
    workspace_id uuid,
    user_id uuid,
    duration_seconds integer,
    message_count integer DEFAULT 0,
    completion_status text,
    completion_rate numeric(5,2),
    persona_used text,
    thread_type text,
    user_engagement_score numeric(5,2),
    response_quality_score numeric(5,2),
    industry text,
    company_size text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT conversation_analytics_completion_status_check CHECK ((completion_status = ANY (ARRAY['completed'::text, 'abandoned'::text, 'in_progress'::text])))
);


--
-- Name: conversation_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid,
    user_id uuid,
    insights jsonb NOT NULL,
    trigger_type text DEFAULT 'manual'::text,
    status text DEFAULT 'pending_review'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: core_funnel_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_funnel_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid,
    campaign_id uuid,
    n8n_execution_id text,
    n8n_workflow_id text NOT NULL,
    status text DEFAULT 'pending'::text,
    current_step integer DEFAULT 1,
    prospects_total integer NOT NULL,
    prospects_processed integer DEFAULT 0,
    prospects_active integer DEFAULT 0,
    prospects_completed integer DEFAULT 0,
    prospects_failed integer DEFAULT 0,
    messages_sent integer DEFAULT 0,
    responses_received integer DEFAULT 0,
    meetings_booked integer DEFAULT 0,
    unsubscribes integer DEFAULT 0,
    started_at timestamp without time zone,
    last_activity_at timestamp without time zone,
    estimated_completion_at timestamp without time zone,
    completed_at timestamp without time zone,
    execution_variables jsonb,
    timing_overrides jsonb,
    final_stats jsonb,
    performance_summary jsonb,
    error_details jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    workspace_id uuid NOT NULL,
    CONSTRAINT core_funnel_executions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'paused'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: core_funnel_performance_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.core_funnel_performance_view AS
 SELECT t.id AS template_id,
    t.name AS template_name,
    t.funnel_type,
    t.industry,
    t.target_role,
    t.total_executions,
    t.avg_response_rate,
    t.avg_conversion_rate,
    count(e.id) AS active_executions,
    avg(e.prospects_processed) AS avg_prospects_per_execution,
    max(e.updated_at) AS last_execution_date
   FROM (public.core_funnel_templates t
     LEFT JOIN public.core_funnel_executions e ON (((t.id = e.template_id) AND (e.status = 'running'::text))))
  WHERE (t.is_active = true)
  GROUP BY t.id, t.name, t.funnel_type, t.industry, t.target_role, t.total_executions, t.avg_response_rate, t.avg_conversion_rate;


--
-- Name: crm_conflict_resolutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_conflict_resolutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    crm_type text NOT NULL,
    strategy text NOT NULL,
    winner_source text NOT NULL,
    sam_record_id uuid,
    crm_record_id text,
    sam_data jsonb,
    crm_data jsonb,
    resolved_by uuid,
    resolved_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_conflict_resolutions_entity_type_check CHECK ((entity_type = ANY (ARRAY['contact'::text, 'company'::text, 'deal'::text]))),
    CONSTRAINT crm_conflict_resolutions_strategy_check CHECK ((strategy = ANY (ARRAY['sam_wins'::text, 'crm_wins'::text, 'manual'::text, 'newest_wins'::text]))),
    CONSTRAINT crm_conflict_resolutions_winner_source_check CHECK ((winner_source = ANY (ARRAY['sam'::text, 'crm'::text])))
);


--
-- Name: TABLE crm_conflict_resolutions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.crm_conflict_resolutions IS 'Logs conflict resolution decisions when contact updated in both SAM and CRM';


--
-- Name: COLUMN crm_conflict_resolutions.strategy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crm_conflict_resolutions.strategy IS 'Resolution strategy used (e.g., crm_wins, sam_wins, newest_wins)';


--
-- Name: COLUMN crm_conflict_resolutions.winner_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crm_conflict_resolutions.winner_source IS 'Which system won the conflict (sam or crm)';


--
-- Name: crm_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    crm_type text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp with time zone,
    scope text[],
    crm_account_id text,
    crm_account_name text,
    status text DEFAULT 'active'::text NOT NULL,
    error_message text,
    connected_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_connections_crm_type_check CHECK ((crm_type = ANY (ARRAY['hubspot'::text, 'salesforce'::text, 'pipedrive'::text, 'zoho'::text, 'activecampaign'::text, 'keap'::text, 'close'::text, 'copper'::text, 'freshsales'::text, 'airtable'::text]))),
    CONSTRAINT crm_connections_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text, 'error'::text])))
);


--
-- Name: TABLE crm_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.crm_connections IS 'Stores OAuth credentials and connection status for CRM integrations';


--
-- Name: CONSTRAINT crm_connections_crm_type_check ON crm_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT crm_connections_crm_type_check ON public.crm_connections IS 'Valid CRM types including Airtable';


--
-- Name: crm_contact_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_contact_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    crm_type text NOT NULL,
    sam_contact_id uuid NOT NULL,
    crm_contact_id text NOT NULL,
    sam_updated_at timestamp with time zone,
    crm_updated_at timestamp with time zone,
    last_sync_status text,
    last_sync_error text,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_contact_mappings_crm_type_check CHECK ((crm_type = ANY (ARRAY['hubspot'::text, 'salesforce'::text, 'pipedrive'::text, 'zoho'::text, 'activecampaign'::text, 'airtable'::text, 'keap'::text, 'close'::text, 'copper'::text, 'freshsales'::text]))),
    CONSTRAINT crm_contact_mappings_last_sync_status_check CHECK ((last_sync_status = ANY (ARRAY['success'::text, 'failed'::text, 'conflict'::text])))
);


--
-- Name: TABLE crm_contact_mappings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.crm_contact_mappings IS 'Maps SAM contacts to CRM contacts for bi-directional sync';


--
-- Name: COLUMN crm_contact_mappings.sam_updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crm_contact_mappings.sam_updated_at IS 'Last time SAM contact was updated (for conflict detection)';


--
-- Name: COLUMN crm_contact_mappings.crm_updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.crm_contact_mappings.crm_updated_at IS 'Last time CRM contact was updated (for conflict detection)';


--
-- Name: crm_field_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_field_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    crm_type text NOT NULL,
    sam_field text NOT NULL,
    crm_field text NOT NULL,
    field_type text NOT NULL,
    data_type text,
    is_required boolean DEFAULT false,
    is_custom boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_field_mappings_crm_type_check CHECK ((crm_type = ANY (ARRAY['hubspot'::text, 'salesforce'::text, 'pipedrive'::text, 'zoho'::text, 'activecampaign'::text, 'keap'::text, 'close'::text, 'copper'::text, 'freshsales'::text, 'airtable'::text]))),
    CONSTRAINT crm_field_mappings_data_type_check CHECK ((data_type = ANY (ARRAY['string'::text, 'number'::text, 'boolean'::text, 'date'::text, 'array'::text]))),
    CONSTRAINT crm_field_mappings_field_type_check CHECK ((field_type = ANY (ARRAY['contact'::text, 'company'::text, 'deal'::text])))
);


--
-- Name: TABLE crm_field_mappings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.crm_field_mappings IS 'Maps SAM standard fields to CRM-specific field names';


--
-- Name: crm_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_sync_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    sync_type text NOT NULL,
    entity_type text NOT NULL,
    operation text NOT NULL,
    status text NOT NULL,
    records_processed integer DEFAULT 0,
    records_succeeded integer DEFAULT 0,
    records_failed integer DEFAULT 0,
    error_details jsonb,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_sync_logs_entity_type_check CHECK ((entity_type = ANY (ARRAY['contact'::text, 'company'::text, 'deal'::text]))),
    CONSTRAINT crm_sync_logs_operation_check CHECK ((operation = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'sync'::text]))),
    CONSTRAINT crm_sync_logs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'partial'::text, 'failed'::text]))),
    CONSTRAINT crm_sync_logs_sync_type_check CHECK ((sync_type = ANY (ARRAY['manual'::text, 'scheduled'::text, 'webhook'::text, 'campaign'::text])))
);


--
-- Name: TABLE crm_sync_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.crm_sync_logs IS 'Tracks CRM synchronization activities and errors';


--
-- Name: cron_job_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cron_job_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_name text NOT NULL,
    run_at timestamp with time zone DEFAULT now(),
    status text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cron_job_schedule; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.cron_job_schedule AS
 SELECT jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active
   FROM cron.job
  ORDER BY schedule;


--
-- Name: customer_insight_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_insight_patterns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    insight_type text NOT NULL,
    description text NOT NULL,
    frequency_score integer DEFAULT 1,
    business_impact text DEFAULT 'medium'::text,
    last_seen timestamp with time zone DEFAULT now(),
    source_conversations uuid[] DEFAULT '{}'::uuid[],
    embedding public.vector(768),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: data_retention_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_retention_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    policy_name text NOT NULL,
    applies_to text[] DEFAULT ARRAY['prospects'::text, 'campaigns'::text, 'messages'::text],
    default_retention_days integer DEFAULT 730,
    inactive_prospect_retention_days integer DEFAULT 365,
    campaign_data_retention_days integer DEFAULT 1095,
    message_history_retention_days integer DEFAULT 730,
    eu_resident_retention_days integer DEFAULT 365,
    non_eu_retention_days integer DEFAULT 730,
    auto_delete_enabled boolean DEFAULT false,
    notify_before_deletion_days integer DEFAULT 30,
    legal_hold_enabled boolean DEFAULT false,
    legal_hold_reason text,
    legal_hold_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    is_active boolean DEFAULT true
);


--
-- Name: TABLE data_retention_policies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.data_retention_policies IS 'Workspace-specific data retention policies for GDPR compliance';


--
-- Name: deployment_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deployment_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deployment_name text NOT NULL,
    deployment_type text NOT NULL,
    target_workspaces uuid[],
    target_count integer,
    deployment_mode text,
    status text,
    success_count integer DEFAULT 0,
    failure_count integer DEFAULT 0,
    error_message text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_seconds integer,
    deployed_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT deployment_logs_deployment_mode_check CHECK ((deployment_mode = ANY (ARRAY['test'::text, 'production'::text]))),
    CONSTRAINT deployment_logs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'success'::text, 'failed'::text, 'partial'::text])))
);


--
-- Name: document_ai_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_ai_analysis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    document_id uuid,
    analysis_type text NOT NULL,
    model_used text,
    tags text[] DEFAULT '{}'::text[],
    categories text[] DEFAULT '{}'::text[],
    key_insights jsonb DEFAULT '[]'::jsonb,
    summary text,
    relevance_score numeric,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: dpa_sub_processors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dpa_sub_processors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    purpose text NOT NULL,
    location text NOT NULL,
    data_processed text[],
    dpa_url text,
    added_date date DEFAULT CURRENT_DATE,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE dpa_sub_processors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.dpa_sub_processors IS 'List of third-party sub-processors for GDPR transparency';


--
-- Name: dpa_update_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dpa_update_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    notification_type text,
    subject text NOT NULL,
    message text NOT NULL,
    sent_at timestamp without time zone DEFAULT now(),
    acknowledged boolean DEFAULT false,
    acknowledged_at timestamp without time zone,
    acknowledged_by uuid,
    CONSTRAINT dpa_update_notifications_notification_type_check CHECK ((notification_type = ANY (ARRAY['new_sub_processor'::text, 'dpa_version_update'::text, 'policy_change'::text])))
);


--
-- Name: TABLE dpa_update_notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.dpa_update_notifications IS 'Notifications for DPA updates and new sub-processors';


--
-- Name: dpa_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dpa_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version text NOT NULL,
    effective_date date NOT NULL,
    content text NOT NULL,
    is_current boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: TABLE dpa_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.dpa_versions IS 'Version control for Data Processing Agreements';


--
-- Name: dynamic_funnel_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dynamic_funnel_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    funnel_id uuid,
    campaign_id uuid,
    n8n_execution_id text,
    n8n_workflow_id text NOT NULL,
    status text DEFAULT 'pending'::text,
    current_step integer DEFAULT 1,
    total_steps integer NOT NULL,
    prospects_total integer NOT NULL,
    prospects_in_step jsonb DEFAULT '{}'::jsonb,
    prospects_completed integer DEFAULT 0,
    prospects_failed integer DEFAULT 0,
    adaptation_history jsonb DEFAULT '[]'::jsonb,
    adaptation_triggers_fired jsonb DEFAULT '[]'::jsonb,
    current_adaptation_version integer DEFAULT 1,
    step_performance jsonb DEFAULT '{}'::jsonb,
    overall_performance_score numeric(3,2),
    response_patterns jsonb,
    started_at timestamp without time zone,
    last_adaptation_at timestamp without time zone,
    estimated_completion_at timestamp without time zone,
    completed_at timestamp without time zone,
    performance_metrics jsonb,
    learning_insights jsonb,
    error_details jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    workspace_id uuid NOT NULL,
    CONSTRAINT dynamic_funnel_executions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'paused'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: dynamic_funnel_performance_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.dynamic_funnel_performance_view AS
 SELECT d.id AS definition_id,
    d.name AS funnel_name,
    d.campaign_id,
    d.target_persona,
    d.execution_count,
    d.adaptation_count,
    d.avg_performance_score,
    count(e.id) AS active_executions,
    avg(e.overall_performance_score) AS current_avg_performance,
    max(e.updated_at) AS last_execution_date
   FROM (public.dynamic_funnel_definitions d
     LEFT JOIN public.dynamic_funnel_executions e ON (((d.id = e.funnel_id) AND (e.status = 'running'::text))))
  WHERE (d.is_active = true)
  GROUP BY d.id, d.name, d.campaign_id, d.target_persona, d.execution_count, d.adaptation_count, d.avg_performance_score;


--
-- Name: dynamic_funnel_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dynamic_funnel_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    funnel_id uuid,
    step_order integer NOT NULL,
    step_name text NOT NULL,
    step_type text NOT NULL,
    trigger_condition jsonb,
    timing_config jsonb,
    message_template text,
    message_variables jsonb,
    channel_config jsonb,
    success_action jsonb,
    failure_action jsonb,
    adaptation_triggers jsonb,
    execution_count integer DEFAULT 0,
    success_rate numeric(5,2) DEFAULT 0,
    avg_response_time interval,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    workspace_id uuid NOT NULL,
    CONSTRAINT dynamic_funnel_steps_step_type_check CHECK ((step_type = ANY (ARRAY['message'::text, 'wait'::text, 'condition'::text, 'webhook'::text, 'adaptation_point'::text])))
);


--
-- Name: email_campaign_prospects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_campaign_prospects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    workspace_id uuid,
    email text NOT NULL,
    first_name text,
    last_name text,
    company_name text,
    title text,
    reachinbox_campaign_id text,
    reachinbox_lead_id text,
    emails_sent integer DEFAULT 0,
    emails_opened integer DEFAULT 0,
    emails_clicked integer DEFAULT 0,
    emails_replied integer DEFAULT 0,
    emails_bounced boolean DEFAULT false,
    first_sent_at timestamp with time zone,
    last_sent_at timestamp with time zone,
    first_opened_at timestamp with time zone,
    last_opened_at timestamp with time zone,
    first_clicked_at timestamp with time zone,
    replied_at timestamp with time zone,
    bounced_at timestamp with time zone,
    reply_sentiment text,
    meeting_booked boolean DEFAULT false,
    meeting_booked_at timestamp with time zone,
    trial_signup boolean DEFAULT false,
    trial_signup_at timestamp with time zone,
    converted_to_mrr boolean DEFAULT false,
    mrr_converted_at timestamp with time zone,
    mrr_value numeric(10,2),
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT email_campaign_prospects_reply_sentiment_check CHECK ((reply_sentiment = ANY (ARRAY['positive'::text, 'negative'::text, 'neutral'::text])))
);


--
-- Name: email_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider_type character varying(50) NOT NULL,
    provider_name character varying(255) NOT NULL,
    email_address character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'disconnected'::character varying NOT NULL,
    config jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: email_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_responses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid,
    campaign_id uuid,
    prospect_id uuid,
    from_email text NOT NULL,
    from_name text,
    to_email text NOT NULL,
    subject text,
    message_id text,
    text_body text,
    html_body text,
    stripped_text text,
    has_attachments boolean DEFAULT false,
    attachments jsonb,
    received_at timestamp with time zone NOT NULL,
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    sentiment text,
    intent text,
    requires_response boolean DEFAULT true,
    ai_summary text,
    ai_suggested_response text,
    raw_email jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE email_responses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_responses IS 'Stores inbound email replies from prospects to campaigns';


--
-- Name: COLUMN email_responses.message_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_responses.message_id IS 'Postmark MessageID for deduplication';


--
-- Name: COLUMN email_responses.stripped_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_responses.stripped_text IS 'Email body with signatures and quoted text removed';


--
-- Name: COLUMN email_responses.sentiment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_responses.sentiment IS 'AI-detected sentiment: positive, negative, neutral, interested';


--
-- Name: COLUMN email_responses.intent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_responses.intent IS 'AI-detected intent: meeting_request, question, objection, unsubscribe, etc.';


--
-- Name: email_send_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_send_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    prospect_id uuid NOT NULL,
    email_account_id text NOT NULL,
    recipient_email text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    from_name text,
    scheduled_for timestamp without time zone NOT NULL,
    sent_at timestamp without time zone,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    error_message text,
    message_id text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    variant character varying(10)
);


--
-- Name: enrichment_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid,
    prospect_ids text[] NOT NULL,
    total_prospects integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    processed_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    current_prospect_id text,
    current_prospect_url text,
    error_message text,
    enrichment_results jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT enrichment_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: TABLE enrichment_jobs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.enrichment_jobs IS 'Queue for async prospect enrichment jobs to avoid serverless function timeouts';


--
-- Name: COLUMN enrichment_jobs.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.enrichment_jobs.status IS 'pending: waiting to start, processing: currently running, completed: finished successfully, failed: error occurred, cancelled: user cancelled';


--
-- Name: COLUMN enrichment_jobs.enrichment_results; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.enrichment_jobs.enrichment_results IS 'Array of enriched prospect data with verification status';


--
-- Name: follow_up_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follow_up_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    message text NOT NULL,
    subject text,
    channel character varying(20) NOT NULL,
    tone character varying(30) NOT NULL,
    touch_number integer NOT NULL,
    scenario character varying(50) NOT NULL,
    confidence_score numeric(3,2),
    reasoning text,
    status character varying(30) DEFAULT 'pending_approval'::character varying NOT NULL,
    scheduled_for timestamp with time zone,
    sent_at timestamp with time zone,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejected_reason text,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT follow_up_drafts_channel_check CHECK (((channel)::text = ANY ((ARRAY['linkedin'::character varying, 'email'::character varying, 'inmail'::character varying])::text[]))),
    CONSTRAINT follow_up_drafts_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
    CONSTRAINT follow_up_drafts_scenario_check CHECK (((scenario)::text = ANY ((ARRAY['no_reply_to_cr'::character varying, 'replied_then_silent'::character varying, 'no_show_to_call'::character varying, 'post_demo_silence'::character varying, 'check_back_later'::character varying, 'trial_no_activity'::character varying, 'standard'::character varying])::text[]))),
    CONSTRAINT follow_up_drafts_status_check CHECK (((status)::text = ANY ((ARRAY['pending_generation'::character varying, 'pending_approval'::character varying, 'approved'::character varying, 'rejected'::character varying, 'sent'::character varying, 'failed'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT follow_up_drafts_tone_check CHECK (((tone)::text = ANY ((ARRAY['light_bump'::character varying, 'value_add'::character varying, 'different_angle'::character varying, 'breakup'::character varying])::text[]))),
    CONSTRAINT follow_up_drafts_touch_number_check CHECK (((touch_number >= 1) AND (touch_number <= 6)))
);


--
-- Name: TABLE follow_up_drafts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.follow_up_drafts IS 'Stores AI-generated follow-up messages pending human approval (HITL)';


--
-- Name: COLUMN follow_up_drafts.tone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.follow_up_drafts.tone IS 'The message tone: light_bump (touch 1), value_add (touch 2), different_angle (touch 3), or breakup (touch 4)';


--
-- Name: COLUMN follow_up_drafts.scenario; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.follow_up_drafts.scenario IS 'The follow-up scenario: no_reply_to_cr, replied_then_silent, no_show_to_call, post_demo_silence, check_back_later, trial_no_activity, or standard';


--
-- Name: COLUMN follow_up_drafts.confidence_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.follow_up_drafts.confidence_score IS 'AI confidence in the generated message (0.0 to 1.0)';


--
-- Name: funnel_adaptation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funnel_adaptation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    definition_id uuid,
    execution_id text,
    event_type text NOT NULL,
    trigger_reason text NOT NULL,
    step_order integer,
    original_config jsonb,
    adapted_config jsonb,
    adaptation_reasoning text,
    before_performance jsonb,
    after_performance jsonb,
    adaptation_effectiveness numeric(3,2),
    ai_model_used text,
    confidence_score numeric(3,2),
    "timestamp" timestamp without time zone DEFAULT now(),
    workspace_id uuid NOT NULL,
    CONSTRAINT funnel_adaptation_logs_event_type_check CHECK ((event_type = ANY (ARRAY['adaptation_triggered'::text, 'adaptation_applied'::text, 'step_failure'::text, 'response_pattern_detected'::text])))
);


--
-- Name: funnel_step_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funnel_step_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id text NOT NULL,
    funnel_type text NOT NULL,
    prospect_id uuid,
    step_identifier text NOT NULL,
    step_type text NOT NULL,
    result text NOT NULL,
    execution_time_ms integer,
    input_data jsonb,
    output_data jsonb,
    error_details jsonb,
    n8n_node_id text,
    "timestamp" timestamp without time zone DEFAULT now(),
    workspace_id uuid NOT NULL,
    CONSTRAINT funnel_step_logs_funnel_type_check CHECK ((funnel_type = ANY (ARRAY['core'::text, 'dynamic'::text]))),
    CONSTRAINT funnel_step_logs_result_check CHECK ((result = ANY (ARRAY['success'::text, 'failure'::text, 'pending'::text, 'skipped'::text])))
);


--
-- Name: gdpr_deletion_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gdpr_deletion_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    prospect_id uuid,
    email_address text,
    linkedin_profile_url text,
    full_name text,
    request_type text NOT NULL,
    request_source text NOT NULL,
    status text DEFAULT 'pending'::text,
    verification_method text,
    verification_completed_at timestamp with time zone,
    verified_by uuid,
    scheduled_execution_date timestamp with time zone,
    executed_at timestamp with time zone,
    executed_by uuid,
    deletion_scope jsonb,
    backup_reference text,
    notes text,
    rejection_reason text,
    requested_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    request_metadata jsonb,
    CONSTRAINT gdpr_deletion_requests_request_source_check CHECK ((request_source = ANY (ARRAY['prospect_request'::text, 'workspace_admin'::text, 'system_automated'::text, 'compliance_audit'::text]))),
    CONSTRAINT gdpr_deletion_requests_request_type_check CHECK ((request_type = ANY (ARRAY['right_to_be_forgotten'::text, 'right_to_erasure'::text, 'data_export'::text, 'data_correction'::text, 'processing_restriction'::text]))),
    CONSTRAINT gdpr_deletion_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'approved'::text, 'rejected'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: TABLE gdpr_deletion_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.gdpr_deletion_requests IS 'GDPR data subject deletion requests (Right to be Forgotten)';


--
-- Name: hitl_reply_approval_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hitl_reply_approval_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_execution_id uuid,
    original_message_id text NOT NULL,
    original_message_content text NOT NULL,
    original_message_channel text NOT NULL,
    prospect_name text,
    prospect_email text,
    prospect_linkedin_url text,
    prospect_company text,
    sam_suggested_reply text NOT NULL,
    sam_confidence_score numeric(3,2),
    sam_reasoning text,
    approval_status text DEFAULT 'pending'::text NOT NULL,
    assigned_to_email text NOT NULL,
    assigned_to text,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    final_message text,
    rejection_reason text,
    approval_email_sent_at timestamp with time zone,
    approval_email_opened_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    timeout_hours integer DEFAULT 24,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT hitl_reply_approval_sessions_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text]))),
    CONSTRAINT hitl_reply_approval_sessions_original_message_channel_check CHECK ((original_message_channel = ANY (ARRAY['email'::text, 'linkedin'::text]))),
    CONSTRAINT hitl_reply_approval_sessions_sam_confidence_score_check CHECK (((sam_confidence_score >= (0)::numeric) AND (sam_confidence_score <= (1)::numeric)))
);


--
-- Name: icp_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icp_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    market_niche text NOT NULL,
    industry_vertical text NOT NULL,
    status text DEFAULT 'active'::text,
    priority text DEFAULT 'secondary'::text,
    target_profile jsonb DEFAULT '{}'::jsonb NOT NULL,
    decision_makers jsonb DEFAULT '{}'::jsonb NOT NULL,
    pain_points jsonb DEFAULT '{}'::jsonb NOT NULL,
    buying_process jsonb DEFAULT '{}'::jsonb NOT NULL,
    messaging_strategy jsonb DEFAULT '{}'::jsonb NOT NULL,
    success_metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    advanced_classification jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT icp_configurations_priority_check CHECK ((priority = ANY (ARRAY['primary'::text, 'secondary'::text, 'experimental'::text]))),
    CONSTRAINT icp_configurations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'testing'::text, 'archived'::text, 'draft'::text])))
);

ALTER TABLE ONLY public.icp_configurations FORCE ROW LEVEL SECURITY;


--
-- Name: inbox_message_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbox_message_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    name character varying(100) NOT NULL,
    slug character varying(50) NOT NULL,
    description text,
    color character varying(7) DEFAULT '#6b7280'::character varying,
    icon character varying(50),
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    suggested_action character varying(50),
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT inbox_message_categories_suggested_action_check CHECK (((suggested_action)::text = ANY ((ARRAY['reply'::character varying, 'archive'::character varying, 'escalate'::character varying, 'ignore'::character varying, 'follow_up'::character varying])::text[])))
);


--
-- Name: inbox_message_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbox_message_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    message_id text NOT NULL,
    message_source character varying(20) NOT NULL,
    category_id uuid,
    detected_intent character varying(50),
    confidence_score numeric(3,2),
    ai_reasoning text,
    ai_model character varying(100),
    is_manual_override boolean DEFAULT false,
    overridden_by uuid,
    overridden_at timestamp with time zone,
    suggested_response text,
    response_used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT inbox_message_tags_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
    CONSTRAINT inbox_message_tags_message_source_check CHECK (((message_source)::text = ANY ((ARRAY['linkedin'::character varying, 'email'::character varying, 'gmail'::character varying, 'outlook'::character varying])::text[])))
);


--
-- Name: kb_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kb_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text,
    data jsonb,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: knowledge_base; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    category text NOT NULL,
    subcategory text,
    title text NOT NULL,
    content text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    version text DEFAULT '1.0'::text,
    is_active boolean DEFAULT true,
    source_attachment_id uuid,
    source_type text,
    source_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    icp_id uuid,
    CONSTRAINT knowledge_base_source_type_check CHECK ((source_type = ANY (ARRAY['manual'::text, 'document_upload'::text, 'sam_discovery'::text, 'api_import'::text])))
);


--
-- Name: COLUMN knowledge_base.source_attachment_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.knowledge_base.source_attachment_id IS 'Reference to the uploaded document that generated this knowledge entry. NULL for manually created entries.';


--
-- Name: COLUMN knowledge_base.source_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.knowledge_base.source_type IS 'Origin of the knowledge entry: manual (user created), document_upload (extracted from uploaded document), sam_discovery (from SAM conversation), api_import (imported via API)';


--
-- Name: COLUMN knowledge_base.icp_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.knowledge_base.icp_id IS 'NULL = global content for all ICPs, UUID = content specific to that ICP';


--
-- Name: knowledge_base_competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    website text,
    market_share text,
    market_position text,
    strengths jsonb DEFAULT '[]'::jsonb,
    weaknesses jsonb DEFAULT '[]'::jsonb,
    opportunities jsonb DEFAULT '[]'::jsonb,
    threats jsonb DEFAULT '[]'::jsonb,
    pricing_info jsonb,
    product_comparison jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.knowledge_base_competitors FORCE ROW LEVEL SECURITY;


--
-- Name: knowledge_base_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    section_id text NOT NULL,
    content_type text NOT NULL,
    title text,
    content jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.knowledge_base_content FORCE ROW LEVEL SECURITY;


--
-- Name: knowledge_base_document_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_document_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    document_id uuid NOT NULL,
    thread_id uuid,
    message_id uuid,
    user_id uuid,
    chunks_used integer DEFAULT 0,
    relevance_score numeric,
    query_context text,
    metadata jsonb DEFAULT '{}'::jsonb,
    used_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.knowledge_base_document_usage FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE knowledge_base_document_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.knowledge_base_document_usage IS 'Tracks every time SAM uses a document in a conversation';


--
-- Name: knowledge_base_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    section_id text NOT NULL,
    filename text NOT NULL,
    original_filename text NOT NULL,
    file_type text,
    file_size integer,
    storage_path text,
    extracted_content text,
    metadata jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT '{}'::text[],
    categories text[] DEFAULT '{}'::text[],
    content_type text,
    key_insights jsonb DEFAULT '[]'::jsonb,
    summary text,
    relevance_score numeric,
    suggested_section text,
    ai_metadata jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'uploaded'::text,
    processed_at timestamp with time zone,
    vector_chunks integer DEFAULT 0,
    vectorized_at timestamp with time zone,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    section text,
    usage_count integer DEFAULT 0,
    last_used_at timestamp with time zone,
    last_used_in_thread_id uuid,
    first_used_at timestamp with time zone,
    icp_id uuid
);

ALTER TABLE ONLY public.knowledge_base_documents FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN knowledge_base_documents.icp_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.knowledge_base_documents.icp_id IS 'NULL = global document for all ICPs, UUID = document specific to that ICP';


--
-- Name: knowledge_base_icps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_icps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    industry text,
    company_size text,
    revenue_range text,
    geography text[],
    pain_points jsonb DEFAULT '[]'::jsonb,
    buying_process jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.knowledge_base_icps FORCE ROW LEVEL SECURITY;


--
-- Name: knowledge_base_personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_personas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    avatar_url text,
    job_title text,
    seniority_level text,
    department text,
    age_range text,
    location text,
    goals jsonb DEFAULT '[]'::jsonb,
    challenges jsonb DEFAULT '[]'::jsonb,
    motivations jsonb DEFAULT '[]'::jsonb,
    frustrations jsonb DEFAULT '[]'::jsonb,
    decision_criteria jsonb DEFAULT '[]'::jsonb,
    preferred_channels jsonb DEFAULT '[]'::jsonb,
    content_preferences jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.knowledge_base_personas FORCE ROW LEVEL SECURITY;


--
-- Name: knowledge_base_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    sku text,
    category text,
    price numeric,
    currency text DEFAULT 'USD'::text,
    pricing_model text,
    features jsonb DEFAULT '[]'::jsonb,
    benefits jsonb DEFAULT '[]'::jsonb,
    use_cases jsonb DEFAULT '[]'::jsonb,
    specifications jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.knowledge_base_products FORCE ROW LEVEL SECURITY;


--
-- Name: knowledge_base_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    section_id text NOT NULL,
    title text NOT NULL,
    description text,
    icon text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.knowledge_base_sections FORCE ROW LEVEL SECURITY;


--
-- Name: knowledge_base_vectors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_vectors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    document_id uuid,
    section_id text NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    embedding public.vector(768) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    icp_id uuid
);


--
-- Name: COLUMN knowledge_base_vectors.embedding; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.knowledge_base_vectors.embedding IS 'Embeddings using text-embedding-3-large @ 1536 dimensions for quality-first RAG';


--
-- Name: COLUMN knowledge_base_vectors.icp_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.knowledge_base_vectors.icp_id IS 'NULL = global vector for all ICPs, UUID = vector specific to that ICP';


--
-- Name: knowledge_gap_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_gap_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    missing_info text NOT NULL,
    impact_level text DEFAULT 'medium'::text,
    suggested_section text,
    source_conversation uuid,
    insight_id uuid,
    status text DEFAULT 'open'::text,
    embedding public.vector(768),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: link_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tracked_link_id uuid NOT NULL,
    clicked_at timestamp with time zone DEFAULT now(),
    ip_address inet,
    user_agent text,
    referrer text,
    country text,
    city text,
    is_first_click boolean DEFAULT false
);


--
-- Name: TABLE link_clicks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.link_clicks IS 'Click events on tracked links - triggers agent follow-ups';


--
-- Name: linkedin_post_monitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_post_monitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    hashtags text[] NOT NULL,
    keywords text[],
    n8n_workflow_id character varying(255),
    n8n_webhook_url text,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    timezone character varying(100) DEFAULT 'America/New_York'::character varying,
    daily_start_time time without time zone DEFAULT '09:00:00'::time without time zone,
    auto_approve_enabled boolean DEFAULT false,
    auto_approve_start_time time without time zone DEFAULT '09:00:00'::time without time zone,
    auto_approve_end_time time without time zone DEFAULT '17:00:00'::time without time zone,
    profile_vanities text[],
    profile_provider_ids text[],
    name text,
    metadata jsonb DEFAULT '{}'::jsonb,
    last_scraped_at timestamp without time zone,
    scrapes_today integer DEFAULT 0,
    scrape_count_reset_date date DEFAULT CURRENT_DATE
);


--
-- Name: COLUMN linkedin_post_monitors.timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_monitors.timezone IS 'IANA 
  timezone identifier (e.g., America/New_York, 
  Europe/London)';


--
-- Name: COLUMN linkedin_post_monitors.daily_start_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_monitors.daily_start_time IS 'Time when daily commenting should begin (local
   to timezone)';


--
-- Name: COLUMN linkedin_post_monitors.auto_approve_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_monitors.auto_approve_enabled IS 'Whether to auto-approve comments generated 
  during the approval window';


--
-- Name: COLUMN linkedin_post_monitors.auto_approve_start_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_monitors.auto_approve_start_time IS 'Start of auto-approval window (local to 
  timezone)';


--
-- Name: COLUMN linkedin_post_monitors.auto_approve_end_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_monitors.auto_approve_end_time IS 'End of auto-approval window (local to 
  timezone)';


--
-- Name: COLUMN linkedin_post_monitors.last_scraped_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_monitors.last_scraped_at IS 'Timestamp of last successful scrape';


--
-- Name: COLUMN linkedin_post_monitors.scrapes_today; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_monitors.scrapes_today IS 'Number of scrapes performed today';


--
-- Name: COLUMN linkedin_post_monitors.scrape_count_reset_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_monitors.scrape_count_reset_date IS 'Date when scrapes_today was last reset';


--
-- Name: linkedin_active_monitors; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.linkedin_active_monitors AS
 SELECT id,
    workspace_id,
    hashtags,
    keywords,
    status,
    n8n_workflow_id,
    created_by,
    created_at
   FROM public.linkedin_post_monitors
  WHERE ((status)::text = 'active'::text)
  ORDER BY created_at DESC;


--
-- Name: linkedin_author_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_author_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    author_profile_id text NOT NULL,
    author_name text,
    author_headline text,
    author_company text,
    total_comments_made integer DEFAULT 0,
    total_replies_received integer DEFAULT 0,
    total_likes_received integer DEFAULT 0,
    author_responded_count integer DEFAULT 0,
    avg_performance_score numeric(5,2),
    best_performing_topic text,
    first_interaction_at timestamp with time zone,
    last_interaction_at timestamp with time zone,
    last_comment_at timestamp with time zone,
    relationship_strength text DEFAULT 'new'::text,
    topics_discussed jsonb DEFAULT '[]'::jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT linkedin_author_relationships_relationship_strength_check CHECK ((relationship_strength = ANY (ARRAY['new'::text, 'engaged'::text, 'responsive'::text, 'advocate'::text])))
);


--
-- Name: TABLE linkedin_author_relationships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.linkedin_author_relationships IS 'Tracks interaction history with LinkedIn authors for relationship building';


--
-- Name: linkedin_brand_guidelines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_brand_guidelines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    tone_of_voice text NOT NULL,
    writing_style text,
    topics_and_perspective text,
    dos_and_donts text,
    comment_framework text DEFAULT 'ACA+I: 
  Acknowledge, Add nuance, drop an I-statement, 
  ask a warm question'::text,
    max_characters integer DEFAULT 300,
    system_prompt text DEFAULT 'You are an AI 
  agent replying as a real person to LinkedIn 
  posts. Write replies that sound like a sharp, 
  trusted friend—confident, human, and curious. 
  Professional but warm.'::text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    perspective_style character varying(50) DEFAULT 'additive'::character varying,
    confidence_level character varying(50) DEFAULT 'balanced'::character varying,
    tone character varying(50) DEFAULT 'professional'::character varying,
    formality character varying(50) DEFAULT 'semi-formal'::character varying,
    comment_length character varying(50) DEFAULT 'medium'::character varying,
    question_frequency character varying(50) DEFAULT 'sometimes'::character varying,
    use_workspace_knowledge boolean DEFAULT false,
    what_you_do text,
    what_youve_learned text,
    pov_on_future text,
    industry_talking_points text,
    voice_reference text,
    okay_funny boolean DEFAULT true,
    okay_blunt boolean DEFAULT true,
    casual_openers boolean DEFAULT true,
    personal_experience boolean DEFAULT true,
    strictly_professional boolean DEFAULT false,
    framework_preset character varying(50) DEFAULT 'aca_i'::character varying,
    custom_framework text,
    example_comments text[],
    admired_comments text[],
    default_relationship_tag character varying(50) DEFAULT 'unknown'::character varying,
    comment_scope character varying(50) DEFAULT 'my_expertise'::character varying,
    auto_skip_generic boolean DEFAULT false,
    post_age_awareness boolean DEFAULT true,
    recent_comment_memory boolean DEFAULT true,
    competitors_never_mention text[],
    end_with_cta character varying(50) DEFAULT 'never'::character varying,
    cta_style character varying(50) DEFAULT 'question_only'::character varying,
    timezone character varying(100) DEFAULT 'America/New_York'::character varying,
    posting_start_time time without time zone DEFAULT '09:00:00'::time without time zone,
    posting_end_time time without time zone DEFAULT '17:00:00'::time without time zone,
    post_on_weekends boolean DEFAULT false,
    post_on_holidays boolean DEFAULT false,
    daily_comment_limit integer DEFAULT 30,
    min_days_between_profile_comments integer DEFAULT 1,
    max_days_between_profile_comments integer DEFAULT 7,
    tag_post_authors boolean DEFAULT true,
    blacklisted_profiles text[],
    monitor_comments boolean DEFAULT false,
    reply_to_high_engagement boolean DEFAULT false,
    auto_approve_enabled boolean DEFAULT false,
    auto_approve_start_time time without time zone DEFAULT '09:00:00'::time without time zone,
    auto_approve_end_time time without time zone DEFAULT '17:00:00'::time without time zone,
    profile_scrape_interval_days integer DEFAULT 1,
    max_profile_scrapes_per_day integer DEFAULT 20,
    voice_enabled boolean DEFAULT false,
    voice_gender character varying(10) DEFAULT 'female'::character varying,
    elevenlabs_voice_id text,
    voice_sample_url text,
    voice_clone_status character varying(20) DEFAULT 'none'::character varying,
    auto_repost_enabled boolean DEFAULT false,
    repost_min_likes integer DEFAULT 100,
    repost_min_comments integer DEFAULT 20,
    reposts_per_day integer DEFAULT 1,
    country_code character varying(5) DEFAULT 'US'::character varying,
    block_job_posts boolean DEFAULT true,
    block_event_posts boolean DEFAULT false,
    block_promotional_posts boolean DEFAULT false,
    block_repost_only boolean DEFAULT false,
    block_generic_motivation boolean DEFAULT false,
    block_self_promotion boolean DEFAULT false,
    custom_blocked_keywords text[],
    apify_calls_today integer DEFAULT 0,
    apify_calls_reset_date date DEFAULT CURRENT_DATE,
    digest_email text,
    digest_enabled boolean DEFAULT true,
    digest_time time without time zone DEFAULT '08:00:00'::time without time zone,
    digest_timezone text DEFAULT 'America/Los_Angeles'::text,
    last_digest_sent_at timestamp with time zone,
    target_countries text[],
    priority_profiles jsonb DEFAULT '[]'::jsonb,
    opportunity_digest_enabled boolean DEFAULT false,
    opportunity_digest_time character varying(10) DEFAULT '07:00'::character varying,
    CONSTRAINT check_comment_cadence CHECK ((min_days_between_profile_comments <= max_days_between_profile_comments)),
    CONSTRAINT check_daily_comment_limit CHECK (((daily_comment_limit >= 1) AND (daily_comment_limit <= 30))),
    CONSTRAINT check_max_profile_scrapes CHECK (((max_profile_scrapes_per_day >= 1) AND (max_profile_scrapes_per_day <= 20))),
    CONSTRAINT check_profile_scrape_interval CHECK (((profile_scrape_interval_days >= 1) AND (profile_scrape_interval_days <= 30))),
    CONSTRAINT check_voice_clone_status CHECK (((voice_clone_status)::text = ANY ((ARRAY['none'::character varying, 'pending'::character varying, 'processing'::character varying, 'ready'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT check_voice_gender CHECK (((voice_gender)::text = ANY ((ARRAY['male'::character varying, 'female'::character varying])::text[]))),
    CONSTRAINT valid_comment_length CHECK (((comment_length)::text = ANY ((ARRAY['short'::character varying, 'medium'::character varying, 'long'::character varying])::text[]))),
    CONSTRAINT valid_comment_scope CHECK (((comment_scope)::text = ANY ((ARRAY['my_expertise'::character varying, 'expertise_adjacent'::character varying, 'anything_relevant'::character varying])::text[]))),
    CONSTRAINT valid_confidence_level CHECK (((confidence_level)::text = ANY ((ARRAY['assertive'::character varying, 'balanced'::character varying, 'humble'::character varying])::text[]))),
    CONSTRAINT valid_cta_frequency CHECK (((end_with_cta)::text = ANY ((ARRAY['never'::character varying, 'occasionally'::character varying, 'when_relevant'::character varying])::text[]))),
    CONSTRAINT valid_cta_style CHECK (((cta_style)::text = ANY ((ARRAY['question_only'::character varying, 'soft_invitation'::character varying, 'direct_ask'::character varying])::text[]))),
    CONSTRAINT valid_formality CHECK (((formality)::text = ANY ((ARRAY['formal'::character varying, 'semi_formal'::character varying, 'informal'::character varying])::text[]))),
    CONSTRAINT valid_framework_preset CHECK (((framework_preset)::text = ANY ((ARRAY['aca_i'::character varying, 'var'::character varying, 'hook_value_bridge'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT valid_perspective_style CHECK (((perspective_style)::text = ANY ((ARRAY['supportive'::character varying, 'additive'::character varying, 'thought_provoking'::character varying])::text[]))),
    CONSTRAINT valid_question_frequency CHECK (((question_frequency)::text = ANY ((ARRAY['frequently'::character varying, 'sometimes'::character varying, 'rarely'::character varying, 'never'::character varying])::text[]))),
    CONSTRAINT valid_relationship_tag CHECK (((default_relationship_tag)::text = ANY ((ARRAY['prospect'::character varying, 'client'::character varying, 'peer'::character varying, 'thought_leader'::character varying, 'unknown'::character varying])::text[]))),
    CONSTRAINT valid_tone CHECK (((tone)::text = ANY ((ARRAY['professional'::character varying, 'friendly'::character varying, 'casual'::character varying, 'passionate'::character varying])::text[])))
);


--
-- Name: TABLE linkedin_brand_guidelines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.linkedin_brand_guidelines IS 'Comprehensive LinkedIn commenting settings per workspace. Includes quick settings, expertise, brand voice, vibe check, frameworks, examples, context, and guardrails.';


--
-- Name: COLUMN linkedin_brand_guidelines.daily_comment_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.daily_comment_limit IS 'Maximum comments per day (hard limit: 1-30)';


--
-- Name: COLUMN linkedin_brand_guidelines.min_days_between_profile_comments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.min_days_between_profile_comments IS 'Minimum days to wait before commenting on the same profile again';


--
-- Name: COLUMN linkedin_brand_guidelines.max_days_between_profile_comments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.max_days_between_profile_comments IS 'Maximum days to wait before commenting on the same profile again';


--
-- Name: COLUMN linkedin_brand_guidelines.tag_post_authors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.tag_post_authors IS 'Whether to mention post authors with @username in comments';


--
-- Name: COLUMN linkedin_brand_guidelines.blacklisted_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.blacklisted_profiles IS 'Array of LinkedIn profiles to never engage with';


--
-- Name: COLUMN linkedin_brand_guidelines.monitor_comments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.monitor_comments IS 'Track comments on posts to find reply opportunities';


--
-- Name: COLUMN linkedin_brand_guidelines.reply_to_high_engagement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.reply_to_high_engagement IS 'Generate replies to high-engagement comments on posts';


--
-- Name: COLUMN linkedin_brand_guidelines.auto_approve_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.auto_approve_enabled IS 'Automatically approve and post comments without review';


--
-- Name: COLUMN linkedin_brand_guidelines.auto_approve_start_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.auto_approve_start_time IS 'Start time for auto-approval window';


--
-- Name: COLUMN linkedin_brand_guidelines.auto_approve_end_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.auto_approve_end_time IS 'End time for auto-approval window';


--
-- Name: COLUMN linkedin_brand_guidelines.profile_scrape_interval_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.profile_scrape_interval_days IS 'Days to wait before scraping same profile again (1-30)';


--
-- Name: COLUMN linkedin_brand_guidelines.max_profile_scrapes_per_day; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.max_profile_scrapes_per_day IS 'Maximum number of profile scrapes per day (1-20)';


--
-- Name: COLUMN linkedin_brand_guidelines.voice_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.voice_enabled IS 'Whether voice drops are enabled for this workspace';


--
-- Name: COLUMN linkedin_brand_guidelines.voice_gender; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.voice_gender IS 'Default voice gender for 11Labs TTS (male/female)';


--
-- Name: COLUMN linkedin_brand_guidelines.elevenlabs_voice_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.elevenlabs_voice_id IS '11Labs voice ID for custom voice selection';


--
-- Name: COLUMN linkedin_brand_guidelines.voice_sample_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.voice_sample_url IS 'URL to uploaded voice sample for 11Labs cloning';


--
-- Name: COLUMN linkedin_brand_guidelines.voice_clone_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.voice_clone_status IS 'Status of voice cloning: none, pending, processing, ready, failed';


--
-- Name: COLUMN linkedin_brand_guidelines.block_job_posts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.block_job_posts IS 'Filter out hiring announcements and job listings';


--
-- Name: COLUMN linkedin_brand_guidelines.block_event_posts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.block_event_posts IS 'Filter out webinar invites and event promotions';


--
-- Name: COLUMN linkedin_brand_guidelines.block_promotional_posts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.block_promotional_posts IS 'Filter out product launches and sales pitches';


--
-- Name: COLUMN linkedin_brand_guidelines.block_repost_only; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.block_repost_only IS 'Filter out reposts without original commentary';


--
-- Name: COLUMN linkedin_brand_guidelines.block_generic_motivation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.block_generic_motivation IS 'Filter out generic motivational posts';


--
-- Name: COLUMN linkedin_brand_guidelines.block_self_promotion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.block_self_promotion IS 'Filter out self-promotional achievement posts';


--
-- Name: COLUMN linkedin_brand_guidelines.custom_blocked_keywords; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_brand_guidelines.custom_blocked_keywords IS 'Custom keywords/phrases to block';


--
-- Name: linkedin_comment_performance_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_comment_performance_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_comments integer DEFAULT 0,
    total_posted integer DEFAULT 0,
    total_with_engagement integer DEFAULT 0,
    total_reactions integer DEFAULT 0,
    total_replies integer DEFAULT 0,
    author_response_rate numeric(5,2),
    performance_by_type jsonb DEFAULT '{}'::jsonb,
    performance_by_length jsonb DEFAULT '{}'::jsonb,
    top_openers jsonb DEFAULT '[]'::jsonb,
    top_topics jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE linkedin_comment_performance_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.linkedin_comment_performance_stats IS 'Aggregated performance metrics to learn what comment styles work best';


--
-- Name: linkedin_comment_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_comment_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    post_id uuid,
    post_social_id character varying(255) NOT NULL,
    comment_text text NOT NULL,
    comment_length integer,
    requires_approval boolean DEFAULT true,
    approval_status character varying(50),
    approved_by uuid,
    approved_at timestamp without time zone,
    generated_by character varying(50) DEFAULT 'claude'::character varying,
    generation_model character varying(100),
    confidence_score double precision,
    status character varying(50) DEFAULT 'pending'::character varying,
    posted_at timestamp without time zone,
    error_message text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT valid_approval CHECK (((approval_status IS NULL) OR ((approval_status)::text = ANY ((ARRAY['approved'::character varying, 'rejected'::character varying])::text[])))),
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'posted'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: linkedin_comment_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_comment_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    post_id uuid NOT NULL,
    original_comment_id text NOT NULL,
    original_comment_text text,
    original_comment_author_name text,
    original_comment_author_profile_id text,
    reply_text text NOT NULL,
    replied_at timestamp with time zone DEFAULT now(),
    replied_by uuid,
    unipile_response jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: linkedin_comments_posted; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_comments_posted (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    post_id uuid,
    queue_id uuid,
    comment_id character varying(255) NOT NULL,
    post_social_id character varying(255) NOT NULL,
    comment_text text NOT NULL,
    engagement_metrics jsonb,
    replies_count integer DEFAULT 0,
    user_replied boolean DEFAULT false,
    last_reply_at timestamp without time zone,
    posted_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: linkedin_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid,
    prospect_id uuid,
    linkedin_account_id uuid,
    direction character varying(20) NOT NULL,
    message_type character varying(50) DEFAULT 'message'::character varying NOT NULL,
    subject text,
    content text NOT NULL,
    unipile_message_id character varying(255),
    unipile_chat_id character varying(255),
    linkedin_conversation_id character varying(255),
    sender_linkedin_url text,
    sender_name text,
    sender_linkedin_id character varying(255),
    recipient_linkedin_url text,
    recipient_name text,
    recipient_linkedin_id character varying(255),
    status character varying(50) DEFAULT 'sent'::character varying,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    error_message text,
    retry_count integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT linkedin_messages_direction_check CHECK (((direction)::text = ANY ((ARRAY['outgoing'::character varying, 'incoming'::character varying])::text[])))
);


--
-- Name: TABLE linkedin_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.linkedin_messages IS 'Stores all LinkedIn messages (outgoing connection requests, messages, and incoming replies)';


--
-- Name: COLUMN linkedin_messages.direction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_messages.direction IS 'outgoing = sent by us, incoming = received from prospect';


--
-- Name: COLUMN linkedin_messages.message_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_messages.message_type IS 'connection_request, message, follow_up, inmail';


--
-- Name: COLUMN linkedin_messages.unipile_chat_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_messages.unipile_chat_id IS 'Unipile conversation ID for grouping messages';


--
-- Name: linkedin_post_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_post_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    monitor_id uuid,
    post_id uuid NOT NULL,
    comment_text text NOT NULL,
    edited_comment_text text,
    status character varying(50) DEFAULT 'pending_approval'::character varying NOT NULL,
    generated_at timestamp without time zone DEFAULT now() NOT NULL,
    approved_at timestamp without time zone,
    rejected_at timestamp without time zone,
    posted_at timestamp without time zone,
    scheduled_post_time timestamp without time zone,
    generation_metadata jsonb,
    post_response jsonb,
    failure_reason text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    linkedin_comment_id text,
    engagement_metrics jsonb DEFAULT '{}'::jsonb,
    engagement_checked_at timestamp with time zone,
    user_feedback character varying(10),
    feedback_at timestamp with time zone,
    digest_sent_at timestamp with time zone,
    is_reply_to_comment boolean DEFAULT false,
    reply_to_comment_id text,
    reply_to_author_name text,
    reactions_count integer DEFAULT 0,
    replies_count integer DEFAULT 0,
    performance_score numeric(5,2),
    last_engagement_check timestamp with time zone,
    author_replied boolean DEFAULT false,
    author_liked boolean DEFAULT false,
    expires_at timestamp with time zone,
    expired_at timestamp with time zone,
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['pending_approval'::character varying, 'scheduled'::character varying, 'posting'::character varying, 'posted'::character varying, 'rejected'::character varying, 'failed'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: TABLE linkedin_post_comments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.linkedin_post_comments IS 'Stores AI-generated LinkedIn comments awaiting approval';


--
-- Name: COLUMN linkedin_post_comments.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_comments.status IS 'Comment workflow status: pending_approval, approved, rejected, posted, failed';


--
-- Name: COLUMN linkedin_post_comments.generation_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_comments.generation_metadata IS 'Metadata about AI generation (model, tokens, confidence)';


--
-- Name: COLUMN linkedin_post_comments.linkedin_comment_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_comments.linkedin_comment_id IS 'The Unipile/LinkedIn ID of the posted comment';


--
-- Name: COLUMN linkedin_post_comments.engagement_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_comments.engagement_metrics IS 'JSON object containing likes_count, replies_count, etc.';


--
-- Name: COLUMN linkedin_post_comments.engagement_checked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_comments.engagement_checked_at IS 'When engagement metrics were last fetched from LinkedIn';


--
-- Name: COLUMN linkedin_post_comments.reactions_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_comments.reactions_count IS 'Number of likes/reactions on our comment';


--
-- Name: COLUMN linkedin_post_comments.replies_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_comments.replies_count IS 'Number of replies to our comment';


--
-- Name: COLUMN linkedin_post_comments.performance_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_comments.performance_score IS 'Calculated score based on engagement received';


--
-- Name: COLUMN linkedin_post_comments.author_replied; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_comments.author_replied IS 'Did the post author reply to our comment?';


--
-- Name: COLUMN linkedin_post_comments.author_liked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_comments.author_liked IS 'Did the post author like our comment?';


--
-- Name: COLUMN linkedin_post_comments.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_comments.expires_at IS 'When this comment expires if not approved (6 AM UTC next business day)';


--
-- Name: COLUMN linkedin_post_comments.expired_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_post_comments.expired_at IS 'When this comment was marked as expired';


--
-- Name: linkedin_posted_with_engagement; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.linkedin_posted_with_engagement AS
 SELECT id,
    workspace_id,
    post_social_id,
    comment_text,
    replies_count,
    (engagement_metrics -> 'reactions'::text) AS reactions,
    (engagement_metrics -> 'replies'::text) AS replies,
    posted_at,
    user_replied,
    last_reply_at
   FROM public.linkedin_comments_posted
  ORDER BY posted_at DESC;


--
-- Name: linkedin_posts_discovered; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_posts_discovered (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    monitor_id uuid,
    social_id character varying(255) NOT NULL,
    share_url text NOT NULL,
    post_content text,
    author_name character varying(255),
    author_profile_id character varying(255),
    author_headline text,
    hashtags text[],
    post_date timestamp without time zone,
    engagement_metrics jsonb,
    status character varying(50) DEFAULT 'discovered'::character varying,
    skip_reason text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    author_title text,
    approval_token text,
    approval_status text DEFAULT 'pending'::text,
    approved_at timestamp with time zone,
    rejected_at timestamp with time zone,
    digest_sent_at timestamp with time zone,
    posted_via_email boolean DEFAULT false,
    comment_eligible_at timestamp with time zone,
    comment_generated_at timestamp with time zone,
    author_country text,
    post_intent character varying(50) DEFAULT 'thought_leadership'::character varying,
    engagement_quality_score numeric(5,2),
    quality_factors jsonb DEFAULT '{}'::jsonb,
    expires_at timestamp with time zone,
    expired_at timestamp with time zone,
    CONSTRAINT linkedin_posts_discovered_identifier_check CHECK (((share_url IS NOT NULL) OR (social_id IS NOT NULL))),
    CONSTRAINT valid_approval_status CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'posted'::text, 'expired'::text]))),
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['discovered'::character varying, 'processing'::character varying, 'commented'::character varying, 'skipped'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: COLUMN linkedin_posts_discovered.post_intent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_posts_discovered.post_intent IS 'Detected intent of the post: question, thought_leadership, announcement, etc.';


--
-- Name: COLUMN linkedin_posts_discovered.engagement_quality_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_posts_discovered.engagement_quality_score IS 'Calculated score 0-100 based on engagement signals';


--
-- Name: COLUMN linkedin_posts_discovered.quality_factors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_posts_discovered.quality_factors IS 'Breakdown: {author_score, engagement_ratio, recency_bonus, comment_ratio}';


--
-- Name: COLUMN linkedin_posts_discovered.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_posts_discovered.expires_at IS 'When this post expires if not commented on (6 AM UTC next business day)';


--
-- Name: COLUMN linkedin_posts_discovered.expired_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.linkedin_posts_discovered.expired_at IS 'When this post was marked as expired';


--
-- Name: linkedin_proxy_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_proxy_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    linkedin_account_id text NOT NULL,
    linkedin_account_name text NOT NULL,
    detected_country text NOT NULL,
    proxy_country text NOT NULL,
    proxy_state text,
    proxy_city text,
    proxy_session_id text NOT NULL,
    proxy_username text NOT NULL,
    confidence_score numeric DEFAULT 1.0,
    connectivity_status text DEFAULT 'untested'::text,
    connectivity_details jsonb,
    is_primary_account boolean DEFAULT false,
    account_features jsonb DEFAULT '[]'::jsonb,
    last_updated timestamp with time zone DEFAULT now(),
    last_connectivity_test timestamp with time zone,
    next_rotation_due timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT linkedin_proxy_assignments_connectivity_status_check CHECK ((connectivity_status = ANY (ARRAY['active'::text, 'failed'::text, 'untested'::text, 'disabled'::text])))
);


--
-- Name: linkedin_queue_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.linkedin_queue_summary AS
 SELECT workspace_id,
    status,
    count(*) AS count,
    min(created_at) AS earliest,
    max(created_at) AS latest
   FROM public.linkedin_comment_queue
  GROUP BY workspace_id, status;


--
-- Name: linkedin_reposts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_reposts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    original_post_id uuid,
    original_social_id text NOT NULL,
    original_author text,
    original_share_url text,
    repost_comment text NOT NULL,
    repost_social_id text,
    status character varying(50) DEFAULT 'pending'::character varying,
    posted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: linkedin_searches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_searches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    workspace_id text,
    unipile_account_id text,
    search_query text,
    search_params jsonb,
    api_type text,
    category text,
    results_count integer DEFAULT 0,
    prospects jsonb DEFAULT '[]'::jsonb,
    next_cursor text,
    searched_at timestamp with time zone DEFAULT now()
);


--
-- Name: linkedin_self_post_comment_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_self_post_comment_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    monitor_id uuid NOT NULL,
    comment_linkedin_id text NOT NULL,
    comment_text text NOT NULL,
    commenter_name text,
    commenter_headline text,
    commenter_linkedin_url text,
    commenter_provider_id text,
    commented_at timestamp with time zone,
    comment_likes_count integer DEFAULT 0,
    is_question boolean DEFAULT false,
    sentiment text,
    reply_text text,
    generation_metadata jsonb DEFAULT '{}'::jsonb,
    confidence_score numeric(3,2),
    status text DEFAULT 'pending_generation'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejection_reason text,
    scheduled_post_time timestamp with time zone,
    posted_at timestamp with time zone,
    reply_linkedin_id text,
    failure_reason text,
    post_response jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT linkedin_self_post_comment_replies_status_check CHECK ((status = ANY (ARRAY['pending_generation'::text, 'pending_approval'::text, 'approved'::text, 'scheduled'::text, 'posting'::text, 'posted'::text, 'rejected'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: linkedin_self_post_monitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_self_post_monitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    post_url text NOT NULL,
    post_social_id text,
    post_ugc_id text,
    post_title text,
    post_content text,
    post_author_name text,
    posted_at timestamp with time zone,
    reply_prompt text NOT NULL,
    reply_context jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    auto_approve_replies boolean DEFAULT false,
    max_replies_per_day integer DEFAULT 20,
    check_frequency_minutes integer DEFAULT 30,
    reply_to_questions_only boolean DEFAULT false,
    skip_single_word_comments boolean DEFAULT true,
    min_comment_length integer DEFAULT 10,
    last_checked_at timestamp with time zone,
    last_comment_id text,
    total_comments_found integer DEFAULT 0,
    total_replies_sent integer DEFAULT 0,
    replies_sent_today integer DEFAULT 0,
    replies_reset_date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: magic_link_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.magic_link_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    user_id uuid NOT NULL,
    used boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE magic_link_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.magic_link_tokens IS 'One-time use magic links for 3cubed enterprise customer onboarding';


--
-- Name: meeting_follow_up_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_follow_up_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_id uuid NOT NULL,
    prospect_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    follow_up_type text NOT NULL,
    subject text,
    message text NOT NULL,
    channel text DEFAULT 'email'::text,
    status text DEFAULT 'pending_generation'::text NOT NULL,
    approval_token text,
    approved_at timestamp with time zone,
    approved_by uuid,
    rejected_reason text,
    sent_at timestamp with time zone,
    send_error text,
    ai_model text,
    ai_tokens_used integer,
    generation_time_ms integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE meeting_follow_up_drafts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.meeting_follow_up_drafts IS 'AI-generated meeting follow-ups pending HITL approval';


--
-- Name: meeting_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    reminder_type text NOT NULL,
    scheduled_for timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    error_message text,
    channel text DEFAULT 'email'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE meeting_reminders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.meeting_reminders IS 'Scheduled meeting reminders (24h, 1h, 15m before)';


--
-- Name: meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meetings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid,
    booking_url text,
    booking_platform text,
    booking_event_type text,
    title text,
    description text,
    scheduled_at timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 30,
    timezone text DEFAULT 'America/New_York'::text,
    meeting_link text,
    meeting_platform text,
    phone_number text,
    our_attendee_email text,
    our_attendee_name text,
    prospect_email text,
    prospect_name text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    confirmed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancelled_by text,
    cancellation_reason text,
    no_show_detected_at timestamp with time zone,
    completed_at timestamp with time zone,
    rescheduled_to uuid,
    reminder_24h_sent_at timestamp with time zone,
    reminder_1h_sent_at timestamp with time zone,
    reminder_15m_sent_at timestamp with time zone,
    no_show_follow_up_sent_at timestamp with time zone,
    post_meeting_follow_up_sent_at timestamp with time zone,
    reschedule_attempts integer DEFAULT 0,
    max_reschedule_attempts integer DEFAULT 3,
    our_calendar_event_id text,
    their_calendar_event_id text,
    calendar_synced_at timestamp with time zone,
    outcome text,
    next_steps text,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source_reply_draft_id uuid
);


--
-- Name: TABLE meetings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.meetings IS 'Meeting lifecycle management - booking, reminders, no-show handling, follow-ups';


--
-- Name: COLUMN meetings.source_reply_draft_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meetings.source_reply_draft_id IS 'Links meeting back to the reply agent draft that led to booking';


--
-- Name: memory_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    workspace_id uuid,
    snapshot_date timestamp with time zone DEFAULT now(),
    thread_count integer NOT NULL,
    message_count integer NOT NULL,
    memory_summary text,
    thread_ids uuid[] NOT NULL,
    archived_threads jsonb NOT NULL,
    importance_score integer DEFAULT 5,
    user_notes text,
    restore_count integer DEFAULT 0,
    last_restored_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT memory_snapshots_importance_score_check CHECK (((importance_score >= 1) AND (importance_score <= 10)))
);


--
-- Name: TABLE memory_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.memory_snapshots IS 'Persistent memory snapshots of SAM conversation threads';


--
-- Name: message_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_outbox (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid,
    campaign_id uuid,
    prospect_id uuid,
    reply_id uuid,
    channel text NOT NULL,
    message_content text NOT NULL,
    subject text,
    status text DEFAULT 'queued'::text,
    scheduled_send_time timestamp with time zone,
    sent_at timestamp with time zone,
    failed_at timestamp with time zone,
    failure_reason text,
    external_message_id text,
    n8n_execution_id text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE message_outbox; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.message_outbox IS 'Queue for outbound messages (email, LinkedIn) awaiting delivery';


--
-- Name: COLUMN message_outbox.prospect_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.message_outbox.prospect_id IS 'Links to workspace_prospects (no FK constraint - table may not exist)';


--
-- Name: COLUMN message_outbox.reply_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.message_outbox.reply_id IS 'Links to campaign_replies (no FK constraint - table may not exist)';


--
-- Name: COLUMN message_outbox.channel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.message_outbox.channel IS 'Delivery channel: email, linkedin, both';


--
-- Name: COLUMN message_outbox.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.message_outbox.status IS 'Message delivery status: queued, sending, sent, failed, cancelled';


--
-- Name: messaging_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messaging_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id text NOT NULL,
    template_name text NOT NULL,
    campaign_type text,
    industry text,
    target_role text,
    target_company_size text,
    connection_message text NOT NULL,
    alternative_message text,
    follow_up_messages jsonb DEFAULT '[]'::jsonb,
    language text DEFAULT 'en'::text,
    tone text DEFAULT 'professional'::text,
    performance_metrics jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT messaging_templates_campaign_type_check CHECK ((campaign_type = ANY (ARRAY['sam_signature'::text, 'event_invitation'::text, 'product_launch'::text, 'partnership'::text, 'custom'::text]))),
    CONSTRAINT messaging_templates_target_company_size_check CHECK ((target_company_size = ANY (ARRAY['startup'::text, 'smb'::text, 'mid_market'::text, 'enterprise'::text])))
);


--
-- Name: n8n_campaign_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.n8n_campaign_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_n8n_workflow_id uuid,
    campaign_approval_session_id uuid,
    workspace_id text,
    n8n_execution_id text NOT NULL,
    n8n_workflow_id text NOT NULL,
    campaign_name text,
    campaign_type text,
    execution_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    total_prospects integer DEFAULT 0,
    processed_prospects integer DEFAULT 0,
    successful_outreach integer DEFAULT 0,
    failed_outreach integer DEFAULT 0,
    responses_received integer DEFAULT 0,
    execution_status text DEFAULT 'pending'::text,
    current_step text,
    progress_percentage real DEFAULT 0.0,
    campaign_results jsonb DEFAULT '{}'::jsonb,
    performance_metrics jsonb DEFAULT '{}'::jsonb,
    error_details text,
    estimated_completion_time timestamp with time zone,
    estimated_duration_minutes integer,
    actual_duration_minutes integer,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT n8n_campaign_executions_campaign_type_check CHECK ((campaign_type = ANY (ARRAY['email_only'::text, 'linkedin_only'::text, 'multi_channel'::text]))),
    CONSTRAINT n8n_campaign_executions_execution_status_check CHECK ((execution_status = ANY (ARRAY['pending'::text, 'started'::text, 'in_progress'::text, 'paused'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: oauth_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    state text NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid,
    provider text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE oauth_states; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.oauth_states IS 'Temporary OAuth state storage for CSRF protection during OAuth flows';


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clerk_org_id text,
    name text NOT NULL,
    slug text,
    logo_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    billing_type text DEFAULT 'direct'::text NOT NULL,
    master_billing_email text,
    stripe_customer_id text,
    CONSTRAINT organizations_billing_type_check CHECK ((billing_type = ANY (ARRAY['direct'::text, 'master_account'::text])))
);


--
-- Name: TABLE organizations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organizations IS 'Organizations with different billing models (3cubed = master account with per-workspace invoicing, InnovareAI = direct Stripe)';


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    email text NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pii_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pii_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid,
    table_name text NOT NULL,
    record_id uuid,
    field_name text NOT NULL,
    access_type text NOT NULL,
    ip_address inet,
    user_agent text,
    accessed_at timestamp with time zone DEFAULT now(),
    access_reason text,
    CONSTRAINT pii_access_log_access_type_check CHECK ((access_type = ANY (ARRAY['read'::text, 'write'::text, 'delete'::text])))
);


--
-- Name: TABLE pii_access_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pii_access_log IS 'Audit log for all PII field access (GDPR compliance)';


--
-- Name: prospect_approval_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_approval_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    prospect_id text NOT NULL,
    name text NOT NULL,
    title text NOT NULL,
    location text,
    profile_image text,
    recent_activity text,
    company jsonb DEFAULT '{}'::jsonb NOT NULL,
    contact jsonb DEFAULT '{}'::jsonb NOT NULL,
    connection_degree integer DEFAULT 0,
    enrichment_score integer DEFAULT 0,
    source text DEFAULT 'unipile_linkedin_search'::text NOT NULL,
    enriched_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    approval_status text DEFAULT 'pending'::text,
    workspace_id uuid,
    CONSTRAINT prospect_approval_data_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: COLUMN prospect_approval_data.workspace_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.prospect_approval_data.workspace_id IS 'Workspace ID for multi-tenant isolation. Replaces session_id-based isolation.';


--
-- Name: prospect_approval_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_approval_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    prospect_id text NOT NULL,
    decision text NOT NULL,
    reason text,
    decided_by uuid NOT NULL,
    decided_at timestamp with time zone DEFAULT now(),
    is_immutable boolean DEFAULT true,
    workspace_id uuid,
    CONSTRAINT prospect_approval_decisions_decision_check CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text])))
);


--
-- Name: prospect_approval_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_approval_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_number integer NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    total_prospects integer DEFAULT 0 NOT NULL,
    approved_count integer DEFAULT 0 NOT NULL,
    rejected_count integer DEFAULT 0 NOT NULL,
    pending_count integer DEFAULT 0 NOT NULL,
    icp_criteria jsonb DEFAULT '{}'::jsonb NOT NULL,
    prospect_source text DEFAULT 'unipile_linkedin_search'::text,
    learning_insights jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    campaign_name text,
    campaign_tag text,
    campaign_id uuid,
    metadata jsonb,
    CONSTRAINT prospect_approval_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text])))
);


--
-- Name: COLUMN prospect_approval_sessions.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.prospect_approval_sessions.metadata IS 'JSON metadata including batch_id for new architecture sessions';


--
-- Name: prospect_data_integrity; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.prospect_data_integrity AS
 SELECT count(*) FILTER (WHERE ((status = 'connection_request_sent'::text) AND (contacted_at IS NULL))) AS corrupted_sent,
    count(*) FILTER (WHERE ((status = 'failed'::text) AND (contacted_at IS NOT NULL))) AS corrupted_failed,
    count(*) FILTER (WHERE ((status = 'pending'::text) AND (contacted_at IS NOT NULL))) AS corrupted_pending,
    count(*) AS total_prospects,
    round(((100.0 * (count(*) FILTER (WHERE ((status = 'connection_request_sent'::text) AND (contacted_at IS NULL))))::numeric) / (NULLIF(count(*), 0))::numeric), 2) AS corruption_percentage
   FROM public.campaign_prospects;


--
-- Name: prospect_exports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_exports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    prospect_count integer DEFAULT 0 NOT NULL,
    export_data jsonb DEFAULT '[]'::jsonb NOT NULL,
    export_format text DEFAULT 'json'::text,
    share_url text,
    google_sheets_url text,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    CONSTRAINT prospect_exports_export_format_check CHECK ((export_format = ANY (ARRAY['json'::text, 'csv'::text, 'google_sheets'::text])))
);


--
-- Name: prospect_learning_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_learning_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    prospect_id text NOT NULL,
    decision text NOT NULL,
    reason text,
    prospect_title text,
    company_size text,
    company_industry text,
    connection_degree integer,
    enrichment_score integer,
    has_email boolean DEFAULT false,
    has_phone boolean DEFAULT false,
    learning_features jsonb DEFAULT '{}'::jsonb,
    logged_at timestamp with time zone DEFAULT now(),
    workspace_id uuid NOT NULL,
    CONSTRAINT prospect_learning_logs_decision_check CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text])))
);


--
-- Name: prospect_search_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_search_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    workspace_id uuid,
    search_criteria jsonb NOT NULL,
    search_type text NOT NULL,
    search_source text,
    status text DEFAULT 'queued'::text NOT NULL,
    progress_current integer DEFAULT 0,
    progress_total integer DEFAULT 0,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    total_results integer,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: prospect_search_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_search_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid,
    prospect_data jsonb NOT NULL,
    batch_number integer,
    created_at timestamp with time zone DEFAULT now(),
    workspace_id uuid NOT NULL
);


--
-- Name: qa_autofix_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qa_autofix_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    issue_type text NOT NULL,
    issue_description text NOT NULL,
    severity text,
    fix_applied text,
    fix_status text,
    affected_component text,
    affected_file text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT qa_autofix_logs_fix_status_check CHECK ((fix_status = ANY (ARRAY['success'::text, 'failed'::text, 'manual_required'::text]))),
    CONSTRAINT qa_autofix_logs_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: workspace_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    account_type text NOT NULL,
    account_identifier text NOT NULL,
    account_name text,
    unipile_account_id text,
    platform_account_id text,
    connection_status text DEFAULT 'pending'::text,
    connected_at timestamp with time zone,
    last_verified_at timestamp with time zone,
    account_metadata jsonb DEFAULT '{}'::jsonb,
    capabilities jsonb DEFAULT '{}'::jsonb,
    limitations jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    error_details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    unipile_sources jsonb DEFAULT '[]'::jsonb,
    daily_message_limit integer DEFAULT 20,
    messages_sent_today integer DEFAULT 0,
    last_message_date date DEFAULT CURRENT_DATE,
    scheduling_url text,
    access_token text,
    refresh_token text,
    token_expires_at timestamp with time zone,
    CONSTRAINT workspace_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['linkedin'::text, 'email'::text, 'google_calendar'::text, 'google'::text, 'outlook_calendar'::text, 'calcom'::text, 'calendly'::text]))),
    CONSTRAINT workspace_accounts_connection_status_check CHECK ((connection_status = ANY (ARRAY['pending'::text, 'connected'::text, 'failed'::text, 'needs_verification'::text, 'disconnected'::text])))
);


--
-- Name: COLUMN workspace_accounts.connection_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_accounts.connection_status IS 'Status: active, inactive, error, duplicate_removed, cancelled, payment_failed, requires_action, deleted';


--
-- Name: COLUMN workspace_accounts.daily_message_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_accounts.daily_message_limit IS 'Max connection requests per day (default 20 for 
  free LinkedIn, can be increased for premium accounts)';


--
-- Name: COLUMN workspace_accounts.messages_sent_today; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_accounts.messages_sent_today IS 'Number of messages sent today from this 
  account';


--
-- Name: COLUMN workspace_accounts.last_message_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_accounts.last_message_date IS 'Date of last message sent (used to reset daily 
  counter)';


--
-- Name: COLUMN workspace_accounts.scheduling_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_accounts.scheduling_url IS 'User scheduling URL (Calendly, Cal.com)';


--
-- Name: COLUMN workspace_accounts.access_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_accounts.access_token IS 'OAuth access token (encrypted in production)';


--
-- Name: COLUMN workspace_accounts.refresh_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_accounts.refresh_token IS 'OAuth refresh token (encrypted in production)';


--
-- Name: COLUMN workspace_accounts.token_expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_accounts.token_expires_at IS 'When the access token expires';


--
-- Name: rate_limits_by_account; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.rate_limits_by_account AS
 SELECT cp.unipile_account_id,
    wa.account_name,
    w.name AS workspace_name,
    cp.status,
    count(*) AS prospect_count,
    min(cp.updated_at) AS first_rate_limit,
    max(cp.updated_at) AS last_rate_limit,
        CASE
            WHEN (cp.status = 'rate_limited_cr'::text) THEN (max(cp.updated_at) + '24:00:00'::interval)
            WHEN (cp.status = 'rate_limited_message'::text) THEN (max(cp.updated_at) + '01:00:00'::interval)
            ELSE NULL::timestamp with time zone
        END AS available_after,
        CASE
            WHEN (cp.status = 'rate_limited_cr'::text) THEN ((max(cp.updated_at) + '24:00:00'::interval) < now())
            WHEN (cp.status = 'rate_limited_message'::text) THEN ((max(cp.updated_at) + '01:00:00'::interval) < now())
            ELSE NULL::boolean
        END AS is_available_now
   FROM (((public.campaign_prospects cp
     LEFT JOIN public.campaigns c ON ((c.id = cp.campaign_id)))
     LEFT JOIN public.workspaces w ON ((w.id = c.workspace_id)))
     LEFT JOIN public.workspace_accounts wa ON ((wa.unipile_account_id = cp.unipile_account_id)))
  WHERE ((cp.status ~~ 'rate_limited%'::text) AND (cp.unipile_account_id IS NOT NULL))
  GROUP BY cp.unipile_account_id, wa.account_name, w.name, cp.status
  ORDER BY (max(cp.updated_at)) DESC;


--
-- Name: reply_agent_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reply_agent_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid,
    prospect_id uuid,
    inbound_message_id text NOT NULL,
    inbound_message_text text NOT NULL,
    inbound_message_at timestamp with time zone NOT NULL,
    channel character varying(20) DEFAULT 'linkedin'::character varying NOT NULL,
    prospect_name text,
    prospect_linkedin_url text,
    prospect_company text,
    prospect_title text,
    research_linkedin_profile jsonb,
    research_company_profile jsonb,
    research_website text,
    draft_text text NOT NULL,
    intent_detected character varying(50),
    ai_model text,
    status character varying(30) DEFAULT 'pending_approval'::character varying NOT NULL,
    approval_token uuid DEFAULT gen_random_uuid(),
    approved_by uuid,
    approved_at timestamp with time zone,
    edited_text text,
    rejection_reason text,
    sent_at timestamp with time zone,
    send_error text,
    outbound_message_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '48:00:00'::interval),
    included_calendar_link boolean DEFAULT false,
    prospect_sent_calendar_link text
);


--
-- Name: COLUMN reply_agent_drafts.included_calendar_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reply_agent_drafts.included_calendar_link IS 'Whether this draft included a calendar booking link';


--
-- Name: COLUMN reply_agent_drafts.prospect_sent_calendar_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reply_agent_drafts.prospect_sent_calendar_link IS 'If prospect sent their own calendar link in their message, store it here';


--
-- Name: reply_agent_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reply_agent_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    replies_received integer DEFAULT 0,
    drafts_generated integer DEFAULT 0,
    drafts_approved integer DEFAULT 0,
    drafts_edited integer DEFAULT 0,
    drafts_refused integer DEFAULT 0,
    intent_interested integer DEFAULT 0,
    intent_curious integer DEFAULT 0,
    intent_objection integer DEFAULT 0,
    intent_timing integer DEFAULT 0,
    intent_wrong_person integer DEFAULT 0,
    intent_not_interested integer DEFAULT 0,
    intent_question integer DEFAULT 0,
    intent_vague_positive integer DEFAULT 0,
    avg_intent_confidence numeric(3,2),
    thumbs_up_count integer DEFAULT 0,
    thumbs_down_count integer DEFAULT 0,
    edit_rate numeric(3,2),
    linkedin_replies integer DEFAULT 0,
    email_replies integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: reply_agent_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reply_agent_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    sam_description text,
    sam_differentiators text,
    ideal_customer text,
    objection_handling jsonb DEFAULT '[]'::jsonb,
    proof_points text,
    pricing_guidance text,
    voice_reference text,
    tone_of_voice text,
    writing_style text,
    dos_and_donts text,
    default_cta character varying(50) DEFAULT 'book_call'::character varying,
    calendar_link text,
    pushiness_level character varying(20) DEFAULT 'balanced'::character varying,
    handle_not_interested character varying(30) DEFAULT 'graceful_exit'::character varying,
    handle_pricing character varying(30) DEFAULT 'deflect_to_call'::character varying,
    system_prompt_override text,
    enabled boolean DEFAULT false,
    approval_mode character varying(20) DEFAULT 'manual'::character varying,
    ai_model character varying(50) DEFAULT 'anthropic/claude-sonnet-4'::character varying,
    reply_delay_minutes integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    demo_video_link text,
    pdf_overview_link text,
    case_studies_link text,
    landing_page_link text,
    signup_link text
);


--
-- Name: COLUMN reply_agent_settings.demo_video_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reply_agent_settings.demo_video_link IS 'Link to demo video';


--
-- Name: COLUMN reply_agent_settings.pdf_overview_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reply_agent_settings.pdf_overview_link IS 'Link to PDF overview/one-pager';


--
-- Name: COLUMN reply_agent_settings.case_studies_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reply_agent_settings.case_studies_link IS 'Link to case studies';


--
-- Name: COLUMN reply_agent_settings.landing_page_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reply_agent_settings.landing_page_link IS 'Link to product landing page';


--
-- Name: COLUMN reply_agent_settings.signup_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reply_agent_settings.signup_link IS 'Link to signup page';


--
-- Name: reply_feedback_reasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reply_feedback_reasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reply_id uuid NOT NULL,
    reason character varying(50) NOT NULL,
    custom_reason text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: sam_conversation_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sam_conversation_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    message_id uuid,
    user_id uuid NOT NULL,
    workspace_id uuid,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer NOT NULL,
    mime_type text NOT NULL,
    storage_path text NOT NULL,
    storage_bucket text DEFAULT 'sam-attachments'::text NOT NULL,
    processing_status text DEFAULT 'pending'::text NOT NULL,
    extracted_text text,
    extracted_metadata jsonb DEFAULT '{}'::jsonb,
    attachment_type text,
    user_notes text,
    analysis_results jsonb DEFAULT '{}'::jsonb,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    CONSTRAINT sam_conversation_attachments_attachment_type_check CHECK ((attachment_type = ANY (ARRAY['linkedin_profile'::text, 'icp_document'::text, 'pitch_deck'::text, 'case_study'::text, 'other'::text]))),
    CONSTRAINT sam_conversation_attachments_processing_status_check CHECK ((processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: sam_conversation_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sam_conversation_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid,
    role text NOT NULL,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    message_order integer DEFAULT 0 NOT NULL,
    user_id uuid,
    has_prospect_intelligence boolean DEFAULT false,
    prospect_intelligence_data jsonb,
    message_metadata jsonb DEFAULT '{}'::jsonb,
    model_used text DEFAULT 'anthropic/claude-3.7-sonnet'::text,
    workspace_id uuid,
    CONSTRAINT sam_conversation_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);


--
-- Name: TABLE sam_conversation_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sam_conversation_messages IS 'Stores messages within SAM conversation threads';


--
-- Name: COLUMN sam_conversation_messages.message_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sam_conversation_messages.message_order IS 'Order of message within thread';


--
-- Name: COLUMN sam_conversation_messages.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sam_conversation_messages.user_id IS 'User who created the message';


--
-- Name: COLUMN sam_conversation_messages.has_prospect_intelligence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sam_conversation_messages.has_prospect_intelligence IS 'Whether message contains prospect research data';


--
-- Name: COLUMN sam_conversation_messages.prospect_intelligence_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sam_conversation_messages.prospect_intelligence_data IS 'Prospect intelligence JSON data';


--
-- Name: COLUMN sam_conversation_messages.message_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sam_conversation_messages.message_metadata IS 'Additional message metadata';


--
-- Name: COLUMN sam_conversation_messages.model_used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sam_conversation_messages.model_used IS 'The AI model used to generate this message (for assistant messages)';


--
-- Name: sam_conversation_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sam_conversation_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    organization_id uuid,
    workspace_id uuid,
    title text NOT NULL,
    thread_type text NOT NULL,
    prospect_name text,
    prospect_company text,
    prospect_linkedin_url text,
    campaign_name text,
    tags text[],
    priority text DEFAULT 'medium'::text,
    sales_methodology text DEFAULT 'meddic'::text,
    status text DEFAULT 'active'::text,
    last_active_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    memory_archived boolean DEFAULT false,
    memory_archive_date timestamp with time zone,
    memory_importance_score integer DEFAULT 5,
    user_bookmarked boolean DEFAULT false,
    CONSTRAINT sam_conversation_threads_memory_importance_score_check CHECK (((memory_importance_score >= 1) AND (memory_importance_score <= 10)))
);


--
-- Name: sam_funnel_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sam_funnel_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid,
    template_id text NOT NULL,
    step_number integer NOT NULL,
    step_type text NOT NULL,
    mandatory_element text,
    messages_sent integer DEFAULT 0,
    messages_delivered integer DEFAULT 0,
    messages_read integer DEFAULT 0,
    responses_received integer DEFAULT 0,
    positive_responses integer DEFAULT 0,
    negative_responses integer DEFAULT 0,
    opt_outs integer DEFAULT 0,
    cta_variation text,
    cta_performance_score numeric(5,2),
    avg_response_time interval,
    best_performing_day text,
    best_performing_time time without time zone,
    calculated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    workspace_id uuid NOT NULL
);


--
-- Name: sam_funnel_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sam_funnel_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    workspace_id uuid NOT NULL,
    template_id text NOT NULL,
    execution_type text DEFAULT 'sam_funnel'::text,
    status text DEFAULT 'pending'::text,
    prospects_total integer NOT NULL,
    prospects_scheduled integer DEFAULT 0,
    prospects_active integer DEFAULT 0,
    prospects_completed integer DEFAULT 0,
    prospects_responded integer DEFAULT 0,
    start_date timestamp with time zone NOT NULL,
    estimated_completion_date timestamp with time zone,
    actual_completion_date timestamp with time zone,
    schedule jsonb DEFAULT '{}'::jsonb,
    personalization_data jsonb DEFAULT '{}'::jsonb,
    client_messaging jsonb,
    response_rate numeric(5,2) DEFAULT 0.00,
    conversion_rate numeric(5,2) DEFAULT 0.00,
    meeting_booking_rate numeric(5,2) DEFAULT 0.00,
    opt_out_rate numeric(5,2) DEFAULT 0.00,
    cta_test_results jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sam_funnel_executions_execution_type_check CHECK ((execution_type = ANY (ARRAY['sam_funnel'::text, 'sam_funnel_extended'::text]))),
    CONSTRAINT sam_funnel_executions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'paused'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: sam_funnel_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sam_funnel_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid,
    campaign_id uuid,
    prospect_id uuid,
    step_number integer NOT NULL,
    step_type text NOT NULL,
    message_template text NOT NULL,
    subject text,
    scheduled_date timestamp with time zone NOT NULL,
    sent_date timestamp with time zone,
    week_number integer NOT NULL,
    weekday text NOT NULL,
    mandatory_element text,
    cta_variation text,
    status text DEFAULT 'scheduled'::text,
    response_received boolean DEFAULT false,
    response_type text,
    response_content text,
    conditions jsonb DEFAULT '[]'::jsonb,
    skip_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    workspace_id uuid NOT NULL,
    CONSTRAINT sam_funnel_messages_mandatory_element_check CHECK ((mandatory_element = ANY (ARRAY['competence_validation'::text, 'free_trial'::text, 'loom_video'::text, 'second_cta'::text, 'goodbye_qualification'::text]))),
    CONSTRAINT sam_funnel_messages_response_type_check CHECK ((response_type = ANY (ARRAY['positive'::text, 'negative'::text, 'question'::text, 'objection'::text, 'opt_out'::text, 'qualification'::text]))),
    CONSTRAINT sam_funnel_messages_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'responded'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT sam_funnel_messages_step_type_check CHECK ((step_type = ANY (ARRAY['connection_request'::text, 'follow_up'::text, 'goodbye'::text, 'email'::text])))
);


--
-- Name: sam_funnel_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sam_funnel_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid,
    message_id uuid,
    prospect_id uuid,
    response_type text NOT NULL,
    response_content text NOT NULL,
    response_date timestamp with time zone DEFAULT now(),
    qualification_option text,
    qualification_meaning text,
    sam_analysis jsonb,
    sam_suggested_reply text,
    sam_confidence_score numeric(3,2),
    requires_approval boolean DEFAULT true,
    approved_by uuid,
    approved_at timestamp with time zone,
    approval_status text DEFAULT 'pending'::text,
    final_reply text,
    action_taken text,
    action_date timestamp with time zone,
    follow_up_scheduled_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    workspace_id uuid NOT NULL,
    CONSTRAINT sam_funnel_responses_action_taken_check CHECK ((action_taken = ANY (ARRAY['replied'::text, 'scheduled_follow_up'::text, 'marked_dnc'::text, 'booked_meeting'::text, 'sent_calendar_link'::text]))),
    CONSTRAINT sam_funnel_responses_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'modified'::text]))),
    CONSTRAINT sam_funnel_responses_qualification_option_check CHECK ((qualification_option = ANY (ARRAY['a'::text, 'b'::text, 'c'::text, 'd'::text]))),
    CONSTRAINT sam_funnel_responses_response_type_check CHECK ((response_type = ANY (ARRAY['positive'::text, 'negative'::text, 'question'::text, 'objection'::text, 'opt_out'::text, 'qualification'::text, 'meeting_request'::text])))
);


--
-- Name: sam_funnel_template_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sam_funnel_template_performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id text NOT NULL,
    template_type text NOT NULL,
    total_executions integer DEFAULT 0,
    total_prospects integer DEFAULT 0,
    total_messages_sent integer DEFAULT 0,
    total_responses integer DEFAULT 0,
    total_positive_responses integer DEFAULT 0,
    total_meetings_booked integer DEFAULT 0,
    total_opt_outs integer DEFAULT 0,
    avg_response_rate numeric(5,2) DEFAULT 0.00,
    avg_conversion_rate numeric(5,2) DEFAULT 0.00,
    avg_meeting_booking_rate numeric(5,2) DEFAULT 0.00,
    avg_opt_out_rate numeric(5,2) DEFAULT 0.00,
    step_performance jsonb DEFAULT '{}'::jsonb,
    best_performing_cta text,
    cta_test_confidence numeric(5,2),
    best_start_day text,
    optimal_timing jsonb,
    version_history jsonb DEFAULT '[]'::jsonb,
    last_optimization_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sam_funnel_template_performance_template_type_check CHECK ((template_type = ANY (ARRAY['linkedin'::text, 'email'::text])))
);


--
-- Name: sam_icp_discovery_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sam_icp_discovery_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    thread_id uuid,
    session_status text DEFAULT 'in_progress'::text NOT NULL,
    discovery_payload jsonb DEFAULT '{}'::jsonb,
    phases_completed text[] DEFAULT ARRAY[]::text[],
    red_flags text[] DEFAULT ARRAY[]::text[],
    confidence_score numeric(3,2) DEFAULT 0.0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    question_responses jsonb DEFAULT '[]'::jsonb,
    industry_context jsonb DEFAULT '{}'::jsonb,
    prospecting_criteria jsonb DEFAULT '{}'::jsonb,
    linkedin_profile_data jsonb DEFAULT '{}'::jsonb,
    content_strategy jsonb DEFAULT '{}'::jsonb,
    workspace_id uuid,
    CONSTRAINT sam_icp_discovery_sessions_session_status_check CHECK ((session_status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'abandoned'::text])))
);


--
-- Name: TABLE sam_icp_discovery_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sam_icp_discovery_sessions IS 'Stores ICP discovery session state and progress for SAM conversations';


--
-- Name: sam_icp_knowledge_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sam_icp_knowledge_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    discovery_session_id uuid,
    question_id text NOT NULL,
    question_text text NOT NULL,
    answer_text text NOT NULL,
    answer_structured jsonb DEFAULT '{}'::jsonb,
    stage text NOT NULL,
    category text NOT NULL,
    confidence_score numeric(3,2) DEFAULT 1.0,
    is_shallow boolean DEFAULT false,
    needs_clarification boolean DEFAULT false,
    clarification_notes text,
    embedding public.vector(768),
    indexed_for_rag boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source_attachment_id uuid
);


--
-- Name: COLUMN sam_icp_knowledge_entries.source_attachment_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sam_icp_knowledge_entries.source_attachment_id IS 'Reference to the uploaded document that generated this knowledge entry. NULL for entries from SAM discovery conversations.';


--
-- Name: sam_knowledge_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sam_knowledge_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    document_id uuid,
    section_id text,
    total_chunks integer,
    total_tokens integer,
    tags text[] DEFAULT '{}'::text[],
    quick_summary text,
    metadata jsonb DEFAULT '{}'::jsonb,
    sam_ready boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: sam_learning_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sam_learning_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    model_version integer DEFAULT 1,
    model_type text DEFAULT 'prospect_approval'::text,
    learned_preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    feature_weights jsonb DEFAULT '{}'::jsonb,
    accuracy_score real DEFAULT 0.0,
    sessions_trained_on integer DEFAULT 0,
    last_training_session uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sam_learning_models_model_type_check CHECK ((model_type = ANY (ARRAY['prospect_approval'::text, 'icp_optimization'::text])))
);


--
-- Name: send_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.send_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    prospect_id uuid NOT NULL,
    linkedin_user_id text NOT NULL,
    message text NOT NULL,
    scheduled_for timestamp without time zone NOT NULL,
    sent_at timestamp without time zone,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    message_type character varying(50) DEFAULT 'connection_request'::character varying,
    requires_connection boolean DEFAULT false,
    voice_message_url text,
    variant character varying(10),
    CONSTRAINT check_message_type CHECK (((message_type)::text = ANY ((ARRAY['text'::character varying, 'voice'::character varying, 'attachment'::character varying, 'voice_followup'::character varying, 'connection_request'::character varying, 'follow_up_1'::character varying, 'follow_up_2'::character varying, 'follow_up_3'::character varying, 'follow_up_4'::character varying, 'follow_up_5'::character varying, 'direct_message_1'::character varying, 'direct_message_2'::character varying, 'direct_message_3'::character varying, 'direct_message_4'::character varying, 'direct_message_5'::character varying])::text[]))),
    CONSTRAINT send_queue_linkedin_user_id_no_urls CHECK ((linkedin_user_id !~~ '%linkedin.com%'::text))
);


--
-- Name: COLUMN send_queue.message_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.send_queue.message_type IS 'Type of message: text, voice, attachment, or voice_followup';


--
-- Name: COLUMN send_queue.requires_connection; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.send_queue.requires_connection IS 'If true, only send if prospect has accepted the connection request. Always false for messenger campaigns.';


--
-- Name: COLUMN send_queue.voice_message_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.send_queue.voice_message_url IS 'URL to .m4a voice file for LinkedIn voice drops';


--
-- Name: slack_app_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_app_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    slack_team_id character varying(50),
    slack_team_name character varying(255),
    bot_token text,
    bot_user_id character varying(50),
    access_token text,
    signing_secret text,
    app_id character varying(50),
    features_enabled jsonb DEFAULT '{"two_way_chat": true, "notifications": true, "slash_commands": true, "thread_replies": true, "interactive_buttons": true}'::jsonb,
    status character varying(20) DEFAULT 'pending'::character varying,
    last_verified_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    default_channel character varying(50)
);


--
-- Name: slack_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    channel_id character varying(50) NOT NULL,
    channel_name character varying(255),
    channel_type character varying(20) DEFAULT 'public'::character varying,
    linked_campaign_id uuid,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: slack_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    channel_id character varying(50) NOT NULL,
    thread_ts character varying(50),
    message_ts character varying(50) NOT NULL,
    direction character varying(10) NOT NULL,
    sender_type character varying(20) NOT NULL,
    sender_id character varying(50),
    sender_name character varying(255),
    content text NOT NULL,
    sam_thread_id uuid,
    ai_response text,
    processed_at timestamp with time zone,
    raw_event jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: slack_pending_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_pending_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    action_type character varying(50) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid NOT NULL,
    channel_id character varying(50),
    message_ts character varying(50),
    user_id character varying(50),
    action_data jsonb DEFAULT '{}'::jsonb,
    expires_at timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying,
    completed_at timestamp with time zone,
    completed_by character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: slack_pending_installations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_pending_installations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slack_team_id text NOT NULL,
    slack_team_name text,
    bot_token text NOT NULL,
    bot_user_id text,
    authed_user_id text,
    status text DEFAULT 'pending'::text,
    linked_workspace_id uuid,
    linked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT slack_pending_installations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'linked'::text, 'expired'::text])))
);


--
-- Name: slack_user_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_user_mapping (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    slack_user_id character varying(50) NOT NULL,
    slack_username character varying(255),
    slack_display_name character varying(255),
    slack_email character varying(255),
    sam_user_id uuid,
    is_admin boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: system_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_type text NOT NULL,
    component text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    resolution_notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT system_alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['critical'::text, 'warning'::text, 'info'::text])))
);


--
-- Name: system_health_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_health_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    check_date timestamp with time zone DEFAULT now() NOT NULL,
    checks jsonb DEFAULT '[]'::jsonb NOT NULL,
    ai_analysis text,
    recommendations jsonb DEFAULT '[]'::jsonb,
    overall_status character varying(20) DEFAULT 'healthy'::character varying NOT NULL,
    duration_ms integer,
    fixes_proposed jsonb DEFAULT '[]'::jsonb,
    fixes_applied jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: system_health_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_health_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component text NOT NULL,
    component_detail text,
    status text NOT NULL,
    response_time_ms integer,
    cpu_usage numeric(5,2),
    memory_usage numeric(5,2),
    storage_usage numeric(5,2),
    error_count integer DEFAULT 0,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT system_health_logs_status_check CHECK ((status = ANY (ARRAY['healthy'::text, 'degraded'::text, 'unhealthy'::text])))
);


--
-- Name: template_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component_type text,
    industry text,
    role text,
    language text DEFAULT 'en'::text,
    content text NOT NULL,
    performance_score numeric(3,2) DEFAULT 0.00,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT template_components_component_type_check CHECK ((component_type = ANY (ARRAY['opening'::text, 'pain_point'::text, 'value_prop'::text, 'cta'::text, 'closing'::text])))
);


--
-- Name: template_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid,
    campaign_id uuid,
    total_sent integer DEFAULT 0,
    total_responses integer DEFAULT 0,
    response_rate numeric(5,2) DEFAULT 0.00,
    connection_rate numeric(5,2) DEFAULT 0.00,
    meeting_rate numeric(5,2) DEFAULT 0.00,
    date_start date,
    date_end date,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tracked_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracked_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    short_code text NOT NULL,
    destination_url text NOT NULL,
    link_type text NOT NULL,
    prospect_id uuid,
    campaign_id uuid,
    workspace_id uuid NOT NULL,
    source_type text,
    source_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone
);


--
-- Name: TABLE tracked_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tracked_links IS 'Unique tracked links per prospect for engagement tracking';


--
-- Name: COLUMN tracked_links.link_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tracked_links.link_type IS 'Type of link: calendar, demo_video, one_pager, case_study, trial, website, other';


--
-- Name: COLUMN tracked_links.source_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tracked_links.source_type IS 'What created this link: reply_agent, follow_up_agent, campaign_sequence, manual';


--
-- Name: user_memory_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_memory_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    workspace_id uuid,
    auto_archive_enabled boolean DEFAULT true,
    archive_frequency_days integer DEFAULT 7,
    max_active_threads integer DEFAULT 20,
    memory_retention_days integer DEFAULT 90,
    importance_threshold integer DEFAULT 3,
    auto_restore_on_login boolean DEFAULT false,
    memory_notifications boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_memory_preferences_archive_frequency_days_check CHECK ((archive_frequency_days > 0))
);


--
-- Name: TABLE user_memory_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_memory_preferences IS 'User preferences for SAM memory management';


--
-- Name: user_organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    organization_id uuid,
    role text DEFAULT 'member'::text,
    joined_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    workspace_id uuid,
    session_start timestamp with time zone NOT NULL,
    session_end timestamp with time zone,
    duration_minutes integer,
    pages_visited integer DEFAULT 0,
    actions_performed integer DEFAULT 0,
    user_agent text,
    ip_address text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_workspaces; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.user_workspaces AS
 SELECT user_id,
    workspace_id,
    role,
    status
   FROM public.workspace_members wm
  WHERE (status = 'active'::text)
  WITH NO DATA;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    current_workspace_id uuid,
    email_verified boolean DEFAULT false,
    email_verified_at timestamp with time zone,
    profile_country text,
    subscription_status text,
    trial_ends_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    subscription_plan text,
    billing_cycle text,
    profile_timezone text DEFAULT 'America/New_York'::text,
    CONSTRAINT users_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['trial'::text, 'active'::text, 'cancelled'::text, 'expired'::text])))
);


--
-- Name: COLUMN users.current_workspace_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.current_workspace_id IS 'Users currently active workspace for context isolation';


--
-- Name: COLUMN users.profile_country; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.profile_country IS '2-letter country code for proxy location preference (e.g., us, de, gb)';


--
-- Name: v_commenting_expiration_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_commenting_expiration_status AS
 SELECT linkedin_posts_discovered.workspace_id,
    'posts'::text AS content_type,
    count(*) FILTER (WHERE ((linkedin_posts_discovered.status)::text = 'discovered'::text)) AS pending_count,
    count(*) FILTER (WHERE (((linkedin_posts_discovered.status)::text = 'discovered'::text) AND (linkedin_posts_discovered.expires_at <= now()))) AS expired_needing_cleanup,
    count(*) FILTER (WHERE ((linkedin_posts_discovered.status)::text = 'expired'::text)) AS already_expired,
    min(linkedin_posts_discovered.expires_at) FILTER (WHERE ((linkedin_posts_discovered.status)::text = 'discovered'::text)) AS next_expiration
   FROM public.linkedin_posts_discovered
  GROUP BY linkedin_posts_discovered.workspace_id
UNION ALL
 SELECT linkedin_post_comments.workspace_id,
    'comments'::text AS content_type,
    count(*) FILTER (WHERE ((linkedin_post_comments.status)::text = ANY ((ARRAY['pending_approval'::character varying, 'scheduled'::character varying])::text[]))) AS pending_count,
    count(*) FILTER (WHERE (((linkedin_post_comments.status)::text = ANY ((ARRAY['pending_approval'::character varying, 'scheduled'::character varying])::text[])) AND (linkedin_post_comments.expires_at <= now()))) AS expired_needing_cleanup,
    count(*) FILTER (WHERE ((linkedin_post_comments.status)::text = 'expired'::text)) AS already_expired,
    min(linkedin_post_comments.expires_at) FILTER (WHERE ((linkedin_post_comments.status)::text = ANY ((ARRAY['pending_approval'::character varying, 'scheduled'::character varying])::text[]))) AS next_expiration
   FROM public.linkedin_post_comments
  GROUP BY linkedin_post_comments.workspace_id;


--
-- Name: VIEW v_commenting_expiration_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_commenting_expiration_status IS 'Monitor content expiration status by workspace';


--
-- Name: v_linkedin_account_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_linkedin_account_status AS
 SELECT uua.id AS user_account_id,
    uua.user_id,
    uua.workspace_id,
    uua.unipile_account_id,
    uua.account_name,
    uua.platform,
    uua.connection_status AS user_connection_status,
    wa.id AS workspace_account_id,
    wa.connection_status AS workspace_connection_status,
    wa.is_active AS workspace_account_active,
        CASE
            WHEN ((uua.id IS NOT NULL) AND (wa.id IS NOT NULL)) THEN 'fully_mapped'::text
            WHEN ((uua.id IS NOT NULL) AND (wa.id IS NULL)) THEN 'missing_workspace_account'::text
            WHEN ((uua.id IS NULL) AND (wa.id IS NOT NULL)) THEN 'missing_user_account'::text
            ELSE 'unknown'::text
        END AS mapping_status
   FROM (public.user_unipile_accounts uua
     FULL JOIN public.workspace_accounts wa ON ((uua.unipile_account_id = wa.unipile_account_id)));


--
-- Name: webhook_error_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_error_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id text NOT NULL,
    workflow_id text NOT NULL,
    event_type text NOT NULL,
    error_message text NOT NULL,
    error_code text,
    stack_trace text,
    payload_data jsonb,
    request_headers jsonb,
    resolved boolean DEFAULT false,
    resolution_notes text,
    resolved_at timestamp without time zone,
    "timestamp" timestamp without time zone DEFAULT now(),
    workspace_id uuid
);


--
-- Name: website_analysis_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_analysis_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    website_url text NOT NULL,
    analysis_depth character varying(20) DEFAULT 'standard'::character varying,
    priority integer DEFAULT 5,
    status character varying(30) DEFAULT 'queued'::character varying,
    error_message text,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    result_id uuid,
    prospect_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    scheduled_for timestamp with time zone DEFAULT now(),
    CONSTRAINT website_analysis_queue_priority_check CHECK (((priority >= 1) AND (priority <= 10))),
    CONSTRAINT website_analysis_queue_status_check CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: website_analysis_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_analysis_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    website_url text NOT NULL,
    domain character varying(255) NOT NULL,
    analyzed_at timestamp with time zone DEFAULT now(),
    status character varying(30) DEFAULT 'pending'::character varying,
    error_message text,
    seo_score integer,
    geo_score integer,
    overall_score integer,
    seo_results jsonb DEFAULT '{}'::jsonb,
    geo_results jsonb DEFAULT '{}'::jsonb,
    recommendations jsonb DEFAULT '[]'::jsonb,
    executive_summary text,
    raw_html_hash character varying(64),
    fetch_duration_ms integer,
    analysis_duration_ms integer,
    prospect_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    CONSTRAINT website_analysis_results_geo_score_check CHECK (((geo_score >= 0) AND (geo_score <= 100))),
    CONSTRAINT website_analysis_results_overall_score_check CHECK (((overall_score >= 0) AND (overall_score <= 100))),
    CONSTRAINT website_analysis_results_seo_score_check CHECK (((seo_score >= 0) AND (seo_score <= 100))),
    CONSTRAINT website_analysis_results_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'analyzing'::character varying, 'completed'::character varying, 'failed'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: website_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_type character varying DEFAULT 'seo_analysis'::character varying,
    source character varying DEFAULT 'wordpress_lead_magnet'::character varying,
    email character varying NOT NULL,
    company_name character varying,
    contact_name character varying,
    phone character varying,
    website_url character varying NOT NULL,
    website_domain character varying GENERATED ALWAYS AS (
CASE
    WHEN ((website_url)::text ~~ 'http://%'::text) THEN split_part(split_part((website_url)::text, 'http://'::text, 2), '/'::text, 1)
    WHEN ((website_url)::text ~~ 'https://%'::text) THEN split_part(split_part((website_url)::text, 'https://'::text, 2), '/'::text, 1)
    ELSE split_part((website_url)::text, '/'::text, 1)
END) STORED,
    seo_score integer,
    geo_score integer,
    analysis_data jsonb,
    analysis_summary text,
    report_url text,
    report_html text,
    report_storage_path text,
    lead_status character varying DEFAULT 'new'::character varying,
    contacted_at timestamp with time zone,
    contacted_by uuid,
    last_contact_at timestamp with time zone,
    next_follow_up_at timestamp with time zone,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    internal_notes text,
    client_notes text,
    utm_source character varying,
    utm_medium character varying,
    utm_campaign character varying,
    utm_content character varying,
    utm_term character varying,
    referrer text,
    report_viewed boolean DEFAULT false,
    report_viewed_at timestamp with time zone,
    report_downloaded boolean DEFAULT false,
    report_downloaded_at timestamp with time zone,
    calendly_clicked boolean DEFAULT false,
    calendly_clicked_at timestamp with time zone,
    meeting_scheduled boolean DEFAULT false,
    meeting_scheduled_at timestamp with time zone,
    converted_to_client boolean DEFAULT false,
    converted_at timestamp with time zone,
    client_id uuid,
    project_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    access_token text,
    token_used boolean DEFAULT false,
    CONSTRAINT website_requests_lead_status_check CHECK (((lead_status)::text = ANY ((ARRAY['new'::character varying, 'contacted'::character varying, 'qualified'::character varying, 'proposal_sent'::character varying, 'converted'::character varying, 'disqualified'::character varying, 'no_response'::character varying])::text[]))),
    CONSTRAINT website_requests_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['seo_analysis'::character varying, 'consultation'::character varying, 'audit'::character varying])::text[])))
);


--
-- Name: TABLE website_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.website_requests IS 'Stores website analysis requests from WordPress lead magnet and tracks them through the sales funnel';


--
-- Name: COLUMN website_requests.request_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.website_requests.request_type IS 'Type of request: seo_analysis, consultation, or audit';


--
-- Name: COLUMN website_requests.source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.website_requests.source IS 'Source of the request (e.g., wordpress_lead_magnet, manual_entry)';


--
-- Name: COLUMN website_requests.report_storage_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.website_requests.report_storage_path IS 'Path to the report in Supabase storage bucket';


--
-- Name: COLUMN website_requests.lead_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.website_requests.lead_status IS 'Current status in the sales funnel';


--
-- Name: COLUMN website_requests.access_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.website_requests.access_token IS 'Secure one-time access token for report viewing (64-char hex string)';


--
-- Name: COLUMN website_requests.token_used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.website_requests.token_used IS 'Track if the access token has been used (for one-time links)';


--
-- Name: website_requests_active; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.website_requests_active AS
 SELECT id,
    email,
    company_name,
    website_url,
    website_domain,
    seo_score,
    geo_score,
    lead_status,
    assigned_to,
    next_follow_up_at,
    created_at,
    EXTRACT(day FROM (now() - created_at)) AS days_since_request,
        CASE
            WHEN (next_follow_up_at < now()) THEN 'overdue'::text
            WHEN ((next_follow_up_at IS NULL) AND (created_at < (now() - '3 days'::interval))) THEN 'needs_scheduling'::text
            ELSE 'scheduled'::text
        END AS follow_up_status
   FROM public.website_requests
  WHERE ((lead_status)::text <> ALL ((ARRAY['converted'::character varying, 'disqualified'::character varying, 'no_response'::character varying])::text[]))
  ORDER BY
        CASE
            WHEN (next_follow_up_at < now()) THEN 1
            WHEN (next_follow_up_at IS NULL) THEN 2
            ELSE 3
        END, next_follow_up_at NULLS FIRST;


--
-- Name: VIEW website_requests_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.website_requests_active IS 'Active requests that need follow-up or attention';


--
-- Name: website_requests_by_source; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.website_requests_by_source AS
 SELECT COALESCE(utm_source, 'direct'::character varying) AS source,
    COALESCE(utm_medium, 'none'::character varying) AS medium,
    COALESCE(utm_campaign, 'none'::character varying) AS campaign,
    count(*) AS total_requests,
    count(*) FILTER (WHERE (converted_to_client = true)) AS conversions,
    avg(seo_score) AS avg_seo_score,
    avg(geo_score) AS avg_geo_score,
    round((((count(*) FILTER (WHERE (converted_to_client = true)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS conversion_rate_percent
   FROM public.website_requests
  GROUP BY COALESCE(utm_source, 'direct'::character varying), COALESCE(utm_medium, 'none'::character varying), COALESCE(utm_campaign, 'none'::character varying)
  ORDER BY (count(*)) DESC;


--
-- Name: VIEW website_requests_by_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.website_requests_by_source IS 'Marketing attribution and performance by traffic source';


--
-- Name: website_requests_dashboard; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.website_requests_dashboard AS
 SELECT date(created_at) AS request_date,
    count(*) AS total_requests,
    count(DISTINCT email) AS unique_leads,
    avg(seo_score) AS avg_seo_score,
    avg(geo_score) AS avg_geo_score,
    count(*) FILTER (WHERE ((lead_status)::text = 'new'::text)) AS new_leads,
    count(*) FILTER (WHERE ((lead_status)::text = 'contacted'::text)) AS contacted_leads,
    count(*) FILTER (WHERE ((lead_status)::text = 'qualified'::text)) AS qualified_leads,
    count(*) FILTER (WHERE ((lead_status)::text = 'proposal_sent'::text)) AS proposals_sent,
    count(*) FILTER (WHERE ((lead_status)::text = 'converted'::text)) AS converted_leads,
    count(*) FILTER (WHERE ((lead_status)::text = 'disqualified'::text)) AS disqualified_leads,
    count(*) FILTER (WHERE (report_viewed = true)) AS reports_viewed,
    count(*) FILTER (WHERE (calendly_clicked = true)) AS calendly_clicks,
    count(*) FILTER (WHERE (meeting_scheduled = true)) AS meetings_scheduled,
    round((((count(*) FILTER (WHERE (converted_to_client = true)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS conversion_rate_percent
   FROM public.website_requests
  GROUP BY (date(created_at))
  ORDER BY (date(created_at)) DESC;


--
-- Name: VIEW website_requests_dashboard; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.website_requests_dashboard IS 'Daily aggregated metrics for website requests';


--
-- Name: workflow_deployment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_deployment_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_n8n_workflow_id uuid NOT NULL,
    workspace_id text NOT NULL,
    deployment_type text NOT NULL,
    deployment_trigger text NOT NULL,
    old_template_version text,
    new_template_version text,
    template_changes jsonb DEFAULT '{}'::jsonb,
    configuration_changes jsonb DEFAULT '{}'::jsonb,
    status text NOT NULL,
    error_message text,
    n8n_execution_id text,
    deployed_workflow_id text,
    deployment_duration_seconds integer,
    initiated_by text NOT NULL,
    deployment_notes text,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_deployment_history_deployment_trigger_check CHECK ((deployment_trigger = ANY (ARRAY['workspace_creation'::text, 'user_request'::text, 'admin_action'::text, 'scheduled_upgrade'::text, 'error_recovery'::text]))),
    CONSTRAINT workflow_deployment_history_deployment_type_check CHECK ((deployment_type = ANY (ARRAY['initial_deployment'::text, 'configuration_update'::text, 'template_upgrade'::text, 'credential_update'::text, 'manual_redeploy'::text]))),
    CONSTRAINT workflow_deployment_history_status_check CHECK ((status = ANY (ARRAY['started'::text, 'in_progress'::text, 'completed'::text, 'failed'::text, 'rolled_back'::text])))
);


--
-- Name: workspace_account_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_account_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    linkedin_limits jsonb DEFAULT '{"warmup": {"enabled": true, "end_limit": 25, "increase_by": 2, "start_limit": 5, "step_length_days": 3}, "settings": {"capitalize_names": true, "adjust_hourly_limits": true, "send_without_connector_message": false, "delete_pending_requests_after_days": 14}, "daily_limits": {"inmails": 10, "event_invites": 10, "company_follows": 10, "follow_up_messages": 50, "connection_requests": 20}, "range_limits": {"inmails": {"max": 20, "min": 5}, "messages": {"max": 100, "min": 20}, "connection_requests": {"max": 30, "min": 10}}}'::jsonb NOT NULL,
    email_limits jsonb DEFAULT '{"warmup": {"enabled": true, "end_limit": 100, "increase_by": 10, "start_limit": 10, "step_length_days": 7}, "daily_limits": {"emails_per_day": 100, "emails_per_hour": 20}}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE workspace_account_limits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_account_limits IS 'Stores LinkedIn and Email account limits and warmup settings per workspace';


--
-- Name: workspace_ai_search_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_ai_search_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    website_url text NOT NULL,
    website_locked boolean DEFAULT true,
    enabled boolean DEFAULT true,
    auto_analyze_prospects boolean DEFAULT false,
    analysis_depth character varying(20) DEFAULT 'standard'::character varying,
    check_meta_tags boolean DEFAULT true,
    check_structured_data boolean DEFAULT true,
    check_robots_txt boolean DEFAULT true,
    check_sitemap boolean DEFAULT true,
    check_page_speed boolean DEFAULT false,
    check_llm_readability boolean DEFAULT true,
    check_entity_clarity boolean DEFAULT true,
    check_fact_density boolean DEFAULT true,
    check_citation_readiness boolean DEFAULT true,
    learn_from_outreach boolean DEFAULT true,
    learn_from_comments boolean DEFAULT true,
    send_analysis_reports boolean DEFAULT true,
    report_email character varying(255),
    ai_model character varying(100) DEFAULT 'claude-3-5-sonnet'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workspace_ai_search_config_analysis_depth_check CHECK (((analysis_depth)::text = ANY ((ARRAY['quick'::character varying, 'standard'::character varying, 'comprehensive'::character varying])::text[])))
);


--
-- Name: workspace_analytics_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_analytics_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    ai_insights jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: workspace_blacklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_blacklists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    linkedin_account_id text,
    blacklist_type text NOT NULL,
    comparison_type text DEFAULT 'contains'::text NOT NULL,
    keyword text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_blacklists_blacklist_type_check CHECK ((blacklist_type = ANY (ARRAY['company_name'::text, 'first_name'::text, 'last_name'::text, 'job_title'::text, 'profile_link'::text]))),
    CONSTRAINT workspace_blacklists_comparison_type_check CHECK ((comparison_type = ANY (ARRAY['contains'::text, 'equals'::text, 'starts_with'::text, 'ends_with'::text])))
);


--
-- Name: TABLE workspace_blacklists; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_blacklists IS 'Blacklist entries to exclude companies, people, or profiles from LinkedIn outreach. Checked before sending connection requests.';


--
-- Name: workspace_dpa_agreements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_dpa_agreements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    dpa_version text NOT NULL,
    status text NOT NULL,
    signed_at timestamp without time zone,
    signed_by uuid,
    signed_by_name text,
    signed_by_title text,
    signed_by_email text,
    signature_method text DEFAULT 'click_through'::text,
    ip_address inet,
    user_agent text,
    consent_text text,
    scroll_completion boolean DEFAULT false,
    signed_dpa_pdf_url text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT workspace_dpa_agreements_signature_method_check CHECK ((signature_method = ANY (ARRAY['click_through'::text, 'custom_agreement'::text]))),
    CONSTRAINT workspace_dpa_agreements_status_check CHECK ((status = ANY (ARRAY['pending_signature'::text, 'signed'::text, 'superseded'::text, 'terminated'::text])))
);


--
-- Name: TABLE workspace_dpa_agreements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_dpa_agreements IS 'Signed DPA agreements for each workspace (self-service/SME only)';


--
-- Name: COLUMN workspace_dpa_agreements.signature_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_dpa_agreements.signature_method IS 'click_through for self-service/SME, custom_agreement for enterprise';


--
-- Name: COLUMN workspace_dpa_agreements.scroll_completion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_dpa_agreements.scroll_completion IS 'Whether user scrolled to bottom of DPA before signing';


--
-- Name: workspace_dpa_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_dpa_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    requires_dpa boolean DEFAULT false,
    detection_method text,
    detected_country text,
    detected_at timestamp without time zone,
    grace_period_start timestamp without time zone,
    grace_period_end timestamp without time zone,
    grace_period_active boolean DEFAULT false,
    reminder_7_days_sent boolean DEFAULT false,
    reminder_20_days_sent boolean DEFAULT false,
    reminder_27_days_sent boolean DEFAULT false,
    final_notice_sent boolean DEFAULT false,
    service_blocked boolean DEFAULT false,
    blocked_at timestamp without time zone,
    block_reason text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT workspace_dpa_requirements_detection_method_check CHECK ((detection_method = ANY (ARRAY['billing_country'::text, 'user_location'::text, 'manual_override'::text])))
);


--
-- Name: TABLE workspace_dpa_requirements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_dpa_requirements IS 'Tracks which workspaces require DPA and grace period status';


--
-- Name: COLUMN workspace_dpa_requirements.grace_period_end; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_dpa_requirements.grace_period_end IS '30 days from workspace creation or EU detection';


--
-- Name: workspace_encryption_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_encryption_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    encrypted_key text NOT NULL,
    key_version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    rotated_at timestamp with time zone,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_by uuid
);


--
-- Name: TABLE workspace_encryption_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_encryption_keys IS 'Workspace-specific encryption keys for PII data isolation';


--
-- Name: workspace_icp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_icp (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text DEFAULT 'Default ICP'::text NOT NULL,
    is_default boolean DEFAULT false,
    titles text[] DEFAULT '{}'::text[],
    seniority_levels text[] DEFAULT '{}'::text[],
    industries text[] DEFAULT '{}'::text[],
    company_size_min integer,
    company_size_max integer,
    locations text[] DEFAULT '{}'::text[],
    countries text[] DEFAULT '{}'::text[],
    funding_stages text[] DEFAULT '{}'::text[],
    keywords text[] DEFAULT '{}'::text[],
    exclude_keywords text[] DEFAULT '{}'::text[],
    target_companies text[] DEFAULT '{}'::text[],
    exclude_companies text[] DEFAULT '{}'::text[],
    description text,
    last_search_at timestamp with time zone,
    last_search_results integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: workspace_inbox_agent_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_inbox_agent_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    enabled boolean DEFAULT false,
    categorization_enabled boolean DEFAULT true,
    auto_categorize_new_messages boolean DEFAULT true,
    response_suggestions_enabled boolean DEFAULT true,
    suggest_for_categories text[] DEFAULT ARRAY['interested'::text, 'question'::text, 'objection'::text],
    auto_tagging_enabled boolean DEFAULT false,
    ai_model character varying(100) DEFAULT 'claude-3-5-sonnet'::character varying,
    categorization_instructions text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: workspace_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    integration_type character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'inactive'::character varying NOT NULL,
    config jsonb DEFAULT '{}'::jsonb,
    connected_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: workspace_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    invited_by uuid NOT NULL,
    invited_email text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    token text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by uuid,
    CONSTRAINT workspace_invitations_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text, 'viewer'::text]))),
    CONSTRAINT workspace_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: TABLE workspace_invitations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_invitations IS 'Email invitations for users to join workspaces';


--
-- Name: workspace_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    organization_id uuid,
    billing_period_start timestamp with time zone NOT NULL,
    billing_period_end timestamp with time zone NOT NULL,
    total_messages integer DEFAULT 0,
    total_campaigns integer DEFAULT 0,
    total_prospects integer DEFAULT 0,
    total_ai_credits integer DEFAULT 0,
    total_amount_cents integer DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    status text DEFAULT 'draft'::text,
    invoice_pdf_url text,
    stripe_invoice_id text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workspace_invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'finalized'::text, 'sent'::text, 'paid'::text])))
);


--
-- Name: TABLE workspace_invoices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_invoices IS 'Monthly invoices per workspace (3cubed workspaces get separate invoices sent to 3cubed billing email)';


--
-- Name: workspace_meeting_agent_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_meeting_agent_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    enabled boolean DEFAULT true,
    auto_book boolean DEFAULT false,
    approval_mode text DEFAULT 'manual'::text,
    reminder_24h_enabled boolean DEFAULT true,
    reminder_1h_enabled boolean DEFAULT true,
    reminder_15m_enabled boolean DEFAULT true,
    no_show_detection_enabled boolean DEFAULT true,
    no_show_grace_period_minutes integer DEFAULT 15,
    max_reschedule_attempts integer DEFAULT 3,
    default_meeting_duration integer DEFAULT 30,
    ai_model text DEFAULT 'claude-sonnet-4-5-20250929'::text,
    follow_up_guidelines text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE workspace_meeting_agent_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_meeting_agent_config IS 'Per-workspace Meeting Agent configuration';


--
-- Name: workspace_prospects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_prospects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    company_name text,
    job_title text,
    linkedin_profile_url text NOT NULL,
    email_address text,
    location text,
    industry text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    added_by uuid,
    added_by_unipile_account text,
    email_address_encrypted bytea,
    linkedin_profile_url_encrypted bytea,
    pii_encryption_version integer DEFAULT 1,
    pii_encrypted_at timestamp with time zone,
    pii_is_encrypted boolean DEFAULT false,
    consent_obtained boolean DEFAULT false,
    consent_date timestamp with time zone,
    consent_source text,
    consent_withdrawn_at timestamp with time zone,
    data_retention_days integer DEFAULT 730,
    scheduled_deletion_date timestamp with time zone,
    deletion_reason text,
    processing_purposes text[] DEFAULT ARRAY['marketing'::text, 'sales_outreach'::text],
    data_source text,
    is_eu_resident boolean,
    gdpr_compliant boolean DEFAULT true,
    data_processing_agreement_version text,
    connection_degree integer,
    linkedin_url text,
    linkedin_url_hash text,
    email text,
    email_hash text,
    company text,
    title text,
    phone text,
    linkedin_provider_id text,
    approval_status text,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejection_reason text,
    batch_id text,
    source text DEFAULT 'manual'::text,
    enrichment_data jsonb DEFAULT '{}'::jsonb,
    active_campaign_id uuid,
    linkedin_chat_id text,
    connection_status text DEFAULT 'unknown'::text,
    company_website text,
    company_name_normalized text,
    title_normalized text,
    location_normalized text
);


--
-- Name: COLUMN workspace_prospects.added_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_prospects.added_by IS 'User who 
  added this prospect - REQUIRED for LinkedIn TOS compliance. 
  Prospects can ONLY be messaged by the user who added them.';


--
-- Name: COLUMN workspace_prospects.connection_degree; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_prospects.connection_degree IS 'LinkedIn connection degree: 1 (connected), 2 (friend-of-friend), 3 (extended network)';


--
-- Name: COLUMN workspace_prospects.linkedin_chat_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_prospects.linkedin_chat_id IS 'Unipile chat thread ID for sending messages. Required for messenger campaigns.';


--
-- Name: COLUMN workspace_prospects.connection_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_prospects.connection_status IS 'LinkedIn connection status: unknown, not_connected, pending, connected, withdrawn';


--
-- Name: COLUMN workspace_prospects.company_name_normalized; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_prospects.company_name_normalized IS 'Lowercase normalized company name without legal suffixes (Inc, LLC, etc.) for deduplication';


--
-- Name: COLUMN workspace_prospects.title_normalized; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_prospects.title_normalized IS 'Normalized job title with standardized abbreviations';


--
-- Name: COLUMN workspace_prospects.location_normalized; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_prospects.location_normalized IS 'Normalized location without Area/Greater/Metropolitan suffixes';


--
-- Name: workspace_prospects_decrypted; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.workspace_prospects_decrypted WITH (security_invoker='true') AS
 SELECT id,
    workspace_id,
    first_name,
    last_name,
    company_name,
    job_title,
    location,
    industry,
        CASE
            WHEN pii_is_encrypted THEN public.decrypt_pii(workspace_id, email_address_encrypted)
            ELSE email_address
        END AS email_address,
        CASE
            WHEN pii_is_encrypted THEN public.decrypt_pii(workspace_id, linkedin_profile_url_encrypted)
            ELSE linkedin_profile_url
        END AS linkedin_profile_url,
    pii_is_encrypted,
    pii_encrypted_at,
    created_at,
    updated_at
   FROM public.workspace_prospects wp;


--
-- Name: VIEW workspace_prospects_decrypted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.workspace_prospects_decrypted IS 'Transparent decryption view - use this instead of direct table access';


--
-- Name: workspace_reply_agent_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_reply_agent_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    enabled boolean DEFAULT false,
    approval_mode character varying(20) DEFAULT 'manual'::character varying,
    response_tone character varying(50) DEFAULT 'professional'::character varying,
    reply_delay_hours integer DEFAULT 2,
    ai_model character varying(100) DEFAULT 'claude-opus-4-5-20251101'::character varying,
    reply_guidelines text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    notification_channels text[] DEFAULT ARRAY['email'::text, 'chat'::text],
    CONSTRAINT workspace_reply_agent_config_approval_mode_check CHECK (((approval_mode)::text = ANY ((ARRAY['auto'::character varying, 'manual'::character varying])::text[])))
);


--
-- Name: workspace_schedule_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_schedule_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    timezone text DEFAULT 'America/New_York'::text NOT NULL,
    weekly_schedule jsonb DEFAULT '{"friday": {"end": "22:00", "start": "07:00", "enabled": true}, "monday": {"end": "22:00", "start": "07:00", "enabled": true}, "sunday": {"end": "17:00", "start": "11:30", "enabled": true}, "tuesday": {"end": "22:00", "start": "07:00", "enabled": true}, "saturday": {"end": "19:00", "start": "10:00", "enabled": true}, "thursday": {"end": "22:00", "start": "07:00", "enabled": true}, "wednesday": {"end": "22:00", "start": "07:00", "enabled": true}}'::jsonb NOT NULL,
    inactive_dates jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE workspace_schedule_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_schedule_settings IS 'Workspace-level schedule settings for all automated actions (campaigns, commenting agent, etc.)';


--
-- Name: workspace_searched_prospects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_searched_prospects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    linkedin_url text NOT NULL,
    linkedin_provider_id text,
    first_name text,
    last_name text,
    first_seen_at timestamp with time zone DEFAULT now(),
    search_session_id uuid,
    source text DEFAULT 'linkedin_search'::text
);


--
-- Name: TABLE workspace_searched_prospects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_searched_prospects IS 'Tracks all prospects ever seen in searches per workspace for deduplication';


--
-- Name: workspace_stripe_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_stripe_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    stripe_customer_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE workspace_stripe_customers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_stripe_customers IS 'Maps workspaces to Stripe customer IDs';


--
-- Name: workspace_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    stripe_subscription_id text NOT NULL,
    status text NOT NULL,
    plan text NOT NULL,
    trial_end timestamp with time zone,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    cancel_at timestamp with time zone,
    canceled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_subscriptions_plan_check CHECK ((plan = ANY (ARRAY['startup'::text, 'sme'::text, 'enterprise'::text]))),
    CONSTRAINT workspace_subscriptions_status_check CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'unpaid'::text])))
);


--
-- Name: TABLE workspace_subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_subscriptions IS 'Tracks Stripe subscription status and plan for workspaces';


--
-- Name: workspace_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    tier text NOT NULL,
    tier_status text DEFAULT 'active'::text NOT NULL,
    monthly_email_limit integer DEFAULT 1000 NOT NULL,
    monthly_linkedin_limit integer DEFAULT 100 NOT NULL,
    daily_email_limit integer,
    daily_linkedin_limit integer,
    hitl_approval_required boolean DEFAULT true,
    integration_config jsonb DEFAULT '{}'::jsonb,
    tier_features jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    lead_search_tier text DEFAULT 'external'::text NOT NULL,
    monthly_lead_search_quota integer DEFAULT 100 NOT NULL,
    monthly_lead_searches_used integer DEFAULT 0 NOT NULL,
    search_quota_reset_date date DEFAULT CURRENT_DATE NOT NULL,
    CONSTRAINT workspace_tiers_lead_search_tier_check CHECK ((lead_search_tier = ANY (ARRAY['external'::text, 'sales_navigator'::text]))),
    CONSTRAINT workspace_tiers_tier_check CHECK ((tier = ANY (ARRAY['startup'::text, 'sme'::text, 'enterprise'::text]))),
    CONSTRAINT workspace_tiers_tier_status_check CHECK ((tier_status = ANY (ARRAY['active'::text, 'suspended'::text, 'cancelled'::text])))
);


--
-- Name: COLUMN workspace_tiers.lead_search_tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_tiers.lead_search_tier IS 'Lead search capability: external (BrightData/Google CSE for Classic/Premium LinkedIn), sales_navigator (Unipile LinkedIn Search for Sales Nav users)';


--
-- Name: COLUMN workspace_tiers.monthly_lead_search_quota; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_tiers.monthly_lead_search_quota IS 'Monthly quota for lead searches based on subscription tier';


--
-- Name: COLUMN workspace_tiers.monthly_lead_searches_used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_tiers.monthly_lead_searches_used IS 'Number of lead searches used in current month';


--
-- Name: workspace_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    organization_id uuid,
    usage_type text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workspace_usage_usage_type_check CHECK ((usage_type = ANY (ARRAY['message'::text, 'campaign'::text, 'prospect'::text, 'ai_credits'::text])))
);


--
-- Name: TABLE workspace_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_usage IS 'Usage tracking for all workspaces, aggregated monthly for billing';


--
-- Name: workspace_workflow_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_workflow_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_n8n_workflow_id uuid NOT NULL,
    workspace_id text NOT NULL,
    credential_type text NOT NULL,
    credential_name text NOT NULL,
    n8n_credential_id text NOT NULL,
    is_active boolean DEFAULT true,
    last_validated timestamp with time zone,
    validation_status text DEFAULT 'pending'::text,
    validation_error text,
    encrypted_config text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    CONSTRAINT workspace_workflow_credentials_credential_type_check CHECK ((credential_type = ANY (ARRAY['unipile_api'::text, 'email_smtp'::text, 'linkedin_oauth'::text, 'calendar_api'::text, 'crm_api'::text]))),
    CONSTRAINT workspace_workflow_credentials_validation_status_check CHECK ((validation_status = ANY (ARRAY['pending'::text, 'valid'::text, 'invalid'::text, 'expired'::text])))
);


--
-- Name: workspaces_cancelling_soon; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.workspaces_cancelling_soon AS
 SELECT w.id AS workspace_id,
    w.name AS workspace_name,
    w.subscription_status,
    w.subscription_cancel_at,
    (w.subscription_cancel_at - now()) AS time_until_cancellation,
    count(DISTINCT uua.unipile_account_id) FILTER (WHERE (uua.connection_status = 'active'::text)) AS accounts_to_delete
   FROM ((public.workspaces w
     LEFT JOIN public.workspace_members wm ON ((w.id = wm.workspace_id)))
     LEFT JOIN public.user_unipile_accounts uua ON ((wm.user_id = uua.user_id)))
  WHERE ((w.subscription_status = 'cancelling'::text) AND (w.subscription_cancel_at IS NOT NULL) AND (w.subscription_cancel_at > now()))
  GROUP BY w.id, w.name, w.subscription_status, w.subscription_cancel_at
  ORDER BY w.subscription_cancel_at;


--
-- Name: account_rate_limits account_rate_limits_account_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_rate_limits
    ADD CONSTRAINT account_rate_limits_account_id_date_key UNIQUE (account_id, date);


--
-- Name: account_rate_limits account_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_rate_limits
    ADD CONSTRAINT account_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: agent_fix_proposals agent_fix_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_fix_proposals
    ADD CONSTRAINT agent_fix_proposals_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: booking_platforms booking_platforms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_platforms
    ADD CONSTRAINT booking_platforms_pkey PRIMARY KEY (id);


--
-- Name: booking_platforms booking_platforms_platform_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_platforms
    ADD CONSTRAINT booking_platforms_platform_name_key UNIQUE (platform_name);


--
-- Name: campaign_messages campaign_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_messages
    ADD CONSTRAINT campaign_messages_pkey PRIMARY KEY (id);


--
-- Name: campaign_messages campaign_messages_platform_platform_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_messages
    ADD CONSTRAINT campaign_messages_platform_platform_message_id_key UNIQUE (platform, platform_message_id);


--
-- Name: campaign_optimizations campaign_optimizations_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_optimizations
    ADD CONSTRAINT campaign_optimizations_campaign_id_key UNIQUE (campaign_id);


--
-- Name: campaign_optimizations campaign_optimizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_optimizations
    ADD CONSTRAINT campaign_optimizations_pkey PRIMARY KEY (id);


--
-- Name: campaign_prospect_execution_state campaign_prospect_execution_state_campaign_id_prospect_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_prospect_execution_state
    ADD CONSTRAINT campaign_prospect_execution_state_campaign_id_prospect_id_key UNIQUE (campaign_id, prospect_id);


--
-- Name: campaign_prospect_execution_state campaign_prospect_execution_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_prospect_execution_state
    ADD CONSTRAINT campaign_prospect_execution_state_pkey PRIMARY KEY (id);


--
-- Name: campaign_prospects campaign_prospects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_prospects
    ADD CONSTRAINT campaign_prospects_pkey PRIMARY KEY (id);


--
-- Name: campaign_replies campaign_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_replies
    ADD CONSTRAINT campaign_replies_pkey PRIMARY KEY (id);


--
-- Name: campaign_schedules campaign_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_schedules
    ADD CONSTRAINT campaign_schedules_pkey PRIMARY KEY (id);


--
-- Name: campaign_settings campaign_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_settings
    ADD CONSTRAINT campaign_settings_pkey PRIMARY KEY (id);


--
-- Name: campaign_settings campaign_settings_workspace_id_user_id_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_settings
    ADD CONSTRAINT campaign_settings_workspace_id_user_id_campaign_id_key UNIQUE (workspace_id, user_id, campaign_id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: competitive_intelligence competitive_intelligence_competitor_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitive_intelligence
    ADD CONSTRAINT competitive_intelligence_competitor_name_key UNIQUE (competitor_name);


--
-- Name: competitive_intelligence competitive_intelligence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitive_intelligence
    ADD CONSTRAINT competitive_intelligence_pkey PRIMARY KEY (id);


--
-- Name: conversation_analytics conversation_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_analytics
    ADD CONSTRAINT conversation_analytics_pkey PRIMARY KEY (id);


--
-- Name: conversation_insights conversation_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_insights
    ADD CONSTRAINT conversation_insights_pkey PRIMARY KEY (id);


--
-- Name: core_funnel_executions core_funnel_executions_n8n_execution_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_funnel_executions
    ADD CONSTRAINT core_funnel_executions_n8n_execution_id_key UNIQUE (n8n_execution_id);


--
-- Name: core_funnel_executions core_funnel_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_funnel_executions
    ADD CONSTRAINT core_funnel_executions_pkey PRIMARY KEY (id);


--
-- Name: core_funnel_templates core_funnel_templates_n8n_workflow_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_funnel_templates
    ADD CONSTRAINT core_funnel_templates_n8n_workflow_id_key UNIQUE (n8n_workflow_id);


--
-- Name: core_funnel_templates core_funnel_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_funnel_templates
    ADD CONSTRAINT core_funnel_templates_pkey PRIMARY KEY (id);


--
-- Name: crm_conflict_resolutions crm_conflict_resolutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conflict_resolutions
    ADD CONSTRAINT crm_conflict_resolutions_pkey PRIMARY KEY (id);


--
-- Name: crm_connections crm_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_connections
    ADD CONSTRAINT crm_connections_pkey PRIMARY KEY (id);


--
-- Name: crm_connections crm_connections_workspace_id_crm_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_connections
    ADD CONSTRAINT crm_connections_workspace_id_crm_type_key UNIQUE (workspace_id, crm_type);


--
-- Name: crm_contact_mappings crm_contact_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contact_mappings
    ADD CONSTRAINT crm_contact_mappings_pkey PRIMARY KEY (id);


--
-- Name: crm_contact_mappings crm_contact_mappings_workspace_id_crm_type_sam_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contact_mappings
    ADD CONSTRAINT crm_contact_mappings_workspace_id_crm_type_sam_contact_id_key UNIQUE (workspace_id, crm_type, sam_contact_id);


--
-- Name: crm_field_mappings crm_field_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_field_mappings
    ADD CONSTRAINT crm_field_mappings_pkey PRIMARY KEY (id);


--
-- Name: crm_field_mappings crm_field_mappings_workspace_id_crm_type_field_type_sam_fie_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_field_mappings
    ADD CONSTRAINT crm_field_mappings_workspace_id_crm_type_field_type_sam_fie_key UNIQUE (workspace_id, crm_type, field_type, sam_field);


--
-- Name: crm_sync_logs crm_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_sync_logs
    ADD CONSTRAINT crm_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: cron_job_logs cron_job_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_job_logs
    ADD CONSTRAINT cron_job_logs_pkey PRIMARY KEY (id);


--
-- Name: customer_insight_patterns customer_insight_patterns_insight_type_description_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_insight_patterns
    ADD CONSTRAINT customer_insight_patterns_insight_type_description_key UNIQUE (insight_type, description);


--
-- Name: customer_insight_patterns customer_insight_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_insight_patterns
    ADD CONSTRAINT customer_insight_patterns_pkey PRIMARY KEY (id);


--
-- Name: data_retention_policies data_retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_pkey PRIMARY KEY (id);


--
-- Name: data_retention_policies data_retention_policies_workspace_id_is_active_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_workspace_id_is_active_key UNIQUE (workspace_id, is_active);


--
-- Name: deployment_logs deployment_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_logs
    ADD CONSTRAINT deployment_logs_pkey PRIMARY KEY (id);


--
-- Name: document_ai_analysis document_ai_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_ai_analysis
    ADD CONSTRAINT document_ai_analysis_pkey PRIMARY KEY (id);


--
-- Name: dpa_sub_processors dpa_sub_processors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpa_sub_processors
    ADD CONSTRAINT dpa_sub_processors_pkey PRIMARY KEY (id);


--
-- Name: dpa_update_notifications dpa_update_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpa_update_notifications
    ADD CONSTRAINT dpa_update_notifications_pkey PRIMARY KEY (id);


--
-- Name: dpa_versions dpa_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpa_versions
    ADD CONSTRAINT dpa_versions_pkey PRIMARY KEY (id);


--
-- Name: dpa_versions dpa_versions_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpa_versions
    ADD CONSTRAINT dpa_versions_version_key UNIQUE (version);


--
-- Name: dynamic_funnel_definitions dynamic_funnel_definitions_n8n_workflow_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_definitions
    ADD CONSTRAINT dynamic_funnel_definitions_n8n_workflow_id_key UNIQUE (n8n_workflow_id);


--
-- Name: dynamic_funnel_definitions dynamic_funnel_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_definitions
    ADD CONSTRAINT dynamic_funnel_definitions_pkey PRIMARY KEY (id);


--
-- Name: dynamic_funnel_executions dynamic_funnel_executions_n8n_execution_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_executions
    ADD CONSTRAINT dynamic_funnel_executions_n8n_execution_id_key UNIQUE (n8n_execution_id);


--
-- Name: dynamic_funnel_executions dynamic_funnel_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_executions
    ADD CONSTRAINT dynamic_funnel_executions_pkey PRIMARY KEY (id);


--
-- Name: dynamic_funnel_steps dynamic_funnel_steps_funnel_id_step_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_steps
    ADD CONSTRAINT dynamic_funnel_steps_funnel_id_step_order_key UNIQUE (funnel_id, step_order);


--
-- Name: dynamic_funnel_steps dynamic_funnel_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_steps
    ADD CONSTRAINT dynamic_funnel_steps_pkey PRIMARY KEY (id);


--
-- Name: email_campaign_prospects email_campaign_prospects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaign_prospects
    ADD CONSTRAINT email_campaign_prospects_pkey PRIMARY KEY (id);


--
-- Name: email_providers email_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_providers
    ADD CONSTRAINT email_providers_pkey PRIMARY KEY (id);


--
-- Name: email_responses email_responses_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_responses
    ADD CONSTRAINT email_responses_message_id_key UNIQUE (message_id);


--
-- Name: email_responses email_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_responses
    ADD CONSTRAINT email_responses_pkey PRIMARY KEY (id);


--
-- Name: email_send_queue email_send_queue_campaign_id_prospect_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_queue
    ADD CONSTRAINT email_send_queue_campaign_id_prospect_id_key UNIQUE (campaign_id, prospect_id);


--
-- Name: email_send_queue email_send_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_queue
    ADD CONSTRAINT email_send_queue_pkey PRIMARY KEY (id);


--
-- Name: enrichment_jobs enrichment_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_jobs
    ADD CONSTRAINT enrichment_jobs_pkey PRIMARY KEY (id);


--
-- Name: follow_up_drafts follow_up_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_drafts
    ADD CONSTRAINT follow_up_drafts_pkey PRIMARY KEY (id);


--
-- Name: funnel_adaptation_logs funnel_adaptation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_adaptation_logs
    ADD CONSTRAINT funnel_adaptation_logs_pkey PRIMARY KEY (id);


--
-- Name: funnel_performance_metrics funnel_performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_performance_metrics
    ADD CONSTRAINT funnel_performance_metrics_pkey PRIMARY KEY (id);


--
-- Name: funnel_step_logs funnel_step_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_step_logs
    ADD CONSTRAINT funnel_step_logs_pkey PRIMARY KEY (id);


--
-- Name: gdpr_deletion_requests gdpr_deletion_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gdpr_deletion_requests
    ADD CONSTRAINT gdpr_deletion_requests_pkey PRIMARY KEY (id);


--
-- Name: hitl_reply_approval_sessions hitl_reply_approval_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hitl_reply_approval_sessions
    ADD CONSTRAINT hitl_reply_approval_sessions_pkey PRIMARY KEY (id);


--
-- Name: icp_configurations icp_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icp_configurations
    ADD CONSTRAINT icp_configurations_pkey PRIMARY KEY (id);


--
-- Name: inbox_message_categories inbox_message_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_message_categories
    ADD CONSTRAINT inbox_message_categories_pkey PRIMARY KEY (id);


--
-- Name: inbox_message_categories inbox_message_categories_workspace_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_message_categories
    ADD CONSTRAINT inbox_message_categories_workspace_id_slug_key UNIQUE (workspace_id, slug);


--
-- Name: inbox_message_tags inbox_message_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_message_tags
    ADD CONSTRAINT inbox_message_tags_pkey PRIMARY KEY (id);


--
-- Name: inbox_message_tags inbox_message_tags_workspace_id_message_id_message_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_message_tags
    ADD CONSTRAINT inbox_message_tags_workspace_id_message_id_message_source_key UNIQUE (workspace_id, message_id, message_source);


--
-- Name: kb_notifications kb_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kb_notifications
    ADD CONSTRAINT kb_notifications_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_competitors knowledge_base_competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_competitors
    ADD CONSTRAINT knowledge_base_competitors_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_content knowledge_base_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_content
    ADD CONSTRAINT knowledge_base_content_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_document_usage knowledge_base_document_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_document_usage
    ADD CONSTRAINT knowledge_base_document_usage_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_documents knowledge_base_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_documents
    ADD CONSTRAINT knowledge_base_documents_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_icps knowledge_base_icps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_icps
    ADD CONSTRAINT knowledge_base_icps_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_personas knowledge_base_personas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_personas
    ADD CONSTRAINT knowledge_base_personas_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base knowledge_base_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_products knowledge_base_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_products
    ADD CONSTRAINT knowledge_base_products_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_sections knowledge_base_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_sections
    ADD CONSTRAINT knowledge_base_sections_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_sections knowledge_base_sections_workspace_id_section_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_sections
    ADD CONSTRAINT knowledge_base_sections_workspace_id_section_id_key UNIQUE (workspace_id, section_id);


--
-- Name: knowledge_base_vectors knowledge_base_vectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_vectors
    ADD CONSTRAINT knowledge_base_vectors_pkey PRIMARY KEY (id);


--
-- Name: knowledge_gap_tracking knowledge_gap_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_gap_tracking
    ADD CONSTRAINT knowledge_gap_tracking_pkey PRIMARY KEY (id);


--
-- Name: link_clicks link_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_clicks
    ADD CONSTRAINT link_clicks_pkey PRIMARY KEY (id);


--
-- Name: linkedin_author_relationships linkedin_author_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_author_relationships
    ADD CONSTRAINT linkedin_author_relationships_pkey PRIMARY KEY (id);


--
-- Name: linkedin_author_relationships linkedin_author_relationships_workspace_id_author_profile_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_author_relationships
    ADD CONSTRAINT linkedin_author_relationships_workspace_id_author_profile_i_key UNIQUE (workspace_id, author_profile_id);


--
-- Name: linkedin_brand_guidelines linkedin_brand_guidelines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_brand_guidelines
    ADD CONSTRAINT linkedin_brand_guidelines_pkey PRIMARY KEY (id);


--
-- Name: linkedin_brand_guidelines linkedin_brand_guidelines_workspace_id_is_active_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_brand_guidelines
    ADD CONSTRAINT linkedin_brand_guidelines_workspace_id_is_active_key UNIQUE (workspace_id, is_active);


--
-- Name: linkedin_comment_performance_stats linkedin_comment_performance__workspace_id_period_start_per_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comment_performance_stats
    ADD CONSTRAINT linkedin_comment_performance__workspace_id_period_start_per_key UNIQUE (workspace_id, period_start, period_end);


--
-- Name: linkedin_comment_performance_stats linkedin_comment_performance_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comment_performance_stats
    ADD CONSTRAINT linkedin_comment_performance_stats_pkey PRIMARY KEY (id);


--
-- Name: linkedin_comment_queue linkedin_comment_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comment_queue
    ADD CONSTRAINT linkedin_comment_queue_pkey PRIMARY KEY (id);


--
-- Name: linkedin_comment_replies linkedin_comment_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comment_replies
    ADD CONSTRAINT linkedin_comment_replies_pkey PRIMARY KEY (id);


--
-- Name: linkedin_comments_posted linkedin_comments_posted_comment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comments_posted
    ADD CONSTRAINT linkedin_comments_posted_comment_id_key UNIQUE (comment_id);


--
-- Name: linkedin_comments_posted linkedin_comments_posted_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comments_posted
    ADD CONSTRAINT linkedin_comments_posted_pkey PRIMARY KEY (id);


--
-- Name: linkedin_messages linkedin_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_messages
    ADD CONSTRAINT linkedin_messages_pkey PRIMARY KEY (id);


--
-- Name: linkedin_post_comments linkedin_post_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_post_comments
    ADD CONSTRAINT linkedin_post_comments_pkey PRIMARY KEY (id);


--
-- Name: linkedin_post_monitors linkedin_post_monitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_post_monitors
    ADD CONSTRAINT linkedin_post_monitors_pkey PRIMARY KEY (id);


--
-- Name: linkedin_posts_discovered linkedin_posts_discovered_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_posts_discovered
    ADD CONSTRAINT linkedin_posts_discovered_pkey PRIMARY KEY (id);


--
-- Name: linkedin_posts_discovered linkedin_posts_discovered_social_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_posts_discovered
    ADD CONSTRAINT linkedin_posts_discovered_social_id_key UNIQUE (social_id);


--
-- Name: linkedin_proxy_assignments linkedin_proxy_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_proxy_assignments
    ADD CONSTRAINT linkedin_proxy_assignments_pkey PRIMARY KEY (id);


--
-- Name: linkedin_proxy_assignments linkedin_proxy_assignments_user_id_linkedin_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_proxy_assignments
    ADD CONSTRAINT linkedin_proxy_assignments_user_id_linkedin_account_id_key UNIQUE (user_id, linkedin_account_id);


--
-- Name: linkedin_reposts linkedin_reposts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_reposts
    ADD CONSTRAINT linkedin_reposts_pkey PRIMARY KEY (id);


--
-- Name: linkedin_searches linkedin_searches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_searches
    ADD CONSTRAINT linkedin_searches_pkey PRIMARY KEY (id);


--
-- Name: linkedin_self_post_comment_replies linkedin_self_post_comment_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_self_post_comment_replies
    ADD CONSTRAINT linkedin_self_post_comment_replies_pkey PRIMARY KEY (id);


--
-- Name: linkedin_self_post_monitors linkedin_self_post_monitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_self_post_monitors
    ADD CONSTRAINT linkedin_self_post_monitors_pkey PRIMARY KEY (id);


--
-- Name: magic_link_tokens magic_link_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_link_tokens
    ADD CONSTRAINT magic_link_tokens_pkey PRIMARY KEY (id);


--
-- Name: magic_link_tokens magic_link_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_link_tokens
    ADD CONSTRAINT magic_link_tokens_token_key UNIQUE (token);


--
-- Name: meeting_follow_up_drafts meeting_follow_up_drafts_approval_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_follow_up_drafts
    ADD CONSTRAINT meeting_follow_up_drafts_approval_token_key UNIQUE (approval_token);


--
-- Name: meeting_follow_up_drafts meeting_follow_up_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_follow_up_drafts
    ADD CONSTRAINT meeting_follow_up_drafts_pkey PRIMARY KEY (id);


--
-- Name: meeting_reminders meeting_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_reminders
    ADD CONSTRAINT meeting_reminders_pkey PRIMARY KEY (id);


--
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);


--
-- Name: memory_snapshots memory_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_snapshots
    ADD CONSTRAINT memory_snapshots_pkey PRIMARY KEY (id);


--
-- Name: message_outbox message_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_outbox
    ADD CONSTRAINT message_outbox_pkey PRIMARY KEY (id);


--
-- Name: messaging_templates messaging_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_templates
    ADD CONSTRAINT messaging_templates_pkey PRIMARY KEY (id);


--
-- Name: messaging_templates messaging_templates_workspace_id_template_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_templates
    ADD CONSTRAINT messaging_templates_workspace_id_template_name_key UNIQUE (workspace_id, template_name);


--
-- Name: n8n_campaign_executions n8n_campaign_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.n8n_campaign_executions
    ADD CONSTRAINT n8n_campaign_executions_pkey PRIMARY KEY (id);


--
-- Name: oauth_states oauth_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_states oauth_states_state_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_state_key UNIQUE (state);


--
-- Name: organizations organizations_clerk_org_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_clerk_org_id_key UNIQUE (clerk_org_id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);


--
-- Name: pii_access_log pii_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pii_access_log
    ADD CONSTRAINT pii_access_log_pkey PRIMARY KEY (id);


--
-- Name: prospect_approval_data prospect_approval_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_data
    ADD CONSTRAINT prospect_approval_data_pkey PRIMARY KEY (id);


--
-- Name: prospect_approval_data prospect_approval_data_session_id_prospect_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_data
    ADD CONSTRAINT prospect_approval_data_session_id_prospect_id_key UNIQUE (session_id, prospect_id);


--
-- Name: prospect_approval_decisions prospect_approval_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_decisions
    ADD CONSTRAINT prospect_approval_decisions_pkey PRIMARY KEY (id);


--
-- Name: prospect_approval_decisions prospect_approval_decisions_session_id_prospect_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_decisions
    ADD CONSTRAINT prospect_approval_decisions_session_id_prospect_id_key UNIQUE (session_id, prospect_id);


--
-- Name: prospect_approval_sessions prospect_approval_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_sessions
    ADD CONSTRAINT prospect_approval_sessions_pkey PRIMARY KEY (id);


--
-- Name: prospect_approval_sessions prospect_approval_sessions_user_id_workspace_id_batch_numbe_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_sessions
    ADD CONSTRAINT prospect_approval_sessions_user_id_workspace_id_batch_numbe_key UNIQUE (user_id, workspace_id, batch_number);


--
-- Name: prospect_exports prospect_exports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_exports
    ADD CONSTRAINT prospect_exports_pkey PRIMARY KEY (id);


--
-- Name: prospect_learning_logs prospect_learning_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_learning_logs
    ADD CONSTRAINT prospect_learning_logs_pkey PRIMARY KEY (id);


--
-- Name: prospect_search_jobs prospect_search_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_search_jobs
    ADD CONSTRAINT prospect_search_jobs_pkey PRIMARY KEY (id);


--
-- Name: prospect_search_results prospect_search_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_search_results
    ADD CONSTRAINT prospect_search_results_pkey PRIMARY KEY (id);


--
-- Name: qa_autofix_logs qa_autofix_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_autofix_logs
    ADD CONSTRAINT qa_autofix_logs_pkey PRIMARY KEY (id);


--
-- Name: reply_agent_drafts reply_agent_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_agent_drafts
    ADD CONSTRAINT reply_agent_drafts_pkey PRIMARY KEY (id);


--
-- Name: reply_agent_metrics reply_agent_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_agent_metrics
    ADD CONSTRAINT reply_agent_metrics_pkey PRIMARY KEY (id);


--
-- Name: reply_agent_metrics reply_agent_metrics_workspace_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_agent_metrics
    ADD CONSTRAINT reply_agent_metrics_workspace_id_date_key UNIQUE (workspace_id, date);


--
-- Name: reply_agent_settings reply_agent_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_agent_settings
    ADD CONSTRAINT reply_agent_settings_pkey PRIMARY KEY (id);


--
-- Name: reply_agent_settings reply_agent_settings_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_agent_settings
    ADD CONSTRAINT reply_agent_settings_workspace_id_key UNIQUE (workspace_id);


--
-- Name: reply_feedback_reasons reply_feedback_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_feedback_reasons
    ADD CONSTRAINT reply_feedback_reasons_pkey PRIMARY KEY (id);


--
-- Name: sam_conversation_attachments sam_conversation_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_attachments
    ADD CONSTRAINT sam_conversation_attachments_pkey PRIMARY KEY (id);


--
-- Name: sam_conversation_messages sam_conversation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_messages
    ADD CONSTRAINT sam_conversation_messages_pkey PRIMARY KEY (id);


--
-- Name: sam_conversation_threads sam_conversation_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_threads
    ADD CONSTRAINT sam_conversation_threads_pkey PRIMARY KEY (id);


--
-- Name: sam_funnel_analytics sam_funnel_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_analytics
    ADD CONSTRAINT sam_funnel_analytics_pkey PRIMARY KEY (id);


--
-- Name: sam_funnel_executions sam_funnel_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_executions
    ADD CONSTRAINT sam_funnel_executions_pkey PRIMARY KEY (id);


--
-- Name: sam_funnel_messages sam_funnel_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_messages
    ADD CONSTRAINT sam_funnel_messages_pkey PRIMARY KEY (id);


--
-- Name: sam_funnel_responses sam_funnel_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_responses
    ADD CONSTRAINT sam_funnel_responses_pkey PRIMARY KEY (id);


--
-- Name: sam_funnel_template_performance sam_funnel_template_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_template_performance
    ADD CONSTRAINT sam_funnel_template_performance_pkey PRIMARY KEY (id);


--
-- Name: sam_funnel_template_performance sam_funnel_template_performance_template_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_template_performance
    ADD CONSTRAINT sam_funnel_template_performance_template_id_key UNIQUE (template_id);


--
-- Name: sam_icp_discovery_sessions sam_icp_discovery_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_icp_discovery_sessions
    ADD CONSTRAINT sam_icp_discovery_sessions_pkey PRIMARY KEY (id);


--
-- Name: sam_icp_knowledge_entries sam_icp_knowledge_entries_discovery_session_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_icp_knowledge_entries
    ADD CONSTRAINT sam_icp_knowledge_entries_discovery_session_id_question_id_key UNIQUE (discovery_session_id, question_id);


--
-- Name: sam_icp_knowledge_entries sam_icp_knowledge_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_icp_knowledge_entries
    ADD CONSTRAINT sam_icp_knowledge_entries_pkey PRIMARY KEY (id);


--
-- Name: sam_knowledge_summaries sam_knowledge_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_knowledge_summaries
    ADD CONSTRAINT sam_knowledge_summaries_pkey PRIMARY KEY (id);


--
-- Name: sam_learning_models sam_learning_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_learning_models
    ADD CONSTRAINT sam_learning_models_pkey PRIMARY KEY (id);


--
-- Name: sam_learning_models sam_learning_models_user_id_workspace_id_model_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_learning_models
    ADD CONSTRAINT sam_learning_models_user_id_workspace_id_model_type_key UNIQUE (user_id, workspace_id, model_type);


--
-- Name: send_queue send_queue_campaign_prospect_message_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.send_queue
    ADD CONSTRAINT send_queue_campaign_prospect_message_unique UNIQUE (campaign_id, prospect_id, message_type);


--
-- Name: send_queue send_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.send_queue
    ADD CONSTRAINT send_queue_pkey PRIMARY KEY (id);


--
-- Name: slack_app_config slack_app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_app_config
    ADD CONSTRAINT slack_app_config_pkey PRIMARY KEY (id);


--
-- Name: slack_app_config slack_app_config_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_app_config
    ADD CONSTRAINT slack_app_config_workspace_id_key UNIQUE (workspace_id);


--
-- Name: slack_channels slack_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_channels
    ADD CONSTRAINT slack_channels_pkey PRIMARY KEY (id);


--
-- Name: slack_channels slack_channels_workspace_id_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_channels
    ADD CONSTRAINT slack_channels_workspace_id_channel_id_key UNIQUE (workspace_id, channel_id);


--
-- Name: slack_messages slack_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_messages
    ADD CONSTRAINT slack_messages_pkey PRIMARY KEY (id);


--
-- Name: slack_messages slack_messages_workspace_id_message_ts_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_messages
    ADD CONSTRAINT slack_messages_workspace_id_message_ts_key UNIQUE (workspace_id, message_ts);


--
-- Name: slack_pending_actions slack_pending_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_pending_actions
    ADD CONSTRAINT slack_pending_actions_pkey PRIMARY KEY (id);


--
-- Name: slack_pending_installations slack_pending_installations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_pending_installations
    ADD CONSTRAINT slack_pending_installations_pkey PRIMARY KEY (id);


--
-- Name: slack_pending_installations slack_pending_installations_slack_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_pending_installations
    ADD CONSTRAINT slack_pending_installations_slack_team_id_key UNIQUE (slack_team_id);


--
-- Name: slack_user_mapping slack_user_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_user_mapping
    ADD CONSTRAINT slack_user_mapping_pkey PRIMARY KEY (id);


--
-- Name: slack_user_mapping slack_user_mapping_workspace_id_slack_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_user_mapping
    ADD CONSTRAINT slack_user_mapping_workspace_id_slack_user_id_key UNIQUE (workspace_id, slack_user_id);


--
-- Name: system_alerts system_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_alerts
    ADD CONSTRAINT system_alerts_pkey PRIMARY KEY (id);


--
-- Name: system_health_checks system_health_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_health_checks
    ADD CONSTRAINT system_health_checks_pkey PRIMARY KEY (id);


--
-- Name: system_health_logs system_health_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_health_logs
    ADD CONSTRAINT system_health_logs_pkey PRIMARY KEY (id);


--
-- Name: template_components template_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_components
    ADD CONSTRAINT template_components_pkey PRIMARY KEY (id);


--
-- Name: template_performance template_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_performance
    ADD CONSTRAINT template_performance_pkey PRIMARY KEY (id);


--
-- Name: tracked_links tracked_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracked_links
    ADD CONSTRAINT tracked_links_pkey PRIMARY KEY (id);


--
-- Name: tracked_links tracked_links_short_code_idx; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracked_links
    ADD CONSTRAINT tracked_links_short_code_idx UNIQUE (short_code);


--
-- Name: workspaces unique_client_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT unique_client_code UNIQUE (client_code);


--
-- Name: linkedin_post_comments unique_comment_per_post; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_post_comments
    ADD CONSTRAINT unique_comment_per_post UNIQUE (post_id);


--
-- Name: linkedin_self_post_comment_replies unique_monitor_comment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_self_post_comment_replies
    ADD CONSTRAINT unique_monitor_comment UNIQUE (monitor_id, comment_linkedin_id);


--
-- Name: linkedin_self_post_monitors unique_workspace_post; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_self_post_monitors
    ADD CONSTRAINT unique_workspace_post UNIQUE (workspace_id, post_url);


--
-- Name: workspace_schedule_settings unique_workspace_schedule; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_schedule_settings
    ADD CONSTRAINT unique_workspace_schedule UNIQUE (workspace_id);


--
-- Name: user_memory_preferences user_memory_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memory_preferences
    ADD CONSTRAINT user_memory_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_memory_preferences user_memory_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memory_preferences
    ADD CONSTRAINT user_memory_preferences_user_id_key UNIQUE (user_id);


--
-- Name: user_organizations user_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_pkey PRIMARY KEY (id);


--
-- Name: user_organizations user_organizations_user_id_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_user_id_organization_id_key UNIQUE (user_id, organization_id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_unipile_accounts user_unipile_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_unipile_accounts
    ADD CONSTRAINT user_unipile_accounts_pkey PRIMARY KEY (id);


--
-- Name: user_unipile_accounts user_unipile_accounts_unipile_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_unipile_accounts
    ADD CONSTRAINT user_unipile_accounts_unipile_account_id_key UNIQUE (unipile_account_id);


--
-- Name: CONSTRAINT user_unipile_accounts_unipile_account_id_key ON user_unipile_accounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT user_unipile_accounts_unipile_account_id_key ON public.user_unipile_accounts IS 'CRITICAL: One account can only belong to ONE workspace. No exceptions.';


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webhook_error_logs webhook_error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_error_logs
    ADD CONSTRAINT webhook_error_logs_pkey PRIMARY KEY (id);


--
-- Name: website_analysis_queue website_analysis_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_analysis_queue
    ADD CONSTRAINT website_analysis_queue_pkey PRIMARY KEY (id);


--
-- Name: website_analysis_results website_analysis_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_analysis_results
    ADD CONSTRAINT website_analysis_results_pkey PRIMARY KEY (id);


--
-- Name: website_requests website_requests_access_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_requests
    ADD CONSTRAINT website_requests_access_token_key UNIQUE (access_token);


--
-- Name: website_requests website_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_requests
    ADD CONSTRAINT website_requests_pkey PRIMARY KEY (id);


--
-- Name: workflow_deployment_history workflow_deployment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_deployment_history
    ADD CONSTRAINT workflow_deployment_history_pkey PRIMARY KEY (id);


--
-- Name: workflow_templates workflow_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_pkey PRIMARY KEY (id);


--
-- Name: workflow_templates workflow_templates_template_name_template_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_template_name_template_version_key UNIQUE (template_name, template_version);


--
-- Name: workspace_account_limits workspace_account_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_account_limits
    ADD CONSTRAINT workspace_account_limits_pkey PRIMARY KEY (id);


--
-- Name: workspace_account_limits workspace_account_limits_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_account_limits
    ADD CONSTRAINT workspace_account_limits_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspace_accounts workspace_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_accounts
    ADD CONSTRAINT workspace_accounts_pkey PRIMARY KEY (id);


--
-- Name: workspace_accounts workspace_accounts_unipile_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_accounts
    ADD CONSTRAINT workspace_accounts_unipile_account_id_key UNIQUE (unipile_account_id);


--
-- Name: CONSTRAINT workspace_accounts_unipile_account_id_key ON workspace_accounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT workspace_accounts_unipile_account_id_key ON public.workspace_accounts IS 'CRITICAL: One account can only belong to ONE workspace. No exceptions.';


--
-- Name: workspace_accounts workspace_accounts_unique_account_per_workspace; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_accounts
    ADD CONSTRAINT workspace_accounts_unique_account_per_workspace UNIQUE (workspace_id, user_id, account_type, account_identifier);


--
-- Name: CONSTRAINT workspace_accounts_unique_account_per_workspace ON workspace_accounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT workspace_accounts_unique_account_per_workspace ON public.workspace_accounts IS 'Ensures one unique account per workspace, user, account 
  type, and identifier combination.
  Required by associate_account_atomic RPC for ON CONFLICT 
  upsert operations.';


--
-- Name: workspace_accounts workspace_accounts_workspace_id_account_type_account_identi_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_accounts
    ADD CONSTRAINT workspace_accounts_workspace_id_account_type_account_identi_key UNIQUE (workspace_id, account_type, account_identifier);


--
-- Name: workspace_ai_search_config workspace_ai_search_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_ai_search_config
    ADD CONSTRAINT workspace_ai_search_config_pkey PRIMARY KEY (id);


--
-- Name: workspace_ai_search_config workspace_ai_search_config_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_ai_search_config
    ADD CONSTRAINT workspace_ai_search_config_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspace_analytics_reports workspace_analytics_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_analytics_reports
    ADD CONSTRAINT workspace_analytics_reports_pkey PRIMARY KEY (id);


--
-- Name: workspace_blacklists workspace_blacklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_blacklists
    ADD CONSTRAINT workspace_blacklists_pkey PRIMARY KEY (id);


--
-- Name: workspace_dpa_agreements workspace_dpa_agreements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_dpa_agreements
    ADD CONSTRAINT workspace_dpa_agreements_pkey PRIMARY KEY (id);


--
-- Name: workspace_dpa_agreements workspace_dpa_agreements_workspace_id_dpa_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_dpa_agreements
    ADD CONSTRAINT workspace_dpa_agreements_workspace_id_dpa_version_key UNIQUE (workspace_id, dpa_version);


--
-- Name: workspace_dpa_requirements workspace_dpa_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_dpa_requirements
    ADD CONSTRAINT workspace_dpa_requirements_pkey PRIMARY KEY (id);


--
-- Name: workspace_dpa_requirements workspace_dpa_requirements_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_dpa_requirements
    ADD CONSTRAINT workspace_dpa_requirements_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspace_encryption_keys workspace_encryption_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_encryption_keys
    ADD CONSTRAINT workspace_encryption_keys_pkey PRIMARY KEY (id);


--
-- Name: workspace_encryption_keys workspace_encryption_keys_workspace_id_is_active_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_encryption_keys
    ADD CONSTRAINT workspace_encryption_keys_workspace_id_is_active_key UNIQUE (workspace_id, is_active);


--
-- Name: workspace_icp workspace_icp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_icp
    ADD CONSTRAINT workspace_icp_pkey PRIMARY KEY (id);


--
-- Name: workspace_inbox_agent_config workspace_inbox_agent_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_inbox_agent_config
    ADD CONSTRAINT workspace_inbox_agent_config_pkey PRIMARY KEY (id);


--
-- Name: workspace_inbox_agent_config workspace_inbox_agent_config_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_inbox_agent_config
    ADD CONSTRAINT workspace_inbox_agent_config_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspace_integrations workspace_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_integrations
    ADD CONSTRAINT workspace_integrations_pkey PRIMARY KEY (id);


--
-- Name: workspace_integrations workspace_integrations_workspace_id_integration_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_integrations
    ADD CONSTRAINT workspace_integrations_workspace_id_integration_type_key UNIQUE (workspace_id, integration_type);


--
-- Name: workspace_invitations workspace_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_pkey PRIMARY KEY (id);


--
-- Name: workspace_invitations workspace_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_token_key UNIQUE (token);


--
-- Name: workspace_invoices workspace_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invoices
    ADD CONSTRAINT workspace_invoices_pkey PRIMARY KEY (id);


--
-- Name: workspace_invoices workspace_invoices_workspace_id_billing_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invoices
    ADD CONSTRAINT workspace_invoices_workspace_id_billing_period_start_key UNIQUE (workspace_id, billing_period_start);


--
-- Name: workspace_meeting_agent_config workspace_meeting_agent_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_meeting_agent_config
    ADD CONSTRAINT workspace_meeting_agent_config_pkey PRIMARY KEY (id);


--
-- Name: workspace_meeting_agent_config workspace_meeting_agent_config_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_meeting_agent_config
    ADD CONSTRAINT workspace_meeting_agent_config_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_workspace_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);


--
-- Name: workspace_n8n_workflows workspace_n8n_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_n8n_workflows
    ADD CONSTRAINT workspace_n8n_workflows_pkey PRIMARY KEY (id);


--
-- Name: workspace_n8n_workflows workspace_n8n_workflows_workspace_id_deployment_status_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_n8n_workflows
    ADD CONSTRAINT workspace_n8n_workflows_workspace_id_deployment_status_key UNIQUE (workspace_id, deployment_status) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: workspace_prospects workspace_prospects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_prospects
    ADD CONSTRAINT workspace_prospects_pkey PRIMARY KEY (id);


--
-- Name: workspace_reply_agent_config workspace_reply_agent_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_reply_agent_config
    ADD CONSTRAINT workspace_reply_agent_config_pkey PRIMARY KEY (id);


--
-- Name: workspace_reply_agent_config workspace_reply_agent_config_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_reply_agent_config
    ADD CONSTRAINT workspace_reply_agent_config_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspace_schedule_settings workspace_schedule_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_schedule_settings
    ADD CONSTRAINT workspace_schedule_settings_pkey PRIMARY KEY (id);


--
-- Name: workspace_searched_prospects workspace_searched_prospects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_searched_prospects
    ADD CONSTRAINT workspace_searched_prospects_pkey PRIMARY KEY (id);


--
-- Name: workspace_searched_prospects workspace_searched_prospects_workspace_id_linkedin_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_searched_prospects
    ADD CONSTRAINT workspace_searched_prospects_workspace_id_linkedin_url_key UNIQUE (workspace_id, linkedin_url);


--
-- Name: workspace_stripe_customers workspace_stripe_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_stripe_customers
    ADD CONSTRAINT workspace_stripe_customers_pkey PRIMARY KEY (id);


--
-- Name: workspace_stripe_customers workspace_stripe_customers_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_stripe_customers
    ADD CONSTRAINT workspace_stripe_customers_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: workspace_stripe_customers workspace_stripe_customers_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_stripe_customers
    ADD CONSTRAINT workspace_stripe_customers_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspace_subscriptions workspace_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_subscriptions
    ADD CONSTRAINT workspace_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: workspace_subscriptions workspace_subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_subscriptions
    ADD CONSTRAINT workspace_subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: workspace_subscriptions workspace_subscriptions_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_subscriptions
    ADD CONSTRAINT workspace_subscriptions_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspace_tiers workspace_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_tiers
    ADD CONSTRAINT workspace_tiers_pkey PRIMARY KEY (id);


--
-- Name: workspace_tiers workspace_tiers_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_tiers
    ADD CONSTRAINT workspace_tiers_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspace_usage workspace_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_usage
    ADD CONSTRAINT workspace_usage_pkey PRIMARY KEY (id);


--
-- Name: workspace_workflow_credentials workspace_workflow_credential_workspace_id_credential_type__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_workflow_credentials
    ADD CONSTRAINT workspace_workflow_credential_workspace_id_credential_type__key UNIQUE (workspace_id, credential_type, credential_name);


--
-- Name: workspace_workflow_credentials workspace_workflow_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_workflow_credentials
    ADD CONSTRAINT workspace_workflow_credentials_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_slug_key UNIQUE (slug);


--
-- Name: idx_adaptation_logs_definition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adaptation_logs_definition ON public.funnel_adaptation_logs USING btree (definition_id);


--
-- Name: idx_adaptation_logs_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adaptation_logs_execution ON public.funnel_adaptation_logs USING btree (execution_id);


--
-- Name: idx_adaptation_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adaptation_logs_timestamp ON public.funnel_adaptation_logs USING btree ("timestamp");


--
-- Name: idx_alerts_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_created ON public.system_alerts USING btree (created_at);


--
-- Name: idx_alerts_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_resolved ON public.system_alerts USING btree (resolved);


--
-- Name: idx_alerts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_type ON public.system_alerts USING btree (alert_type);


--
-- Name: idx_analytics_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_period ON public.workspace_analytics_reports USING btree (period_start DESC);


--
-- Name: idx_analytics_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_workspace ON public.workspace_analytics_reports USING btree (workspace_id);


--
-- Name: idx_api_keys_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_is_active ON public.api_keys USING btree (is_active);


--
-- Name: idx_api_keys_key_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_key_hash ON public.api_keys USING btree (key_hash);


--
-- Name: idx_api_keys_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_workspace_id ON public.api_keys USING btree (workspace_id);


--
-- Name: idx_attachments_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_message ON public.sam_conversation_attachments USING btree (message_id);


--
-- Name: idx_attachments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_status ON public.sam_conversation_attachments USING btree (processing_status);


--
-- Name: idx_attachments_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_thread ON public.sam_conversation_attachments USING btree (thread_id);


--
-- Name: idx_attachments_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_type ON public.sam_conversation_attachments USING btree (attachment_type);


--
-- Name: idx_attachments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_user ON public.sam_conversation_attachments USING btree (user_id);


--
-- Name: idx_attachments_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_workspace ON public.sam_conversation_attachments USING btree (workspace_id);


--
-- Name: idx_author_relationships_last_interaction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_author_relationships_last_interaction ON public.linkedin_author_relationships USING btree (workspace_id, last_interaction_at DESC);


--
-- Name: idx_author_relationships_strength; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_author_relationships_strength ON public.linkedin_author_relationships USING btree (workspace_id, relationship_strength);


--
-- Name: idx_author_relationships_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_author_relationships_workspace ON public.linkedin_author_relationships USING btree (workspace_id);


--
-- Name: idx_brand_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_workspace ON public.linkedin_brand_guidelines USING btree (workspace_id);


--
-- Name: idx_campaign_messages_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_messages_campaign ON public.campaign_messages USING btree (campaign_id);


--
-- Name: idx_campaign_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_messages_conversation ON public.campaign_messages USING btree (conversation_id) WHERE (conversation_id IS NOT NULL);


--
-- Name: idx_campaign_messages_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_messages_sent_at ON public.campaign_messages USING btree (sent_at);


--
-- Name: idx_campaign_messages_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_messages_workspace ON public.campaign_messages USING btree (workspace_id);


--
-- Name: idx_campaign_optimizations_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_optimizations_campaign ON public.campaign_optimizations USING btree (campaign_id);


--
-- Name: idx_campaign_prospects_ab_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_ab_variant ON public.campaign_prospects USING btree (campaign_id, ab_variant) WHERE (ab_variant IS NOT NULL);


--
-- Name: idx_campaign_prospects_account_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_account_status ON public.campaign_prospects USING btree (unipile_account_id, status) WHERE (status ~~ 'rate_limited%'::text);


--
-- Name: idx_campaign_prospects_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_added_by ON public.campaign_prospects USING btree (added_by);


--
-- Name: idx_campaign_prospects_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_campaign_id ON public.campaign_prospects USING btree (campaign_id);


--
-- Name: idx_campaign_prospects_campaign_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_campaign_status ON public.campaign_prospects USING btree (campaign_id, status);


--
-- Name: idx_campaign_prospects_company_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_company_normalized ON public.campaign_prospects USING btree (company_name_normalized);


--
-- Name: idx_campaign_prospects_connection_degree; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_connection_degree ON public.campaign_prospects USING btree (connection_degree) WHERE (connection_degree IS NOT NULL);


--
-- Name: idx_campaign_prospects_contacted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_contacted_at ON public.campaign_prospects USING btree (contacted_at);


--
-- Name: idx_campaign_prospects_follow_up_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_follow_up_due ON public.campaign_prospects USING btree (status, follow_up_due_at) WHERE (status = 'connected'::text);


--
-- Name: idx_campaign_prospects_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_master ON public.campaign_prospects USING btree (master_prospect_id) WHERE (master_prospect_id IS NOT NULL);


--
-- Name: idx_campaign_prospects_ready_to_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_ready_to_contact ON public.campaign_prospects USING btree (campaign_id) WHERE ((contacted_at IS NULL) AND (status = ANY (ARRAY['pending'::text, 'approved'::text, 'ready_to_message'::text])));


--
-- Name: idx_campaign_prospects_scheduled_send; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_scheduled_send ON public.campaign_prospects USING btree (scheduled_send_at, status) WHERE ((scheduled_send_at IS NOT NULL) AND (status = 'queued'::text));


--
-- Name: idx_campaign_prospects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_status ON public.campaign_prospects USING btree (status);


--
-- Name: idx_campaign_prospects_unipile_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_unipile_account ON public.campaign_prospects USING btree (added_by_unipile_account);


--
-- Name: idx_campaign_prospects_unique_active_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_campaign_prospects_unique_active_prospect ON public.campaign_prospects USING btree (workspace_id, linkedin_url_hash) WHERE ((linkedin_url_hash IS NOT NULL) AND (linkedin_url_hash <> ''::text) AND (status <> ALL (ARRAY['completed'::text, 'failed'::text, 'withdrawn'::text, 'connection_failed'::text, 'not_found'::text])));


--
-- Name: idx_campaign_prospects_validation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_validation ON public.campaign_prospects USING btree (validation_status, status) WHERE ((validation_status)::text <> 'valid'::text);


--
-- Name: idx_campaign_prospects_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_prospects_workspace_id ON public.campaign_prospects USING btree (workspace_id);


--
-- Name: idx_campaign_replies_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_replies_campaign ON public.campaign_replies USING btree (campaign_id);


--
-- Name: idx_campaign_replies_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_replies_conversation ON public.campaign_replies USING btree (conversation_id) WHERE (conversation_id IS NOT NULL);


--
-- Name: idx_campaign_replies_email_response; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_replies_email_response ON public.campaign_replies USING btree (email_response_id);


--
-- Name: idx_campaign_replies_feedback; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_replies_feedback ON public.campaign_replies USING btree (feedback);


--
-- Name: idx_campaign_replies_intent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_replies_intent ON public.campaign_replies USING btree (intent);


--
-- Name: idx_campaign_replies_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_replies_priority ON public.campaign_replies USING btree (priority, received_at DESC) WHERE (requires_review = true);


--
-- Name: idx_campaign_replies_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_replies_prospect ON public.campaign_replies USING btree (prospect_id);


--
-- Name: idx_campaign_replies_received_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_replies_received_at ON public.campaign_replies USING btree (received_at DESC);


--
-- Name: idx_campaign_replies_reviewed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_replies_reviewed_by ON public.campaign_replies USING btree (reviewed_by);


--
-- Name: idx_campaign_replies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_replies_status ON public.campaign_replies USING btree (status);


--
-- Name: idx_campaign_replies_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_replies_unprocessed ON public.campaign_replies USING btree (workspace_id, is_processed) WHERE (is_processed = false);


--
-- Name: idx_campaign_replies_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_replies_workspace ON public.campaign_replies USING btree (workspace_id);


--
-- Name: idx_campaign_schedules_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_schedules_campaign_id ON public.campaign_schedules USING btree (campaign_id);


--
-- Name: idx_campaign_schedules_start_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_schedules_start_time ON public.campaign_schedules USING btree (scheduled_start_time);


--
-- Name: idx_campaign_schedules_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_schedules_status ON public.campaign_schedules USING btree (schedule_status);


--
-- Name: idx_campaign_schedules_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_schedules_workspace_id ON public.campaign_schedules USING btree (workspace_id);


--
-- Name: idx_campaign_settings_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_settings_campaign ON public.campaign_settings USING btree (campaign_id) WHERE (campaign_id IS NOT NULL);


--
-- Name: idx_campaign_settings_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_settings_user ON public.campaign_settings USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_campaign_settings_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_settings_workspace ON public.campaign_settings USING btree (workspace_id);


--
-- Name: idx_campaigns_campaign_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_campaign_name ON public.campaigns USING btree (campaign_name);


--
-- Name: idx_campaigns_execution_preferences; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_execution_preferences ON public.campaigns USING gin (execution_preferences);


--
-- Name: idx_campaigns_launched_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_launched_at ON public.campaigns USING btree (launched_at) WHERE (launched_at IS NOT NULL);


--
-- Name: idx_campaigns_linkedin_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_linkedin_account ON public.campaigns USING btree (linkedin_account_id);


--
-- Name: idx_campaigns_metadata_ab_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_metadata_ab_test ON public.campaigns USING gin (((metadata -> 'ab_test_group'::text)));


--
-- Name: idx_campaigns_reachinbox_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_reachinbox_id ON public.campaigns USING btree (reachinbox_campaign_id) WHERE (reachinbox_campaign_id IS NOT NULL);


--
-- Name: idx_campaigns_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_scheduled ON public.campaigns USING btree (next_execution_time) WHERE ((status = 'scheduled'::text) AND (next_execution_time IS NOT NULL));


--
-- Name: idx_campaigns_send_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_send_schedule ON public.campaigns USING gin (send_schedule);


--
-- Name: idx_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);


--
-- Name: idx_campaigns_status_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_status_workspace ON public.campaigns USING btree (status, workspace_id);


--
-- Name: idx_campaigns_target_criteria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_target_criteria ON public.campaigns USING gin (target_criteria);


--
-- Name: idx_campaigns_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_template_id ON public.campaigns USING btree (template_id);


--
-- Name: idx_campaigns_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_type ON public.campaigns USING btree (type);


--
-- Name: idx_campaigns_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_workspace_id ON public.campaigns USING btree (workspace_id);


--
-- Name: idx_ci_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_embedding ON public.competitive_intelligence USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='10');


--
-- Name: idx_cip_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cip_embedding ON public.customer_insight_patterns USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='10');


--
-- Name: idx_comment_performance_stats_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_performance_stats_workspace ON public.linkedin_comment_performance_stats USING btree (workspace_id, period_start DESC);


--
-- Name: idx_comment_queue_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_queue_approval ON public.linkedin_comment_queue USING btree (approval_status);


--
-- Name: idx_comment_queue_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_queue_created ON public.linkedin_comment_queue USING btree (created_at DESC);


--
-- Name: idx_comment_queue_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_queue_post ON public.linkedin_comment_queue USING btree (post_id);


--
-- Name: idx_comment_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_queue_status ON public.linkedin_comment_queue USING btree (status);


--
-- Name: idx_comment_queue_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_queue_workspace ON public.linkedin_comment_queue USING btree (workspace_id);


--
-- Name: idx_comments_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_expires_at ON public.linkedin_post_comments USING btree (workspace_id, expires_at) WHERE (((status)::text = ANY ((ARRAY['pending_approval'::character varying, 'scheduled'::character varying])::text[])) AND (expires_at IS NOT NULL));


--
-- Name: idx_comments_is_reply; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_is_reply ON public.linkedin_post_comments USING btree (workspace_id, is_reply_to_comment) WHERE (is_reply_to_comment = true);


--
-- Name: idx_comments_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_performance ON public.linkedin_post_comments USING btree (workspace_id, performance_score DESC) WHERE ((status)::text = 'posted'::text);


--
-- Name: idx_comments_posted_comment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_posted_comment_id ON public.linkedin_comments_posted USING btree (comment_id);


--
-- Name: idx_comments_posted_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_posted_post ON public.linkedin_comments_posted USING btree (post_id);


--
-- Name: idx_comments_posted_posted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_posted_posted_at ON public.linkedin_comments_posted USING btree (posted_at DESC);


--
-- Name: idx_comments_posted_user_replied; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_posted_user_replied ON public.linkedin_comments_posted USING btree (user_replied);


--
-- Name: idx_comments_posted_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_posted_workspace ON public.linkedin_comments_posted USING btree (workspace_id);


--
-- Name: idx_conv_analytics_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_analytics_created ON public.conversation_analytics USING btree (created_at);


--
-- Name: idx_conv_analytics_industry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_analytics_industry ON public.conversation_analytics USING btree (industry);


--
-- Name: idx_conv_analytics_persona; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_analytics_persona ON public.conversation_analytics USING btree (persona_used);


--
-- Name: idx_conv_analytics_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_analytics_thread ON public.conversation_analytics USING btree (thread_id);


--
-- Name: idx_conv_analytics_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_analytics_user ON public.conversation_analytics USING btree (user_id);


--
-- Name: idx_conv_analytics_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_analytics_workspace ON public.conversation_analytics USING btree (workspace_id);


--
-- Name: idx_core_executions_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_core_executions_campaign ON public.core_funnel_executions USING btree (campaign_id);


--
-- Name: idx_core_executions_n8n; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_core_executions_n8n ON public.core_funnel_executions USING btree (n8n_execution_id);


--
-- Name: idx_core_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_core_executions_status ON public.core_funnel_executions USING btree (status);


--
-- Name: idx_core_executions_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_core_executions_template ON public.core_funnel_executions USING btree (template_id);


--
-- Name: idx_core_funnel_executions_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_core_funnel_executions_workspace_id ON public.core_funnel_executions USING btree (workspace_id);


--
-- Name: idx_core_funnel_templates_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_core_funnel_templates_workspace_id ON public.core_funnel_templates USING btree (workspace_id);


--
-- Name: idx_core_templates_funnel_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_core_templates_funnel_type ON public.core_funnel_templates USING btree (funnel_type);


--
-- Name: idx_core_templates_industry_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_core_templates_industry_role ON public.core_funnel_templates USING btree (industry, target_role);


--
-- Name: idx_core_templates_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_core_templates_performance ON public.core_funnel_templates USING btree (avg_response_rate DESC, avg_conversion_rate DESC);


--
-- Name: idx_crm_conflict_resolutions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_conflict_resolutions_created ON public.crm_conflict_resolutions USING btree (created_at DESC);


--
-- Name: idx_crm_conflict_resolutions_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_conflict_resolutions_entity ON public.crm_conflict_resolutions USING btree (entity_type, entity_id);


--
-- Name: idx_crm_conflict_resolutions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_conflict_resolutions_workspace ON public.crm_conflict_resolutions USING btree (workspace_id);


--
-- Name: idx_crm_connections_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_connections_status ON public.crm_connections USING btree (status);


--
-- Name: idx_crm_connections_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_connections_workspace ON public.crm_connections USING btree (workspace_id);


--
-- Name: idx_crm_contact_mappings_crm_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_contact_mappings_crm_contact ON public.crm_contact_mappings USING btree (workspace_id, crm_type, crm_contact_id);


--
-- Name: idx_crm_contact_mappings_sam_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_contact_mappings_sam_contact ON public.crm_contact_mappings USING btree (sam_contact_id);


--
-- Name: idx_crm_contact_mappings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_contact_mappings_status ON public.crm_contact_mappings USING btree (last_sync_status);


--
-- Name: idx_crm_contact_mappings_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_contact_mappings_workspace ON public.crm_contact_mappings USING btree (workspace_id);


--
-- Name: idx_crm_field_mappings_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_field_mappings_type ON public.crm_field_mappings USING btree (crm_type, field_type);


--
-- Name: idx_crm_field_mappings_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_field_mappings_workspace ON public.crm_field_mappings USING btree (workspace_id);


--
-- Name: idx_crm_sync_logs_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_sync_logs_connection ON public.crm_sync_logs USING btree (connection_id);


--
-- Name: idx_crm_sync_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_sync_logs_created ON public.crm_sync_logs USING btree (created_at DESC);


--
-- Name: idx_crm_sync_logs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_sync_logs_workspace ON public.crm_sync_logs USING btree (workspace_id);


--
-- Name: idx_decisions_session_decision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_decisions_session_decision ON public.prospect_approval_decisions USING btree (session_id, decision);


--
-- Name: INDEX idx_decisions_session_decision; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_decisions_session_decision IS 'Optimizes filtering prospects by approval status (approved/rejected/pending)';


--
-- Name: idx_deploy_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deploy_logs_created ON public.deployment_logs USING btree (created_at);


--
-- Name: idx_deploy_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deploy_logs_status ON public.deployment_logs USING btree (status);


--
-- Name: idx_deploy_logs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deploy_logs_type ON public.deployment_logs USING btree (deployment_type);


--
-- Name: idx_deployment_history_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deployment_history_created ON public.workflow_deployment_history USING btree (created_at);


--
-- Name: idx_deployment_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deployment_history_status ON public.workflow_deployment_history USING btree (status);


--
-- Name: idx_deployment_history_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deployment_history_workflow ON public.workflow_deployment_history USING btree (workspace_n8n_workflow_id);


--
-- Name: idx_deployment_history_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deployment_history_workspace ON public.workflow_deployment_history USING btree (workspace_id);


--
-- Name: idx_dpa_notifications_unacked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dpa_notifications_unacked ON public.dpa_update_notifications USING btree (workspace_id, acknowledged) WHERE (acknowledged = false);


--
-- Name: idx_dpa_sub_processors_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dpa_sub_processors_active ON public.dpa_sub_processors USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_dpa_versions_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dpa_versions_current ON public.dpa_versions USING btree (is_current) WHERE (is_current = true);


--
-- Name: idx_dynamic_definitions_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_definitions_campaign ON public.dynamic_funnel_definitions USING btree (campaign_id);


--
-- Name: idx_dynamic_definitions_n8n; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_definitions_n8n ON public.dynamic_funnel_definitions USING btree (n8n_workflow_id);


--
-- Name: idx_dynamic_definitions_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_definitions_performance ON public.dynamic_funnel_definitions USING btree (avg_performance_score DESC);


--
-- Name: idx_dynamic_executions_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_executions_campaign ON public.dynamic_funnel_executions USING btree (campaign_id);


--
-- Name: idx_dynamic_executions_funnel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_executions_funnel ON public.dynamic_funnel_executions USING btree (funnel_id);


--
-- Name: idx_dynamic_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_executions_status ON public.dynamic_funnel_executions USING btree (status);


--
-- Name: idx_dynamic_funnel_definitions_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_funnel_definitions_workspace_id ON public.dynamic_funnel_definitions USING btree (workspace_id);


--
-- Name: idx_dynamic_funnel_executions_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_funnel_executions_workspace_id ON public.dynamic_funnel_executions USING btree (workspace_id);


--
-- Name: idx_dynamic_funnel_steps_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_funnel_steps_workspace_id ON public.dynamic_funnel_steps USING btree (workspace_id);


--
-- Name: idx_dynamic_steps_funnel_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_steps_funnel_order ON public.dynamic_funnel_steps USING btree (funnel_id, step_order);


--
-- Name: idx_dynamic_steps_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dynamic_steps_type ON public.dynamic_funnel_steps USING btree (step_type);


--
-- Name: idx_email_prospects_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_prospects_campaign ON public.email_campaign_prospects USING btree (campaign_id);


--
-- Name: idx_email_prospects_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_prospects_email ON public.email_campaign_prospects USING btree (email);


--
-- Name: idx_email_prospects_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_prospects_workspace ON public.email_campaign_prospects USING btree (workspace_id);


--
-- Name: idx_email_providers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_providers_user_id ON public.email_providers USING btree (user_id);


--
-- Name: idx_email_responses_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_responses_campaign ON public.email_responses USING btree (campaign_id);


--
-- Name: idx_email_responses_from_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_responses_from_email ON public.email_responses USING btree (from_email);


--
-- Name: idx_email_responses_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_responses_message_id ON public.email_responses USING btree (message_id);


--
-- Name: idx_email_responses_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_responses_processed ON public.email_responses USING btree (processed) WHERE (processed = false);


--
-- Name: idx_email_responses_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_responses_prospect ON public.email_responses USING btree (prospect_id);


--
-- Name: idx_email_responses_received_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_responses_received_at ON public.email_responses USING btree (received_at DESC);


--
-- Name: idx_email_responses_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_responses_workspace ON public.email_responses USING btree (workspace_id);


--
-- Name: idx_email_send_queue_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_queue_campaign ON public.email_send_queue USING btree (campaign_id);


--
-- Name: idx_email_send_queue_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_queue_pending ON public.email_send_queue USING btree (scheduled_for) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_email_send_queue_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_queue_variant ON public.email_send_queue USING btree (campaign_id, variant) WHERE (variant IS NOT NULL);


--
-- Name: idx_enrichment_jobs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_jobs_created ON public.enrichment_jobs USING btree (created_at DESC);


--
-- Name: idx_enrichment_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_jobs_status ON public.enrichment_jobs USING btree (status);


--
-- Name: idx_enrichment_jobs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_jobs_user ON public.enrichment_jobs USING btree (user_id);


--
-- Name: idx_enrichment_jobs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_jobs_workspace ON public.enrichment_jobs USING btree (workspace_id);


--
-- Name: idx_execution_state_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_state_campaign ON public.campaign_prospect_execution_state USING btree (campaign_id);


--
-- Name: idx_execution_state_next_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_state_next_execution ON public.campaign_prospect_execution_state USING btree (next_execution_at) WHERE (status = ANY (ARRAY['pending'::text, 'waiting_trigger'::text]));


--
-- Name: idx_execution_state_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_state_status ON public.campaign_prospect_execution_state USING btree (status);


--
-- Name: idx_execution_state_trigger_check; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_state_trigger_check ON public.campaign_prospect_execution_state USING btree (next_check_at) WHERE (waiting_for_trigger IS NOT NULL);


--
-- Name: idx_fix_proposals_health_check; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fix_proposals_health_check ON public.agent_fix_proposals USING btree (health_check_id);


--
-- Name: idx_fix_proposals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fix_proposals_status ON public.agent_fix_proposals USING btree (status);


--
-- Name: idx_follow_up_drafts_approved_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_up_drafts_approved_scheduled ON public.follow_up_drafts USING btree (scheduled_for) WHERE ((status)::text = 'approved'::text);


--
-- Name: idx_follow_up_drafts_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_up_drafts_campaign ON public.follow_up_drafts USING btree (campaign_id);


--
-- Name: idx_follow_up_drafts_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_up_drafts_prospect ON public.follow_up_drafts USING btree (prospect_id);


--
-- Name: idx_follow_up_drafts_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_up_drafts_status_created ON public.follow_up_drafts USING btree (status, created_at);


--
-- Name: idx_follow_up_drafts_workspace_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follow_up_drafts_workspace_pending ON public.follow_up_drafts USING btree (workspace_id, status) WHERE ((status)::text = 'pending_approval'::text);


--
-- Name: idx_funnel_adaptation_logs_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funnel_adaptation_logs_workspace_id ON public.funnel_adaptation_logs USING btree (workspace_id);


--
-- Name: idx_funnel_performance_metrics_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funnel_performance_metrics_workspace_id ON public.funnel_performance_metrics USING btree (workspace_id);


--
-- Name: idx_funnel_step_logs_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funnel_step_logs_execution ON public.funnel_step_logs USING btree (execution_id);


--
-- Name: idx_funnel_step_logs_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funnel_step_logs_prospect ON public.funnel_step_logs USING btree (prospect_id);


--
-- Name: idx_funnel_step_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funnel_step_logs_timestamp ON public.funnel_step_logs USING btree ("timestamp");


--
-- Name: idx_funnel_step_logs_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funnel_step_logs_workspace_id ON public.funnel_step_logs USING btree (workspace_id);


--
-- Name: idx_gdpr_deletion_requests_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gdpr_deletion_requests_prospect ON public.gdpr_deletion_requests USING btree (prospect_id);


--
-- Name: idx_gdpr_deletion_requests_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gdpr_deletion_requests_scheduled ON public.gdpr_deletion_requests USING btree (scheduled_execution_date) WHERE (status = 'approved'::text);


--
-- Name: idx_gdpr_deletion_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gdpr_deletion_requests_status ON public.gdpr_deletion_requests USING btree (status);


--
-- Name: idx_gdpr_deletion_requests_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gdpr_deletion_requests_workspace ON public.gdpr_deletion_requests USING btree (workspace_id);


--
-- Name: idx_health_checks_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_health_checks_date ON public.system_health_checks USING btree (check_date DESC);


--
-- Name: idx_health_checks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_health_checks_status ON public.system_health_checks USING btree (overall_status);


--
-- Name: idx_health_logs_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_health_logs_component ON public.system_health_logs USING btree (component);


--
-- Name: idx_health_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_health_logs_created ON public.system_health_logs USING btree (created_at);


--
-- Name: idx_health_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_health_logs_status ON public.system_health_logs USING btree (status);


--
-- Name: idx_hitl_sessions_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hitl_sessions_assigned_to ON public.hitl_reply_approval_sessions USING btree (assigned_to_email);


--
-- Name: idx_hitl_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hitl_sessions_expires_at ON public.hitl_reply_approval_sessions USING btree (expires_at);


--
-- Name: idx_hitl_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hitl_sessions_status ON public.hitl_reply_approval_sessions USING btree (approval_status);


--
-- Name: idx_hitl_sessions_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hitl_sessions_workspace_id ON public.hitl_reply_approval_sessions USING btree (workspace_id);


--
-- Name: idx_inbox_message_categories_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbox_message_categories_workspace ON public.inbox_message_categories USING btree (workspace_id);


--
-- Name: idx_inbox_message_tags_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbox_message_tags_category ON public.inbox_message_tags USING btree (category_id);


--
-- Name: idx_inbox_message_tags_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbox_message_tags_created ON public.inbox_message_tags USING btree (created_at DESC);


--
-- Name: idx_inbox_message_tags_intent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbox_message_tags_intent ON public.inbox_message_tags USING btree (detected_intent);


--
-- Name: idx_inbox_message_tags_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbox_message_tags_workspace ON public.inbox_message_tags USING btree (workspace_id);


--
-- Name: idx_kb_competitors_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_competitors_active ON public.knowledge_base_competitors USING btree (workspace_id, is_active);


--
-- Name: idx_kb_competitors_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_competitors_name ON public.knowledge_base_competitors USING btree (name);


--
-- Name: idx_kb_competitors_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_competitors_workspace ON public.knowledge_base_competitors USING btree (workspace_id);


--
-- Name: idx_kb_content_workspace_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_content_workspace_section ON public.knowledge_base_content USING btree (workspace_id, section_id);


--
-- Name: idx_kb_docs_icp_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_docs_icp_id ON public.knowledge_base_documents USING btree (icp_id);


--
-- Name: idx_kb_docs_last_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_docs_last_used ON public.knowledge_base_documents USING btree (workspace_id, last_used_at DESC NULLS LAST);


--
-- Name: idx_kb_docs_usage_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_docs_usage_count ON public.knowledge_base_documents USING btree (workspace_id, usage_count DESC);


--
-- Name: idx_kb_docs_workspace_icp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_docs_workspace_icp ON public.knowledge_base_documents USING btree (workspace_id, icp_id);


--
-- Name: idx_kb_icp_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_icp_id ON public.knowledge_base USING btree (icp_id);


--
-- Name: idx_kb_icps_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_icps_active ON public.knowledge_base_icps USING btree (workspace_id, is_active);


--
-- Name: idx_kb_icps_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_icps_created ON public.knowledge_base_icps USING btree (created_at DESC);


--
-- Name: idx_kb_icps_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_icps_workspace ON public.knowledge_base_icps USING btree (workspace_id);


--
-- Name: idx_kb_personas_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_personas_active ON public.knowledge_base_personas USING btree (workspace_id, is_active);


--
-- Name: idx_kb_personas_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_personas_title ON public.knowledge_base_personas USING btree (job_title) WHERE (job_title IS NOT NULL);


--
-- Name: idx_kb_personas_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_personas_workspace ON public.knowledge_base_personas USING btree (workspace_id);


--
-- Name: idx_kb_products_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_products_active ON public.knowledge_base_products USING btree (workspace_id, is_active);


--
-- Name: idx_kb_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_products_category ON public.knowledge_base_products USING btree (workspace_id, category);


--
-- Name: idx_kb_products_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_products_sku ON public.knowledge_base_products USING btree (sku) WHERE (sku IS NOT NULL);


--
-- Name: idx_kb_products_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_products_workspace ON public.knowledge_base_products USING btree (workspace_id);


--
-- Name: idx_kb_sections_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_sections_workspace ON public.knowledge_base_sections USING btree (workspace_id);


--
-- Name: idx_kb_usage_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_usage_document ON public.knowledge_base_document_usage USING btree (document_id);


--
-- Name: idx_kb_usage_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_usage_thread ON public.knowledge_base_document_usage USING btree (thread_id) WHERE (thread_id IS NOT NULL);


--
-- Name: idx_kb_usage_used_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_usage_used_at ON public.knowledge_base_document_usage USING btree (used_at DESC);


--
-- Name: idx_kb_usage_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_usage_workspace ON public.knowledge_base_document_usage USING btree (workspace_id);


--
-- Name: idx_kb_usage_workspace_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_usage_workspace_date ON public.knowledge_base_document_usage USING btree (workspace_id, used_at DESC);


--
-- Name: idx_kb_vectors_document_chunk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_vectors_document_chunk ON public.knowledge_base_vectors USING btree (document_id, chunk_index);


--
-- Name: idx_kb_vectors_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_vectors_embedding ON public.knowledge_base_vectors USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: idx_kb_vectors_icp_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_vectors_icp_id ON public.knowledge_base_vectors USING btree (icp_id);


--
-- Name: idx_kb_vectors_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_vectors_tags ON public.knowledge_base_vectors USING gin (tags);


--
-- Name: idx_kb_vectors_workspace_icp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_vectors_workspace_icp ON public.knowledge_base_vectors USING btree (workspace_id, icp_id);


--
-- Name: idx_kb_vectors_workspace_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_vectors_workspace_section ON public.knowledge_base_vectors USING btree (workspace_id, section_id);


--
-- Name: idx_kb_workspace_icp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_workspace_icp ON public.knowledge_base USING btree (workspace_id, icp_id);


--
-- Name: idx_kg_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kg_embedding ON public.knowledge_gap_tracking USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='10');


--
-- Name: idx_knowledge_base_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_base_active ON public.knowledge_base USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_knowledge_base_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_base_category ON public.knowledge_base USING btree (category);


--
-- Name: idx_knowledge_base_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_base_source ON public.knowledge_base USING btree (source_attachment_id);


--
-- Name: idx_knowledge_base_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_base_workspace ON public.knowledge_base USING btree (workspace_id);


--
-- Name: idx_link_clicks_clicked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_link_clicks_clicked_at ON public.link_clicks USING btree (clicked_at);


--
-- Name: idx_link_clicks_tracked_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_link_clicks_tracked_link ON public.link_clicks USING btree (tracked_link_id);


--
-- Name: idx_linkedin_comment_replies_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_comment_replies_post_id ON public.linkedin_comment_replies USING btree (post_id);


--
-- Name: idx_linkedin_comment_replies_replied_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_comment_replies_replied_at ON public.linkedin_comment_replies USING btree (replied_at DESC);


--
-- Name: idx_linkedin_comment_replies_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_comment_replies_workspace_id ON public.linkedin_comment_replies USING btree (workspace_id);


--
-- Name: idx_linkedin_comments_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_comments_scheduled ON public.linkedin_post_comments USING btree (scheduled_post_time, status) WHERE ((status)::text = 'scheduled'::text);


--
-- Name: idx_linkedin_messages_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_messages_campaign ON public.linkedin_messages USING btree (campaign_id);


--
-- Name: idx_linkedin_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_messages_conversation ON public.linkedin_messages USING btree (prospect_id, created_at DESC);


--
-- Name: idx_linkedin_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_messages_created ON public.linkedin_messages USING btree (created_at DESC);


--
-- Name: idx_linkedin_messages_direction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_messages_direction ON public.linkedin_messages USING btree (direction);


--
-- Name: idx_linkedin_messages_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_messages_prospect ON public.linkedin_messages USING btree (prospect_id);


--
-- Name: idx_linkedin_messages_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_messages_recipient ON public.linkedin_messages USING btree (recipient_linkedin_id);


--
-- Name: idx_linkedin_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_messages_sender ON public.linkedin_messages USING btree (sender_linkedin_id);


--
-- Name: idx_linkedin_messages_unipile_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_messages_unipile_chat ON public.linkedin_messages USING btree (unipile_chat_id);


--
-- Name: idx_linkedin_messages_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_messages_workspace ON public.linkedin_messages USING btree (workspace_id);


--
-- Name: idx_linkedin_monitors_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_monitors_created_by ON public.linkedin_post_monitors USING btree (created_by);


--
-- Name: idx_linkedin_monitors_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_monitors_status ON public.linkedin_post_monitors USING btree (status);


--
-- Name: idx_linkedin_monitors_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_monitors_workspace ON public.linkedin_post_monitors USING btree (workspace_id);


--
-- Name: idx_linkedin_post_comments_engagement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_post_comments_engagement ON public.linkedin_post_comments USING btree (status, engagement_checked_at) WHERE ((status)::text = 'posted'::text);


--
-- Name: idx_linkedin_post_comments_monitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_post_comments_monitor ON public.linkedin_post_comments USING btree (monitor_id);


--
-- Name: idx_linkedin_post_comments_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_post_comments_pending ON public.linkedin_post_comments USING btree (workspace_id, status) WHERE ((status)::text = 'pending_approval'::text);


--
-- Name: idx_linkedin_post_comments_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_post_comments_post ON public.linkedin_post_comments USING btree (post_id);


--
-- Name: idx_linkedin_post_comments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_post_comments_status ON public.linkedin_post_comments USING btree (status);


--
-- Name: idx_linkedin_post_comments_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_post_comments_workspace ON public.linkedin_post_comments USING btree (workspace_id);


--
-- Name: idx_linkedin_post_monitors_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_post_monitors_name ON public.linkedin_post_monitors USING btree (name);


--
-- Name: idx_linkedin_proxy_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_proxy_account ON public.linkedin_proxy_assignments USING btree (linkedin_account_id);


--
-- Name: idx_linkedin_proxy_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_proxy_user ON public.linkedin_proxy_assignments USING btree (user_id);


--
-- Name: idx_linkedin_reposts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_reposts_status ON public.linkedin_reposts USING btree (status, created_at);


--
-- Name: idx_linkedin_reposts_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_reposts_workspace ON public.linkedin_reposts USING btree (workspace_id);


--
-- Name: idx_magic_link_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_link_tokens_expires_at ON public.magic_link_tokens USING btree (expires_at);


--
-- Name: idx_magic_link_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_link_tokens_token ON public.magic_link_tokens USING btree (token);


--
-- Name: idx_magic_link_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magic_link_tokens_user_id ON public.magic_link_tokens USING btree (user_id);


--
-- Name: idx_meeting_follow_up_drafts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meeting_follow_up_drafts_status ON public.meeting_follow_up_drafts USING btree (status) WHERE (status = ANY (ARRAY['pending_generation'::text, 'pending_approval'::text, 'approved'::text]));


--
-- Name: idx_meeting_reminders_status_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meeting_reminders_status_scheduled ON public.meeting_reminders USING btree (status, scheduled_for) WHERE (status = 'pending'::text);


--
-- Name: idx_meetings_prospect_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_prospect_id ON public.meetings USING btree (prospect_id);


--
-- Name: idx_meetings_scheduled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_scheduled_at ON public.meetings USING btree (scheduled_at);


--
-- Name: idx_meetings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_status ON public.meetings USING btree (status);


--
-- Name: idx_meetings_status_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_status_scheduled ON public.meetings USING btree (status, scheduled_at) WHERE (status = ANY (ARRAY['scheduled'::text, 'confirmed'::text]));


--
-- Name: idx_meetings_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meetings_workspace_id ON public.meetings USING btree (workspace_id);


--
-- Name: idx_memory_snapshots_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memory_snapshots_user_date ON public.memory_snapshots USING btree (user_id, snapshot_date DESC);


--
-- Name: idx_memory_snapshots_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memory_snapshots_workspace ON public.memory_snapshots USING btree (workspace_id, snapshot_date DESC);


--
-- Name: idx_message_outbox_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_outbox_campaign ON public.message_outbox USING btree (campaign_id);


--
-- Name: idx_message_outbox_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_outbox_prospect ON public.message_outbox USING btree (prospect_id);


--
-- Name: idx_message_outbox_reply; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_outbox_reply ON public.message_outbox USING btree (reply_id);


--
-- Name: idx_message_outbox_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_outbox_scheduled ON public.message_outbox USING btree (scheduled_send_time) WHERE (status = 'queued'::text);


--
-- Name: idx_message_outbox_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_outbox_status ON public.message_outbox USING btree (status) WHERE (status = ANY (ARRAY['queued'::text, 'sending'::text]));


--
-- Name: idx_message_outbox_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_outbox_workspace ON public.message_outbox USING btree (workspace_id);


--
-- Name: idx_messaging_templates_campaign_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messaging_templates_campaign_type ON public.messaging_templates USING btree (campaign_type);


--
-- Name: idx_messaging_templates_industry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messaging_templates_industry ON public.messaging_templates USING btree (industry);


--
-- Name: idx_messaging_templates_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messaging_templates_workspace ON public.messaging_templates USING btree (workspace_id);


--
-- Name: idx_n8n_executions_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_n8n_executions_approval ON public.n8n_campaign_executions USING btree (campaign_approval_session_id);


--
-- Name: idx_n8n_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_n8n_executions_status ON public.n8n_campaign_executions USING btree (execution_status);


--
-- Name: idx_n8n_executions_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_n8n_executions_workflow ON public.n8n_campaign_executions USING btree (workspace_n8n_workflow_id);


--
-- Name: idx_n8n_executions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_n8n_executions_workspace ON public.n8n_campaign_executions USING btree (workspace_id);


--
-- Name: idx_oauth_states_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states USING btree (expires_at);


--
-- Name: idx_oauth_states_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_states_state ON public.oauth_states USING btree (state);


--
-- Name: idx_organizations_clerk_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_clerk_org_id ON public.organizations USING btree (clerk_org_id);


--
-- Name: idx_password_reset_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: idx_password_reset_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_performance_metrics_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_metrics_campaign ON public.funnel_performance_metrics USING btree (campaign_id);


--
-- Name: idx_performance_metrics_funnel_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_metrics_funnel_type ON public.funnel_performance_metrics USING btree (funnel_type);


--
-- Name: idx_performance_metrics_rates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_metrics_rates ON public.funnel_performance_metrics USING btree (response_rate DESC, conversion_rate DESC);


--
-- Name: idx_pii_access_log_accessed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pii_access_log_accessed_at ON public.pii_access_log USING btree (accessed_at);


--
-- Name: idx_pii_access_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pii_access_log_user ON public.pii_access_log USING btree (user_id);


--
-- Name: idx_pii_access_log_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pii_access_log_workspace ON public.pii_access_log USING btree (workspace_id);


--
-- Name: idx_posts_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_approval_status ON public.linkedin_posts_discovered USING btree (approval_status);


--
-- Name: idx_posts_approval_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_approval_token ON public.linkedin_posts_discovered USING btree (approval_token);


--
-- Name: idx_posts_comment_eligible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_comment_eligible ON public.linkedin_posts_discovered USING btree (comment_eligible_at);


--
-- Name: idx_posts_digest_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_digest_sent ON public.linkedin_posts_discovered USING btree (digest_sent_at);


--
-- Name: idx_posts_discovered_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_discovered_date ON public.linkedin_posts_discovered USING btree (post_date DESC);


--
-- Name: idx_posts_discovered_monitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_discovered_monitor ON public.linkedin_posts_discovered USING btree (monitor_id);


--
-- Name: idx_posts_discovered_social_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_discovered_social_id ON public.linkedin_posts_discovered USING btree (social_id);


--
-- Name: idx_posts_discovered_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_discovered_status ON public.linkedin_posts_discovered USING btree (status);


--
-- Name: idx_posts_discovered_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_discovered_workspace ON public.linkedin_posts_discovered USING btree (workspace_id);


--
-- Name: idx_posts_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_expires_at ON public.linkedin_posts_discovered USING btree (workspace_id, expires_at) WHERE (((status)::text = 'discovered'::text) AND (expires_at IS NOT NULL));


--
-- Name: idx_posts_intent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_intent ON public.linkedin_posts_discovered USING btree (post_intent);


--
-- Name: idx_posts_quality_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_quality_score ON public.linkedin_posts_discovered USING btree (workspace_id, engagement_quality_score DESC) WHERE ((status)::text = 'discovered'::text);


--
-- Name: idx_prospect_approval_data_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_approval_data_approval_status ON public.prospect_approval_data USING btree (approval_status);


--
-- Name: idx_prospect_approval_data_session_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_approval_data_session_status ON public.prospect_approval_data USING btree (session_id, approval_status);


--
-- Name: idx_prospect_approval_data_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_approval_data_workspace_id ON public.prospect_approval_data USING btree (workspace_id);


--
-- Name: idx_prospect_approval_decisions_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_approval_decisions_workspace_id ON public.prospect_approval_decisions USING btree (workspace_id);


--
-- Name: idx_prospect_approval_sessions_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_approval_sessions_campaign_id ON public.prospect_approval_sessions USING btree (campaign_id);


--
-- Name: idx_prospect_approval_sessions_campaign_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_approval_sessions_campaign_name ON public.prospect_approval_sessions USING btree (campaign_name);


--
-- Name: idx_prospect_approval_sessions_campaign_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_approval_sessions_campaign_tag ON public.prospect_approval_sessions USING btree (campaign_tag);


--
-- Name: idx_prospect_approval_sessions_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_approval_sessions_metadata ON public.prospect_approval_sessions USING gin (metadata);


--
-- Name: idx_prospect_data_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_data_session ON public.prospect_approval_data USING btree (session_id);


--
-- Name: idx_prospect_decisions_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_decisions_session ON public.prospect_approval_decisions USING btree (session_id);


--
-- Name: idx_prospect_exports_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_exports_user ON public.prospect_exports USING btree (user_id, workspace_id);


--
-- Name: idx_prospect_learning_logs_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_learning_logs_workspace_id ON public.prospect_learning_logs USING btree (workspace_id);


--
-- Name: idx_prospect_learning_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_learning_session ON public.prospect_learning_logs USING btree (session_id);


--
-- Name: idx_prospect_search_jobs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_search_jobs_created_at ON public.prospect_search_jobs USING btree (created_at DESC);


--
-- Name: idx_prospect_search_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_search_jobs_status ON public.prospect_search_jobs USING btree (status);


--
-- Name: idx_prospect_search_jobs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_search_jobs_user_id ON public.prospect_search_jobs USING btree (user_id);


--
-- Name: idx_prospect_search_jobs_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_search_jobs_workspace_id ON public.prospect_search_jobs USING btree (workspace_id);


--
-- Name: idx_prospect_search_results_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_search_results_job_id ON public.prospect_search_results USING btree (job_id);


--
-- Name: idx_prospect_search_results_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_search_results_workspace_id ON public.prospect_search_results USING btree (workspace_id);


--
-- Name: idx_prospect_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_sessions_status ON public.prospect_approval_sessions USING btree (status);


--
-- Name: idx_prospect_sessions_user_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_sessions_user_workspace ON public.prospect_approval_sessions USING btree (user_id, workspace_id);


--
-- Name: idx_prospect_sessions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_sessions_workspace ON public.prospect_approval_sessions USING btree (workspace_id);


--
-- Name: idx_prospects_calendar_follow_up; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_calendar_follow_up ON public.campaign_prospects USING btree (calendar_follow_up_due_at) WHERE ((calendar_follow_up_due_at IS NOT NULL) AND (meeting_booked_at IS NULL) AND (conversation_stage = 'awaiting_booking'::text));


--
-- Name: idx_prospects_sam_replied_no_response; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_sam_replied_no_response ON public.campaign_prospects USING btree (sam_reply_sent_at) WHERE ((sam_reply_sent_at IS NOT NULL) AND (responded_at IS NULL));


--
-- Name: idx_prospects_session_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_session_created ON public.prospect_approval_data USING btree (session_id, created_at DESC);


--
-- Name: INDEX idx_prospects_session_created; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_prospects_session_created IS 'Optimizes paginated queries sorting by creation date (newest first)';


--
-- Name: idx_prospects_session_prospect_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_session_prospect_id ON public.prospect_approval_data USING btree (session_id, prospect_id);


--
-- Name: INDEX idx_prospects_session_prospect_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_prospects_session_prospect_id IS 'Optimizes JOIN between prospect_approval_data and prospect_approval_decisions';


--
-- Name: idx_prospects_session_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_session_score ON public.prospect_approval_data USING btree (session_id, enrichment_score DESC);


--
-- Name: INDEX idx_prospects_session_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_prospects_session_score IS 'Optimizes paginated queries sorting by quality score';


--
-- Name: idx_qa_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_logs_created ON public.qa_autofix_logs USING btree (created_at);


--
-- Name: idx_qa_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_logs_status ON public.qa_autofix_logs USING btree (fix_status);


--
-- Name: idx_rate_limits_account_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_account_date ON public.account_rate_limits USING btree (account_id, date DESC);


--
-- Name: idx_reply_agent_metrics_workspace_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reply_agent_metrics_workspace_date ON public.reply_agent_metrics USING btree (workspace_id, date DESC);


--
-- Name: idx_reply_agent_settings_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reply_agent_settings_workspace ON public.reply_agent_settings USING btree (workspace_id);


--
-- Name: idx_reply_drafts_inbound_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reply_drafts_inbound_id ON public.reply_agent_drafts USING btree (inbound_message_id);


--
-- Name: idx_reply_drafts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reply_drafts_status ON public.reply_agent_drafts USING btree (status);


--
-- Name: idx_reply_drafts_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reply_drafts_token ON public.reply_agent_drafts USING btree (approval_token);


--
-- Name: idx_reply_drafts_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reply_drafts_workspace ON public.reply_agent_drafts USING btree (workspace_id);


--
-- Name: idx_reply_feedback_reasons_reply; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reply_feedback_reasons_reply ON public.reply_feedback_reasons USING btree (reply_id);


--
-- Name: idx_sam_conversation_messages_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_conversation_messages_workspace_id ON public.sam_conversation_messages USING btree (workspace_id);


--
-- Name: idx_sam_funnel_analytics_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_analytics_execution ON public.sam_funnel_analytics USING btree (execution_id);


--
-- Name: idx_sam_funnel_analytics_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_analytics_template ON public.sam_funnel_analytics USING btree (template_id);


--
-- Name: idx_sam_funnel_analytics_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_analytics_workspace_id ON public.sam_funnel_analytics USING btree (workspace_id);


--
-- Name: idx_sam_funnel_executions_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_executions_campaign ON public.sam_funnel_executions USING btree (campaign_id);


--
-- Name: idx_sam_funnel_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_executions_status ON public.sam_funnel_executions USING btree (status);


--
-- Name: idx_sam_funnel_executions_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_executions_template ON public.sam_funnel_executions USING btree (template_id);


--
-- Name: idx_sam_funnel_executions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_executions_workspace ON public.sam_funnel_executions USING btree (workspace_id);


--
-- Name: idx_sam_funnel_messages_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_messages_execution ON public.sam_funnel_messages USING btree (execution_id);


--
-- Name: idx_sam_funnel_messages_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_messages_prospect ON public.sam_funnel_messages USING btree (prospect_id);


--
-- Name: idx_sam_funnel_messages_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_messages_scheduled ON public.sam_funnel_messages USING btree (scheduled_date);


--
-- Name: idx_sam_funnel_messages_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_messages_status ON public.sam_funnel_messages USING btree (status);


--
-- Name: idx_sam_funnel_messages_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_messages_workspace_id ON public.sam_funnel_messages USING btree (workspace_id);


--
-- Name: idx_sam_funnel_responses_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_responses_approval ON public.sam_funnel_responses USING btree (approval_status);


--
-- Name: idx_sam_funnel_responses_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_responses_execution ON public.sam_funnel_responses USING btree (execution_id);


--
-- Name: idx_sam_funnel_responses_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_responses_prospect ON public.sam_funnel_responses USING btree (prospect_id);


--
-- Name: idx_sam_funnel_responses_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_responses_type ON public.sam_funnel_responses USING btree (response_type);


--
-- Name: idx_sam_funnel_responses_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_funnel_responses_workspace_id ON public.sam_funnel_responses USING btree (workspace_id);


--
-- Name: idx_sam_icp_discovery_sessions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_icp_discovery_sessions_created_at ON public.sam_icp_discovery_sessions USING btree (created_at DESC);


--
-- Name: idx_sam_icp_discovery_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_icp_discovery_sessions_status ON public.sam_icp_discovery_sessions USING btree (session_status);


--
-- Name: idx_sam_icp_discovery_sessions_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_icp_discovery_sessions_thread_id ON public.sam_icp_discovery_sessions USING btree (thread_id);


--
-- Name: idx_sam_icp_discovery_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_icp_discovery_sessions_user_id ON public.sam_icp_discovery_sessions USING btree (user_id);


--
-- Name: idx_sam_icp_discovery_sessions_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_icp_discovery_sessions_workspace_id ON public.sam_icp_discovery_sessions USING btree (workspace_id);


--
-- Name: idx_sam_icp_knowledge_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_icp_knowledge_category ON public.sam_icp_knowledge_entries USING btree (category);


--
-- Name: idx_sam_icp_knowledge_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_icp_knowledge_embedding ON public.sam_icp_knowledge_entries USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: idx_sam_icp_knowledge_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_icp_knowledge_session ON public.sam_icp_knowledge_entries USING btree (discovery_session_id);


--
-- Name: idx_sam_icp_knowledge_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_icp_knowledge_source ON public.sam_icp_knowledge_entries USING btree (source_attachment_id);


--
-- Name: idx_sam_icp_knowledge_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_icp_knowledge_stage ON public.sam_icp_knowledge_entries USING btree (stage);


--
-- Name: idx_sam_icp_knowledge_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_icp_knowledge_user ON public.sam_icp_knowledge_entries USING btree (user_id);


--
-- Name: idx_sam_icp_knowledge_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_icp_knowledge_workspace ON public.sam_icp_knowledge_entries USING btree (workspace_id);


--
-- Name: idx_sam_learning_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_learning_user ON public.sam_learning_models USING btree (user_id, workspace_id);


--
-- Name: idx_sam_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_messages_created_at ON public.sam_conversation_messages USING btree (created_at);


--
-- Name: idx_sam_messages_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_messages_order ON public.sam_conversation_messages USING btree (thread_id, message_order);


--
-- Name: idx_sam_messages_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_messages_thread_id ON public.sam_conversation_messages USING btree (thread_id);


--
-- Name: idx_sam_threads_last_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_threads_last_active ON public.sam_conversation_threads USING btree (last_active_at);


--
-- Name: idx_sam_threads_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_threads_user_id ON public.sam_conversation_threads USING btree (user_id);


--
-- Name: idx_sam_threads_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sam_threads_workspace_id ON public.sam_conversation_threads USING btree (workspace_id);


--
-- Name: idx_self_post_monitors_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_self_post_monitors_active ON public.linkedin_self_post_monitors USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_self_post_monitors_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_self_post_monitors_workspace ON public.linkedin_self_post_monitors USING btree (workspace_id);


--
-- Name: idx_self_post_replies_monitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_self_post_replies_monitor ON public.linkedin_self_post_comment_replies USING btree (monitor_id);


--
-- Name: idx_self_post_replies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_self_post_replies_status ON public.linkedin_self_post_comment_replies USING btree (status);


--
-- Name: idx_self_post_replies_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_self_post_replies_workspace ON public.linkedin_self_post_comment_replies USING btree (workspace_id);


--
-- Name: idx_send_queue_campaign_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_send_queue_campaign_status ON public.send_queue USING btree (campaign_id, status);


--
-- Name: idx_send_queue_message_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_send_queue_message_type ON public.send_queue USING btree (message_type);


--
-- Name: idx_send_queue_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_send_queue_pending ON public.send_queue USING btree (scheduled_for) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_send_queue_status_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_send_queue_status_scheduled ON public.send_queue USING btree (status, scheduled_for) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_send_queue_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_send_queue_variant ON public.send_queue USING btree (campaign_id, variant) WHERE (variant IS NOT NULL);


--
-- Name: idx_sessions_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_start ON public.user_sessions USING btree (session_start);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user ON public.user_sessions USING btree (user_id);


--
-- Name: idx_sessions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_workspace ON public.user_sessions USING btree (workspace_id);


--
-- Name: idx_slack_app_config_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_app_config_status ON public.slack_app_config USING btree (status);


--
-- Name: idx_slack_app_config_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_app_config_workspace ON public.slack_app_config USING btree (workspace_id);


--
-- Name: idx_slack_channels_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_channels_campaign ON public.slack_channels USING btree (linked_campaign_id);


--
-- Name: idx_slack_channels_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_channels_channel ON public.slack_channels USING btree (channel_id);


--
-- Name: idx_slack_channels_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_channels_workspace ON public.slack_channels USING btree (workspace_id);


--
-- Name: idx_slack_messages_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_messages_channel ON public.slack_messages USING btree (channel_id);


--
-- Name: idx_slack_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_messages_created ON public.slack_messages USING btree (created_at DESC);


--
-- Name: idx_slack_messages_direction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_messages_direction ON public.slack_messages USING btree (direction);


--
-- Name: idx_slack_messages_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_messages_thread ON public.slack_messages USING btree (thread_ts);


--
-- Name: idx_slack_messages_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_messages_workspace ON public.slack_messages USING btree (workspace_id);


--
-- Name: idx_slack_pending_actions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_pending_actions_expires ON public.slack_pending_actions USING btree (expires_at);


--
-- Name: idx_slack_pending_actions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_pending_actions_status ON public.slack_pending_actions USING btree (status);


--
-- Name: idx_slack_pending_actions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_pending_actions_workspace ON public.slack_pending_actions USING btree (workspace_id);


--
-- Name: idx_slack_pending_slack_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_pending_slack_team_id ON public.slack_pending_installations USING btree (slack_team_id);


--
-- Name: idx_slack_pending_status_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_pending_status_expires ON public.slack_pending_installations USING btree (status, expires_at);


--
-- Name: idx_slack_user_mapping_sam_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_user_mapping_sam_user ON public.slack_user_mapping USING btree (sam_user_id);


--
-- Name: idx_slack_user_mapping_slack_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_user_mapping_slack_user ON public.slack_user_mapping USING btree (slack_user_id);


--
-- Name: idx_slack_user_mapping_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_user_mapping_workspace ON public.slack_user_mapping USING btree (workspace_id);


--
-- Name: idx_template_components_industry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_components_industry ON public.template_components USING btree (industry);


--
-- Name: idx_template_components_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_components_type ON public.template_components USING btree (component_type);


--
-- Name: idx_template_performance_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_performance_template_id ON public.template_performance USING btree (template_id);


--
-- Name: idx_threads_importance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_importance ON public.sam_conversation_threads USING btree (user_id, memory_importance_score, created_at);


--
-- Name: idx_threads_memory_archive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_memory_archive ON public.sam_conversation_threads USING btree (user_id, memory_archived, created_at) WHERE (memory_archived = false);


--
-- Name: idx_tracked_links_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracked_links_prospect ON public.tracked_links USING btree (prospect_id);


--
-- Name: idx_tracked_links_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracked_links_workspace ON public.tracked_links USING btree (workspace_id);


--
-- Name: idx_user_memory_preferences_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_memory_preferences_user ON public.user_memory_preferences USING btree (user_id);


--
-- Name: idx_user_organizations_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_organizations_org_id ON public.user_organizations USING btree (organization_id);


--
-- Name: idx_user_organizations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_organizations_user_id ON public.user_organizations USING btree (user_id);


--
-- Name: idx_user_unipile_accounts_linkedin_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_unipile_accounts_linkedin_type ON public.user_unipile_accounts USING btree (linkedin_account_type) WHERE (platform = 'LINKEDIN'::text);


--
-- Name: idx_user_unipile_accounts_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_unipile_accounts_platform ON public.user_unipile_accounts USING btree (platform);


--
-- Name: idx_user_unipile_accounts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_unipile_accounts_status ON public.user_unipile_accounts USING btree (connection_status);


--
-- Name: idx_user_unipile_accounts_unipile_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_unipile_accounts_unipile_account_id ON public.user_unipile_accounts USING btree (unipile_account_id);


--
-- Name: idx_user_unipile_accounts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_unipile_accounts_user_id ON public.user_unipile_accounts USING btree (user_id);


--
-- Name: idx_user_unipile_accounts_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_unipile_accounts_workspace_id ON public.user_unipile_accounts USING btree (workspace_id);


--
-- Name: idx_users_cancelled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_cancelled_at ON public.users USING btree (cancelled_at);


--
-- Name: idx_users_current_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_current_workspace_id ON public.users USING btree (current_workspace_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_profile_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_profile_country ON public.users USING btree (profile_country);


--
-- Name: idx_users_subscription_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_subscription_status ON public.users USING btree (subscription_status);


--
-- Name: idx_users_trial_ends_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_trial_ends_at ON public.users USING btree (trial_ends_at);


--
-- Name: idx_webhook_error_logs_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_error_logs_workspace_id ON public.webhook_error_logs USING btree (workspace_id);


--
-- Name: idx_webhook_errors_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_errors_execution ON public.webhook_error_logs USING btree (execution_id);


--
-- Name: idx_webhook_errors_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_errors_timestamp ON public.webhook_error_logs USING btree ("timestamp");


--
-- Name: idx_webhook_errors_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_errors_workflow ON public.webhook_error_logs USING btree (workflow_id);


--
-- Name: idx_website_analysis_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_analysis_queue_status ON public.website_analysis_queue USING btree (status, scheduled_for);


--
-- Name: idx_website_analysis_queue_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_analysis_queue_workspace ON public.website_analysis_queue USING btree (workspace_id);


--
-- Name: idx_website_analysis_results_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_analysis_results_domain ON public.website_analysis_results USING btree (domain);


--
-- Name: idx_website_analysis_results_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_analysis_results_status ON public.website_analysis_results USING btree (status);


--
-- Name: idx_website_analysis_results_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_analysis_results_workspace ON public.website_analysis_results USING btree (workspace_id);


--
-- Name: idx_website_requests_access_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_requests_access_token ON public.website_requests USING btree (access_token);


--
-- Name: idx_website_requests_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_requests_assigned_to ON public.website_requests USING btree (assigned_to);


--
-- Name: idx_website_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_requests_created_at ON public.website_requests USING btree (created_at DESC);


--
-- Name: idx_website_requests_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_requests_email ON public.website_requests USING btree (email);


--
-- Name: idx_website_requests_lead_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_requests_lead_status ON public.website_requests USING btree (lead_status);


--
-- Name: idx_website_requests_next_follow_up; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_requests_next_follow_up ON public.website_requests USING btree (next_follow_up_at) WHERE ((lead_status)::text <> ALL ((ARRAY['converted'::character varying, 'disqualified'::character varying])::text[]));


--
-- Name: idx_website_requests_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_requests_source ON public.website_requests USING btree (source);


--
-- Name: idx_website_requests_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_requests_status_date ON public.website_requests USING btree (lead_status, created_at DESC);


--
-- Name: idx_website_requests_website_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_requests_website_domain ON public.website_requests USING btree (website_domain);


--
-- Name: idx_workflow_credentials_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_credentials_active ON public.workspace_workflow_credentials USING btree (is_active);


--
-- Name: idx_workflow_credentials_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_credentials_type ON public.workspace_workflow_credentials USING btree (credential_type);


--
-- Name: idx_workflow_credentials_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_credentials_workflow ON public.workspace_workflow_credentials USING btree (workspace_n8n_workflow_id);


--
-- Name: idx_workflow_credentials_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_credentials_workspace ON public.workspace_workflow_credentials USING btree (workspace_id);


--
-- Name: idx_workflow_templates_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_templates_default ON public.workflow_templates USING btree (is_default);


--
-- Name: idx_workflow_templates_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_templates_status ON public.workflow_templates USING btree (status);


--
-- Name: idx_workflow_templates_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_templates_version ON public.workflow_templates USING btree (template_version);


--
-- Name: idx_workspace_account_limits_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_account_limits_workspace_id ON public.workspace_account_limits USING btree (workspace_id);


--
-- Name: idx_workspace_accounts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_accounts_status ON public.workspace_accounts USING btree (connection_status);


--
-- Name: idx_workspace_accounts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_accounts_type ON public.workspace_accounts USING btree (account_type);


--
-- Name: idx_workspace_accounts_unipile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_accounts_unipile ON public.workspace_accounts USING btree (unipile_account_id);


--
-- Name: idx_workspace_accounts_unipile_sources; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_accounts_unipile_sources ON public.workspace_accounts USING gin (unipile_sources);


--
-- Name: idx_workspace_accounts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_accounts_user ON public.workspace_accounts USING btree (user_id);


--
-- Name: idx_workspace_accounts_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_accounts_workspace ON public.workspace_accounts USING btree (workspace_id);


--
-- Name: idx_workspace_blacklists_keyword; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_blacklists_keyword ON public.workspace_blacklists USING btree (keyword);


--
-- Name: idx_workspace_blacklists_linkedin_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_blacklists_linkedin_account ON public.workspace_blacklists USING btree (linkedin_account_id);


--
-- Name: idx_workspace_blacklists_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_blacklists_type ON public.workspace_blacklists USING btree (blacklist_type);


--
-- Name: idx_workspace_blacklists_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_blacklists_workspace_id ON public.workspace_blacklists USING btree (workspace_id);


--
-- Name: idx_workspace_dpa_requirements_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_dpa_requirements_active ON public.workspace_dpa_requirements USING btree (requires_dpa) WHERE (requires_dpa = true);


--
-- Name: idx_workspace_dpa_requirements_grace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_dpa_requirements_grace ON public.workspace_dpa_requirements USING btree (grace_period_active) WHERE (grace_period_active = true);


--
-- Name: idx_workspace_dpa_signed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_dpa_signed_at ON public.workspace_dpa_agreements USING btree (signed_at);


--
-- Name: idx_workspace_dpa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_dpa_status ON public.workspace_dpa_agreements USING btree (status);


--
-- Name: idx_workspace_dpa_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_dpa_workspace ON public.workspace_dpa_agreements USING btree (workspace_id);


--
-- Name: idx_workspace_encryption_keys_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_encryption_keys_workspace ON public.workspace_encryption_keys USING btree (workspace_id) WHERE (is_active = true);


--
-- Name: idx_workspace_icp_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_icp_default ON public.workspace_icp USING btree (workspace_id, is_default) WHERE (is_default = true);


--
-- Name: idx_workspace_icp_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_icp_workspace ON public.workspace_icp USING btree (workspace_id);


--
-- Name: idx_workspace_integrations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_integrations_status ON public.workspace_integrations USING btree (status);


--
-- Name: idx_workspace_integrations_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_integrations_type ON public.workspace_integrations USING btree (integration_type);


--
-- Name: idx_workspace_integrations_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_integrations_workspace ON public.workspace_integrations USING btree (workspace_id);


--
-- Name: idx_workspace_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_invitations_email ON public.workspace_invitations USING btree (invited_email);


--
-- Name: idx_workspace_invitations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_invitations_status ON public.workspace_invitations USING btree (status);


--
-- Name: idx_workspace_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_invitations_token ON public.workspace_invitations USING btree (token);


--
-- Name: idx_workspace_invitations_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_invitations_workspace_id ON public.workspace_invitations USING btree (workspace_id);


--
-- Name: idx_workspace_invoices_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_invoices_organization_id ON public.workspace_invoices USING btree (organization_id);


--
-- Name: idx_workspace_invoices_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_invoices_period ON public.workspace_invoices USING btree (billing_period_start, billing_period_end);


--
-- Name: idx_workspace_invoices_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_invoices_workspace_id ON public.workspace_invoices USING btree (workspace_id);


--
-- Name: idx_workspace_members_linkedin_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_linkedin_account ON public.workspace_members USING btree (linkedin_unipile_account_id);


--
-- Name: idx_workspace_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_user_id ON public.workspace_members USING btree (user_id);


--
-- Name: idx_workspace_members_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members USING btree (workspace_id);


--
-- Name: idx_workspace_n8n_workflows_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_n8n_workflows_status ON public.workspace_n8n_workflows USING btree (deployment_status);


--
-- Name: idx_workspace_n8n_workflows_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_n8n_workflows_user ON public.workspace_n8n_workflows USING btree (user_id);


--
-- Name: idx_workspace_n8n_workflows_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_n8n_workflows_workspace ON public.workspace_n8n_workflows USING btree (workspace_id);


--
-- Name: idx_workspace_prospects_active_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_prospects_active_campaign ON public.workspace_prospects USING btree (active_campaign_id) WHERE (active_campaign_id IS NOT NULL);


--
-- Name: idx_workspace_prospects_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_prospects_added_by ON public.workspace_prospects USING btree (added_by);


--
-- Name: idx_workspace_prospects_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_prospects_approval_status ON public.workspace_prospects USING btree (workspace_id, approval_status) WHERE (approval_status IS NOT NULL);


--
-- Name: idx_workspace_prospects_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_prospects_batch ON public.workspace_prospects USING btree (workspace_id, batch_id) WHERE (batch_id IS NOT NULL);


--
-- Name: idx_workspace_prospects_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_prospects_chat_id ON public.workspace_prospects USING btree (linkedin_chat_id) WHERE (linkedin_chat_id IS NOT NULL);


--
-- Name: idx_workspace_prospects_company_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_prospects_company_normalized ON public.workspace_prospects USING btree (company_name_normalized);


--
-- Name: idx_workspace_prospects_connection_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_prospects_connection_status ON public.workspace_prospects USING btree (workspace_id, connection_status) WHERE (connection_status IS NOT NULL);


--
-- Name: idx_workspace_prospects_email_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_prospects_email_hash ON public.workspace_prospects USING btree (workspace_id, email_hash) WHERE (email_hash IS NOT NULL);


--
-- Name: idx_workspace_prospects_linkedin_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_prospects_linkedin_hash ON public.workspace_prospects USING btree (workspace_id, linkedin_url_hash) WHERE (linkedin_url_hash IS NOT NULL);


--
-- Name: idx_workspace_prospects_linkedin_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_prospects_linkedin_url ON public.workspace_prospects USING btree (linkedin_profile_url);


--
-- Name: idx_workspace_prospects_unipile_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_prospects_unipile_account ON public.workspace_prospects USING btree (added_by_unipile_account);


--
-- Name: idx_workspace_prospects_unique_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_workspace_prospects_unique_email ON public.workspace_prospects USING btree (workspace_id, email_hash) WHERE ((email_hash IS NOT NULL) AND (email_hash <> ''::text));


--
-- Name: idx_workspace_prospects_unique_linkedin; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_workspace_prospects_unique_linkedin ON public.workspace_prospects USING btree (workspace_id, linkedin_url_hash) WHERE ((linkedin_url_hash IS NOT NULL) AND (linkedin_url_hash <> ''::text));


--
-- Name: idx_workspace_prospects_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_prospects_workspace_id ON public.workspace_prospects USING btree (workspace_id);


--
-- Name: idx_workspace_schedule_settings_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_schedule_settings_workspace_id ON public.workspace_schedule_settings USING btree (workspace_id);


--
-- Name: idx_workspace_stripe_customers_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_stripe_customers_workspace ON public.workspace_stripe_customers USING btree (workspace_id);


--
-- Name: idx_workspace_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_subscriptions_status ON public.workspace_subscriptions USING btree (status);


--
-- Name: idx_workspace_subscriptions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_subscriptions_workspace ON public.workspace_subscriptions USING btree (workspace_id);


--
-- Name: idx_workspace_tiers_search_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_tiers_search_tier ON public.workspace_tiers USING btree (lead_search_tier);


--
-- Name: idx_workspace_tiers_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_tiers_tier ON public.workspace_tiers USING btree (tier);


--
-- Name: idx_workspace_tiers_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_tiers_workspace_id ON public.workspace_tiers USING btree (workspace_id);


--
-- Name: idx_workspace_usage_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_usage_created_at ON public.workspace_usage USING btree (created_at);


--
-- Name: idx_workspace_usage_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_usage_organization_id ON public.workspace_usage USING btree (organization_id);


--
-- Name: idx_workspace_usage_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_usage_workspace_id ON public.workspace_usage USING btree (workspace_id);


--
-- Name: idx_workspaces_analysis_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_analysis_status ON public.workspaces USING btree (website_analysis_status);


--
-- Name: idx_workspaces_client_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_client_code ON public.workspaces USING btree (client_code);


--
-- Name: idx_workspaces_commenting_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_commenting_enabled ON public.workspaces USING btree (commenting_agent_enabled) WHERE (commenting_agent_enabled = true);


--
-- Name: idx_workspaces_company_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_company_url ON public.workspaces USING btree (company_url);


--
-- Name: idx_workspaces_detected_industry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_detected_industry ON public.workspaces USING btree (detected_industry);


--
-- Name: idx_workspaces_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_organization_id ON public.workspaces USING btree (organization_id);


--
-- Name: idx_workspaces_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_owner_id ON public.workspaces USING btree (owner_id);


--
-- Name: idx_workspaces_reseller_affiliation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_reseller_affiliation ON public.workspaces USING btree (reseller_affiliation);


--
-- Name: idx_workspaces_stripe_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_stripe_customer_id ON public.workspaces USING btree (stripe_customer_id);


--
-- Name: idx_workspaces_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_tenant ON public.workspaces USING btree (tenant);


--
-- Name: idx_workspaces_trial_ends_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_trial_ends_at ON public.workspaces USING btree (trial_ends_at);


--
-- Name: idx_wsp_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wsp_workspace ON public.workspace_searched_prospects USING btree (workspace_id);


--
-- Name: idx_wsp_workspace_linkedin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wsp_workspace_linkedin ON public.workspace_searched_prospects USING btree (workspace_id, linkedin_url);


--
-- Name: linkedin_posts_discovered_monitor_url_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX linkedin_posts_discovered_monitor_url_idx ON public.linkedin_posts_discovered USING btree (monitor_id, share_url);


--
-- Name: linkedin_posts_discovered_share_url_workspace_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX linkedin_posts_discovered_share_url_workspace_idx ON public.linkedin_posts_discovered USING btree (share_url, workspace_id);


--
-- Name: INDEX linkedin_posts_discovered_share_url_workspace_idx; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.linkedin_posts_discovered_share_url_workspace_idx IS 'Prevents duplicate posts by URL within the same workspace';


--
-- Name: linkedin_posts_discovered_social_id_workspace_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX linkedin_posts_discovered_social_id_workspace_idx ON public.linkedin_posts_discovered USING btree (social_id, workspace_id);


--
-- Name: linkedin_author_relationships author_relationships_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER author_relationships_updated_at BEFORE UPDATE ON public.linkedin_author_relationships FOR EACH ROW EXECUTE FUNCTION public.update_author_relationship_timestamp();


--
-- Name: campaign_replies campaign_replies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaign_replies_updated_at BEFORE UPDATE ON public.campaign_replies FOR EACH ROW EXECUTE FUNCTION public.update_campaign_replies_updated_at();


--
-- Name: campaign_schedules campaign_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER campaign_schedules_updated_at BEFORE UPDATE ON public.campaign_schedules FOR EACH ROW EXECUTE FUNCTION public.update_campaign_schedules_updated_at();


--
-- Name: linkedin_post_comments comment_set_expiration; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER comment_set_expiration BEFORE INSERT ON public.linkedin_post_comments FOR EACH ROW EXECUTE FUNCTION public.set_comment_expiration();


--
-- Name: email_responses email_responses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_responses_updated_at BEFORE UPDATE ON public.email_responses FOR EACH ROW EXECUTE FUNCTION public.update_email_responses_updated_at();


--
-- Name: enrichment_jobs enrichment_job_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enrichment_job_updated_at BEFORE UPDATE ON public.enrichment_jobs FOR EACH ROW EXECUTE FUNCTION public.update_enrichment_job_timestamp();


--
-- Name: linkedin_messages linkedin_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER linkedin_messages_updated_at BEFORE UPDATE ON public.linkedin_messages FOR EACH ROW EXECUTE FUNCTION public.update_linkedin_messages_updated_at();


--
-- Name: meeting_follow_up_drafts meeting_follow_up_drafts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER meeting_follow_up_drafts_updated_at BEFORE UPDATE ON public.meeting_follow_up_drafts FOR EACH ROW EXECUTE FUNCTION public.update_meetings_updated_at();


--
-- Name: meeting_reminders meeting_reminders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER meeting_reminders_updated_at BEFORE UPDATE ON public.meeting_reminders FOR EACH ROW EXECUTE FUNCTION public.update_meetings_updated_at();


--
-- Name: meetings meetings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_meetings_updated_at();


--
-- Name: message_outbox message_outbox_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER message_outbox_updated_at BEFORE UPDATE ON public.message_outbox FOR EACH ROW EXECUTE FUNCTION public.update_message_outbox_updated_at();


--
-- Name: linkedin_posts_discovered post_set_expiration; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER post_set_expiration BEFORE INSERT ON public.linkedin_posts_discovered FOR EACH ROW EXECUTE FUNCTION public.set_post_expiration();


--
-- Name: campaign_prospects trg_campaign_prospect_normalize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_campaign_prospect_normalize BEFORE INSERT OR UPDATE ON public.campaign_prospects FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_campaign_prospect();


--
-- Name: TRIGGER trg_campaign_prospect_normalize ON campaign_prospects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER trg_campaign_prospect_normalize ON public.campaign_prospects IS 'Auto-normalizes company_name, location, title on INSERT/UPDATE';


--
-- Name: workspace_prospects trg_workspace_prospect_normalize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workspace_prospect_normalize BEFORE INSERT OR UPDATE ON public.workspace_prospects FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_workspace_prospect();


--
-- Name: TRIGGER trg_workspace_prospect_normalize ON workspace_prospects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER trg_workspace_prospect_normalize ON public.workspace_prospects IS 'Auto-normalizes company_name, location, job_title on INSERT/UPDATE';


--
-- Name: workspaces trigger_auto_assign_client_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_assign_client_code BEFORE INSERT OR UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.auto_assign_client_code();


--
-- Name: core_funnel_executions trigger_core_executions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_core_executions_updated_at BEFORE UPDATE ON public.core_funnel_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: core_funnel_templates trigger_core_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_core_templates_updated_at BEFORE UPDATE ON public.core_funnel_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: dynamic_funnel_definitions trigger_dynamic_definitions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_dynamic_definitions_updated_at BEFORE UPDATE ON public.dynamic_funnel_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: dynamic_funnel_executions trigger_dynamic_executions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_dynamic_executions_updated_at BEFORE UPDATE ON public.dynamic_funnel_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: dynamic_funnel_steps trigger_dynamic_steps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_dynamic_steps_updated_at BEFORE UPDATE ON public.dynamic_funnel_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: workspace_icp trigger_ensure_single_default_icp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_ensure_single_default_icp BEFORE INSERT OR UPDATE ON public.workspace_icp FOR EACH ROW WHEN ((new.is_default = true)) EXECUTE FUNCTION public.ensure_single_default_icp();


--
-- Name: workspace_prospects trigger_normalize_prospect_identifiers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_normalize_prospect_identifiers BEFORE INSERT OR UPDATE ON public.workspace_prospects FOR EACH ROW EXECUTE FUNCTION public.normalize_prospect_identifiers();


--
-- Name: funnel_performance_metrics trigger_performance_metrics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_performance_metrics_updated_at BEFORE UPDATE ON public.funnel_performance_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: sam_funnel_executions trigger_sam_funnel_executions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sam_funnel_executions_updated_at BEFORE UPDATE ON public.sam_funnel_executions FOR EACH ROW EXECUTE FUNCTION public.update_sam_funnel_updated_at();


--
-- Name: sam_funnel_messages trigger_sam_funnel_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sam_funnel_messages_updated_at BEFORE UPDATE ON public.sam_funnel_messages FOR EACH ROW EXECUTE FUNCTION public.update_sam_funnel_updated_at();


--
-- Name: sam_funnel_responses trigger_sam_funnel_response_metrics; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sam_funnel_response_metrics AFTER INSERT OR UPDATE ON public.sam_funnel_responses FOR EACH ROW EXECUTE FUNCTION public.trigger_update_execution_metrics();


--
-- Name: sam_funnel_responses trigger_sam_funnel_responses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sam_funnel_responses_updated_at BEFORE UPDATE ON public.sam_funnel_responses FOR EACH ROW EXECUTE FUNCTION public.update_sam_funnel_updated_at();


--
-- Name: workspace_prospects trigger_set_prospect_deletion_date; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_prospect_deletion_date BEFORE INSERT ON public.workspace_prospects FOR EACH ROW EXECUTE FUNCTION public.set_prospect_deletion_date();


--
-- Name: user_unipile_accounts trigger_sync_unipile_to_workspace; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_unipile_to_workspace AFTER INSERT OR UPDATE ON public.user_unipile_accounts FOR EACH ROW EXECUTE FUNCTION public.sync_unipile_to_workspace_accounts();


--
-- Name: sam_conversation_attachments trigger_update_attachment_processing; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_attachment_processing BEFORE UPDATE ON public.sam_conversation_attachments FOR EACH ROW EXECUTE FUNCTION public.update_attachment_processing_status();


--
-- Name: core_funnel_executions trigger_update_core_funnel_metrics; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_core_funnel_metrics AFTER UPDATE ON public.core_funnel_executions FOR EACH ROW EXECUTE FUNCTION public.update_funnel_performance_metrics();


--
-- Name: dynamic_funnel_executions trigger_update_dynamic_funnel_metrics; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_dynamic_funnel_metrics AFTER UPDATE ON public.dynamic_funnel_executions FOR EACH ROW EXECUTE FUNCTION public.update_funnel_performance_metrics();


--
-- Name: follow_up_drafts trigger_update_follow_up_drafts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_follow_up_drafts_updated_at BEFORE UPDATE ON public.follow_up_drafts FOR EACH ROW EXECUTE FUNCTION public.update_follow_up_drafts_updated_at();


--
-- Name: campaign_replies trigger_update_reply_metrics; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_reply_metrics AFTER INSERT ON public.campaign_replies FOR EACH ROW EXECUTE FUNCTION public.update_reply_agent_metrics();


--
-- Name: sam_icp_knowledge_entries trigger_update_sam_icp_knowledge_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_sam_icp_knowledge_updated_at BEFORE UPDATE ON public.sam_icp_knowledge_entries FOR EACH ROW EXECUTE FUNCTION public.update_sam_icp_knowledge_updated_at();


--
-- Name: workspace_icp trigger_update_workspace_icp_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_workspace_icp_updated_at BEFORE UPDATE ON public.workspace_icp FOR EACH ROW EXECUTE FUNCTION public.update_workspace_icp_updated_at();


--
-- Name: api_keys update_api_keys_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.update_api_keys_updated_at();


--
-- Name: crm_connections update_crm_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_crm_connections_updated_at BEFORE UPDATE ON public.crm_connections FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();


--
-- Name: crm_contact_mappings update_crm_contact_mappings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_crm_contact_mappings_updated_at BEFORE UPDATE ON public.crm_contact_mappings FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();


--
-- Name: crm_field_mappings update_crm_field_mappings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_crm_field_mappings_updated_at BEFORE UPDATE ON public.crm_field_mappings FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();


--
-- Name: campaign_prospect_execution_state update_execution_state_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_execution_state_timestamp BEFORE UPDATE ON public.campaign_prospect_execution_state FOR EACH ROW EXECUTE FUNCTION public.update_execution_state_updated_at();


--
-- Name: knowledge_base_competitors update_kb_competitors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_kb_competitors_updated_at BEFORE UPDATE ON public.knowledge_base_competitors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: knowledge_base_icps update_kb_icps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_kb_icps_updated_at BEFORE UPDATE ON public.knowledge_base_icps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: knowledge_base_personas update_kb_personas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_kb_personas_updated_at BEFORE UPDATE ON public.knowledge_base_personas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: knowledge_base_products update_kb_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_kb_products_updated_at BEFORE UPDATE ON public.knowledge_base_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: linkedin_comment_replies update_linkedin_comment_replies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_linkedin_comment_replies_updated_at BEFORE UPDATE ON public.linkedin_comment_replies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: messaging_templates update_messaging_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_messaging_templates_updated_at BEFORE UPDATE ON public.messaging_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: n8n_campaign_executions update_n8n_campaign_executions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_n8n_campaign_executions_updated_at BEFORE UPDATE ON public.n8n_campaign_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sam_learning_models update_sam_learning_models_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sam_learning_models_updated_at BEFORE UPDATE ON public.sam_learning_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: website_analysis_results update_website_analysis_results_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_website_analysis_results_updated_at BEFORE UPDATE ON public.website_analysis_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: website_requests update_website_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_website_requests_updated_at BEFORE UPDATE ON public.website_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workspace_ai_search_config update_workspace_ai_search_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspace_ai_search_config_updated_at BEFORE UPDATE ON public.workspace_ai_search_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workspace_inbox_agent_config update_workspace_inbox_agent_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspace_inbox_agent_config_updated_at BEFORE UPDATE ON public.workspace_inbox_agent_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workspace_invoices update_workspace_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspace_invoices_updated_at BEFORE UPDATE ON public.workspace_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workspace_n8n_workflows update_workspace_n8n_workflows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspace_n8n_workflows_updated_at BEFORE UPDATE ON public.workspace_n8n_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workspace_stripe_customers update_workspace_stripe_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspace_stripe_customers_updated_at BEFORE UPDATE ON public.workspace_stripe_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workspace_subscriptions update_workspace_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspace_subscriptions_updated_at BEFORE UPDATE ON public.workspace_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workspace_workflow_credentials update_workspace_workflow_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspace_workflow_credentials_updated_at BEFORE UPDATE ON public.workspace_workflow_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: campaign_prospects validate_prospect_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_prospect_status BEFORE UPDATE ON public.campaign_prospects FOR EACH ROW EXECUTE FUNCTION public.validate_prospect_status_update();


--
-- Name: workspace_meeting_agent_config workspace_meeting_agent_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workspace_meeting_agent_config_updated_at BEFORE UPDATE ON public.workspace_meeting_agent_config FOR EACH ROW EXECUTE FUNCTION public.update_meetings_updated_at();


--
-- Name: agent_fix_proposals agent_fix_proposals_health_check_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_fix_proposals
    ADD CONSTRAINT agent_fix_proposals_health_check_id_fkey FOREIGN KEY (health_check_id) REFERENCES public.system_health_checks(id);


--
-- Name: api_keys api_keys_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaign_messages campaign_messages_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_messages
    ADD CONSTRAINT campaign_messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_messages campaign_messages_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_messages
    ADD CONSTRAINT campaign_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaign_optimizations campaign_optimizations_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_optimizations
    ADD CONSTRAINT campaign_optimizations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_prospect_execution_state campaign_prospect_execution_state_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_prospect_execution_state
    ADD CONSTRAINT campaign_prospect_execution_state_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_prospect_execution_state campaign_prospect_execution_state_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_prospect_execution_state
    ADD CONSTRAINT campaign_prospect_execution_state_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE CASCADE;


--
-- Name: campaign_prospects campaign_prospects_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_prospects
    ADD CONSTRAINT campaign_prospects_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id);


--
-- Name: campaign_prospects campaign_prospects_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_prospects
    ADD CONSTRAINT campaign_prospects_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_prospects campaign_prospects_master_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_prospects
    ADD CONSTRAINT campaign_prospects_master_prospect_id_fkey FOREIGN KEY (master_prospect_id) REFERENCES public.workspace_prospects(id);


--
-- Name: campaign_prospects campaign_prospects_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_prospects
    ADD CONSTRAINT campaign_prospects_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id);


--
-- Name: campaign_replies campaign_replies_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_replies
    ADD CONSTRAINT campaign_replies_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_replies campaign_replies_campaign_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_replies
    ADD CONSTRAINT campaign_replies_campaign_message_id_fkey FOREIGN KEY (campaign_message_id) REFERENCES public.campaign_messages(id) ON DELETE CASCADE;


--
-- Name: campaign_replies campaign_replies_email_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_replies
    ADD CONSTRAINT campaign_replies_email_response_id_fkey FOREIGN KEY (email_response_id) REFERENCES public.email_responses(id) ON DELETE SET NULL;


--
-- Name: campaign_replies campaign_replies_feedback_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_replies
    ADD CONSTRAINT campaign_replies_feedback_by_fkey FOREIGN KEY (feedback_by) REFERENCES auth.users(id);


--
-- Name: campaign_replies campaign_replies_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_replies
    ADD CONSTRAINT campaign_replies_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: campaign_replies campaign_replies_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_replies
    ADD CONSTRAINT campaign_replies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaign_schedules campaign_schedules_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_schedules
    ADD CONSTRAINT campaign_schedules_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_schedules campaign_schedules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_schedules
    ADD CONSTRAINT campaign_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: campaign_schedules campaign_schedules_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_schedules
    ADD CONSTRAINT campaign_schedules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: campaign_settings campaign_settings_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_settings
    ADD CONSTRAINT campaign_settings_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_settings campaign_settings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_settings
    ADD CONSTRAINT campaign_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: campaign_settings campaign_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_settings
    ADD CONSTRAINT campaign_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: campaign_settings campaign_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_settings
    ADD CONSTRAINT campaign_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: campaign_settings campaign_settings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_settings
    ADD CONSTRAINT campaign_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_core_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_core_template_id_fkey FOREIGN KEY (core_template_id) REFERENCES public.core_funnel_templates(id);


--
-- Name: campaigns campaigns_dynamic_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_dynamic_definition_id_fkey FOREIGN KEY (dynamic_definition_id) REFERENCES public.dynamic_funnel_definitions(id);


--
-- Name: campaigns campaigns_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: conversation_analytics conversation_analytics_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_analytics
    ADD CONSTRAINT conversation_analytics_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.sam_conversation_threads(id) ON DELETE CASCADE;


--
-- Name: conversation_analytics conversation_analytics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_analytics
    ADD CONSTRAINT conversation_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversation_analytics conversation_analytics_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_analytics
    ADD CONSTRAINT conversation_analytics_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: conversation_insights conversation_insights_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_insights
    ADD CONSTRAINT conversation_insights_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.sam_conversation_threads(id) ON DELETE CASCADE;


--
-- Name: core_funnel_executions core_funnel_executions_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_funnel_executions
    ADD CONSTRAINT core_funnel_executions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: core_funnel_executions core_funnel_executions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_funnel_executions
    ADD CONSTRAINT core_funnel_executions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.core_funnel_templates(id) ON DELETE CASCADE;


--
-- Name: crm_conflict_resolutions crm_conflict_resolutions_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conflict_resolutions
    ADD CONSTRAINT crm_conflict_resolutions_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: crm_conflict_resolutions crm_conflict_resolutions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conflict_resolutions
    ADD CONSTRAINT crm_conflict_resolutions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: crm_connections crm_connections_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_connections
    ADD CONSTRAINT crm_connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: crm_contact_mappings crm_contact_mappings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contact_mappings
    ADD CONSTRAINT crm_contact_mappings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: crm_field_mappings crm_field_mappings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_field_mappings
    ADD CONSTRAINT crm_field_mappings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: crm_sync_logs crm_sync_logs_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_sync_logs
    ADD CONSTRAINT crm_sync_logs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.crm_connections(id) ON DELETE CASCADE;


--
-- Name: crm_sync_logs crm_sync_logs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_sync_logs
    ADD CONSTRAINT crm_sync_logs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: data_retention_policies data_retention_policies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: data_retention_policies data_retention_policies_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: deployment_logs deployment_logs_deployed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_logs
    ADD CONSTRAINT deployment_logs_deployed_by_fkey FOREIGN KEY (deployed_by) REFERENCES auth.users(id);


--
-- Name: document_ai_analysis document_ai_analysis_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_ai_analysis
    ADD CONSTRAINT document_ai_analysis_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_base_documents(id) ON DELETE CASCADE;


--
-- Name: document_ai_analysis document_ai_analysis_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_ai_analysis
    ADD CONSTRAINT document_ai_analysis_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: dpa_update_notifications dpa_update_notifications_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpa_update_notifications
    ADD CONSTRAINT dpa_update_notifications_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id);


--
-- Name: dpa_update_notifications dpa_update_notifications_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpa_update_notifications
    ADD CONSTRAINT dpa_update_notifications_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: dpa_versions dpa_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpa_versions
    ADD CONSTRAINT dpa_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: dynamic_funnel_definitions dynamic_funnel_definitions_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_definitions
    ADD CONSTRAINT dynamic_funnel_definitions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: dynamic_funnel_executions dynamic_funnel_executions_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_executions
    ADD CONSTRAINT dynamic_funnel_executions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: dynamic_funnel_executions dynamic_funnel_executions_funnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_executions
    ADD CONSTRAINT dynamic_funnel_executions_funnel_id_fkey FOREIGN KEY (funnel_id) REFERENCES public.dynamic_funnel_definitions(id) ON DELETE CASCADE;


--
-- Name: dynamic_funnel_steps dynamic_funnel_steps_funnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_steps
    ADD CONSTRAINT dynamic_funnel_steps_funnel_id_fkey FOREIGN KEY (funnel_id) REFERENCES public.dynamic_funnel_definitions(id) ON DELETE CASCADE;


--
-- Name: email_campaign_prospects email_campaign_prospects_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaign_prospects
    ADD CONSTRAINT email_campaign_prospects_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: email_campaign_prospects email_campaign_prospects_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_campaign_prospects
    ADD CONSTRAINT email_campaign_prospects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: email_providers email_providers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_providers
    ADD CONSTRAINT email_providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: email_responses email_responses_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_responses
    ADD CONSTRAINT email_responses_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: email_responses email_responses_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_responses
    ADD CONSTRAINT email_responses_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: email_send_queue email_send_queue_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_queue
    ADD CONSTRAINT email_send_queue_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: email_send_queue email_send_queue_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_queue
    ADD CONSTRAINT email_send_queue_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE CASCADE;


--
-- Name: enrichment_jobs enrichment_jobs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_jobs
    ADD CONSTRAINT enrichment_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: enrichment_jobs enrichment_jobs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_jobs
    ADD CONSTRAINT enrichment_jobs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaign_replies fk_campaign_replies_prospect; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_replies
    ADD CONSTRAINT fk_campaign_replies_prospect FOREIGN KEY (prospect_id) REFERENCES public.workspace_prospects(id) ON DELETE SET NULL;


--
-- Name: campaign_schedules fk_campaign_schedules_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_schedules
    ADD CONSTRAINT fk_campaign_schedules_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: campaigns fk_campaigns_linkedin_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT fk_campaigns_linkedin_account FOREIGN KEY (linkedin_account_id) REFERENCES public.user_unipile_accounts(id) ON DELETE SET NULL;


--
-- Name: campaigns fk_campaigns_template_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT fk_campaigns_template_id FOREIGN KEY (template_id) REFERENCES public.messaging_templates(id);


--
-- Name: core_funnel_executions fk_core_funnel_executions_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_funnel_executions
    ADD CONSTRAINT fk_core_funnel_executions_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: core_funnel_templates fk_core_funnel_templates_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_funnel_templates
    ADD CONSTRAINT fk_core_funnel_templates_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_base_document_usage fk_document; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_document_usage
    ADD CONSTRAINT fk_document FOREIGN KEY (document_id) REFERENCES public.knowledge_base_documents(id) ON DELETE CASCADE;


--
-- Name: dynamic_funnel_definitions fk_dynamic_funnel_definitions_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_definitions
    ADD CONSTRAINT fk_dynamic_funnel_definitions_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: dynamic_funnel_executions fk_dynamic_funnel_executions_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_executions
    ADD CONSTRAINT fk_dynamic_funnel_executions_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: dynamic_funnel_steps fk_dynamic_funnel_steps_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dynamic_funnel_steps
    ADD CONSTRAINT fk_dynamic_funnel_steps_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: funnel_adaptation_logs fk_funnel_adaptation_logs_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_adaptation_logs
    ADD CONSTRAINT fk_funnel_adaptation_logs_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: funnel_performance_metrics fk_funnel_performance_metrics_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_performance_metrics
    ADD CONSTRAINT fk_funnel_performance_metrics_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: funnel_step_logs fk_funnel_step_logs_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_step_logs
    ADD CONSTRAINT fk_funnel_step_logs_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sam_conversation_attachments fk_message; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_attachments
    ADD CONSTRAINT fk_message FOREIGN KEY (message_id) REFERENCES public.sam_conversation_messages(id) ON DELETE CASCADE;


--
-- Name: message_outbox fk_message_outbox_reply; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_outbox
    ADD CONSTRAINT fk_message_outbox_reply FOREIGN KEY (reply_id) REFERENCES public.campaign_replies(id) ON DELETE SET NULL;


--
-- Name: prospect_approval_decisions fk_prospect_approval_decisions_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_decisions
    ADD CONSTRAINT fk_prospect_approval_decisions_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: prospect_learning_logs fk_prospect_learning_logs_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_learning_logs
    ADD CONSTRAINT fk_prospect_learning_logs_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: prospect_search_results fk_prospect_search_results_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_search_results
    ADD CONSTRAINT fk_prospect_search_results_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sam_conversation_messages fk_sam_conversation_messages_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_messages
    ADD CONSTRAINT fk_sam_conversation_messages_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sam_funnel_analytics fk_sam_funnel_analytics_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_analytics
    ADD CONSTRAINT fk_sam_funnel_analytics_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sam_funnel_messages fk_sam_funnel_messages_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_messages
    ADD CONSTRAINT fk_sam_funnel_messages_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sam_funnel_responses fk_sam_funnel_responses_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_responses
    ADD CONSTRAINT fk_sam_funnel_responses_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sam_conversation_attachments fk_thread; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_attachments
    ADD CONSTRAINT fk_thread FOREIGN KEY (thread_id) REFERENCES public.sam_conversation_threads(id) ON DELETE CASCADE;


--
-- Name: webhook_error_logs fk_webhook_error_logs_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_error_logs
    ADD CONSTRAINT fk_webhook_error_logs_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: knowledge_base_document_usage fk_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_document_usage
    ADD CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: follow_up_drafts follow_up_drafts_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_drafts
    ADD CONSTRAINT follow_up_drafts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: follow_up_drafts follow_up_drafts_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_drafts
    ADD CONSTRAINT follow_up_drafts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: follow_up_drafts follow_up_drafts_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_drafts
    ADD CONSTRAINT follow_up_drafts_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE CASCADE;


--
-- Name: follow_up_drafts follow_up_drafts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_up_drafts
    ADD CONSTRAINT follow_up_drafts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: funnel_adaptation_logs funnel_adaptation_logs_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_adaptation_logs
    ADD CONSTRAINT funnel_adaptation_logs_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.dynamic_funnel_definitions(id) ON DELETE CASCADE;


--
-- Name: funnel_performance_metrics funnel_performance_metrics_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_performance_metrics
    ADD CONSTRAINT funnel_performance_metrics_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: funnel_step_logs funnel_step_logs_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_step_logs
    ADD CONSTRAINT funnel_step_logs_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id);


--
-- Name: gdpr_deletion_requests gdpr_deletion_requests_executed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gdpr_deletion_requests
    ADD CONSTRAINT gdpr_deletion_requests_executed_by_fkey FOREIGN KEY (executed_by) REFERENCES public.users(id);


--
-- Name: gdpr_deletion_requests gdpr_deletion_requests_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gdpr_deletion_requests
    ADD CONSTRAINT gdpr_deletion_requests_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.workspace_prospects(id) ON DELETE SET NULL;


--
-- Name: gdpr_deletion_requests gdpr_deletion_requests_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gdpr_deletion_requests
    ADD CONSTRAINT gdpr_deletion_requests_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: gdpr_deletion_requests gdpr_deletion_requests_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gdpr_deletion_requests
    ADD CONSTRAINT gdpr_deletion_requests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: hitl_reply_approval_sessions hitl_reply_approval_sessions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hitl_reply_approval_sessions
    ADD CONSTRAINT hitl_reply_approval_sessions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: icp_configurations icp_configurations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icp_configurations
    ADD CONSTRAINT icp_configurations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: inbox_message_categories inbox_message_categories_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_message_categories
    ADD CONSTRAINT inbox_message_categories_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: inbox_message_tags inbox_message_tags_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_message_tags
    ADD CONSTRAINT inbox_message_tags_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.inbox_message_categories(id) ON DELETE SET NULL;


--
-- Name: inbox_message_tags inbox_message_tags_overridden_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_message_tags
    ADD CONSTRAINT inbox_message_tags_overridden_by_fkey FOREIGN KEY (overridden_by) REFERENCES auth.users(id);


--
-- Name: inbox_message_tags inbox_message_tags_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbox_message_tags
    ADD CONSTRAINT inbox_message_tags_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_base_competitors knowledge_base_competitors_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_competitors
    ADD CONSTRAINT knowledge_base_competitors_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: knowledge_base_competitors knowledge_base_competitors_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_competitors
    ADD CONSTRAINT knowledge_base_competitors_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_base_content knowledge_base_content_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_content
    ADD CONSTRAINT knowledge_base_content_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: knowledge_base_content knowledge_base_content_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_content
    ADD CONSTRAINT knowledge_base_content_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_base_document_usage knowledge_base_document_usage_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_document_usage
    ADD CONSTRAINT knowledge_base_document_usage_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_base_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_base_document_usage knowledge_base_document_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_document_usage
    ADD CONSTRAINT knowledge_base_document_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: knowledge_base_document_usage knowledge_base_document_usage_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_document_usage
    ADD CONSTRAINT knowledge_base_document_usage_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_base_documents knowledge_base_documents_icp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_documents
    ADD CONSTRAINT knowledge_base_documents_icp_id_fkey FOREIGN KEY (icp_id) REFERENCES public.knowledge_base_icps(id) ON DELETE SET NULL;


--
-- Name: knowledge_base_documents knowledge_base_documents_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_documents
    ADD CONSTRAINT knowledge_base_documents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_base knowledge_base_icp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_icp_id_fkey FOREIGN KEY (icp_id) REFERENCES public.knowledge_base_icps(id) ON DELETE SET NULL;


--
-- Name: knowledge_base_icps knowledge_base_icps_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_icps
    ADD CONSTRAINT knowledge_base_icps_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: knowledge_base_icps knowledge_base_icps_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_icps
    ADD CONSTRAINT knowledge_base_icps_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_base_personas knowledge_base_personas_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_personas
    ADD CONSTRAINT knowledge_base_personas_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: knowledge_base_personas knowledge_base_personas_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_personas
    ADD CONSTRAINT knowledge_base_personas_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_base_products knowledge_base_products_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_products
    ADD CONSTRAINT knowledge_base_products_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: knowledge_base_products knowledge_base_products_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_products
    ADD CONSTRAINT knowledge_base_products_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_base_sections knowledge_base_sections_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_sections
    ADD CONSTRAINT knowledge_base_sections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_base knowledge_base_source_attachment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_source_attachment_id_fkey FOREIGN KEY (source_attachment_id) REFERENCES public.sam_conversation_attachments(id) ON DELETE SET NULL;


--
-- Name: knowledge_base_vectors knowledge_base_vectors_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_vectors
    ADD CONSTRAINT knowledge_base_vectors_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_base(id) ON DELETE CASCADE;


--
-- Name: knowledge_base_vectors knowledge_base_vectors_icp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_vectors
    ADD CONSTRAINT knowledge_base_vectors_icp_id_fkey FOREIGN KEY (icp_id) REFERENCES public.knowledge_base_icps(id) ON DELETE SET NULL;


--
-- Name: knowledge_base_vectors knowledge_base_vectors_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_vectors
    ADD CONSTRAINT knowledge_base_vectors_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_base knowledge_base_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: knowledge_gap_tracking knowledge_gap_tracking_insight_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_gap_tracking
    ADD CONSTRAINT knowledge_gap_tracking_insight_id_fkey FOREIGN KEY (insight_id) REFERENCES public.conversation_insights(id) ON DELETE SET NULL;


--
-- Name: link_clicks link_clicks_tracked_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_clicks
    ADD CONSTRAINT link_clicks_tracked_link_id_fkey FOREIGN KEY (tracked_link_id) REFERENCES public.tracked_links(id) ON DELETE CASCADE;


--
-- Name: linkedin_author_relationships linkedin_author_relationships_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_author_relationships
    ADD CONSTRAINT linkedin_author_relationships_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: linkedin_brand_guidelines linkedin_brand_guidelines_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_brand_guidelines
    ADD CONSTRAINT linkedin_brand_guidelines_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: linkedin_comment_performance_stats linkedin_comment_performance_stats_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comment_performance_stats
    ADD CONSTRAINT linkedin_comment_performance_stats_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: linkedin_comment_queue linkedin_comment_queue_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comment_queue
    ADD CONSTRAINT linkedin_comment_queue_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: linkedin_comment_queue linkedin_comment_queue_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comment_queue
    ADD CONSTRAINT linkedin_comment_queue_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.linkedin_posts_discovered(id) ON DELETE SET NULL;


--
-- Name: linkedin_comment_queue linkedin_comment_queue_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comment_queue
    ADD CONSTRAINT linkedin_comment_queue_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: linkedin_comment_replies linkedin_comment_replies_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comment_replies
    ADD CONSTRAINT linkedin_comment_replies_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.linkedin_posts_discovered(id) ON DELETE CASCADE;


--
-- Name: linkedin_comment_replies linkedin_comment_replies_replied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comment_replies
    ADD CONSTRAINT linkedin_comment_replies_replied_by_fkey FOREIGN KEY (replied_by) REFERENCES auth.users(id);


--
-- Name: linkedin_comment_replies linkedin_comment_replies_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comment_replies
    ADD CONSTRAINT linkedin_comment_replies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: linkedin_comments_posted linkedin_comments_posted_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comments_posted
    ADD CONSTRAINT linkedin_comments_posted_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.linkedin_posts_discovered(id) ON DELETE SET NULL;


--
-- Name: linkedin_comments_posted linkedin_comments_posted_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comments_posted
    ADD CONSTRAINT linkedin_comments_posted_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.linkedin_comment_queue(id) ON DELETE SET NULL;


--
-- Name: linkedin_comments_posted linkedin_comments_posted_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_comments_posted
    ADD CONSTRAINT linkedin_comments_posted_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: linkedin_messages linkedin_messages_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_messages
    ADD CONSTRAINT linkedin_messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: linkedin_messages linkedin_messages_linkedin_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_messages
    ADD CONSTRAINT linkedin_messages_linkedin_account_id_fkey FOREIGN KEY (linkedin_account_id) REFERENCES public.workspace_accounts(id) ON DELETE SET NULL;


--
-- Name: linkedin_messages linkedin_messages_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_messages
    ADD CONSTRAINT linkedin_messages_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE SET NULL;


--
-- Name: linkedin_messages linkedin_messages_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_messages
    ADD CONSTRAINT linkedin_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: linkedin_post_comments linkedin_post_comments_monitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_post_comments
    ADD CONSTRAINT linkedin_post_comments_monitor_id_fkey FOREIGN KEY (monitor_id) REFERENCES public.linkedin_post_monitors(id) ON DELETE CASCADE;


--
-- Name: linkedin_post_comments linkedin_post_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_post_comments
    ADD CONSTRAINT linkedin_post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.linkedin_posts_discovered(id) ON DELETE CASCADE;


--
-- Name: linkedin_post_comments linkedin_post_comments_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_post_comments
    ADD CONSTRAINT linkedin_post_comments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: linkedin_post_monitors linkedin_post_monitors_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_post_monitors
    ADD CONSTRAINT linkedin_post_monitors_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: linkedin_post_monitors linkedin_post_monitors_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_post_monitors
    ADD CONSTRAINT linkedin_post_monitors_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: linkedin_posts_discovered linkedin_posts_discovered_monitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_posts_discovered
    ADD CONSTRAINT linkedin_posts_discovered_monitor_id_fkey FOREIGN KEY (monitor_id) REFERENCES public.linkedin_post_monitors(id) ON DELETE SET NULL;


--
-- Name: linkedin_posts_discovered linkedin_posts_discovered_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_posts_discovered
    ADD CONSTRAINT linkedin_posts_discovered_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: linkedin_proxy_assignments linkedin_proxy_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_proxy_assignments
    ADD CONSTRAINT linkedin_proxy_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: linkedin_reposts linkedin_reposts_original_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_reposts
    ADD CONSTRAINT linkedin_reposts_original_post_id_fkey FOREIGN KEY (original_post_id) REFERENCES public.linkedin_posts_discovered(id);


--
-- Name: linkedin_reposts linkedin_reposts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_reposts
    ADD CONSTRAINT linkedin_reposts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: linkedin_searches linkedin_searches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_searches
    ADD CONSTRAINT linkedin_searches_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: linkedin_self_post_comment_replies linkedin_self_post_comment_replies_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_self_post_comment_replies
    ADD CONSTRAINT linkedin_self_post_comment_replies_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: linkedin_self_post_comment_replies linkedin_self_post_comment_replies_monitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_self_post_comment_replies
    ADD CONSTRAINT linkedin_self_post_comment_replies_monitor_id_fkey FOREIGN KEY (monitor_id) REFERENCES public.linkedin_self_post_monitors(id) ON DELETE CASCADE;


--
-- Name: linkedin_self_post_comment_replies linkedin_self_post_comment_replies_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_self_post_comment_replies
    ADD CONSTRAINT linkedin_self_post_comment_replies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: linkedin_self_post_monitors linkedin_self_post_monitors_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_self_post_monitors
    ADD CONSTRAINT linkedin_self_post_monitors_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: magic_link_tokens magic_link_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magic_link_tokens
    ADD CONSTRAINT magic_link_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: meeting_follow_up_drafts meeting_follow_up_drafts_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_follow_up_drafts
    ADD CONSTRAINT meeting_follow_up_drafts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: meeting_follow_up_drafts meeting_follow_up_drafts_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_follow_up_drafts
    ADD CONSTRAINT meeting_follow_up_drafts_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


--
-- Name: meeting_follow_up_drafts meeting_follow_up_drafts_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_follow_up_drafts
    ADD CONSTRAINT meeting_follow_up_drafts_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE CASCADE;


--
-- Name: meeting_follow_up_drafts meeting_follow_up_drafts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_follow_up_drafts
    ADD CONSTRAINT meeting_follow_up_drafts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: meeting_reminders meeting_reminders_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_reminders
    ADD CONSTRAINT meeting_reminders_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


--
-- Name: meeting_reminders meeting_reminders_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_reminders
    ADD CONSTRAINT meeting_reminders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: meetings meetings_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: meetings meetings_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE CASCADE;


--
-- Name: meetings meetings_source_reply_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_source_reply_draft_id_fkey FOREIGN KEY (source_reply_draft_id) REFERENCES public.reply_agent_drafts(id);


--
-- Name: meetings meetings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: memory_snapshots memory_snapshots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_snapshots
    ADD CONSTRAINT memory_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: memory_snapshots memory_snapshots_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_snapshots
    ADD CONSTRAINT memory_snapshots_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: message_outbox message_outbox_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_outbox
    ADD CONSTRAINT message_outbox_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: message_outbox message_outbox_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_outbox
    ADD CONSTRAINT message_outbox_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: n8n_campaign_executions n8n_campaign_executions_workspace_n8n_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.n8n_campaign_executions
    ADD CONSTRAINT n8n_campaign_executions_workspace_n8n_workflow_id_fkey FOREIGN KEY (workspace_n8n_workflow_id) REFERENCES public.workspace_n8n_workflows(id) ON DELETE CASCADE;


--
-- Name: oauth_states oauth_states_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_states oauth_states_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: pii_access_log pii_access_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pii_access_log
    ADD CONSTRAINT pii_access_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: pii_access_log pii_access_log_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pii_access_log
    ADD CONSTRAINT pii_access_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: prospect_approval_data prospect_approval_data_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_data
    ADD CONSTRAINT prospect_approval_data_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.prospect_approval_sessions(id) ON DELETE CASCADE;


--
-- Name: prospect_approval_decisions prospect_approval_decisions_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_decisions
    ADD CONSTRAINT prospect_approval_decisions_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: prospect_approval_decisions prospect_approval_decisions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_decisions
    ADD CONSTRAINT prospect_approval_decisions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.prospect_approval_sessions(id) ON DELETE CASCADE;


--
-- Name: prospect_approval_sessions prospect_approval_sessions_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_sessions
    ADD CONSTRAINT prospect_approval_sessions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: prospect_approval_sessions prospect_approval_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_sessions
    ADD CONSTRAINT prospect_approval_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: prospect_approval_sessions prospect_approval_sessions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_approval_sessions
    ADD CONSTRAINT prospect_approval_sessions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: prospect_exports prospect_exports_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_exports
    ADD CONSTRAINT prospect_exports_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.prospect_approval_sessions(id) ON DELETE CASCADE;


--
-- Name: prospect_exports prospect_exports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_exports
    ADD CONSTRAINT prospect_exports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: prospect_exports prospect_exports_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_exports
    ADD CONSTRAINT prospect_exports_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: prospect_learning_logs prospect_learning_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_learning_logs
    ADD CONSTRAINT prospect_learning_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.prospect_approval_sessions(id) ON DELETE CASCADE;


--
-- Name: prospect_search_jobs prospect_search_jobs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_search_jobs
    ADD CONSTRAINT prospect_search_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: prospect_search_results prospect_search_results_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_search_results
    ADD CONSTRAINT prospect_search_results_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.prospect_search_jobs(id) ON DELETE CASCADE;


--
-- Name: reply_agent_drafts reply_agent_drafts_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_agent_drafts
    ADD CONSTRAINT reply_agent_drafts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: reply_agent_drafts reply_agent_drafts_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_agent_drafts
    ADD CONSTRAINT reply_agent_drafts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: reply_agent_drafts reply_agent_drafts_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_agent_drafts
    ADD CONSTRAINT reply_agent_drafts_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE SET NULL;


--
-- Name: reply_agent_drafts reply_agent_drafts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_agent_drafts
    ADD CONSTRAINT reply_agent_drafts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: reply_agent_metrics reply_agent_metrics_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_agent_metrics
    ADD CONSTRAINT reply_agent_metrics_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: reply_agent_settings reply_agent_settings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_agent_settings
    ADD CONSTRAINT reply_agent_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: reply_feedback_reasons reply_feedback_reasons_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_feedback_reasons
    ADD CONSTRAINT reply_feedback_reasons_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: reply_feedback_reasons reply_feedback_reasons_reply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_feedback_reasons
    ADD CONSTRAINT reply_feedback_reasons_reply_id_fkey FOREIGN KEY (reply_id) REFERENCES public.campaign_replies(id) ON DELETE CASCADE;


--
-- Name: sam_conversation_attachments sam_conversation_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_attachments
    ADD CONSTRAINT sam_conversation_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.sam_conversation_messages(id) ON DELETE CASCADE;


--
-- Name: sam_conversation_attachments sam_conversation_attachments_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_attachments
    ADD CONSTRAINT sam_conversation_attachments_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.sam_conversation_threads(id) ON DELETE CASCADE;


--
-- Name: sam_conversation_attachments sam_conversation_attachments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_attachments
    ADD CONSTRAINT sam_conversation_attachments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sam_conversation_attachments sam_conversation_attachments_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_attachments
    ADD CONSTRAINT sam_conversation_attachments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sam_conversation_messages sam_conversation_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_messages
    ADD CONSTRAINT sam_conversation_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.sam_conversation_threads(id) ON DELETE CASCADE;


--
-- Name: sam_conversation_messages sam_conversation_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_messages
    ADD CONSTRAINT sam_conversation_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: sam_conversation_threads sam_conversation_threads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_conversation_threads
    ADD CONSTRAINT sam_conversation_threads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sam_funnel_analytics sam_funnel_analytics_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_analytics
    ADD CONSTRAINT sam_funnel_analytics_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.sam_funnel_executions(id) ON DELETE CASCADE;


--
-- Name: sam_funnel_executions sam_funnel_executions_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_executions
    ADD CONSTRAINT sam_funnel_executions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: sam_funnel_executions sam_funnel_executions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_executions
    ADD CONSTRAINT sam_funnel_executions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sam_funnel_messages sam_funnel_messages_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_messages
    ADD CONSTRAINT sam_funnel_messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: sam_funnel_messages sam_funnel_messages_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_messages
    ADD CONSTRAINT sam_funnel_messages_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.sam_funnel_executions(id) ON DELETE CASCADE;


--
-- Name: sam_funnel_messages sam_funnel_messages_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_messages
    ADD CONSTRAINT sam_funnel_messages_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE CASCADE;


--
-- Name: sam_funnel_responses sam_funnel_responses_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_responses
    ADD CONSTRAINT sam_funnel_responses_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.sam_funnel_executions(id) ON DELETE CASCADE;


--
-- Name: sam_funnel_responses sam_funnel_responses_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_responses
    ADD CONSTRAINT sam_funnel_responses_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.sam_funnel_messages(id) ON DELETE CASCADE;


--
-- Name: sam_funnel_responses sam_funnel_responses_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_funnel_responses
    ADD CONSTRAINT sam_funnel_responses_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE CASCADE;


--
-- Name: sam_icp_discovery_sessions sam_icp_discovery_sessions_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_icp_discovery_sessions
    ADD CONSTRAINT sam_icp_discovery_sessions_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.sam_conversation_threads(id) ON DELETE CASCADE;


--
-- Name: sam_icp_discovery_sessions sam_icp_discovery_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_icp_discovery_sessions
    ADD CONSTRAINT sam_icp_discovery_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sam_icp_discovery_sessions sam_icp_discovery_sessions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_icp_discovery_sessions
    ADD CONSTRAINT sam_icp_discovery_sessions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sam_icp_knowledge_entries sam_icp_knowledge_entries_discovery_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_icp_knowledge_entries
    ADD CONSTRAINT sam_icp_knowledge_entries_discovery_session_id_fkey FOREIGN KEY (discovery_session_id) REFERENCES public.sam_icp_discovery_sessions(id) ON DELETE CASCADE;


--
-- Name: sam_icp_knowledge_entries sam_icp_knowledge_entries_source_attachment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_icp_knowledge_entries
    ADD CONSTRAINT sam_icp_knowledge_entries_source_attachment_id_fkey FOREIGN KEY (source_attachment_id) REFERENCES public.sam_conversation_attachments(id) ON DELETE SET NULL;


--
-- Name: sam_icp_knowledge_entries sam_icp_knowledge_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_icp_knowledge_entries
    ADD CONSTRAINT sam_icp_knowledge_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sam_icp_knowledge_entries sam_icp_knowledge_entries_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_icp_knowledge_entries
    ADD CONSTRAINT sam_icp_knowledge_entries_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sam_knowledge_summaries sam_knowledge_summaries_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_knowledge_summaries
    ADD CONSTRAINT sam_knowledge_summaries_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_base_documents(id) ON DELETE CASCADE;


--
-- Name: sam_knowledge_summaries sam_knowledge_summaries_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_knowledge_summaries
    ADD CONSTRAINT sam_knowledge_summaries_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sam_learning_models sam_learning_models_last_training_session_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_learning_models
    ADD CONSTRAINT sam_learning_models_last_training_session_fkey FOREIGN KEY (last_training_session) REFERENCES public.prospect_approval_sessions(id);


--
-- Name: sam_learning_models sam_learning_models_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_learning_models
    ADD CONSTRAINT sam_learning_models_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sam_learning_models sam_learning_models_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sam_learning_models
    ADD CONSTRAINT sam_learning_models_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: send_queue send_queue_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.send_queue
    ADD CONSTRAINT send_queue_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: send_queue send_queue_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.send_queue
    ADD CONSTRAINT send_queue_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE CASCADE;


--
-- Name: slack_app_config slack_app_config_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_app_config
    ADD CONSTRAINT slack_app_config_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: slack_channels slack_channels_linked_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_channels
    ADD CONSTRAINT slack_channels_linked_campaign_id_fkey FOREIGN KEY (linked_campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: slack_channels slack_channels_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_channels
    ADD CONSTRAINT slack_channels_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: slack_messages slack_messages_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_messages
    ADD CONSTRAINT slack_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: slack_pending_actions slack_pending_actions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_pending_actions
    ADD CONSTRAINT slack_pending_actions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: slack_pending_installations slack_pending_installations_linked_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_pending_installations
    ADD CONSTRAINT slack_pending_installations_linked_workspace_id_fkey FOREIGN KEY (linked_workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: slack_user_mapping slack_user_mapping_sam_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_user_mapping
    ADD CONSTRAINT slack_user_mapping_sam_user_id_fkey FOREIGN KEY (sam_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: slack_user_mapping slack_user_mapping_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_user_mapping
    ADD CONSTRAINT slack_user_mapping_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: system_alerts system_alerts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_alerts
    ADD CONSTRAINT system_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id);


--
-- Name: template_performance template_performance_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_performance
    ADD CONSTRAINT template_performance_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.messaging_templates(id) ON DELETE CASCADE;


--
-- Name: tracked_links tracked_links_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracked_links
    ADD CONSTRAINT tracked_links_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: tracked_links tracked_links_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracked_links
    ADD CONSTRAINT tracked_links_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE CASCADE;


--
-- Name: tracked_links tracked_links_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracked_links
    ADD CONSTRAINT tracked_links_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: user_memory_preferences user_memory_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memory_preferences
    ADD CONSTRAINT user_memory_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_memory_preferences user_memory_preferences_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memory_preferences
    ADD CONSTRAINT user_memory_preferences_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: user_organizations user_organizations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_organizations user_organizations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: user_unipile_accounts user_unipile_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_unipile_accounts
    ADD CONSTRAINT user_unipile_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_unipile_accounts user_unipile_accounts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_unipile_accounts
    ADD CONSTRAINT user_unipile_accounts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: users users_current_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_current_workspace_id_fkey FOREIGN KEY (current_workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: website_analysis_queue website_analysis_queue_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_analysis_queue
    ADD CONSTRAINT website_analysis_queue_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE SET NULL;


--
-- Name: website_analysis_queue website_analysis_queue_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_analysis_queue
    ADD CONSTRAINT website_analysis_queue_result_id_fkey FOREIGN KEY (result_id) REFERENCES public.website_analysis_results(id) ON DELETE SET NULL;


--
-- Name: website_analysis_queue website_analysis_queue_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_analysis_queue
    ADD CONSTRAINT website_analysis_queue_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: website_analysis_results website_analysis_results_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_analysis_results
    ADD CONSTRAINT website_analysis_results_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.campaign_prospects(id) ON DELETE SET NULL;


--
-- Name: website_analysis_results website_analysis_results_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_analysis_results
    ADD CONSTRAINT website_analysis_results_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workflow_deployment_history workflow_deployment_history_workspace_n8n_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_deployment_history
    ADD CONSTRAINT workflow_deployment_history_workspace_n8n_workflow_id_fkey FOREIGN KEY (workspace_n8n_workflow_id) REFERENCES public.workspace_n8n_workflows(id) ON DELETE CASCADE;


--
-- Name: workspace_account_limits workspace_account_limits_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_account_limits
    ADD CONSTRAINT workspace_account_limits_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_accounts workspace_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_accounts
    ADD CONSTRAINT workspace_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_accounts workspace_accounts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_accounts
    ADD CONSTRAINT workspace_accounts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_ai_search_config workspace_ai_search_config_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_ai_search_config
    ADD CONSTRAINT workspace_ai_search_config_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_analytics_reports workspace_analytics_reports_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_analytics_reports
    ADD CONSTRAINT workspace_analytics_reports_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_blacklists workspace_blacklists_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_blacklists
    ADD CONSTRAINT workspace_blacklists_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: workspace_blacklists workspace_blacklists_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_blacklists
    ADD CONSTRAINT workspace_blacklists_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_dpa_agreements workspace_dpa_agreements_signed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_dpa_agreements
    ADD CONSTRAINT workspace_dpa_agreements_signed_by_fkey FOREIGN KEY (signed_by) REFERENCES auth.users(id);


--
-- Name: workspace_dpa_agreements workspace_dpa_agreements_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_dpa_agreements
    ADD CONSTRAINT workspace_dpa_agreements_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: workspace_dpa_requirements workspace_dpa_requirements_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_dpa_requirements
    ADD CONSTRAINT workspace_dpa_requirements_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: workspace_encryption_keys workspace_encryption_keys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_encryption_keys
    ADD CONSTRAINT workspace_encryption_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workspace_encryption_keys workspace_encryption_keys_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_encryption_keys
    ADD CONSTRAINT workspace_encryption_keys_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_icp workspace_icp_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_icp
    ADD CONSTRAINT workspace_icp_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: workspace_icp workspace_icp_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_icp
    ADD CONSTRAINT workspace_icp_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_inbox_agent_config workspace_inbox_agent_config_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_inbox_agent_config
    ADD CONSTRAINT workspace_inbox_agent_config_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_integrations workspace_integrations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_integrations
    ADD CONSTRAINT workspace_integrations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_invitations workspace_invitations_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: workspace_invitations workspace_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_invitations workspace_invitations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_invoices workspace_invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invoices
    ADD CONSTRAINT workspace_invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: workspace_invoices workspace_invoices_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invoices
    ADD CONSTRAINT workspace_invoices_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_meeting_agent_config workspace_meeting_agent_config_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_meeting_agent_config
    ADD CONSTRAINT workspace_meeting_agent_config_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_prospects workspace_prospects_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_prospects
    ADD CONSTRAINT workspace_prospects_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id);


--
-- Name: workspace_reply_agent_config workspace_reply_agent_config_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_reply_agent_config
    ADD CONSTRAINT workspace_reply_agent_config_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_schedule_settings workspace_schedule_settings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_schedule_settings
    ADD CONSTRAINT workspace_schedule_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_searched_prospects workspace_searched_prospects_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_searched_prospects
    ADD CONSTRAINT workspace_searched_prospects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_stripe_customers workspace_stripe_customers_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_stripe_customers
    ADD CONSTRAINT workspace_stripe_customers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_subscriptions workspace_subscriptions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_subscriptions
    ADD CONSTRAINT workspace_subscriptions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_tiers workspace_tiers_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_tiers
    ADD CONSTRAINT workspace_tiers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_usage workspace_usage_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_usage
    ADD CONSTRAINT workspace_usage_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: workspace_usage workspace_usage_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_usage
    ADD CONSTRAINT workspace_usage_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_workflow_credentials workspace_workflow_credentials_workspace_n8n_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_workflow_credentials
    ADD CONSTRAINT workspace_workflow_credentials_workspace_n8n_workflow_id_fkey FOREIGN KEY (workspace_n8n_workflow_id) REFERENCES public.workspace_n8n_workflows(id) ON DELETE CASCADE;


--
-- Name: reply_agent_settings Admins can manage reply agent settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage reply agent settings" ON public.reply_agent_settings USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: template_components All users can access template components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All users can access template components" ON public.template_components USING (true);


--
-- Name: sam_funnel_template_performance All users can access template performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All users can access template performance" ON public.sam_funnel_template_performance FOR SELECT USING (true);


--
-- Name: email_send_queue Allow INSERT for service role on email_send_queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow INSERT for service role on email_send_queue" ON public.email_send_queue FOR INSERT WITH CHECK (true);


--
-- Name: email_send_queue Allow UPDATE for service role on email_send_queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow UPDATE for service role on email_send_queue" ON public.email_send_queue FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: n8n_campaign_executions Allow service role full access to n8n_campaign_executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow service role full access to n8n_campaign_executions" ON public.n8n_campaign_executions TO service_role USING (true) WITH CHECK (true);


--
-- Name: dpa_sub_processors Anyone can view active sub-processors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active sub-processors" ON public.dpa_sub_processors FOR SELECT USING ((is_active = true));


--
-- Name: dpa_versions Anyone can view current DPA versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view current DPA versions" ON public.dpa_versions FOR SELECT USING ((is_current = true));


--
-- Name: website_requests Authenticated users can update website requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update website requests" ON public.website_requests FOR UPDATE USING ((auth.role() = 'authenticated'::text));


--
-- Name: website_requests Authenticated users can view all website requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all website requests" ON public.website_requests FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: workspace_encryption_keys Block all user access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Block all user access" ON public.workspace_encryption_keys TO authenticated USING (false) WITH CHECK (false);


--
-- Name: n8n_campaign_executions Enable all access for campaign executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all access for campaign executions" ON public.n8n_campaign_executions USING (true);


--
-- Name: workflow_deployment_history Enable all access for deployment history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all access for deployment history" ON public.workflow_deployment_history USING (true);


--
-- Name: workspace_workflow_credentials Enable all access for workflow credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all access for workflow credentials" ON public.workspace_workflow_credentials USING (true);


--
-- Name: workspace_n8n_workflows Enable all access for workspace workflows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all access for workspace workflows" ON public.workspace_n8n_workflows USING (true);


--
-- Name: workflow_templates Enable read access for workflow templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for workflow templates" ON public.workflow_templates FOR SELECT USING (true);


--
-- Name: workspaces Owners can manage their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage their workspaces" ON public.workspaces TO authenticated USING ((id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text) AND (workspace_members.role = 'owner'::text))))) WITH CHECK ((id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text) AND (workspace_members.role = 'owner'::text)))));


--
-- Name: website_requests Public can submit website requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can submit website requests" ON public.website_requests FOR INSERT WITH CHECK (true);


--
-- Name: email_responses Service role can insert email responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert email responses" ON public.email_responses FOR INSERT WITH CHECK (true);


--
-- Name: workspace_stripe_customers Service role can manage Stripe customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage Stripe customers" ON public.workspace_stripe_customers USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: enrichment_jobs Service role can manage all enrichment jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all enrichment jobs" ON public.enrichment_jobs USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: campaign_prospect_execution_state Service role can manage all execution state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all execution state" ON public.campaign_prospect_execution_state TO service_role USING (true) WITH CHECK (true);


--
-- Name: workspace_members Service role can manage all members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all members" ON public.workspace_members TO service_role USING (true) WITH CHECK (true);


--
-- Name: linkedin_proxy_assignments Service role can manage all proxy assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all proxy assignments" ON public.linkedin_proxy_assignments USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: linkedin_comment_replies Service role can manage all replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all replies" ON public.linkedin_comment_replies USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: users Service role can manage all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all users" ON public.users USING ((auth.role() = 'service_role'::text));


--
-- Name: magic_link_tokens Service role can manage magic link tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage magic link tokens" ON public.magic_link_tokens USING ((auth.role() = 'service_role'::text));


--
-- Name: organizations Service role can manage organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage organizations" ON public.organizations USING ((auth.role() = 'service_role'::text));


--
-- Name: workspace_subscriptions Service role can manage subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage subscriptions" ON public.workspace_subscriptions USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: workspace_usage Service role can manage usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage usage" ON public.workspace_usage USING ((auth.role() = 'service_role'::text));


--
-- Name: workspace_invoices Service role can manage workspace invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage workspace invoices" ON public.workspace_invoices USING ((auth.role() = 'service_role'::text));


--
-- Name: slack_pending_installations Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.slack_pending_installations USING (true) WITH CHECK (true);


--
-- Name: campaign_prospects Service role full access on campaign_prospects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on campaign_prospects" ON public.campaign_prospects TO service_role USING (true) WITH CHECK (true);


--
-- Name: campaigns Service role full access on campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on campaigns" ON public.campaigns TO service_role USING (true) WITH CHECK (true);


--
-- Name: cron_job_logs Service role full access on cron_job_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on cron_job_logs" ON public.cron_job_logs TO service_role USING (true) WITH CHECK (true);


--
-- Name: prospect_approval_sessions Service role full access on prospect_approval_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on prospect_approval_sessions" ON public.prospect_approval_sessions TO service_role USING (true) WITH CHECK (true);


--
-- Name: workspace_accounts Service role full access on workspace_accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on workspace_accounts" ON public.workspace_accounts TO service_role USING (true) WITH CHECK (true);


--
-- Name: follow_up_drafts Service role full access to follow-up drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to follow-up drafts" ON public.follow_up_drafts USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: workspace_icp Service role full access to workspace_icp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to workspace_icp" ON public.workspace_icp USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: campaigns Service role full campaign access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full campaign access" ON public.campaigns TO service_role USING (true) WITH CHECK (true);


--
-- Name: campaign_prospects Service role full prospect access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full prospect access" ON public.campaign_prospects TO service_role USING (true) WITH CHECK (true);


--
-- Name: linkedin_messages Service role has full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role has full access" ON public.linkedin_messages USING ((auth.role() = 'service_role'::text));


--
-- Name: workspace_schedule_settings Service role has full access to schedule settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role has full access to schedule settings" ON public.workspace_schedule_settings USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: linkedin_author_relationships Service role manages author relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages author relationships" ON public.linkedin_author_relationships USING (true) WITH CHECK (true);


--
-- Name: linkedin_comment_performance_stats Service role manages performance stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages performance stats" ON public.linkedin_comment_performance_stats USING (true) WITH CHECK (true);


--
-- Name: workspace_encryption_keys Service role only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only" ON public.workspace_encryption_keys TO service_role USING (true) WITH CHECK (true);


--
-- Name: pii_access_log Service role sees all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role sees all" ON public.pii_access_log TO service_role USING (true) WITH CHECK (true);


--
-- Name: system_alerts Super admins can manage all alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage all alerts" ON public.system_alerts USING ((auth.email() = ANY (ARRAY['tl@innovareai.com'::text, 'cl@innovareai.com'::text])));


--
-- Name: deployment_logs Super admins can manage deployment logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage deployment logs" ON public.deployment_logs USING ((auth.email() = ANY (ARRAY['tl@innovareai.com'::text, 'cl@innovareai.com'::text])));


--
-- Name: qa_autofix_logs Super admins can view all QA logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all QA logs" ON public.qa_autofix_logs USING ((auth.email() = ANY (ARRAY['tl@innovareai.com'::text, 'cl@innovareai.com'::text])));


--
-- Name: conversation_analytics Super admins can view all conversation analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all conversation analytics" ON public.conversation_analytics FOR SELECT USING ((auth.email() = ANY (ARRAY['tl@innovareai.com'::text, 'cl@innovareai.com'::text])));


--
-- Name: system_health_logs Super admins can view all health logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all health logs" ON public.system_health_logs USING ((auth.email() = ANY (ARRAY['tl@innovareai.com'::text, 'cl@innovareai.com'::text])));


--
-- Name: user_sessions Super admins can view all sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all sessions" ON public.user_sessions FOR SELECT USING ((auth.email() = ANY (ARRAY['tl@innovareai.com'::text, 'cl@innovareai.com'::text])));


--
-- Name: sam_funnel_analytics Users can access analytics in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access analytics in their workspace" ON public.sam_funnel_analytics USING ((EXISTS ( SELECT 1
   FROM public.sam_funnel_executions sfe
  WHERE ((sfe.id = sam_funnel_analytics.execution_id) AND (sfe.workspace_id IN ( SELECT wm.workspace_id
           FROM public.workspace_members wm
          WHERE (wm.user_id = auth.uid())))))));


--
-- Name: sam_funnel_executions Users can access executions in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access executions in their workspace" ON public.sam_funnel_executions USING ((workspace_id IN ( SELECT wm.workspace_id
   FROM public.workspace_members wm
  WHERE (wm.user_id = auth.uid()))));


--
-- Name: sam_funnel_messages Users can access messages in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access messages in their workspace" ON public.sam_funnel_messages USING ((EXISTS ( SELECT 1
   FROM public.sam_funnel_executions sfe
  WHERE ((sfe.id = sam_funnel_messages.execution_id) AND (sfe.workspace_id IN ( SELECT wm.workspace_id
           FROM public.workspace_members wm
          WHERE (wm.user_id = auth.uid())))))));


--
-- Name: template_performance Users can access performance in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access performance in their workspace" ON public.template_performance USING ((EXISTS ( SELECT 1
   FROM public.messaging_templates mt
  WHERE ((mt.id = template_performance.template_id) AND (mt.workspace_id = current_setting('app.current_workspace_id'::text, true))))));


--
-- Name: workspace_prospects Users can access prospects in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access prospects in their workspace" ON public.workspace_prospects USING ((workspace_id = current_setting('app.current_workspace_id'::text, true)));


--
-- Name: sam_funnel_responses Users can access responses in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access responses in their workspace" ON public.sam_funnel_responses USING ((EXISTS ( SELECT 1
   FROM public.sam_funnel_executions sfe
  WHERE ((sfe.id = sam_funnel_responses.execution_id) AND (sfe.workspace_id IN ( SELECT wm.workspace_id
           FROM public.workspace_members wm
          WHERE (wm.user_id = auth.uid())))))));


--
-- Name: messaging_templates Users can access templates in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access templates in their workspace" ON public.messaging_templates USING ((workspace_id = current_setting('app.current_workspace_id'::text, true)));


--
-- Name: email_providers Users can access their own email providers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access their own email providers" ON public.email_providers USING ((auth.uid() = user_id));


--
-- Name: campaign_messages Users can access workspace campaign messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access workspace campaign messages" ON public.campaign_messages USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_prospects Users can access workspace campaign prospects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access workspace campaign prospects" ON public.campaign_prospects USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_replies Users can access workspace campaign replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access workspace campaign replies" ON public.campaign_replies USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaigns Users can access workspace campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access workspace campaigns" ON public.campaigns USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: reply_feedback_reasons Users can add feedback to their workspace replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add feedback to their workspace replies" ON public.reply_feedback_reasons FOR INSERT WITH CHECK ((reply_id IN ( SELECT cr.id
   FROM (public.campaign_replies cr
     JOIN public.campaigns c ON ((cr.campaign_id = c.id)))
  WHERE (c.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: api_keys Users can create API keys for their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create API keys for their workspaces" ON public.api_keys FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_approval_decisions Users can create decisions in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create decisions in their workspace" ON public.prospect_approval_decisions FOR INSERT WITH CHECK (((session_id IN ( SELECT prospect_approval_sessions.id
   FROM public.prospect_approval_sessions
  WHERE (prospect_approval_sessions.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))) AND (decided_by = auth.uid())));


--
-- Name: enrichment_jobs Users can create enrichment jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create enrichment jobs" ON public.enrichment_jobs FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: prospect_exports Users can create exports in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create exports in their workspace" ON public.prospect_exports FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: follow_up_drafts Users can create follow-up drafts in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create follow-up drafts in their workspace" ON public.follow_up_drafts FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_schedules Users can create schedules for their workspace campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create schedules for their workspace campaigns" ON public.campaign_schedules FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = campaign_schedules.campaign_id) AND (wm.user_id = auth.uid())))));


--
-- Name: prospect_approval_sessions Users can create sessions in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create sessions in their workspace" ON public.prospect_approval_sessions FOR INSERT WITH CHECK (((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))) AND (user_id = auth.uid())));


--
-- Name: sam_icp_discovery_sessions Users can create their own discovery sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own discovery sessions" ON public.sam_icp_discovery_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: memory_snapshots Users can create their own memory snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own memory snapshots" ON public.memory_snapshots FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: prospect_search_jobs Users can create their own search jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own search jobs" ON public.prospect_search_jobs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: workspace_icp Users can create workspace ICPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create workspace ICPs" ON public.workspace_icp FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_accounts Users can create workspace accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create workspace accounts" ON public.workspace_accounts FOR INSERT TO authenticated WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text)))));


--
-- Name: linkedin_post_comments Users can delete comments in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete comments in their workspace" ON public.linkedin_post_comments FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: follow_up_drafts Users can delete follow-up drafts in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete follow-up drafts in their workspace" ON public.follow_up_drafts FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: website_analysis_queue Users can delete from own workspace analysis queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete from own workspace analysis queue" ON public.website_analysis_queue FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_schedules Users can delete schedules for their workspace campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete schedules for their workspace campaigns" ON public.campaign_schedules FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = campaign_schedules.campaign_id) AND (wm.user_id = auth.uid())))));


--
-- Name: sam_conversation_attachments Users can delete their attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their attachments" ON public.sam_conversation_attachments FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: sam_icp_knowledge_entries Users can delete their own ICP knowledge; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own ICP knowledge" ON public.sam_icp_knowledge_entries FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: sam_icp_discovery_sessions Users can delete their own discovery sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own discovery sessions" ON public.sam_icp_discovery_sessions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: api_keys Users can delete their workspace API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their workspace API keys" ON public.api_keys FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_icp Users can delete workspace ICPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete workspace ICPs" ON public.workspace_icp FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_accounts Users can delete workspace accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete workspace accounts" ON public.workspace_accounts FOR DELETE TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text)))));


--
-- Name: linkedin_brand_guidelines Users can insert brand   guidelines in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert brand
  guidelines in their workspace" ON public.linkedin_brand_guidelines FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: linkedin_post_comments Users can insert comments in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert comments in their workspace" ON public.linkedin_post_comments FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: website_analysis_queue Users can insert into own workspace analysis queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert into own workspace analysis queue" ON public.website_analysis_queue FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_learning_logs Users can insert learning logs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert learning logs in their workspace" ON public.prospect_learning_logs FOR INSERT WITH CHECK ((session_id IN ( SELECT prospect_approval_sessions.id
   FROM public.prospect_approval_sessions
  WHERE (prospect_approval_sessions.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: workspace_ai_search_config Users can insert own workspace AI search config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own workspace AI search config" ON public.workspace_ai_search_config FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: website_analysis_results Users can insert own workspace analysis results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own workspace analysis results" ON public.website_analysis_results FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_inbox_agent_config Users can insert own workspace inbox agent config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own workspace inbox agent config" ON public.workspace_inbox_agent_config FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_approval_data Users can insert prospect data in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert prospect data in their workspace" ON public.prospect_approval_data FOR INSERT WITH CHECK ((session_id IN ( SELECT prospect_approval_sessions.id
   FROM public.prospect_approval_sessions
  WHERE (prospect_approval_sessions.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: linkedin_comment_replies Users can insert replies in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert replies in their workspace" ON public.linkedin_comment_replies FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_reply_agent_config Users can insert reply agent config for their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert reply agent config for their workspaces" ON public.workspace_reply_agent_config FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: sam_icp_knowledge_entries Users can insert their own ICP knowledge; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own ICP knowledge" ON public.sam_icp_knowledge_entries FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: workspace_schedule_settings Users can insert their workspace schedule settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their workspace schedule settings" ON public.workspace_schedule_settings FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: message_outbox Users can insert to outbox; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert to outbox" ON public.message_outbox FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_approval_sessions Users can manage approval sessions in their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage approval sessions in their workspaces" ON public.prospect_approval_sessions TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text))))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text)))));


--
-- Name: campaigns Users can manage campaigns in their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage campaigns in their workspaces" ON public.campaigns TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text))))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text)))));


--
-- Name: sam_learning_models Users can manage learning models in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage learning models in their workspace" ON public.sam_learning_models USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: inbox_message_categories Users can manage own workspace categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own workspace categories" ON public.inbox_message_categories USING (((is_system = false) AND (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: inbox_message_tags Users can manage own workspace message tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own workspace message tags" ON public.inbox_message_tags USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_prospects Users can manage prospects in their campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage prospects in their campaigns" ON public.campaign_prospects TO authenticated USING ((campaign_id IN ( SELECT c.id
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((c.workspace_id = wm.workspace_id)))
  WHERE ((wm.user_id = auth.uid()) AND (wm.status = 'active'::text))))) WITH CHECK ((campaign_id IN ( SELECT c.id
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((c.workspace_id = wm.workspace_id)))
  WHERE ((wm.user_id = auth.uid()) AND (wm.status = 'active'::text)))));


--
-- Name: user_memory_preferences Users can manage their own memory preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own memory preferences" ON public.user_memory_preferences USING ((user_id = auth.uid()));


--
-- Name: workspace_integrations Users can manage their workspace integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their workspace integrations" ON public.workspace_integrations USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_settings Users can manage their workspace settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their workspace settings" ON public.campaign_settings USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: slack_app_config Users can manage their workspace slack app config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their workspace slack app config" ON public.slack_app_config USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: slack_channels Users can manage their workspace slack channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their workspace slack channels" ON public.slack_channels USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: slack_messages Users can manage their workspace slack messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their workspace slack messages" ON public.slack_messages USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: slack_pending_actions Users can manage their workspace slack pending actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their workspace slack pending actions" ON public.slack_pending_actions USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: slack_user_mapping Users can manage their workspace slack user mappings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their workspace slack user mappings" ON public.slack_user_mapping USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: sam_conversation_messages Users can only access their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can only access their own messages" ON public.sam_conversation_messages USING (((auth.uid() = user_id) OR (thread_id IN ( SELECT sam_conversation_threads.id
   FROM public.sam_conversation_threads
  WHERE (sam_conversation_threads.user_id = auth.uid())))));


--
-- Name: sam_conversation_threads Users can only access their own threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can only access their own threads" ON public.sam_conversation_threads USING ((auth.uid() = user_id));


--
-- Name: linkedin_searches Users can only see searches in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can only see searches in their workspace" ON public.linkedin_searches USING ((workspace_id IN ( SELECT (workspace_members.workspace_id)::text AS workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_members Users can see their own workspace memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see their own workspace memberships" ON public.workspace_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: linkedin_brand_guidelines Users can update brand   guidelines in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update brand
  guidelines in their workspace" ON public.linkedin_brand_guidelines FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: linkedin_post_comments Users can update comments in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update comments in their workspace" ON public.linkedin_post_comments FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: reply_agent_drafts Users can update drafts for their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update drafts for their workspaces" ON public.reply_agent_drafts FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: email_responses Users can update email responses in their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update email responses in their workspaces" ON public.email_responses FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: follow_up_drafts Users can update follow-up drafts in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update follow-up drafts in their workspace" ON public.follow_up_drafts FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: message_outbox Users can update outbox in their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update outbox in their workspaces" ON public.message_outbox FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_ai_search_config Users can update own workspace AI search config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own workspace AI search config" ON public.workspace_ai_search_config FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: website_analysis_queue Users can update own workspace analysis queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own workspace analysis queue" ON public.website_analysis_queue FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: website_analysis_results Users can update own workspace analysis results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own workspace analysis results" ON public.website_analysis_results FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_inbox_agent_config Users can update own workspace inbox agent config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own workspace inbox agent config" ON public.workspace_inbox_agent_config FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: linkedin_comment_replies Users can update replies in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update replies in their workspace" ON public.linkedin_comment_replies FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_reply_agent_config Users can update reply agent config for their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update reply agent config for their workspaces" ON public.workspace_reply_agent_config FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_schedules Users can update schedules for their workspace campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update schedules for their workspace campaigns" ON public.campaign_schedules FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = campaign_schedules.campaign_id) AND (wm.user_id = auth.uid())))));


--
-- Name: sam_conversation_attachments Users can update their attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their attachments" ON public.sam_conversation_attachments FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: sam_icp_knowledge_entries Users can update their own ICP knowledge; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own ICP knowledge" ON public.sam_icp_knowledge_entries FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: sam_icp_discovery_sessions Users can update their own discovery sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own discovery sessions" ON public.sam_icp_discovery_sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: enrichment_jobs Users can update their own enrichment jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own enrichment jobs" ON public.enrichment_jobs FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: memory_snapshots Users can update their own memory snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own memory snapshots" ON public.memory_snapshots FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: prospect_search_jobs Users can update their own search jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own search jobs" ON public.prospect_search_jobs FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: api_keys Users can update their workspace API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their workspace API keys" ON public.api_keys FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_schedule_settings Users can update their workspace schedule settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their workspace schedule settings" ON public.workspace_schedule_settings FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_approval_sessions Users can update their workspace sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their workspace sessions" ON public.prospect_approval_sessions FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_icp Users can update workspace ICPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update workspace ICPs" ON public.workspace_icp FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_accounts Users can update workspace accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update workspace accounts" ON public.workspace_accounts FOR UPDATE TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text))))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text)))));


--
-- Name: sam_conversation_attachments Users can upload attachments to their threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can upload attachments to their threads" ON public.sam_conversation_attachments FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (thread_id IN ( SELECT sam_conversation_threads.id
   FROM public.sam_conversation_threads
  WHERE (sam_conversation_threads.user_id = auth.uid())))));


--
-- Name: prospect_approval_sessions Users can view approval sessions in their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view approval sessions in their workspaces" ON public.prospect_approval_sessions FOR SELECT TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text)))));


--
-- Name: linkedin_brand_guidelines Users can view brand guidelines   in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view brand guidelines
  in their workspace" ON public.linkedin_brand_guidelines FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaigns Users can view campaigns in their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view campaigns in their workspaces" ON public.campaigns FOR SELECT TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text)))));


--
-- Name: inbox_message_categories Users can view categories for their workspace or system categor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view categories for their workspace or system categor" ON public.inbox_message_categories FOR SELECT USING (((is_system = true) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_post_comments Users can view comments in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view comments in their workspace" ON public.linkedin_post_comments FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_approval_decisions Users can view decisions in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view decisions in their workspace" ON public.prospect_approval_decisions FOR SELECT USING ((session_id IN ( SELECT prospect_approval_sessions.id
   FROM public.prospect_approval_sessions
  WHERE (prospect_approval_sessions.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: reply_agent_drafts Users can view drafts for their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view drafts for their workspaces" ON public.reply_agent_drafts FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: email_responses Users can view email responses for their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view email responses for their workspaces" ON public.email_responses FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: email_send_queue Users can view email_send_queue for their campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view email_send_queue for their campaigns" ON public.email_send_queue FOR SELECT USING ((campaign_id IN ( SELECT campaigns.id
   FROM public.campaigns
  WHERE (campaigns.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: campaign_prospect_execution_state Users can view execution state in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view execution state in their workspace" ON public.campaign_prospect_execution_state FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = campaign_prospect_execution_state.campaign_id) AND (wm.user_id = auth.uid())))));


--
-- Name: reply_feedback_reasons Users can view feedback for their workspace replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view feedback for their workspace replies" ON public.reply_feedback_reasons FOR SELECT USING ((reply_id IN ( SELECT cr.id
   FROM (public.campaign_replies cr
     JOIN public.campaigns c ON ((cr.campaign_id = c.id)))
  WHERE (c.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: follow_up_drafts Users can view follow-up drafts in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view follow-up drafts in their workspace" ON public.follow_up_drafts FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_learning_logs Users can view learning logs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view learning logs in their workspace" ON public.prospect_learning_logs FOR SELECT USING ((session_id IN ( SELECT prospect_approval_sessions.id
   FROM public.prospect_approval_sessions
  WHERE (prospect_approval_sessions.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: sam_learning_models Users can view learning models in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view learning models in their workspace" ON public.sam_learning_models FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: linkedin_messages Users can view messages in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages in their workspace" ON public.linkedin_messages FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: reply_agent_metrics Users can view metrics for their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view metrics for their workspaces" ON public.reply_agent_metrics FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: message_outbox Users can view outbox for their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view outbox for their workspaces" ON public.message_outbox FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_ai_search_config Users can view own workspace AI search config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own workspace AI search config" ON public.workspace_ai_search_config FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: website_analysis_queue Users can view own workspace analysis queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own workspace analysis queue" ON public.website_analysis_queue FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: website_analysis_results Users can view own workspace analysis results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own workspace analysis results" ON public.website_analysis_results FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_inbox_agent_config Users can view own workspace inbox agent config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own workspace inbox agent config" ON public.workspace_inbox_agent_config FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: inbox_message_tags Users can view own workspace message tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own workspace message tags" ON public.inbox_message_tags FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_approval_data Users can view prospect data in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view prospect data in their workspace" ON public.prospect_approval_data FOR SELECT USING ((session_id IN ( SELECT prospect_approval_sessions.id
   FROM public.prospect_approval_sessions
  WHERE (prospect_approval_sessions.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: campaign_prospects Users can view prospects in their campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view prospects in their campaigns" ON public.campaign_prospects FOR SELECT TO authenticated USING ((campaign_id IN ( SELECT c.id
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((c.workspace_id = wm.workspace_id)))
  WHERE ((wm.user_id = auth.uid()) AND (wm.status = 'active'::text)))));


--
-- Name: linkedin_comment_replies Users can view replies in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view replies in their workspace" ON public.linkedin_comment_replies FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_reply_agent_config Users can view reply agent config for their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view reply agent config for their workspaces" ON public.workspace_reply_agent_config FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: reply_agent_settings Users can view reply agent settings for their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view reply agent settings for their workspaces" ON public.reply_agent_settings FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_search_results Users can view results from their own jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view results from their own jobs" ON public.prospect_search_results FOR SELECT USING ((job_id IN ( SELECT prospect_search_jobs.id
   FROM public.prospect_search_jobs
  WHERE (prospect_search_jobs.user_id = auth.uid()))));


--
-- Name: campaign_schedules Users can view schedules for their workspace campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view schedules for their workspace campaigns" ON public.campaign_schedules FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = campaign_schedules.campaign_id) AND (wm.user_id = auth.uid())))));


--
-- Name: send_queue Users can view send_queue for their campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view send_queue for their campaigns" ON public.send_queue FOR SELECT USING ((campaign_id IN ( SELECT campaigns.id
   FROM public.campaigns
  WHERE (campaigns.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: prospect_exports Users can view their exports in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their exports in their workspace" ON public.prospect_exports FOR SELECT USING (((user_id = auth.uid()) AND (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: sam_icp_knowledge_entries Users can view their own ICP knowledge; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own ICP knowledge" ON public.sam_icp_knowledge_entries FOR SELECT USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: conversation_analytics Users can view their own conversation analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own conversation analytics" ON public.conversation_analytics FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: sam_icp_discovery_sessions Users can view their own discovery sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own discovery sessions" ON public.sam_icp_discovery_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: enrichment_jobs Users can view their own enrichment jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own enrichment jobs" ON public.enrichment_jobs FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: memory_snapshots Users can view their own memory snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own memory snapshots" ON public.memory_snapshots FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: prospect_search_jobs Users can view their own search jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own search jobs" ON public.prospect_search_jobs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_sessions Users can view their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own sessions" ON public.user_sessions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: api_keys Users can view their workspace API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace API keys" ON public.api_keys FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_stripe_customers Users can view their workspace Stripe customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace Stripe customer" ON public.workspace_stripe_customers FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: sam_conversation_attachments Users can view their workspace attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace attachments" ON public.sam_conversation_attachments FOR SELECT USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: workspace_integrations Users can view their workspace integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace integrations" ON public.workspace_integrations FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_schedule_settings Users can view their workspace schedule settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace schedule settings" ON public.workspace_schedule_settings FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_approval_sessions Users can view their workspace sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace sessions" ON public.prospect_approval_sessions FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_settings Users can view their workspace settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace settings" ON public.campaign_settings FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: slack_app_config Users can view their workspace slack app config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace slack app config" ON public.slack_app_config FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: slack_channels Users can view their workspace slack channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace slack channels" ON public.slack_channels FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: slack_messages Users can view their workspace slack messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace slack messages" ON public.slack_messages FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: slack_pending_actions Users can view their workspace slack pending actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace slack pending actions" ON public.slack_pending_actions FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: slack_user_mapping Users can view their workspace slack user mappings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace slack user mappings" ON public.slack_user_mapping FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_subscriptions Users can view their workspace subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace subscription" ON public.workspace_subscriptions FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspaces Users can view their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspaces" ON public.workspaces FOR SELECT TO authenticated USING ((id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text)))));


--
-- Name: workspace_icp Users can view workspace ICPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view workspace ICPs" ON public.workspace_icp FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_accounts Users can view workspace accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view workspace accounts" ON public.workspace_accounts FOR SELECT TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text)))));


--
-- Name: pii_access_log Users see own access logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own access logs" ON public.pii_access_log FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: workspace_invitations Workspace admins can create invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace admins can create invitations" ON public.workspace_invitations FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: workspace_invitations Workspace admins can delete invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace admins can delete invitations" ON public.workspace_invitations FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: workspace_dpa_agreements Workspace admins can insert DPA agreements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace admins can insert DPA agreements" ON public.workspace_dpa_agreements FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: workspace_dpa_agreements Workspace admins can update DPA agreements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace admins can update DPA agreements" ON public.workspace_dpa_agreements FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: workspace_invitations Workspace admins can update invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace admins can update invitations" ON public.workspace_invitations FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: gdpr_deletion_requests Workspace admins manage deletion requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace admins manage deletion requests" ON public.gdpr_deletion_requests TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['admin'::text, 'owner'::text])))))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: data_retention_policies Workspace admins manage retention policies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace admins manage retention policies" ON public.data_retention_policies TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['admin'::text, 'owner'::text])))))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: dpa_update_notifications Workspace members can acknowledge DPA notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can acknowledge DPA notifications" ON public.dpa_update_notifications FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaign_prospects Workspace members can manage prospects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can manage prospects" ON public.campaign_prospects TO authenticated USING ((campaign_id IN ( SELECT c.id
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((c.workspace_id = wm.workspace_id)))
  WHERE ((wm.user_id = auth.uid()) AND (wm.status = 'active'::text))))) WITH CHECK ((campaign_id IN ( SELECT c.id
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((c.workspace_id = wm.workspace_id)))
  WHERE ((wm.user_id = auth.uid()) AND (wm.status = 'active'::text)))));


--
-- Name: workspace_invitations Workspace members can view invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view invitations" ON public.workspace_invitations FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_dpa_agreements Workspace members can view their DPA agreements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view their DPA agreements" ON public.workspace_dpa_agreements FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: dpa_update_notifications Workspace members can view their DPA notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view their DPA notifications" ON public.dpa_update_notifications FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_dpa_requirements Workspace members can view their DPA requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view their DPA requirements" ON public.workspace_dpa_requirements FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: campaigns Workspace members full access to campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members full access to campaigns" ON public.campaigns TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text))))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text)))));


--
-- Name: gdpr_deletion_requests Workspace members see deletion requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members see deletion requests" ON public.gdpr_deletion_requests FOR SELECT TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: linkedin_author_relationships Workspace members view author relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members view author relationships" ON public.linkedin_author_relationships FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: linkedin_comment_performance_stats Workspace members view performance stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members view performance stats" ON public.linkedin_comment_performance_stats FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: data_retention_policies Workspace members view retention policies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members view retention policies" ON public.data_retention_policies FOR SELECT TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_approval_data Workspace owners full approval access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace owners full approval access" ON public.prospect_approval_data TO authenticated USING ((session_id IN ( SELECT pas.id
   FROM (public.prospect_approval_sessions pas
     JOIN public.workspace_members wm ON ((pas.workspace_id = wm.workspace_id)))
  WHERE ((wm.user_id = auth.uid()) AND (wm.status = 'active'::text))))) WITH CHECK ((session_id IN ( SELECT pas.id
   FROM (public.prospect_approval_sessions pas
     JOIN public.workspace_members wm ON ((pas.workspace_id = wm.workspace_id)))
  WHERE ((wm.user_id = auth.uid()) AND (wm.status = 'active'::text)))));


--
-- Name: campaigns Workspace owners full campaign access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace owners full campaign access" ON public.campaigns TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text))))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text)))));


--
-- Name: campaign_prospects Workspace owners full prospect access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace owners full prospect access" ON public.campaign_prospects TO authenticated USING ((campaign_id IN ( SELECT c.id
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((c.workspace_id = wm.workspace_id)))
  WHERE ((wm.user_id = auth.uid()) AND (wm.status = 'active'::text))))) WITH CHECK ((campaign_id IN ( SELECT c.id
   FROM (public.campaigns c
     JOIN public.workspace_members wm ON ((c.workspace_id = wm.workspace_id)))
  WHERE ((wm.user_id = auth.uid()) AND (wm.status = 'active'::text)))));


--
-- Name: prospect_approval_sessions Workspace owners full session access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace owners full session access" ON public.prospect_approval_sessions TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text))))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text)))));


--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_brand_guidelines brand_guidelines_workspace_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brand_guidelines_workspace_delete ON public.linkedin_brand_guidelines FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_brand_guidelines.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: POLICY brand_guidelines_workspace_delete ON linkedin_brand_guidelines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY brand_guidelines_workspace_delete ON public.linkedin_brand_guidelines IS 'Allow workspace members to delete brand guidelines';


--
-- Name: campaign_prospect_execution_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_prospect_execution_state ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_prospects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_prospects ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_comment_queue comment_queue_workspace_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comment_queue_workspace_delete ON public.linkedin_comment_queue FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_comment_queue.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: POLICY comment_queue_workspace_delete ON linkedin_comment_queue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY comment_queue_workspace_delete ON public.linkedin_comment_queue IS 'Allow workspace members to delete queued comments';


--
-- Name: linkedin_comments_posted comments_posted_workspace_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_posted_workspace_delete ON public.linkedin_comments_posted FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_comments_posted.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: POLICY comments_posted_workspace_delete ON linkedin_comments_posted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY comments_posted_workspace_delete ON public.linkedin_comments_posted IS 'Allow workspace members to delete posted comments';


--
-- Name: conversation_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: core_funnel_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.core_funnel_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: core_funnel_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.core_funnel_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_conflict_resolutions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_conflict_resolutions ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_conflict_resolutions crm_conflict_resolutions_service_role_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_conflict_resolutions_service_role_policy ON public.crm_conflict_resolutions TO service_role USING (true) WITH CHECK (true);


--
-- Name: crm_conflict_resolutions crm_conflict_resolutions_workspace_member_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_conflict_resolutions_workspace_member_policy ON public.crm_conflict_resolutions USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: crm_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_connections crm_connections_service_role_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_connections_service_role_policy ON public.crm_connections TO service_role USING (true) WITH CHECK (true);


--
-- Name: crm_connections crm_connections_workspace_member_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_connections_workspace_member_policy ON public.crm_connections USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: crm_contact_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_contact_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_contact_mappings crm_contact_mappings_service_role_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_contact_mappings_service_role_policy ON public.crm_contact_mappings TO service_role USING (true) WITH CHECK (true);


--
-- Name: crm_contact_mappings crm_contact_mappings_workspace_member_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_contact_mappings_workspace_member_policy ON public.crm_contact_mappings USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: crm_field_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_field_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_field_mappings crm_field_mappings_service_role_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_field_mappings_service_role_policy ON public.crm_field_mappings TO service_role USING (true) WITH CHECK (true);


--
-- Name: crm_field_mappings crm_field_mappings_workspace_member_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_field_mappings_workspace_member_policy ON public.crm_field_mappings USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: crm_sync_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_sync_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_sync_logs crm_sync_logs_service_role_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_sync_logs_service_role_policy ON public.crm_sync_logs TO service_role USING (true) WITH CHECK (true);


--
-- Name: crm_sync_logs crm_sync_logs_workspace_member_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_sync_logs_workspace_member_policy ON public.crm_sync_logs USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: cron_job_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: data_retention_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: deployment_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deployment_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: document_ai_analysis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_ai_analysis ENABLE ROW LEVEL SECURITY;

--
-- Name: dpa_sub_processors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dpa_sub_processors ENABLE ROW LEVEL SECURITY;

--
-- Name: dpa_update_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dpa_update_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: dpa_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dpa_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: dynamic_funnel_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dynamic_funnel_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: dynamic_funnel_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dynamic_funnel_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: dynamic_funnel_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dynamic_funnel_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: email_providers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: email_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: email_send_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_send_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: enrichment_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: follow_up_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.follow_up_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: funnel_adaptation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funnel_adaptation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: funnel_performance_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funnel_performance_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: funnel_step_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funnel_step_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: gdpr_deletion_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gdpr_deletion_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: hitl_reply_approval_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hitl_reply_approval_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: hitl_reply_approval_sessions hitl_sessions_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hitl_sessions_delete_policy ON public.hitl_reply_approval_sessions FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: hitl_reply_approval_sessions hitl_sessions_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hitl_sessions_insert_policy ON public.hitl_reply_approval_sessions FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: hitl_reply_approval_sessions hitl_sessions_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hitl_sessions_select_policy ON public.hitl_reply_approval_sessions FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: hitl_reply_approval_sessions hitl_sessions_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hitl_sessions_update_policy ON public.hitl_reply_approval_sessions FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: icp_configurations icp_config_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icp_config_delete_scoped ON public.icp_configurations FOR DELETE USING (((workspace_id IS NULL) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: icp_configurations icp_config_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icp_config_insert_scoped ON public.icp_configurations FOR INSERT WITH CHECK (((workspace_id IS NULL) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: icp_configurations icp_config_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icp_config_select_scoped ON public.icp_configurations FOR SELECT USING (((workspace_id IS NULL) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: icp_configurations icp_config_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icp_config_update_scoped ON public.icp_configurations FOR UPDATE USING (((workspace_id IS NULL) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))))) WITH CHECK (((workspace_id IS NULL) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: icp_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.icp_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: inbox_message_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inbox_message_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: inbox_message_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inbox_message_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_base_competitors kb_competitors_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_competitors_delete_scoped ON public.knowledge_base_competitors FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_competitors kb_competitors_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_competitors_insert_scoped ON public.knowledge_base_competitors FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_competitors kb_competitors_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_competitors_select_scoped ON public.knowledge_base_competitors FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_competitors kb_competitors_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_competitors_update_scoped ON public.knowledge_base_competitors FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_content kb_content_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_content_delete_scoped ON public.knowledge_base_content FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_content kb_content_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_content_insert_scoped ON public.knowledge_base_content FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_content kb_content_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_content_select_scoped ON public.knowledge_base_content FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_content kb_content_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_content_update_scoped ON public.knowledge_base_content FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_documents kb_documents_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_documents_delete_scoped ON public.knowledge_base_documents FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_documents kb_documents_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_documents_insert_scoped ON public.knowledge_base_documents FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_documents kb_documents_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_documents_select_scoped ON public.knowledge_base_documents FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_documents kb_documents_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_documents_update_scoped ON public.knowledge_base_documents FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_icps kb_icps_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_icps_delete_scoped ON public.knowledge_base_icps FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_icps kb_icps_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_icps_insert_scoped ON public.knowledge_base_icps FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_icps kb_icps_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_icps_select_scoped ON public.knowledge_base_icps FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_icps kb_icps_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_icps_update_scoped ON public.knowledge_base_icps FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_personas kb_personas_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_personas_delete_scoped ON public.knowledge_base_personas FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_personas kb_personas_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_personas_insert_scoped ON public.knowledge_base_personas FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_personas kb_personas_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_personas_select_scoped ON public.knowledge_base_personas FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_personas kb_personas_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_personas_update_scoped ON public.knowledge_base_personas FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_products kb_products_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_products_delete_scoped ON public.knowledge_base_products FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_products kb_products_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_products_insert_scoped ON public.knowledge_base_products FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_products kb_products_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_products_select_scoped ON public.knowledge_base_products FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_products kb_products_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_products_update_scoped ON public.knowledge_base_products FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))) WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_sections kb_sections_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_sections_delete_scoped ON public.knowledge_base_sections FOR DELETE USING (((workspace_id IS NULL) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: knowledge_base_sections kb_sections_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_sections_insert_scoped ON public.knowledge_base_sections FOR INSERT WITH CHECK (((workspace_id IS NULL) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: knowledge_base_sections kb_sections_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_sections_select_scoped ON public.knowledge_base_sections FOR SELECT USING (((workspace_id IS NULL) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: knowledge_base_sections kb_sections_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_sections_update_scoped ON public.knowledge_base_sections FOR UPDATE USING (((workspace_id IS NULL) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))))) WITH CHECK (((workspace_id IS NULL) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: knowledge_base_document_usage kb_usage_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_usage_insert_scoped ON public.knowledge_base_document_usage FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base_document_usage kb_usage_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kb_usage_select_scoped ON public.knowledge_base_document_usage FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_base_competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_base_competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_base_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_base_content ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_base_document_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_base_document_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_base_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_base_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_base_icps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_base_icps ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_base_personas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_base_personas ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_base_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_base_products ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_base_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_base_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_base_vectors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_base_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: link_clicks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: link_clicks link_clicks_service_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY link_clicks_service_role ON public.link_clicks USING ((auth.role() = 'service_role'::text));


--
-- Name: linkedin_author_relationships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_author_relationships ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_brand_guidelines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_brand_guidelines ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_comment_performance_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_comment_performance_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_comment_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_comment_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_comment_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_comment_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_comments_posted; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_comments_posted ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_post_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_post_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_post_monitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_post_monitors ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_comments_posted linkedin_posted_insert_workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY linkedin_posted_insert_workspace ON public.linkedin_comments_posted FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_comments_posted.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_comments_posted linkedin_posted_select_workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY linkedin_posted_select_workspace ON public.linkedin_comments_posted FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_comments_posted.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_comments_posted linkedin_posted_update_workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY linkedin_posted_update_workspace ON public.linkedin_comments_posted FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_comments_posted.workspace_id) AND (workspace_members.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_comments_posted.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_posts_discovered; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_posts_discovered ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_posts_discovered linkedin_posts_insert_workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY linkedin_posts_insert_workspace ON public.linkedin_posts_discovered FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_posts_discovered.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_posts_discovered linkedin_posts_select_workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY linkedin_posts_select_workspace ON public.linkedin_posts_discovered FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_posts_discovered.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_posts_discovered linkedin_posts_update_workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY linkedin_posts_update_workspace ON public.linkedin_posts_discovered FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_posts_discovered.workspace_id) AND (workspace_members.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_posts_discovered.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_proxy_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_proxy_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_proxy_assignments linkedin_proxy_service_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY linkedin_proxy_service_access ON public.linkedin_proxy_assignments USING ((auth.role() = 'service_role'::text));


--
-- Name: linkedin_proxy_assignments linkedin_proxy_user_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY linkedin_proxy_user_access ON public.linkedin_proxy_assignments USING ((user_id = auth.uid()));


--
-- Name: linkedin_comment_queue linkedin_queue_insert_workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY linkedin_queue_insert_workspace ON public.linkedin_comment_queue FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_comment_queue.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_comment_queue linkedin_queue_select_workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY linkedin_queue_select_workspace ON public.linkedin_comment_queue FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_comment_queue.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_comment_queue linkedin_queue_update_workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY linkedin_queue_update_workspace ON public.linkedin_comment_queue FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_comment_queue.workspace_id) AND (workspace_members.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_comment_queue.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_searches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_searches ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_self_post_comment_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_self_post_comment_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_self_post_monitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_self_post_monitors ENABLE ROW LEVEL SECURITY;

--
-- Name: magic_link_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.magic_link_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: meeting_follow_up_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meeting_follow_up_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: meeting_follow_up_drafts meeting_follow_up_drafts_service_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meeting_follow_up_drafts_service_role ON public.meeting_follow_up_drafts USING ((auth.role() = 'service_role'::text));


--
-- Name: meeting_follow_up_drafts meeting_follow_up_drafts_workspace_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meeting_follow_up_drafts_workspace_access ON public.meeting_follow_up_drafts USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: meeting_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meeting_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: meeting_reminders meeting_reminders_service_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meeting_reminders_service_role ON public.meeting_reminders USING ((auth.role() = 'service_role'::text));


--
-- Name: meeting_reminders meeting_reminders_workspace_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meeting_reminders_workspace_access ON public.meeting_reminders USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: meetings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

--
-- Name: meetings meetings_service_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meetings_service_role ON public.meetings USING ((auth.role() = 'service_role'::text));


--
-- Name: meetings meetings_workspace_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meetings_workspace_access ON public.meetings USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: memory_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memory_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: message_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: messaging_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messaging_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_post_monitors monitors_workspace_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY monitors_workspace_delete ON public.linkedin_post_monitors FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_post_monitors.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_post_monitors monitors_workspace_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY monitors_workspace_insert ON public.linkedin_post_monitors FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_post_monitors.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_post_monitors monitors_workspace_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY monitors_workspace_select ON public.linkedin_post_monitors FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_post_monitors.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: linkedin_post_monitors monitors_workspace_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY monitors_workspace_update ON public.linkedin_post_monitors FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_post_monitors.workspace_id) AND (workspace_members.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_post_monitors.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: n8n_campaign_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.n8n_campaign_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: oauth_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

--
-- Name: oauth_states oauth_states_service_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY oauth_states_service_role ON public.oauth_states USING ((auth.role() = 'service_role'::text));


--
-- Name: oauth_states oauth_states_workspace_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY oauth_states_workspace_access ON public.oauth_states FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: pii_access_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pii_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_posts_discovered posts_discovered_workspace_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY posts_discovered_workspace_delete ON public.linkedin_posts_discovered FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = linkedin_posts_discovered.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: POLICY posts_discovered_workspace_delete ON linkedin_posts_discovered; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY posts_discovered_workspace_delete ON public.linkedin_posts_discovered IS 'Allow workspace members to delete discovered posts';


--
-- Name: prospect_approval_decisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prospect_approval_decisions ENABLE ROW LEVEL SECURITY;

--
-- Name: prospect_approval_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prospect_approval_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: prospect_exports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prospect_exports ENABLE ROW LEVEL SECURITY;

--
-- Name: prospect_learning_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prospect_learning_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: prospect_search_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prospect_search_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: prospect_search_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prospect_search_results ENABLE ROW LEVEL SECURITY;

--
-- Name: qa_autofix_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qa_autofix_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: reply_agent_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reply_agent_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: reply_agent_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reply_agent_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: reply_agent_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reply_agent_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: reply_feedback_reasons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reply_feedback_reasons ENABLE ROW LEVEL SECURITY;

--
-- Name: sam_conversation_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sam_conversation_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: sam_conversation_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sam_conversation_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: sam_conversation_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sam_conversation_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: sam_funnel_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sam_funnel_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: sam_funnel_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sam_funnel_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: sam_funnel_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sam_funnel_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: sam_funnel_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sam_funnel_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: sam_funnel_template_performance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sam_funnel_template_performance ENABLE ROW LEVEL SECURITY;

--
-- Name: sam_icp_discovery_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sam_icp_discovery_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sam_icp_knowledge_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sam_icp_knowledge_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: sam_knowledge_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sam_knowledge_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: sam_learning_models; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sam_learning_models ENABLE ROW LEVEL SECURITY;

--
-- Name: send_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.send_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_self_post_monitors service_role_all_self_post_monitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_self_post_monitors ON public.linkedin_self_post_monitors USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: linkedin_self_post_comment_replies service_role_all_self_post_replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_self_post_replies ON public.linkedin_self_post_comment_replies USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: slack_app_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slack_app_config ENABLE ROW LEVEL SECURITY;

--
-- Name: slack_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slack_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: slack_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slack_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: slack_pending_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slack_pending_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: slack_pending_installations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slack_pending_installations ENABLE ROW LEVEL SECURITY;

--
-- Name: slack_user_mapping; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slack_user_mapping ENABLE ROW LEVEL SECURITY;

--
-- Name: system_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: system_health_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: template_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_components ENABLE ROW LEVEL SECURITY;

--
-- Name: template_performance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_performance ENABLE ROW LEVEL SECURITY;

--
-- Name: tracked_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tracked_links ENABLE ROW LEVEL SECURITY;

--
-- Name: tracked_links tracked_links_service_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tracked_links_service_role ON public.tracked_links USING ((auth.role() = 'service_role'::text));


--
-- Name: tracked_links tracked_links_workspace_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tracked_links_workspace_access ON public.tracked_links USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: user_memory_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_memory_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: user_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_unipile_accounts user_unipile_accounts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_unipile_accounts_delete ON public.user_unipile_accounts FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: user_unipile_accounts user_unipile_accounts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_unipile_accounts_insert ON public.user_unipile_accounts FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_unipile_accounts user_unipile_accounts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_unipile_accounts_select ON public.user_unipile_accounts FOR SELECT USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: user_unipile_accounts user_unipile_accounts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_unipile_accounts_update ON public.user_unipile_accounts FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_can_update_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_update_own_profile ON public.users FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: webhook_error_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_error_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: website_analysis_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.website_analysis_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: website_analysis_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.website_analysis_results ENABLE ROW LEVEL SECURITY;

--
-- Name: website_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.website_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_deployment_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_deployment_history ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: workspaces workspace_access_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_access_policy ON public.workspaces FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR (id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.status = 'active'::text))))));


--
-- Name: workspaces workspace_access_workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_access_workspaces ON public.workspaces USING ((id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_account_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_account_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_account_limits workspace_account_limits_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_account_limits_delete_policy ON public.workspace_account_limits FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_account_limits workspace_account_limits_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_account_limits_insert_policy ON public.workspace_account_limits FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_account_limits workspace_account_limits_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_account_limits_select_policy ON public.workspace_account_limits FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_account_limits workspace_account_limits_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_account_limits_update_policy ON public.workspace_account_limits FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_ai_search_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_ai_search_config ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_blacklists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_blacklists ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_blacklists workspace_blacklists_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_blacklists_delete_policy ON public.workspace_blacklists FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_blacklists workspace_blacklists_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_blacklists_insert_policy ON public.workspace_blacklists FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_blacklists workspace_blacklists_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_blacklists_select_policy ON public.workspace_blacklists FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_blacklists workspace_blacklists_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_blacklists_update_policy ON public.workspace_blacklists FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_dpa_agreements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_dpa_agreements ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_dpa_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_dpa_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_encryption_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_encryption_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_icp; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_icp ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_inbox_agent_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_inbox_agent_config ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_schedules workspace_isolation_campaign_schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_campaign_schedules ON public.campaign_schedules USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: core_funnel_executions workspace_isolation_core_funnel_executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_core_funnel_executions ON public.core_funnel_executions USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: core_funnel_templates workspace_isolation_core_funnel_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_core_funnel_templates ON public.core_funnel_templates USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: dynamic_funnel_definitions workspace_isolation_dynamic_funnel_definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_dynamic_funnel_definitions ON public.dynamic_funnel_definitions USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: dynamic_funnel_executions workspace_isolation_dynamic_funnel_executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_dynamic_funnel_executions ON public.dynamic_funnel_executions USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: dynamic_funnel_steps workspace_isolation_dynamic_funnel_steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_dynamic_funnel_steps ON public.dynamic_funnel_steps USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: funnel_adaptation_logs workspace_isolation_funnel_adaptation_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_funnel_adaptation_logs ON public.funnel_adaptation_logs USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: funnel_performance_metrics workspace_isolation_funnel_performance_metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_funnel_performance_metrics ON public.funnel_performance_metrics USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: funnel_step_logs workspace_isolation_funnel_step_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_funnel_step_logs ON public.funnel_step_logs USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: knowledge_base workspace_isolation_knowledge_base; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_knowledge_base ON public.knowledge_base USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_approval_decisions workspace_isolation_prospect_approval_decisions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_prospect_approval_decisions ON public.prospect_approval_decisions USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_learning_logs workspace_isolation_prospect_learning_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_prospect_learning_logs ON public.prospect_learning_logs USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: prospect_search_results workspace_isolation_prospect_search_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_prospect_search_results ON public.prospect_search_results USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: sam_conversation_messages workspace_isolation_sam_conversation_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_sam_conversation_messages ON public.sam_conversation_messages USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: sam_funnel_analytics workspace_isolation_sam_funnel_analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_sam_funnel_analytics ON public.sam_funnel_analytics USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: sam_funnel_messages workspace_isolation_sam_funnel_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_sam_funnel_messages ON public.sam_funnel_messages USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: sam_funnel_responses workspace_isolation_sam_funnel_responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_sam_funnel_responses ON public.sam_funnel_responses USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: webhook_error_logs workspace_isolation_webhook_error_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_isolation_webhook_error_logs ON public.webhook_error_logs USING (((workspace_id IS NULL) OR (workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())))));


--
-- Name: workspace_meeting_agent_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_meeting_agent_config ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_meeting_agent_config workspace_meeting_agent_config_service_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_meeting_agent_config_service_role ON public.workspace_meeting_agent_config USING ((auth.role() = 'service_role'::text));


--
-- Name: workspace_meeting_agent_config workspace_meeting_agent_config_workspace_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_meeting_agent_config_workspace_access ON public.workspace_meeting_agent_config USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_self_post_monitors workspace_members_all_self_post_monitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_all_self_post_monitors ON public.linkedin_self_post_monitors USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: linkedin_self_post_comment_replies workspace_members_all_self_post_replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_all_self_post_replies ON public.linkedin_self_post_comment_replies USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: linkedin_self_post_monitors workspace_members_select_self_post_monitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_select_self_post_monitors ON public.linkedin_self_post_monitors FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: linkedin_self_post_comment_replies workspace_members_select_self_post_replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_select_self_post_replies ON public.linkedin_self_post_comment_replies FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_n8n_workflows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_n8n_workflows ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_prospects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_prospects ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_reply_agent_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_reply_agent_config ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_schedule_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_schedule_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_stripe_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_stripe_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_tiers workspace_tiers_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_tiers_delete_policy ON public.workspace_tiers FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: workspace_tiers workspace_tiers_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_tiers_insert_policy ON public.workspace_tiers FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: workspace_tiers workspace_tiers_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_tiers_select_policy ON public.workspace_tiers FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_tiers workspace_tiers_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_tiers_update_policy ON public.workspace_tiers FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE ((workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: workspace_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_workflow_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_workflow_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime prospect_search_jobs; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.prospect_search_jobs;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict w92ZF3lsw9YDUnxRcbxa3DPJv00uLneu9yPIlXKCW6tjsHmweOKmUMKaRgFsAaZ

