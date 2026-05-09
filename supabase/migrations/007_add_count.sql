-- N-3: 打席カウント記録（任意）
-- balls/strikes の最終カウントを記録するカラムを追加
-- nullable: 記録しない場合は NULL のまま

ALTER TABLE at_bats ADD COLUMN IF NOT EXISTS count_balls smallint;
ALTER TABLE at_bats ADD COLUMN IF NOT EXISTS count_strikes smallint;
