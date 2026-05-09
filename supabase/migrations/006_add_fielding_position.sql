-- Migration: 006_add_fielding_position
-- at_bats に fielding_position カラムを追加（nullable）
-- 守備ポジション: 投・捕・一・二・三・遊・左・中・右・DH の10種

ALTER TABLE public.at_bats
  ADD COLUMN IF NOT EXISTS fielding_position text
  CHECK (fielding_position IN (
    'pitcher', 'catcher',
    'first_base', 'second_base', 'third_base', 'shortstop',
    'left', 'center', 'right',
    'dh'
  ));
