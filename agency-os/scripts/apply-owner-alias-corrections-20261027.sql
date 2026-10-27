-- Approved corrections from the owner, 27.10.2026. Data only, not a schema migration.
-- Preserve existing aliases; do not seed the rest of the unapproved proposal.
BEGIN;
DO $aliases$
DECLARE target record; changed integer;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('80ab2a07-259c-45fc-b449-9ec7238f9f15'::uuid,'Ansaligy',ARRAY['Ансалиджи']::text[]),
    ('c5c2bbf1-4ea6-4e49-b469-1416710d7dbd'::uuid,'ESTT',ARRAY['ИСТТ','серверы','ВПС','ВДС','VPS','VDS']::text[]),
    ('a2abaaa6-d3f2-40bf-8757-60f408dc7b7d'::uuid,'Электроника',ARRAY['Системные решения','системайс','платы','печатные платы']::text[])
  ) AS approved(id,name,extra) LOOP
    UPDATE public.projects p
    SET aliases=ARRAY(SELECT DISTINCT value FROM unnest(p.aliases||target.extra) AS value ORDER BY value)
    WHERE p.id=target.id AND p.name=target.name;
    GET DIAGNOSTICS changed=ROW_COUNT;
    IF changed<>1 THEN RAISE EXCEPTION 'Project identity changed: %',target.name; END IF;
  END LOOP;
  -- Моспром and Мос.ру are different projects. Remove only the erroneous variants,
  -- if any were saved elsewhere; never create or activate either project here.
  UPDATE public.projects p SET aliases=ARRAY(
    SELECT value FROM unnest(p.aliases) AS value
    WHERE lower(btrim(value)) NOT IN ('моспром','по моспрому','моспрому')
  ) WHERE p.id='84a75b58-07ee-4d5e-afbe-bf2ead7b4e0f' AND p.name='Мос.ру';
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Мос.ру identity changed'; END IF;
  UPDATE public.profiles p
  SET aliases=ARRAY(SELECT DISTINCT value FROM unnest(p.aliases||ARRAY['Катерина','Катя']) AS value ORDER BY value)
  WHERE p.id='67ee2205-e76f-4254-8d3f-f3739ed494e5' AND p.role='owner' AND p.is_active;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Owner identity changed'; END IF;
END;
$aliases$;
COMMIT;
SELECT 'project' AS kind,name,aliases FROM public.projects
WHERE id IN ('80ab2a07-259c-45fc-b449-9ec7238f9f15','c5c2bbf1-4ea6-4e49-b469-1416710d7dbd','a2abaaa6-d3f2-40bf-8757-60f408dc7b7d','84a75b58-07ee-4d5e-afbe-bf2ead7b4e0f')
UNION ALL SELECT 'owner',full_name,aliases FROM public.profiles WHERE id='67ee2205-e76f-4254-8d3f-f3739ed494e5'
ORDER BY kind,name;
