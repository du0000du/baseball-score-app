'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const MAX_ROWS = 50
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const RESULT_OPTIONS = [
  { value: 'win',  label: '○ 勝', short: '勝' },
  { value: 'loss', label: '● 負', short: '負' },
  { value: 'draw', label: '△ 引', short: '引' },
] as const

type ResultType = 'win' | 'loss' | 'draw'

// ─── 行データ型 ───────────────────────────────────────────────────────────────

type BulkRow = {
  id: string            // クライアント側ユニーク ID（UI key 用）
  game_date: string     // YYYY-MM-DD
  opponent: string
  result: ResultType
  score_us: string      // 文字列で保持（バリデーション前）
  score_them: string
  stadium: string
  notes: string
}

type RowError = {
  game_date?: string
  opponent?: string
  score_us?: string
  score_them?: string
  opponent_score_mismatch?: string  // スコアと勝敗の矛盾
}

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function newRow(): BulkRow {
  return {
    id: crypto.randomUUID(),
    game_date: new Date().toISOString().split('T')[0],
    opponent: '',
    result: 'win',
    score_us: '0',
    score_them: '0',
    stadium: '',
    notes: '',
  }
}

/** 空行判定：対戦相手が空なら「未入力行」とみなしてスキップ */
function isEmptyRow(row: BulkRow): boolean {
  return row.opponent.trim() === ''
}

/** 1行のバリデーション。空行は呼ばない前提 */
function validateRow(row: BulkRow): RowError {
  const err: RowError = {}

  // ── 試合日 ──
  if (!row.game_date) {
    err.game_date = '試合日を入力してください'
  } else if (!DATE_PATTERN.test(row.game_date)) {
    err.game_date = '形式が不正です（YYYY-MM-DD）'
  } else {
    const d = new Date(row.game_date)
    if (isNaN(d.getTime())) {
      err.game_date = '存在しない日付です'
    } else {
      const year = d.getFullYear()
      if (year < 2000 || year > 2099) err.game_date = '年は 2000〜2099 で入力してください'
    }
  }

  // ── 対戦相手 ──
  if (!row.opponent.trim()) {
    err.opponent = '対戦相手を入力してください'
  } else if (row.opponent.trim().length > 100) {
    err.opponent = '100文字以内で入力してください'
  }

  // ── スコア（数値・範囲チェック） ──
  const us   = parseInt(row.score_us,   10)
  const them = parseInt(row.score_them, 10)

  if (row.score_us === '' || isNaN(us)) {
    err.score_us = '数値を入力してください'
  } else if (us < 0 || us > 99) {
    err.score_us = '0〜99 で入力してください'
  }

  if (row.score_them === '' || isNaN(them)) {
    err.score_them = '数値を入力してください'
  } else if (them < 0 || them > 99) {
    err.score_them = '0〜99 で入力してください'
  }

  // ── スコアと勝敗の整合性チェック ──
  if (!err.score_us && !err.score_them) {
    if (row.result === 'win' && us <= them) {
      err.opponent_score_mismatch = `勝利なら自チーム(${us})>相手(${them})のはずです`
    } else if (row.result === 'loss' && us >= them) {
      err.opponent_score_mismatch = `敗北なら自チーム(${us})<相手(${them})のはずです`
    } else if (row.result === 'draw' && us !== them) {
      err.opponent_score_mismatch = `引き分けなら自チーム(${us})=相手(${them})のはずです`
    }
  }

  return err
}

function hasError(e: RowError): boolean {
  return Object.keys(e).length > 0
}

// ─── コンポーネント ───────────────────────────────────────────────────────────

export default function BulkNewPage() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [rows, setRows]           = useState<BulkRow[]>(() => Array.from({ length: 5 }, newRow))
  const [rowErrors, setRowErrors] = useState<Record<string, RowError>>({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading]     = useState(false)
  const [submitted, setSubmitted] = useState(false)  // 送信試行フラグ（送信後にのみエラー表示）
  const [pastOpponents, setPastOpponents] = useState<string[]>([])
  const [pastStadiums,  setPastStadiums]  = useState<string[]>([])

  // 過去の候補を取得
  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('games')
        .select('opponent, stadium')
        .eq('user_id', user.id)
      if (data) {
        setPastOpponents(Array.from(new Set(data.map(g => g.opponent).filter(Boolean))).sort() as string[])
        setPastStadiums( Array.from(new Set(data.map(g => g.stadium ).filter(Boolean))).sort() as string[])
      }
    }
    fetchSuggestions()
  }, [supabase])

  // ── 行更新 ──
  const updateRow = useCallback((id: string, key: keyof BulkRow, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r))
    // 入力が変わったら、そのフィールドのエラーをリアルタイムでクリア
    if (submitted) {
      setRowErrors(prev => {
        const rowErr = { ...(prev[id] ?? {}) }
        if (key === 'game_date') delete rowErr.game_date
        if (key === 'opponent')  delete rowErr.opponent
        if (key === 'score_us')  { delete rowErr.score_us;  delete rowErr.opponent_score_mismatch }
        if (key === 'score_them'){ delete rowErr.score_them; delete rowErr.opponent_score_mismatch }
        if (key === 'result')    delete rowErr.opponent_score_mismatch
        return { ...prev, [id]: rowErr }
      })
    }
  }, [submitted])

  // ── 勝敗切替時にスコアを自動補正（任意・ユーザー補助） ──
  const handleResultChange = useCallback((id: string, result: ResultType) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      const us   = parseInt(r.score_us,   10)
      const them = parseInt(r.score_them, 10)
      if (isNaN(us) || isNaN(them)) return { ...r, result }
      // 矛盾がある場合のみスコアを自動修正（矛盾がなければそのまま）
      if (result === 'win'  && us <= them) return { ...r, result, score_us: String(them + 1) }
      if (result === 'loss' && us >= them) return { ...r, result, score_them: String(us + 1) }
      if (result === 'draw' && us !== them) return { ...r, result, score_them: r.score_us }
      return { ...r, result }
    }))
    if (submitted) {
      setRowErrors(prev => {
        const rowErr = { ...(prev[id] ?? {}) }
        delete rowErr.opponent_score_mismatch
        return { ...prev, [id]: rowErr }
      })
    }
  }, [submitted])

  // ── 行追加 ──
  const addRow = () => {
    if (rows.length >= MAX_ROWS) return
    // 直前の行の日付・球場を引き継いで入力しやすくする
    const last = rows[rows.length - 1]
    const r = newRow()
    r.game_date = last?.game_date ?? r.game_date
    r.stadium   = last?.stadium   ?? ''
    setRows(prev => [...prev, r])
  }

  // ── 行削除 ──
  const removeRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id))
    setRowErrors(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  // ── 送信 ──
  const handleSubmit = async () => {
    setSubmitted(true)
    setGlobalError('')

    // 空行を除いた有効行
    const activeRows = rows.filter(r => !isEmptyRow(r))
    if (activeRows.length === 0) {
      setGlobalError('対戦相手を少なくとも1件入力してください')
      return
    }

    // 全行バリデーション
    const newErrors: Record<string, RowError> = {}
    for (const row of activeRows) {
      const e = validateRow(row)
      if (hasError(e)) newErrors[row.id] = e
    }

    if (Object.keys(newErrors).length > 0) {
      setRowErrors(newErrors)
      setGlobalError(`エラーがある行があります（${Object.keys(newErrors).length}件）。赤枠の行を修正してください。`)
      // エラーがある最初の行にスクロール
      const firstErrorId = Object.keys(newErrors)[0]
      document.getElementById(`row-${firstErrorId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    // DB 登録
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const insertRows = activeRows.map(row => ({
      user_id:    user.id,
      game_date:  row.game_date,
      opponent:   row.opponent.trim(),
      result:     row.result,
      score_us:   parseInt(row.score_us,   10),
      score_them: parseInt(row.score_them, 10),
      stadium:    row.stadium.trim() || null,
      notes:      row.notes.trim()   || null,
      season:     parseInt(row.game_date.slice(0, 4), 10),
    }))

    // 50件超の場合は分割 INSERT
    const CHUNK = 50
    let dbError = null
    for (let i = 0; i < insertRows.length; i += CHUNK) {
      const chunk = insertRows.slice(i, i + CHUNK)
      const { error } = await supabase.from('games').insert(chunk)
      if (error) { dbError = error; break }
    }

    setLoading(false)

    if (dbError) {
      setGlobalError('データベースへの登録に失敗しました。もう一度お試しください。')
      return
    }

    router.push('/games')
  }

  // ── 空行数・有効行数 ──
  const activeCount = rows.filter(r => !isEmptyRow(r)).length
  const errorCount  = Object.values(rowErrors).filter(hasError).length

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/games" className="text-sub2 hover:text-main transition-colors text-sm">
          ← 試合一覧
        </Link>
        <h1 className="text-xl font-bold text-accent">複数試合をまとめて登録</h1>
      </div>
      <p className="text-sm text-sub2 mb-5">
        ベボレコなどの記録を見ながら、複数の試合を一度に入力できます。<br className="hidden sm:block"/>
        <strong className="text-main">対戦相手が空の行は自動でスキップ</strong>されます。
      </p>

      {/* グローバルエラー */}
      {globalError && (
        <div className="mb-4 flex items-start gap-2 bg-neg/10 border border-neg/40 text-neg-t rounded-xl px-4 py-3 text-sm">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{globalError}</span>
        </div>
      )}

      {/* テーブル（スマホ横スクロール） */}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="min-w-[840px] w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-s2 text-xs text-sub2 font-medium">
              <th className="text-left py-2 px-2 whitespace-nowrap w-40">試合日 *</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">対戦相手 *</th>
              <th className="text-left py-2 px-2 whitespace-nowrap w-28">球場</th>
              <th className="text-center py-2 px-2 whitespace-nowrap w-28">勝敗 *</th>
              <th className="text-center py-2 px-2 whitespace-nowrap w-16">自点 *</th>
              <th className="text-center py-2 px-2 whitespace-nowrap w-16">相点 *</th>
              <th className="text-left py-2 px-2 whitespace-nowrap">メモ</th>
              <th className="w-8 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const err     = rowErrors[row.id] ?? {}
              const hasErr  = hasError(err)
              const isEmpty = isEmptyRow(row)
              return (
                <tr
                  key={row.id}
                  id={`row-${row.id}`}
                  className={`border-b transition-colors ${
                    hasErr && !isEmpty
                      ? 'border-neg/50 bg-neg/5'
                      : 'border-s2 hover:bg-lv2/50'
                  }`}
                >
                  {/* 行番号 + 試合日 */}
                  <td className="py-2 px-2 align-top">
                    <div className="flex items-start gap-1">
                      <span className="text-xs text-sub2 w-5 shrink-0 mt-2 text-right">{idx + 1}</span>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={row.game_date}
                          onChange={e => updateRow(row.id, 'game_date', e.target.value)}
                          placeholder="2025-06-15"
                          maxLength={10}
                          className={`w-full border rounded px-2 py-1.5 text-sm bg-lv1 text-main focus:outline-none focus:ring-1 text-center font-mono ${
                            err.game_date ? 'border-neg focus:ring-neg' : 'border-s2 focus:ring-theme'
                          }`}
                        />
                        {err.game_date && (
                          <p className="text-neg-t text-xs mt-0.5 leading-tight">{err.game_date}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 対戦相手 */}
                  <td className="py-2 px-2 align-top">
                    <OpponentCell
                      value={row.opponent}
                      suggestions={pastOpponents}
                      hasError={!!err.opponent}
                      onChange={v => updateRow(row.id, 'opponent', v)}
                    />
                    {err.opponent && (
                      <p className="text-neg-t text-xs mt-0.5 leading-tight">{err.opponent}</p>
                    )}
                  </td>

                  {/* 球場 */}
                  <td className="py-2 px-2 align-top">
                    <StadiumCell
                      value={row.stadium}
                      suggestions={pastStadiums}
                      onChange={v => updateRow(row.id, 'stadium', v)}
                    />
                  </td>

                  {/* 勝敗 */}
                  <td className="py-2 px-2 align-top">
                    <div className="flex gap-0.5">
                      {RESULT_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleResultChange(row.id, opt.value)}
                          className={`flex-1 py-1.5 text-xs font-medium rounded border transition-colors ${
                            row.result === opt.value
                              ? opt.value === 'win'  ? 'bg-pos border-pos-t text-pos-t'
                              : opt.value === 'loss' ? 'bg-neg border-neg-t text-neg-t'
                              :                        'bg-neu border-neu-t text-neu-t'
                              : 'bg-lv1 border-s2 text-sub2 hover:border-s1'
                          }`}
                        >
                          {opt.short}
                        </button>
                      ))}
                    </div>
                    {err.opponent_score_mismatch && (
                      <p className="text-neg-t text-xs mt-0.5 leading-tight">{err.opponent_score_mismatch}</p>
                    )}
                  </td>

                  {/* 自点 */}
                  <td className="py-2 px-2 align-top">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      inputMode="numeric"
                      value={row.score_us}
                      onChange={e => updateRow(row.id, 'score_us', e.target.value)}
                      className={`w-full border rounded px-2 py-1.5 text-sm bg-lv1 text-main focus:outline-none focus:ring-1 text-center ${
                        err.score_us || err.opponent_score_mismatch ? 'border-neg focus:ring-neg' : 'border-s2 focus:ring-theme'
                      }`}
                    />
                    {err.score_us && (
                      <p className="text-neg-t text-xs mt-0.5 leading-tight">{err.score_us}</p>
                    )}
                  </td>

                  {/* 相手点 */}
                  <td className="py-2 px-2 align-top">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      inputMode="numeric"
                      value={row.score_them}
                      onChange={e => updateRow(row.id, 'score_them', e.target.value)}
                      className={`w-full border rounded px-2 py-1.5 text-sm bg-lv1 text-main focus:outline-none focus:ring-1 text-center ${
                        err.score_them || err.opponent_score_mismatch ? 'border-neg focus:ring-neg' : 'border-s2 focus:ring-theme'
                      }`}
                    />
                    {err.score_them && (
                      <p className="text-neg-t text-xs mt-0.5 leading-tight">{err.score_them}</p>
                    )}
                  </td>

                  {/* メモ */}
                  <td className="py-2 px-2 align-top">
                    <input
                      type="text"
                      value={row.notes}
                      onChange={e => updateRow(row.id, 'notes', e.target.value)}
                      placeholder="任意"
                      maxLength={200}
                      className="w-full border border-s2 rounded px-2 py-1.5 text-sm bg-lv1 text-main focus:outline-none focus:ring-1 focus:ring-theme"
                    />
                  </td>

                  {/* 削除 */}
                  <td className="py-2 px-2 align-top">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length <= 1}
                      className="text-sub2 hover:text-neg-t disabled:opacity-20 transition-colors p-1"
                      title="この行を削除"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 行追加ボタン */}
      <div className="flex items-center justify-between mt-3">
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= MAX_ROWS}
          className="text-sm text-theme border border-theme/40 rounded-lg px-4 py-2 hover:bg-theme/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ＋ 行を追加
        </button>
        <span className="text-xs text-sub2">{rows.length} 行（最大 {MAX_ROWS} 行）</span>
      </div>

      {/* ステータスサマリー */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-sub2">
        <span>入力済み: <strong className="text-main">{activeCount}</strong> 件</span>
        <span>空行（スキップ）: <strong className="text-main">{rows.length - activeCount}</strong> 行</span>
        {errorCount > 0 && (
          <span className="text-neg-t font-medium">⚠️ エラー: {errorCount} 行</span>
        )}
      </div>

      {/* 送信ボタン */}
      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || activeCount === 0}
          className="bg-theme text-white rounded-xl px-6 py-3 font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? '登録中...' : `${activeCount}件を登録する`}
        </button>
        <Link href="/games" className="text-sm text-sub2 hover:text-main transition-colors">
          キャンセル
        </Link>
        {activeCount > 0 && errorCount === 0 && !loading && (
          <span className="text-xs text-sub2">
            ※ 登録後は試合一覧に移動します
          </span>
        )}
      </div>

      {/* ヒント */}
      <div className="mt-8 bg-lv2 border border-s2 rounded-xl px-4 py-3 text-xs text-sub2 space-y-1">
        <p className="font-medium text-sub1">入力のヒント</p>
        <p>・試合日は <code className="bg-lv1 px-1 rounded">YYYY-MM-DD</code> 形式で入力してください（例: 2025-06-15）</p>
        <p>・勝敗ボタンを押すと、スコアとの矛盾が検出されます</p>
        <p>・対戦相手が空の行は自動でスキップされ、登録されません</p>
        <p>・「＋ 行を追加」で最大 {MAX_ROWS} 行まで追加できます</p>
      </div>
    </div>
  )
}

// ─── サブコンポーネント: 対戦相手入力（候補サジェスト付き） ──────────────────

function OpponentCell({
  value,
  suggestions,
  hasError,
  onChange,
}: {
  value: string
  suggestions: string[]
  hasError: boolean
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const filtered = suggestions.filter(s =>
    s.toLowerCase().includes(value.toLowerCase()) && s !== value
  ).slice(0, 6)

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="例：○○ファイターズ"
        maxLength={100}
        className={`w-full border rounded px-2 py-1.5 text-sm bg-lv1 text-main focus:outline-none focus:ring-1 ${
          hasError ? 'border-neg focus:ring-neg' : 'border-s2 focus:ring-theme'
        }`}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 top-full left-0 right-0 bg-lv1 border border-s2 rounded-lg shadow-lg mt-0.5 max-h-40 overflow-y-auto">
          {filtered.map(s => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={() => { onChange(s); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-lv2 text-main transition-colors"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── サブコンポーネント: 球場入力（候補サジェスト付き） ───────────────────────

function StadiumCell({
  value,
  suggestions,
  onChange,
}: {
  value: string
  suggestions: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const filtered = suggestions.filter(s =>
    s.toLowerCase().includes(value.toLowerCase()) && s !== value
  ).slice(0, 6)

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="任意"
        maxLength={100}
        className="w-full border border-s2 rounded px-2 py-1.5 text-sm bg-lv1 text-main focus:outline-none focus:ring-1 focus:ring-theme"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 top-full left-0 right-0 bg-lv1 border border-s2 rounded-lg shadow-lg mt-0.5 max-h-40 overflow-y-auto">
          {filtered.map(s => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={() => { onChange(s); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-lv2 text-main transition-colors"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
