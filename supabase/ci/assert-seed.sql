-- Fails (division by zero / raise) if the demo seed did not produce what the dashboard needs.
DO $$
DECLARE n_runs INT; n_logs INT; n_wf INT; n_versions INT; n_paused INT;
BEGIN
  SELECT count(*) INTO n_wf FROM public.workflows WHERE is_demo;
  SELECT count(*) INTO n_runs FROM public.runs WHERE is_demo;
  SELECT count(*) INTO n_logs FROM public.logs l JOIN public.runs r ON r.id = l.run_id WHERE r.is_demo;
  SELECT count(*) INTO n_versions FROM public.workflow_versions v JOIN public.workflows w ON w.id = v.workflow_id WHERE w.is_demo;
  SELECT count(*) INTO n_paused FROM public.runs WHERE is_demo AND status = 'paused_hitl';
  RAISE NOTICE 'demo seed: % workflows, % runs, % steps, % versions', n_wf, n_runs, n_logs, n_versions;
  IF n_wf <> 4 OR n_runs <> 40 OR n_logs < 100 OR n_versions <> 4 OR n_paused <> 1 THEN
    RAISE EXCEPTION 'unexpected demo seed: wf=% runs=% logs=% versions=% paused=%', n_wf, n_runs, n_logs, n_versions, n_paused;
  END IF;
  IF EXISTS (SELECT 1 FROM public.runs WHERE is_demo AND (total_cost IS NULL OR total_cost < 0)) THEN
    RAISE EXCEPTION 'demo runs without totals';
  END IF;
END $$;
