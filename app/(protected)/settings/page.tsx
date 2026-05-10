'use client'

import { useEffect, useState, useRef, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/lib/supabase/types'
import { ThemeContext } from '@/app/(protected)/_components/ThemeProvider'
import type { Theme } from '@/app/(protected)/_components/ThemeProvider'

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light',  label: 'light',   icon: '☀️' },
  { value: 'dark',   label: 'dark',    icon: '🌙' },
  { value: 'system', label: 'system',  icon: '💻' },
  { value: 'abema',  label: 'ABEMA',   icon: '📺' },
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
  // L6-1: season management
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([])
  const [defaultSeason, setDefaultSeason] = useState<number>(currentYear)
  const [seasonSaved, setSeasonSaved] = useState(false)

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
      // L6-1: fetch season list from DB
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
      // restore default season from localStorage
      const savedSeason = localStorage.getItem('baseball_stats_season')
      if (savedSeason && savedSeason !== 'all') {
        const parsed = parseInt(savedSeason)
        if (!isNaN(parsed)) setDefaultSeason(parsed)
      }
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
      setError('Failed to save: ' + err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-[520px] flex items-center justify-center text-sub2">
        Loading...
      </div>
    )
  }

  const inputClass = "w-full border border-s2 rounded-lg px-3 py-2 text-sm bg-lv1 text-main placeholder-sub2 focus:outline-none focus:ring-2 focus:ring-theme"
  const labelClass = "block text-sm font-medium text-main mb-1.5"

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-accent">Profile Settings</h1>

      {/* Theme */}
      <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-6">
        <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-4">
          Display Theme
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {THEME_OPTIONS.map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-150 text-sm font-medium btn ${
                theme === value
                  ? 'border-theme bg-theme/10 dark:bg-theme/10 text-accent'
                  : 'border-s2 text-sub1 hover:border-s1'
              }`}
            >
              <span className="text-2xl">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Profile */}
      <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide">
          Profile
        </h2>
        <div>
          <label className={labelClass}>Team Name</label>
          <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Tigers" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Taro Yamada" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Position</label>
          <input type="text" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Outfielder" className={inputClass} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && <p className="text-sm text-green-500 font-medium">Saved</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-theme hover:opacity-90 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm btn"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* L6-1: Season Management */}
      <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide">
          Season Management
        </h2>
        <div>
          <label className={labelClass}>Default Season</label>
          <select
            value={defaultSeason}
            onChange={(e) => setDefaultSeason(parseInt(e.target.value))}
            className={inputClass}
          >
            {availableSeasons.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <p className="text-xs text-sub2 mt-1">Season shown when opening the stats page</p>
        </div>
        {seasonSaved && <p className="text-sm text-green-500 font-medium">Season setting saved</p>}
        <div className="flex gap-2">
          <button
            onClick={() => {
              localStorage.setItem('baseball_stats_season', String(defaultSeason))
              setSeasonSaved(true)
              setTimeout(() => setSeasonSaved(false), 3000)
            }}
            className="flex-1 border border-s2 hover:border-theme text-main font-medium py-2 rounded-lg transition-colors text-sm btn"
          >
            Save Season
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
            Start {currentYear} Season
          </button>
        </div>
      </div>

      {/* M6-6: Logout */}
      <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-6">
        <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-4">
          Account
        </h2>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 font-medium py-2.5 rounded-lg transition-colors text-sm btn"
        >
          {loggingOut ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </div>
  )
}
