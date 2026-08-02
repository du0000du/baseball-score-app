'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcBattingStats, fmtAvg, fmtERA, formatIP, outsToIPDecimal } from '@/lib/stats'
import { FIELDING_POSITIONS } from '@/lib/supabase/types'
import type { AtBat, FieldingPosition, Game, PitchingStat, ResultType } from '@/lib/supabase/types'
import { toHalfWidth } from '@/lib/bulk-parse'
import {
  CODE_LEGEND, countsAsAtBat, formatAtBatCode, parseAtBatCode, reachedBase,
} from '@/lib/at-bat-code'
import SheetGrid from './_SheetGrid'
import type { SheetColumn, SheetRow } from './_SheetGrid'

interface GameWithAtBats extends Game { at_bats: AtBat[] }

type Tab = 'batting' | 'pitching'

/** 打席列の最低本数（実データがこれより多ければ自動で増やす） */
const MIN_AB_COLS = 6
const MAX_AB_COLS = 9

// ─── 値の正規化 ───────────────────────────────────────────────────────────────

function normOrder(raw: string): string {
  const s = toHalfWidth(raw).trim()
  if (!s) return ''
  const m = s.match(/\d+/)
  if (!m) return ''
  return String(Math.max(1, Math.min(12, parseInt(m[0], 10))))
}

function normCount(raw: string, max = 99): string {
  const s = toHalfWidth(raw).trim()
  if (!s) return ''
  const m = s.match(/\d+/)
  if (!m) return ''
  return String(Math.max(0, Math.min(max, parseInt(m[0], 10))))
}

const POS_ALIASES: { alias: string; value: FieldingPosition }[] = [
  ...FIELDING_POSITIONS.map(p => ({ alias: p.label, value: p.value })),
  ...FIELDING_POSITIONS.map(p => ({ alias: p.full, value: p.value })),
  { alias: 'P', value: 'pitcher' }, { alias: 'C', value: 'catcher' },
  { alias: '1B', value: 'first_base' }, { alias: '2B', value: 'second_base' },
  { alias: '3B', value: 'third_base' }, { alias: 'SS', value: 'shortstop' },
  { alias: 'LF', value: 'left' }, { alias: 'CF', value: 'center' }, { alias: 'RF', value: 'right' },
]

function parsePosition(raw: string): FieldingPosition | null {
  const s = toHalfWidth(raw).trim().toUpperCase()
  if (!s) return null
  const hit = POS_ALIASES.find(p => p.alias.toUpperCase() === s)
  return hit ? hit.value : null
}

function posLabel(v: FieldingPosition | null): string {
  if (!v) return ''
  return FIELDING_POSITIONS.find(p => p.value === v)?.label ?? ''
}

function normPos(raw: string): string {
  const v = parsePosition(raw)
  return v ? posLabel(v) : (raw.trim() ? raw.trim() : '')
}

/** 打席コードを正規表記に寄せる（解釈できなければ入力のまま返し、検証でエラーにする） */
function normAtBat(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  const p = parseAtBatCode(s)
  return p ? formatAtBatCode(p.result_type, p.rbi) : s
}

/** 「3」「3.1」「3 1/3」→ 1/3単位のアウト数 */
function parseIP(raw: string): number | null {
  const s = toHalfWidth(raw).trim()
  if (!s) return null
  let m = s.match(/^(\d+)\s*[.．]\s*([012])$/)
  if (m) return parseInt(m[1], 10) * 3 + parseInt(m[2], 10)
  m = s.match(/^(\d+)\s+([12])\s*\/\s*3$/)
  if (m) return parseInt(m[1], 10) * 3 + parseInt(m[2], 10)
  m = s.match(/^(\d+)$/)
  if (m) return parseInt(m[1], 10) * 3
  return null
}

function normIP(raw: string): string {
  const outs = parseIP(raw)
  return outs === null ? (raw.trim() ? raw.trim() : '') : formatIP(outs)
}

type PitchResult = 'win' | 'loss' | 'save' | 'hold' | 'none'
const PITCH_RES_LABEL: Record<PitchResult, string> = {
  win: '勝', loss: '敗', save: 'S', hold: 'H', none: '',
}
function parsePitchResult(raw: string): PitchResult | null {
  const s = toHalfWidth(raw).trim().toLowerCase()
  if (!s) return 'none'
  if (['勝', 'w', 'win', '勝ち', '○'].includes(s)) return 'win'
  if (['敗', '負', 'l', 'loss', '●'].includes(s)) return 'loss'
  if (['s', 'save', 'セーブ'].includes(s)) return 'save'
  if (['h', 'hold', 'ホールド'].includes(s)) return 'hold'
  return null
}
function normPitchRes(raw: string): string {
  const v = parsePitchResult(raw)
  return v === null ? raw.trim() : PITCH_RES_LABEL[v]
}

function normFlag(raw: string): string {
  const s = toHalfWidth(raw).trim().toLowerCase()
  if (!s) return ''
  return ['○', 'o', '1', 'yes', 'y', '✓', 'true', '有'].includes(s) ? '○' : ''
}

// ─── ページ ───────────────────────────────────────────────────────────────────

export default function BulkStatsPage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const currentYear = new Date().getFullYear()

  const [season, setSeason] = useState<number | 'all'>(currentYear)
  const [tab, setTab] = useState<Tab>('batting')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [games, setGames] = useState<GameWithAtBats[]>([])
  const [pitchOrig, setPitchOrig] = useState<PitchingStat[]>([])

  const [batRows, setBatRows] = useState<SheetRow[]>([])
  const [batOrig, setBatOrig] = useState<SheetRow[]>([])
  const [pitRows, setPitRows] = useState<SheetRow[]>([])
  const [pitOrigRows, setPitOrigRows] = useState<SheetRow[]>([])
  const [abColCount, setAbColCount] = useState(MIN_AB_COLS)

  const [undoStack, setUndoStack] = useState<{ tab: Tab; rows: SheetRow[] }[]>([])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  // ── 読み込み ──
  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const gq = supabase.from('games').select('*, at_bats(*)').eq('user_id', user.id)
    const [{ data: gData }, { data: pData }] = await Promise.all([
      (season === 'all' ? gq : gq.eq('season', season)).order('game_date', { ascending: false }),
      supabase.from('pitching_stats').select('*, games!inner(season, user_id)').eq('games.user_id', user.id),
    ])

    const gs = (gData ?? []) as GameWithAtBats[]
    const ps = ((pData ?? []) as (PitchingStat & { games: { season: number } })[])
      .filter(p => season === 'all' || p.games?.season === season)

    setGames(gs)
    setPitchOrig(ps)

    // 打席列数：実データの最大打席数に合わせる
    const maxAb = gs.reduce((m, g) => Math.max(m, g.at_bats.length), 0)
    const cols = Math.max(MIN_AB_COLS, Math.min(MAX_AB_COLS, maxAb + 1))
    setAbColCount(cols)

    const bRows: SheetRow[] = gs.map(g => {
      const sorted = [...g.at_bats].sort((a, b) => a.at_bat_number - b.at_bat_number)
      const row: SheetRow = {
        order: sorted[0]?.batting_order ? String(sorted[0].batting_order) : '',
        pos: posLabel((sorted[0]?.fielding_position ?? null) as FieldingPosition | null),
        runs: String(sorted.filter(a => a.is_run).length || ''),
        sb: String(sorted.reduce((s, a) => s + (a.stolen_base_count ?? 0), 0) || ''),
      }
      for (let i = 0; i < cols; i++) {
        const ab = sorted[i]
        row[`ab${i}`] = ab ? formatAtBatCode(ab.result_type as ResultType, ab.rbi_count ?? 0) : ''
      }
      return row
    })
    setBatRows(bRows)
    setBatOrig(bRows.map(r => ({ ...r })))

    const pRows: SheetRow[] = gs.map(g => {
      const p = ps.find(x => x.game_id === g.id)
      if (!p) return { ip: '', res: '', h: '', hr: '', k: '', bb: '', hbp: '', r: '', er: '', cg: '', pitches: '' }
      return {
        ip: formatIP(p.innings_pitched),
        res: PITCH_RES_LABEL[(p.result ?? 'none') as PitchResult],
        h: String(p.hits_allowed ?? 0),
        hr: String(p.home_runs_allowed ?? 0),
        k: String(p.strikeouts ?? 0),
        bb: String(p.walks ?? 0),
        hbp: String(p.hit_batsmen ?? 0),
        r: String(p.runs_allowed ?? 0),
        er: String(p.earned_runs ?? 0),
        cg: p.complete_game ? '○' : '',
        pitches: p.pitch_count !== null && p.pitch_count !== undefined ? String(p.pitch_count) : '',
      }
    })
    setPitRows(pRows)
    setPitOrigRows(pRows.map(r => ({ ...r })))

    setUndoStack([])
    setLoading(false)
  }, [supabase, season])

  useEffect(() => { load() }, [load])

  // ── 列定義 ──
  const batColumns: SheetColumn[] = useMemo(() => {
    const cols: SheetColumn[] = [
      { key: 'order', label: '打順', width: 48, align: 'center', hint: '1〜12' },
      { key: 'pos',   label: '守備', width: 48, align: 'center', hint: '投捕一二三遊左中右DH' },
    ]
    for (let i = 0; i < abColCount; i++) {
      cols.push({
        key: `ab${i}`, label: `${i + 1}打席`, width: 62, align: 'center',
        hint: '安/二/三/本/振/ゴ/飛/四/死/犠 など。末尾の数字は打点（例: 本2）',
      })
    }
    cols.push(
      { key: 'runs', label: '得点', width: 48, align: 'center' },
      { key: 'sb',   label: '盗塁', width: 48, align: 'center' },
      { key: 'sumAB',  label: '打数', width: 48, align: 'right', readOnly: true, accent: true },
      { key: 'sumH',   label: '安打', width: 48, align: 'right', readOnly: true, accent: true },
      { key: 'sumRBI', label: '打点', width: 48, align: 'right', readOnly: true, accent: true },
      { key: 'avg',    label: '打率', width: 58, align: 'right', readOnly: true, accent: true },
    )
    return cols
  }, [abColCount])

  const pitColumns: SheetColumn[] = useMemo(() => [
    { key: 'ip',  label: '投球回', width: 60, align: 'center', hint: '「3」「3.1」＝3回1/3' },
    { key: 'res', label: '結果',   width: 48, align: 'center', hint: '勝 / 敗 / S / H' },
    { key: 'h',   label: '被安打', width: 54, align: 'center' },
    { key: 'hr',  label: '被本',   width: 48, align: 'center', hint: '被本塁打' },
    { key: 'k',   label: '奪三振', width: 54, align: 'center' },
    { key: 'bb',  label: '与四球', width: 54, align: 'center' },
    { key: 'hbp', label: '与死球', width: 54, align: 'center' },
    { key: 'r',   label: '失点',   width: 48, align: 'center' },
    { key: 'er',  label: '自責',   width: 48, align: 'center' },
    { key: 'cg',  label: '完投',   width: 44, align: 'center', hint: '○ で完投' },
    { key: 'pitches', label: '球数', width: 52, align: 'center' },
    { key: 'era', label: '防御率', width: 60, align: 'right', readOnly: true, accent: true },
  ], [])

  // ── 集計列を差し込んだ表示用の行 ──
  const batDisplayRows: SheetRow[] = useMemo(() => batRows.map(row => {
    let ab = 0, h = 0, rbi = 0
    for (let i = 0; i < abColCount; i++) {
      const p = parseAtBatCode(row[`ab${i}`] ?? '')
      if (!p) continue
      if (countsAsAtBat(p.result_type)) ab++
      if (['hit', 'double', 'triple', 'hr'].includes(p.result_type)) h++
      rbi += p.rbi
    }
    return {
      ...row,
      sumAB: ab ? String(ab) : '',
      sumH: h ? String(h) : '',
      sumRBI: rbi ? String(rbi) : '',
      avg: ab > 0 ? fmtAvg(h / ab) : '',
    }
  }), [batRows, abColCount])

  const pitDisplayRows: SheetRow[] = useMemo(() => pitRows.map(row => {
    const outs = parseIP(row.ip ?? '')
    const er = parseInt(row.er ?? '', 10)
    const ipDec = outs !== null ? outsToIPDecimal(outs) : 0
    return {
      ...row,
      era: ipDec > 0 && !isNaN(er) ? fmtERA((er / ipDec) * 7) : '',
    }
  }), [pitRows])

  // ── 検証 ──
  const batErrors = useMemo(() => {
    const m = new Map<string, string>()
    batRows.forEach((row, r) => {
      for (let i = 0; i < abColCount; i++) {
        const v = row[`ab${i}`] ?? ''
        if (v && !parseAtBatCode(v)) {
          m.set(`${r},${batColumns.findIndex(c => c.key === `ab${i}`)}`, `「${v}」は打席結果として解釈できません`)
        }
      }
      if (row.pos && !parsePosition(row.pos)) {
        m.set(`${r},${batColumns.findIndex(c => c.key === 'pos')}`, `「${row.pos}」は守備位置として解釈できません`)
      }
    })
    return m
  }, [batRows, abColCount, batColumns])

  const pitErrors = useMemo(() => {
    const m = new Map<string, string>()
    pitRows.forEach((row, r) => {
      if (row.ip && parseIP(row.ip) === null) {
        m.set(`${r},0`, `「${row.ip}」は投球回として解釈できません（例: 3 または 3.1）`)
      }
      if (row.res && parsePitchResult(row.res) === null) {
        m.set(`${r},1`, `「${row.res}」は結果として解釈できません（勝/敗/S/H）`)
      }
    })
    return m
  }, [pitRows])

  // ── 変更検知 ──
  const dirtyBatRows = useMemo(
    () => batRows.map((r, i) => JSON.stringify(r) !== JSON.stringify(batOrig[i])).map((d, i) => d ? i : -1).filter(i => i >= 0),
    [batRows, batOrig]
  )
  const dirtyPitRows = useMemo(
    () => pitRows.map((r, i) => JSON.stringify(r) !== JSON.stringify(pitOrigRows[i])).map((d, i) => d ? i : -1).filter(i => i >= 0),
    [pitRows, pitOrigRows]
  )
  const dirtyCount = tab === 'batting' ? dirtyBatRows.length : dirtyPitRows.length
  const currentErrors = tab === 'batting' ? batErrors : pitErrors

  // ── セル変更 ──
  const normalizeBat = (colKey: string, raw: string): string => {
    if (colKey === 'order') return normOrder(raw)
    if (colKey === 'pos') return normPos(raw)
    if (colKey === 'runs' || colKey === 'sb') return normCount(raw, 9)
    if (colKey.startsWith('ab')) return normAtBat(raw)
    return raw.trim()
  }

  const normalizePit = (colKey: string, raw: string): string => {
    if (colKey === 'ip') return normIP(raw)
    if (colKey === 'res') return normPitchRes(raw)
    if (colKey === 'cg') return normFlag(raw)
    if (colKey === 'pitches') return normCount(raw, 300)
    return normCount(raw, 99)
  }

  const handleBatCells = useCallback((cells: { r: number; c: number; value: string }[]) => {
    setUndoStack(prev => [...prev.slice(-19), { tab: 'batting', rows: batRows.map(r => ({ ...r })) }])
    setBatRows(prev => {
      const next = prev.map(r => ({ ...r }))
      for (const { r, c, value } of cells) {
        const col = batColumns[c]
        if (!col || col.readOnly || !next[r]) continue
        next[r][col.key] = value
      }
      return next
    })
  }, [batRows, batColumns])

  const handlePitCells = useCallback((cells: { r: number; c: number; value: string }[]) => {
    setUndoStack(prev => [...prev.slice(-19), { tab: 'pitching', rows: pitRows.map(r => ({ ...r })) }])
    setPitRows(prev => {
      const next = prev.map(r => ({ ...r }))
      for (const { r, c, value } of cells) {
        const col = pitColumns[c]
        if (!col || col.readOnly || !next[r]) continue
        next[r][col.key] = value
      }
      return next
    })
  }, [pitRows, pitColumns])

  const undo = useCallback(() => {
    setUndoStack(prev => {
      const last = prev[prev.length - 1]
      if (!last) return prev
      if (last.tab === 'batting') setBatRows(last.rows)
      else setPitRows(last.rows)
      setToast('元に戻しました')
      return prev.slice(0, -1)
    })
  }, [])

  // ── 保存 ──
  const saveBatting = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return '認証が切れています。再ログインしてください。'

    for (const ri of dirtyBatRows) {
      const game = games[ri]
      const row = batRows[ri]
      if (!game) continue

      const order = row.order ? parseInt(row.order, 10) : 1
      const pos = parsePosition(row.pos ?? '')

      // 入力されている打席を左から順に詰める
      const desired: { result_type: ResultType; rbi: number }[] = []
      for (let i = 0; i < abColCount; i++) {
        const p = parseAtBatCode(row[`ab${i}`] ?? '')
        if (p) desired.push(p)
      }

      // 得点は「出塁した打席」に前から割り当てる（合計値が正しく集計されるようにする）
      const runsTotal = parseInt(row.runs ?? '', 10) || 0
      const runFlags = desired.map(() => false)
      let assigned = 0
      for (let i = 0; i < desired.length && assigned < runsTotal; i++) {
        if (reachedBase(desired[i].result_type)) { runFlags[i] = true; assigned++ }
      }
      for (let i = 0; i < desired.length && assigned < runsTotal; i++) {
        if (!runFlags[i]) { runFlags[i] = true; assigned++ }
      }
      const sbTotal = parseInt(row.sb ?? '', 10) || 0

      const existing = [...game.at_bats].sort((a, b) => a.at_bat_number - b.at_bat_number)

      for (let i = 0; i < Math.max(desired.length, existing.length); i++) {
        const d = desired[i]
        const ex = existing[i]

        if (d && ex) {
          const changedType = ex.result_type !== d.result_type
          const { error } = await supabase.from('at_bats').update({
            at_bat_number: i + 1,
            batting_order: order,
            result_type: d.result_type,
            hit_type: d.result_type === 'hit' ? 'single'
              : ['double', 'triple', 'hr'].includes(d.result_type) ? d.result_type : null,
            // 結果が変わったら打球方向は整合しなくなるので消す
            direction: changedType ? null : ex.direction,
            fielding_position: pos,
            rbi_count: d.rbi,
            is_rbi: d.rbi > 0,
            is_run: runFlags[i],
            stolen_base_count: i === 0 ? sbTotal : 0,
            is_stolen_base: i === 0 && sbTotal > 0,
            is_error: d.result_type === 'error',
          }).eq('id', ex.id)
          if (error) return `保存に失敗しました（${game.opponent}戦）`
        } else if (d && !ex) {
          const { error } = await supabase.from('at_bats').insert({
            game_id: game.id,
            user_id: user.id,
            at_bat_number: i + 1,
            batting_order: order,
            result_type: d.result_type,
            hit_type: d.result_type === 'hit' ? 'single'
              : ['double', 'triple', 'hr'].includes(d.result_type) ? d.result_type : null,
            direction: null,
            fielding_position: pos,
            rbi_count: d.rbi,
            is_rbi: d.rbi > 0,
            is_run: runFlags[i],
            stolen_base_count: i === 0 ? sbTotal : 0,
            is_stolen_base: i === 0 && sbTotal > 0,
            is_caught_stealing: false,
            is_error: d.result_type === 'error',
            input_method: 'manual',
          })
          if (error) return `保存に失敗しました（${game.opponent}戦）`
        } else if (!d && ex) {
          const { error } = await supabase.from('at_bats').delete().eq('id', ex.id)
          if (error) return `削除に失敗しました（${game.opponent}戦）`
        }
      }
    }
    return null
  }

  const savePitching = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return '認証が切れています。再ログインしてください。'

    for (const ri of dirtyPitRows) {
      const game = games[ri]
      const row = pitRows[ri]
      if (!game) continue
      const existing = pitchOrig.find(p => p.game_id === game.id)

      const outs = parseIP(row.ip ?? '')
      const isBlank = !row.ip && !row.h && !row.k && !row.bb && !row.r && !row.er && !row.res

      if (isBlank) {
        if (existing) {
          const { error } = await supabase.from('pitching_stats').delete().eq('id', existing.id)
          if (error) return `削除に失敗しました（${game.opponent}戦）`
        }
        continue
      }

      const num = (v: string) => { const n = parseInt(v ?? '', 10); return isNaN(n) ? 0 : n }
      const payload = {
        game_id: game.id,
        user_id: user.id,
        innings_pitched: outs ?? 0,
        result: (parsePitchResult(row.res ?? '') ?? 'none') as PitchResult,
        hits_allowed: num(row.h),
        home_runs_allowed: num(row.hr),
        strikeouts: num(row.k),
        walks: num(row.bb),
        hit_batsmen: num(row.hbp),
        runs_allowed: num(row.r),
        earned_runs: num(row.er),
        complete_game: row.cg === '○',
        pitch_count: row.pitches ? num(row.pitches) : null,
      }

      const { error } = existing
        ? await supabase.from('pitching_stats').update(payload).eq('id', existing.id)
        : await supabase.from('pitching_stats').insert(payload)
      if (error) return `保存に失敗しました（${game.opponent}戦）`
    }
    return null
  }

  const handleSave = async () => {
    setErrorMsg('')
    if (currentErrors.size > 0) {
      setErrorMsg(`入力エラーが ${currentErrors.size} 件あります。赤いセルを修正してください。`)
      return
    }
    if (dirtyCount === 0) {
      setToast('変更はありません')
      return
    }
    setSaving(true)
    const err = tab === 'batting' ? await saveBatting() : await savePitching()
    setSaving(false)
    if (err) { setErrorMsg(err); return }
    setToast(`${dirtyCount}試合分を保存しました`)
    await load()
  }

  // ── 行ラベル ──
  const rowLabel = (i: number) => {
    const g = games[i]
    if (!g) return ''
    const [, m, d] = g.game_date.split('-')
    return (
      <span className="block truncate">
        <span className="text-sub2">{parseInt(m)}/{parseInt(d)}</span>
        <span className="ml-1.5 text-main">{g.opponent}</span>
      </span>
    )
  }

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i)

  // 合計サマリー
  const totalSummary = useMemo(() => {
    const abs: AtBat[] = []
    batRows.forEach((row) => {
      for (let i = 0; i < abColCount; i++) {
        const p = parseAtBatCode(row[`ab${i}`] ?? '')
        if (!p) continue
        abs.push({
          rbi_count: p.rbi, result_type: p.result_type, is_run: false,
          stolen_base_count: 0, is_caught_stealing: false,
        } as AtBat)
      }
    })
    return calcBattingStats(abs)
  }, [batRows, abColCount])

  return (
    <div className="max-w-full mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <Link href="/games" className="text-sub2 hover:text-main transition-colors text-sm">
          ← 試合一覧
        </Link>
        <h1 className="text-xl font-bold text-accent">成績をまとめて編集</h1>
        <select
          value={season}
          onChange={e => setSeason(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          className="ml-auto border border-s2 rounded-lg px-3 py-1.5 text-sm bg-lv1 text-main focus:outline-none focus:ring-2 focus:ring-theme"
        >
          <option value="all">通算</option>
          {years.map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
      </div>
      <p className="text-sm text-sub2 mb-4">
        登録済みの試合に対して、打撃成績・投手成績を表形式でまとめて入力・修正できます。
      </p>

      {errorMsg && (
        <div className="mb-3 flex items-start gap-2 bg-neg/10 border border-neg/40 text-neg-t rounded-xl px-4 py-3 text-sm">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* タブ */}
      <div className="flex items-center gap-1 bg-lv2 rounded-lg p-1 w-fit mb-3">
        {([['batting', '打撃成績'], ['pitching', '投手成績']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              tab === key ? 'bg-theme text-white font-medium shadow-sm' : 'text-sub2 hover:text-main'
            }`}
          >
            {label}
            {((key === 'batting' && dirtyBatRows.length > 0) || (key === 'pitching' && dirtyPitRows.length > 0)) && (
              <span className="ml-1.5 text-[10px] bg-neu text-neu-t rounded-full px-1.5 py-0.5">
                {key === 'batting' ? dirtyBatRows.length : dirtyPitRows.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2 min-h-[400px]">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 bg-lv2 rounded animate-pulse" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="bg-lv1 rounded-xl border border-s2 p-12 text-center">
          <div className="text-4xl mb-3">⚾</div>
          <p className="text-main font-semibold">該当する試合がありません</p>
          <p className="text-sub2 text-sm mt-1">先に試合を登録してください</p>
          <Link href="/games/bulk-new" className="inline-block mt-4 px-5 py-2.5 rounded-lg bg-theme text-white text-sm font-semibold">
            試合をまとめて登録 →
          </Link>
        </div>
      ) : (
        <>
          {tab === 'batting' ? (
            <SheetGrid
              columns={batColumns}
              rows={batDisplayRows}
              rowKey={i => games[i]?.id ?? String(i)}
              rowLabel={rowLabel}
              errors={batErrors}
              normalize={normalizeBat}
              onCellsChange={handleBatCells}
              onUndo={undo}
              onToast={setToast}
            />
          ) : (
            <SheetGrid
              columns={pitColumns}
              rows={pitDisplayRows}
              rowKey={i => games[i]?.id ?? String(i)}
              rowLabel={rowLabel}
              errors={pitErrors}
              normalize={normalizePit}
              onCellsChange={handlePitCells}
              onUndo={undo}
              onToast={setToast}
            />
          )}

          {/* ステータス */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-sub2">
            <span>{games.length} 試合</span>
            {tab === 'batting' && (
              <span>
                入力合計: <strong className="text-main">{totalSummary.ab}打数{totalSummary.hits}安打</strong>
                <span className="ml-1.5">打率 {fmtAvg(totalSummary.avg)}</span>
                <span className="ml-1.5">本塁打 {totalSummary.hrs}</span>
                <span className="ml-1.5">打点 {totalSummary.rbi}</span>
              </span>
            )}
            {dirtyCount > 0 && <span className="text-theme font-medium">未保存の変更: {dirtyCount} 試合</span>}
            {currentErrors.size > 0 && <span className="text-neg-t font-medium">⚠️ エラー: {currentErrors.size} セル</span>}
          </div>

          {/* 保存 */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || dirtyCount === 0}
              className="bg-theme text-white rounded-xl px-6 py-3 font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : dirtyCount > 0 ? `${dirtyCount}試合分を保存` : '変更なし'}
            </button>
            <button
              type="button"
              onClick={undo}
              disabled={undoStack.length === 0}
              className="text-sm border border-s2 rounded-lg px-4 py-2.5 text-sub1 hover:bg-lv2 transition-colors disabled:opacity-40"
            >
              ↶ 元に戻す
            </button>
            <Link href="/games" className="text-sm text-sub2 hover:text-main transition-colors">
              試合一覧へ
            </Link>
          </div>
        </>
      )}

      {/* 凡例・使い方 */}
      <div className="mt-8 bg-lv2 border border-s2 rounded-xl px-4 py-3 text-xs text-sub2 space-y-2">
        {tab === 'batting' ? (
          <>
            <p className="font-medium text-sub1">打席結果の入力コード</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {CODE_LEGEND.map(l => (
                <span key={l.code}>
                  <code className="bg-lv1 px-1 rounded text-main font-medium">{l.code}</code>
                  <span className="ml-1">{l.label}</span>
                </span>
              ))}
            </div>
            <p>・末尾に数字を付けると打点になります（例: <code className="bg-lv1 px-1 rounded">本2</code> ＝ 本塁打・打点2）</p>
            <p>・<code className="bg-lv1 px-1 rounded">HR</code>・<code className="bg-lv1 px-1 rounded">K</code>・<code className="bg-lv1 px-1 rounded">BB</code> などの英字表記も使えます</p>
            <p>・打数・安打・打点・打率の列は入力内容から自動計算されます（編集不可）</p>
            <p>・得点は出塁した打席から順に、盗塁は最初の打席にまとめて記録されます（合計値は正しく集計されます）</p>
            <p>・打順と守備位置は、その試合の全打席に同じ値が入ります（打席ごとに変えたい場合は試合詳細から編集してください）</p>
            <p>・打球方向を記録済みの打席は、結果を変更すると方向がクリアされます</p>
          </>
        ) : (
          <>
            <p className="font-medium text-sub1">投手成績の入力</p>
            <p>・投球回は <code className="bg-lv1 px-1 rounded">3</code>（3回）、<code className="bg-lv1 px-1 rounded">3.1</code>（3回1/3）、<code className="bg-lv1 px-1 rounded">3.2</code>（3回2/3）で入力します</p>
            <p>・結果は <code className="bg-lv1 px-1 rounded">勝</code> / <code className="bg-lv1 px-1 rounded">敗</code> / <code className="bg-lv1 px-1 rounded">S</code> / <code className="bg-lv1 px-1 rounded">H</code>、完投は <code className="bg-lv1 px-1 rounded">○</code> で入力します</p>
            <p>・行をすべて空にして保存すると、その試合の投手成績は削除されます</p>
          </>
        )}
        <div className="pt-1.5 border-t border-s2">
          <p className="font-medium text-sub1">共通操作</p>
          <p>・Excel等からの範囲コピー＆貼り付け、Ctrl+C / Ctrl+Z、矢印キー移動、Delete でクリアに対応しています</p>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 bg-lv1 border border-s2 text-main text-sm font-medium px-4 py-2.5 rounded-full shadow-lg z-50 max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  )
}
