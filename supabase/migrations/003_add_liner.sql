-- Migration: 003_add_liner
-- result_type に 'liner_out'（ライナーアウト）を追加する
-- direction の制約変更は不要（既存値で対応可能）

ALTER TABLE public.at_bats
  DROP CONSTRAINT IF EXISTS at_bats_result_type_check;

ALTER TABLE public.at_bats
  ADD CONSTRAINT at_bats_result_type_check
  CHECK (result_type IN (
    'hit', 'double', 'triple', 'hr',
    'strikeout', 'groundout', 'flyout', 'infield_flyout', 'liner_out',
    'walk', 'hbp', 'sac_bunt', 'sac_fly',
    'error', 'fc'
  ));
