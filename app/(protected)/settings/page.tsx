'use client'

import { useEffect, useState, useRef, useContext } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/lib/supabase/types'
import { ThemeContext } from '@/app/(protected)/_components/ThemeProvider'
import type { Theme } from '@/app/(protected)/_components/ThemeProvider'

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light',  label: 'ライト',       icon: '☀️' },
  { value: 'dark',   label: 'ダーク',       icon: '🌙' },
  { value: 'system', label: 'システム設定', icon: '💻' },
]

export default function SettingsPage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const { theme, setTheme } = useContext(ThemeContext)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [position, setPosition] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      if (data) {
        const profile = data as User
        setName(profile.name ?? '')
        setTeamName(profile.team_name ?? '')
        setPosition(profile.position ?? '')
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: err } = await supabase
      .from('users')
      .upsert({
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
      <div className="min-h-[520px] flex items-center justify-center text-gray-400 dark:text-gray-500">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-crimson-500">プロフィール設定</h1>

      {/* テーマ設定 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          表示テーマ
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-150 text-sm font-medium ${
                theme === value
                  ? 'border-crimson-500 bg-crimson-50 dark:bg-crimson-900/20 text-crimson-600 dark:text-crimson-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <span className="text-2xl">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* プロフィール入力フォーム */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          プロフィール
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            チーム名
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="例: Tigers"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-crimson-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            名前
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 山田太郎"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-crimson-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            ポジション
          </label>
          <input
            type="text"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="例: 外野手"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-crimson-500"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {saved && (
          <p className="text-sm text-green-600 font-medium">✓ 保存しました</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-crimson-500 hover:bg-crimson-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm btn"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}
