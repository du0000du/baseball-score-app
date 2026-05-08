-- batting_order の CHECK 制約を 1-9 から 1-12 に拡張
ALTER TABLE at_bats DROP CONSTRAINT at_bats_batting_order_check;
ALTER TABLE at_bats ADD CONSTRAINT at_bats_batting_order_check CHECK (batting_order BETWEEN 1 AND 12);
