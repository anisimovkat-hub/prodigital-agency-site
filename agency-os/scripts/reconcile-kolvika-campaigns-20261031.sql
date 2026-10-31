-- Approved four campaign assignments only. No new directions, goal settings or ad changes.
-- Idempotent; append UUIDs without replacing existing campaign lists. Brand stays separate.
BEGIN;
DO $reconcile$
DECLARE
  mapping record;
  campaign_id uuid;
  direction_row public.project_ad_directions%ROWTYPE;
BEGIN
  FOR mapping IN SELECT * FROM (VALUES
    ('715598284', '0f6cd1a5-33ae-43c8-a437-56c261f365cf'::uuid, '17c1698c-b686-4cd8-94ef-381d18ebfabe'::uuid),
    ('715598305', '1f6f6e64-832b-4dc3-babe-57e38896c35c'::uuid, '17c1698c-b686-4cd8-94ef-381d18ebfabe'::uuid),
    ('715597778', '3fcc2598-f0fb-4893-8f95-9c45c4d0e1ea'::uuid, 'ea74d330-a4aa-4411-9f26-61589a71e723'::uuid),
    ('715210412', 'd61828df-6144-4328-b113-1e9fee5c6069'::uuid, '3e65cab9-461b-4239-89d7-2428dd39d113'::uuid)
  ) AS verified(external_id, expected_id, direction_id)
  LOOP
    SELECT id INTO STRICT campaign_id FROM public.ad_campaigns
      WHERE id = mapping.expected_id AND external_id = mapping.external_id
        AND ad_account_id = '92d981b0-3e87-4345-8037-7de00077c988'
        AND project_id = 'e5a66e71-b972-4fbb-b5f4-68c8614916b6';
    SELECT * INTO STRICT direction_row FROM public.project_ad_directions
      WHERE id = mapping.direction_id AND project_id = 'e5a66e71-b972-4fbb-b5f4-68c8614916b6' AND is_active
      FOR UPDATE;
    IF EXISTS (SELECT 1 FROM public.project_ad_directions
      WHERE project_id = direction_row.project_id AND id <> direction_row.id AND campaign_id = ANY(campaign_ids))
    THEN RAISE EXCEPTION 'Verified campaign already belongs to another direction'; END IF;
    IF NOT campaign_id = ANY(coalesce(direction_row.campaign_ids, ARRAY[]::uuid[])) THEN
      UPDATE public.project_ad_directions
        SET campaign_ids = array_append(coalesce(campaign_ids, ARRAY[]::uuid[]), campaign_id)
        WHERE id = direction_row.id;
    END IF;
  END LOOP;
END;
$reconcile$;
COMMIT;
