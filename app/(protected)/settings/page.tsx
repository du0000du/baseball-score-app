'use client'

import { useEffect, useState, useRef, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/lib/supabase/types'
import { ThemeContext } from '@/app/(protected)/_components/ThemeProvider'
import type { Theme } from '@/app/(protected)/_components/ThemeProvider'

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light',    label: 'ライト',  icon: '☀️' },
  { value: 'dark',     label: 'ダーク',  icon: '🌙' },
  { value: 'system',   label: '自動',    icon: '💻' },
  { value: 'abema',    label: 'ABM',     icon: '📺' },
  { value: 'nintendo', label: 'NTD',     icon: '🎮' },
  { value: 'hnf',      label: 'HNF',     icon: '🔵' },
  { value: 'htg',      label: 'HTG',     icon: '🐯' },
  { value: 'tys',      label: 'TYS',     icon: '🌀' },
  { value: 'trg',      label: 'TRG',     icon: '🦅' },
]

export default function SettingsPage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const { theme, setTheme } = useContext(ThemeContext)
  const router = useRouter()

  const currentYear = new Date().getFullYear()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [position, setPosition] = useState('')
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([])
  const [defaultSeason, setDefaultSeason] = useState<number>(currentYear)
  const [seasonSaved, setSeasonSaved] = useState(false)
  const [targetAvg, setTargetAvg] = useState('')
  const [targetSaved, setTargetSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (data) {
        const profile = data as User
        setName(profile.name ?? '')
        setTeamName(profile.team_name ?? '')
        setPosition(profile.position ?? '')
      }
      const { data: gamesData } = await supabase
        .from('games')
        .select('season')
        .eq('user_id', user.id)
      if (gamesData) {
        const seasons = Array.from(new Set((gamesData as { season: number }[]).map(g => g.season)))
          .filter(Boolean)
          .sort((a, b) => b - a)
        if (!seasons.includes(currentYear)) seasons.unshift(currentYear)
        setAvailableSeasons(seasons)
      }
      const savedSeason = localStorage.getItem('baseball_stats_season')
      if (savedSeason && savedSeason !== 'all') {
        const parsed = parseInt(savedSeason)
        if (!isNaN(parsed)) setDefaultSeason(parsed)
      }
      const storedTarget = localStorage.getItem('baseball_target_avg')
      if (storedTarget) setTargetAvg(storedTarget)
      setLoading(false)
    }
    load()
  }, [supabase, currentYear])

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: err } = await supabase.from('users').upsert({
      id: user.id,
      name: name.trim() || null,
      team_name: teamName.trim() || null,
      position: position.trim() || null,
    })
    if (err) {
      setError('保存に失敗しました: ' + err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-[520px] flex items-center justify-center text-sub2">
        読み込み中...
      </div>
    )
  }

  const inputClass = "w-full border border-s2 rounded-lg px-3 py-2 text-sm bg-lv1 text-main placeholder-sub2 focus:outline-none focus:ring-2 focus:ring-theme"
  const labelClass = "block text-sm font-medium text-main mb-1.5"

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-accent">設定</h1>

      {/* テーマ */}
      <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-6">
        <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-4">
          表示テーマ
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {THEME_OPTIONS.map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150 text-xs font-medium btn ${
                theme === value
                  ? 'border-theme bg-theme/10 dark:bg-theme/10 text-accent'
                  : 'border-s2 text-sub1 hover:border-s1'
              }`}
            >
              <span className="text-xl">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* プロフィール */}
      <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide">
          プロフィール
        </h2>
        <div>
          <label className={labelClass}>チーム名</label>
          <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="例: タイガース" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>名前</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 山田 太郎" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>ポジション</label>
          <input type="text" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="例: 外野手" className={inputClass} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && <p className="text-sm text-green-500 font-medium">保存しました</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-theme hover:opacity-90 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm btn"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {/* シーズン管理 */}
      <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide">
          シーズン管理
        </h2>
        <div>
          <label className={labelClass}>デフォルトシーズン</label>
          <select
            value={defaultSeason}
            onChange={(e) => setDefaultSeason(parseInt(e.target.value))}
            className={inputClass}
          >
            {availableSeasons.map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <p className="text-xs text-sub2 mt-1">成績ページを開いたときに表示されるシーズン</p>
        </div>
        {seasonSaved && <p className="text-sm text-green-500 font-medium">シーズン設定を保存しました</p>}
        <div className="flex gap-2">
          <button
            onClick={() => {
              localStorage.setItem('baseball_stats_season', String(defaultSeason))
              setSeasonSaved(true)
              setTimeout(() => setSeasonSaved(false), 3000)
            }}
            className="flex-1 border border-s2 hover:border-theme text-main font-medium py-2 rounded-lg transition-colors text-sm btn"
          >
            保存
          </button>
          <button
            onClick={() => {
              localStorage.setItem('baseball_stats_season', String(currentYear))
              setDefaultSeason(currentYear)
              setSeasonSaved(true)
              setTimeout(() => setSeasonSaved(false), 3000)
            }}
            className="flex-1 bg-theme hover:opacity-90 text-white font-medium py-2 rounded-lg transition-colors text-sm btn"
          >
            {currentYear}年シーズン開始
          </button>
        </div>
      </div>

      {/* 目標打率 */}
      <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide">
          目標打率
        </h2>
        <div>
          <label className={labelClass}>目標打率（例: .300）</label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              max="1"
              value={targetAvg}
              onChange={(e) => setTargetAvg(e.target.value)}
              placeholder="例: 0.300"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => {
                const val = parseFloat(targetAvg)
                if (!isNaN(val) && val > 0 && val <= 1) {
                  localStorage.setItem('baseball_target_avg', String(val))
                  setTargetSaved(true)
                  setTimeout(() => setTargetSaved(false), 2000)
                }
              }}
              className="shrink-0 bg-theme hover:opacity-90 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm btn"
            >
              設定
            </button>
          </div>
          {targetSaved && <p className="text-xs text-pos-t mt-1 font-medium">✓ 目標打率を設定しました</p>}
          <p className="text-xs text-sub2 mt-1">ダッシュボードに達成度メーターが表示されます</p>
        </div>
      </div>

      {/* アカウント */}
      <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-6">
        <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-4">
          アカウント
        </h2>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium py-2.5 rounded-lg transition-colors text-sm btn"
        >
          {loggingOut ? 'ログアウト中...' : 'ログアウト'}
        </button>
      </div>
    </div>
  )
}