-- Migration: 003_add_rbi_count_stolen_base_count
-- 打点数（1〜4）と盗塁数（1〜3）を記録するためのカラムを追加

ALTER TABLE public.at_bats ADD COLUMN IF NOT EXISTS rbi_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.at_bats ADD COLUMN IF NOT EXISTS stolen_base_count integer NOT NULL DEFAULT 0;

-- 既存データを移行（is_rbi=true なら rbi_count=1、is_stolen_base=true なら stolen_base_count=1）
UPDATE public.at_bats SET rbi_count = 1 WHERE is_rbi = true AND rbi_count = 0;
UPDATE public.at_bats SET stolen_base_count = 1 WHERE is_stolen_base = true AND stolen_base_count = 0;
