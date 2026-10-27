-- Approved by the owner on 2026-10-27. Manual data operation, not a migration.
-- Idempotent: preserve existing commercial fields/responsibles and aliases.
BEGIN;
DO $fck$
DECLARE client_uuid uuid; project_uuid uuid;
BEGIN
  SELECT id INTO STRICT client_uuid FROM public.clients WHERE upper(btrim(name)) IN ('БЛЭК','BLACK','BLACK AGENCY');
  SELECT id INTO project_uuid FROM public.projects WHERE client_id=client_uuid AND lower(btrim(name))='фцк';
  IF FOUND THEN
    UPDATE public.projects SET stage='active',aliases=ARRAY(
      SELECT DISTINCT a FROM unnest(aliases || ARRAY['ФЦК','Производительность РФ','производительность.рф']) AS a
    ),updated_at=now() WHERE id=project_uuid;
  ELSE
    INSERT INTO public.projects(name,client_id,stage,aliases)
      VALUES('ФЦК',client_uuid,'active',ARRAY['ФЦК','Производительность РФ','производительность.рф']) RETURNING id INTO project_uuid;
  END IF;
  -- Match the normal project-creation action: an active project activates its client.
  UPDATE public.clients SET status='active' WHERE id=client_uuid;
END;
$fck$;
COMMIT;
SELECT p.id,p.name,p.stage,p.aliases,c.name AS client,c.status AS client_status
FROM public.projects p JOIN public.clients c ON c.id=p.client_id
WHERE p.name='ФЦК' AND upper(btrim(c.name)) IN ('БЛЭК','BLACK','BLACK AGENCY');
