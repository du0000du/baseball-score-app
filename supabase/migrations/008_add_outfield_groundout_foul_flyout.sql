-- Migration: 008_add_outfield_groundout_foul_flyout
-- result_type に 'outfield_groundout'（外野ゴロ）と 'foul_flyout'（ファールフライ）を追加する
-- direction の制約変更は不要（既存の全9ポジション + 左中間/右中間で対応可能）

ALTER TABLE public.at_bats
  DROP CONSTRAINT IF EXISTS at_bats_result_type_check;

ALTER TABLE public.at_bats
  ADD CONSTRAINT at_bats_result_type_check
  CHECK (result_type IN (
    'hit', 'double', 'triple', 'hr',
    'strikeout', 'groundout', 'outfield_groundout', 'flyout', 'infield_flyout', 'liner_out', 'foul_flyout',
    'walk', 'hbp', 'sac_bunt', 'sac_fly',
    'error', 'fc'
  ));
