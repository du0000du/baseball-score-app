'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/lib/supabase/types'

export default function SettingsPage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

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
    return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-navy-500">プロフィール設定</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            チーム名
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="例: Tigers"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            名前
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 山田太郎"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            ポジション
          </label>
          <input
            type="text"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="例: 外野手"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
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
          className="w-full bg-navy-500 hover:bg-navy-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}
