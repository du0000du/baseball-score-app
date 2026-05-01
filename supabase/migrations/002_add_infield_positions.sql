-- Migration: 002_add_infield_positions
-- 内野守備位置（サード/ショート/セカンド/ファースト/ピッチャー/キャッチャー）と
-- 内野フライ(infield_flyout)を追加するためにCHECK制約を更新する

-- ① result_type の CHECK制約を拡張（infield_flyout を追加）
ALTER TABLE public.at_bats
  DROP CONSTRAINT IF EXISTS at_bats_result_type_check;

ALTER TABLE public.at_bats
  ADD CONSTRAINT at_bats_result_type_check
  CHECK (result_type IN (
    'hit', 'double', 'triple', 'hr',
    'strikeout', 'groundout', 'flyout', 'infield_flyout',
    'walk', 'hbp', 'sac_bunt', 'sac_fly',
    'error', 'fc'
  ));

-- ② direction の CHECK制約を拡張（内野守備位置を追加）
ALTER TABLE public.at_bats
  DROP CONSTRAINT IF EXISTS at_bats_direction_check;

ALTER TABLE public.at_bats
  ADD CONSTRAINT at_bats_direction_check
  CHECK (direction IN (
    -- 外野方向（既存）
    'left', 'left_center', 'center', 'right_center', 'right',
    -- 内野守備位置（新規追加）
    'pitcher', 'catcher', 'first_base', 'second_base', 'third_base', 'shortstop'
  ));
