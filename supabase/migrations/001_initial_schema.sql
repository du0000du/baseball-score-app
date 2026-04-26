-- ============================================================
-- 草野球成績管理アプリ 初期スキーマ
-- ============================================================

-- Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- users テーブル（Supabase Auth の user_id と紐づく）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          uuid PRIMARY KEY,  -- auth.uid() と一致
  name        text,
  position    text,
  team_name   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- games テーブル（試合記録）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.games (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_date   date NOT NULL,
  opponent    text NOT NULL,
  result      text NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  score_us    integer NOT NULL DEFAULT 0,
  score_them  integer NOT NULL DEFAULT 0,
  stadium     text,
  notes       text,
  season      integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_user_id_game_date ON public.games(user_id, game_date DESC);

-- ============================================================
-- at_bats テーブル（打席記録）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.at_bats (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id              uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  at_bat_number        integer NOT NULL,
  batting_order        integer NOT NULL CHECK (batting_order BETWEEN 1 AND 9),
  result_type          text NOT NULL CHECK (result_type IN (
                         'hit', 'double', 'triple', 'hr',
                         'strikeout', 'groundout', 'flyout',
                         'walk', 'hbp', 'sac_bunt', 'sac_fly',
                         'error', 'fc'
                       )),
  hit_type             text CHECK (hit_type IN ('single', 'double', 'triple', 'hr')),
  direction            text CHECK (direction IN ('left', 'left_center', 'center', 'right_center', 'right')),
  is_rbi               boolean NOT NULL DEFAULT false,
  is_run               boolean NOT NULL DEFAULT false,
  is_stolen_base       boolean NOT NULL DEFAULT false,
  is_caught_stealing   boolean NOT NULL DEFAULT false,
  is_error             boolean NOT NULL DEFAULT false,
  input_method         text NOT NULL DEFAULT 'manual' CHECK (input_method IN ('manual', 'nlp')),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_at_bats_game_id ON public.at_bats(game_id);
CREATE INDEX IF NOT EXISTS idx_at_bats_user_id ON public.at_bats(user_id);

-- ============================================================
-- pitching_records テーブル（投手成績 / Phase 2）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pitching_records (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id             uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  innings_pitched     numeric(4,1),
  pitches             integer,
  hits_allowed        integer DEFAULT 0,
  hr_allowed          integer DEFAULT 0,
  strikeouts          integer DEFAULT 0,
  walks               integer DEFAULT 0,
  hbp                 integer DEFAULT 0,
  runs                integer DEFAULT 0,
  earned_runs         integer DEFAULT 0,
  win_loss_save_hold  text CHECK (win_loss_save_hold IN ('win', 'loss', 'save', 'hold')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.at_bats           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitching_records  ENABLE ROW LEVEL SECURITY;

-- users: 自分のプロフィールのみ
CREATE POLICY "users can access own profile"
  ON public.users FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- games: 自分のデータのみ
CREATE POLICY "users can access own games"
  ON public.games FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- at_bats: 自分のデータのみ
CREATE POLICY "users can access own at_bats"
  ON public.at_bats FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- pitching_records: 自分のデータのみ
CREATE POLICY "users can access own pitching_records"
  ON public.pitching_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ユーザー作成時に users レコードを自動生成するトリガー
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
