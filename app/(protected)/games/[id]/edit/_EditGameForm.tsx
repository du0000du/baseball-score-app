'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'

export default function EditGameForm({ game }: { game: Game }) {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    game_date: game.game_date,
    opponent: game.opponent,
    result: game.result,
    score_us: String(game.score_us),
    score_them: String(game.score_them),
    stadium: game.stadium ?? '',
    notes: game.notes ?? '',
  })

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.opponent.trim()) {
      setError('対戦相手を入力してください')
      return
    }
    setLoading(true)
    setError('')

    const season = new Date(form.game_date).getFullYear()
    const { error: dbError } = await supabase
      .from('games')
      .update({
        game_date: form.game_date,
        opponent: form.opponent.trim(),
        result: form.result,
        score_us: parseInt(form.score_us) || 0,
        score_them: parseInt(form.score_them) || 0,
        stadium: form.stadium.trim() || null,
        notes: form.notes.trim() || null,
        season,
      })
      .eq('id', game.id)

    if (dbError) {
      setError('更新に失敗しました: ' + dbError.message)
      setLoading(false)
      return
    }

    router.push('/games')
    router.refresh()
  }

  const resultOptions = [
    { value: 'win', label: '勝利 ○', color: 'bg-green-50 border-green-300 text-green-700' },
    { value: 'loss', label: '敗北 ●', color: 'bg-red-50 border-red-300 text-red-700' },
    { value: 'draw', label: '引分 △', color: 'bg-yellow-50 border-yellow-300 text-yellow-700' },
  ] as const

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/games" className="text-gray-400 hover:text-gray-600 transition-colors">
          ← 試合一覧
        </Link>
        <h1 className="text-2xl font-bold text-navy-500">試合を編集</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">試合日 *</label>
          <input
            type="date"
            value={form.game_date}
            onChange={(e) => set('game_date', e.target.value)}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">対戦相手 *</label>
          <input
            type="text"
            value={form.opponent}
            onChange={(e) => set('opponent', e.target.value)}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">試合結果 *</label>
          <div className="grid grid-cols-3 gap-2">
            {resultOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('result', opt.value)}
                className={`py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  form.result === opt.value
                    ? opt.color + ' border-2'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">スコア</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">自チーム</label>
              <input
                type="number"
                min="0"
                value={form.score_us}
                onChange={(e) => set('score_us', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
            </div>
            <span className="text-gray-400 font-bold mt-5">-</span>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">相手チーム</label>
              <input
                type="number"
                min="0"
                value={form.score_them}
                onChange={(e) => set('score_them', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">球場・グラウンド</label>
          <input
            type="text"
            value={form.stadium}
            onChange={(e) => set('stadium', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-navy-500 hover:bg-navy-600 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {loading ? '更新中...' : '試合を更新