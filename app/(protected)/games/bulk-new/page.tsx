'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  COLUMNS, COL_KEYS, buildPastePlan, deriveResult, normalizeCell,
  parseClipboard, toTSV,
} from '@/lib/bulk-parse'
import type { ColKey, ResultValue } from '@/lib/bulk-parse'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const MAX_ROWS = 200
const INITIAL_ROWS = 12
const ADD_ROWS_STEP = 10
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const UNDO_LIMIT = 30

const RESULT_LABEL: Record<ResultValue, string> = { win: '勝', loss: '負', draw: '分' }
const RESULT_CLASS: Record<ResultValue, string> = {
  win:  'text-pos-t font-bold',
  loss: 'text-neg-t font-bold',
  draw: 'text-neu-t font-bold',
}

// ─── 型 ──────────────────────────────────────────────────────────────────────

type BulkRow = { id: string } & Record<ColKey, string>
type CellPos = { r: number; c: number }
type Sel = { r1: number; c1: number; r2: number; c2: number }

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function emptyRow(): BulkRow {
  return {
    id: crypto.randomUUID(),
    game_date: '', opponent: '', stadium: '',
    result: '', score_us: '', score_them: '', notes: '',
  }
}

function isEmptyRow(row: BulkRow): boolean {
  return COL_KEYS.every(k => (row[k] ?? '').trim() === '')
}

/** 登録対象の行：対戦相手が入っていれば有効とみなす（従来仕様を踏襲） */
function isActiveRow(row: BulkRow): boolean {
  return row.opponent.trim() !== ''
}

/** セルの表示文字列（勝敗は日本語ラベルで見せる） */
function displayValue(key: ColKey, raw: string): string {
  if (key === 'result' && raw) return RESULT_LABEL[raw as ResultValue] ?? raw
  return raw
}

/** セル単位のエラーを `${r},${c}` キーで返す */
function validateRows(rows: BulkRow[]): Map<string, string> {
  const errs = new Map<string, string>()
  const iDate = COL_KEYS.indexOf('game_date')
  const iOpp  = COL_KEYS.indexOf('opponent')
  const iRes  = COL_KEYS.indexOf('result')
  const iUs   = COL_KEYS.indexOf('score_us')
  const iThem = COL_KEYS.indexOf('score_them')

  rows.forEach((row, r) => {
    if (isEmptyRow(row)) return

    if (!row.opponent.trim()) {
      errs.set(`${r},${iOpp}`, '対戦相手を入力してください')
    } else if (row.opponent.trim().length > 100) {
      errs.set(`${r},${iOpp}`, '100文字以内で入力してください')
    }

    if (!row.game_date) {
      errs.set(`${r},${iDate}`, '試合日を入力してください')
    } else if (!DATE_PATTERN.test(row.game_date)) {
      errs.set(`${r},${iDate}`, '日付として解釈できません（例: 2026-06-15）')
    } else {
      const [y, m, dd] = row.game_date.split('-').map(Number)
      const d = new Date(row.game_date)
      if (isNaN(d.getTime()) || d.getUTCMonth() + 1 !== m || d.getUTCDate() !== dd) {
        errs.set(`${r},${iDate}`, '存在しない日付です')
      } else if (y < 2000 || y > 2099) {
        errs.set(`${r},${iDate}`, '年は2000〜2099で入力してください')
      }
    }

    const us   = parseInt(row.score_us, 10)
    const them = parseInt(row.score_them, 10)
    if (row.score_us === '' || isNaN(us)) {
      errs.set(`${r},${iUs}`, '数値を入力してください')
    } else if (us < 0 || us > 99) {
      errs.set(`${r},${iUs}`, '0〜99で入力してください')
    }
    if (row.score_them === '' || isNaN(them)) {
      errs.set(`${r},${iThem}`, '数値を入力してください')
    } else if (them < 0 || them > 99) {
      errs.set(`${r},${iThem}`, '0〜99で入力してください')
    }

    if (!row.result) {
      errs.set(`${r},${iRes}`, '勝敗を入力してください（勝/負/分）')
    } else if (!isNaN(us) && !isNaN(them)) {
      const expected = deriveResult(row.score_us, row.score_them)
      if (expected && expected !== row.result) {
        errs.set(`${r},${iRes}`, `スコア ${us}-${them} なら「${RESULT_LABEL[expected]}」のはずです`)
      }
    }
  })
  return errs
}

function toSel(a: CellPos, b: CellPos): Sel {
  return {
    r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r),
    c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c),
  }
}

// ─── ページ ───────────────────────────────────────────────────────────────────

export default function BulkNewPage() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const gridRef = useRef<HTMLDivElement>(null)
  /**
   * 選択セルには常に input を置き、キー入力・IME変換・コピー/貼り付けを
   * すべてこの input で受ける。これにより日本語入力（IMEでは keydown が
   * 印字可能文字にならない）でも取りこぼしが起きない。
   */
  const inputRef = useRef<HTMLInputElement>(null)
  const currentYear = new Date().getFullYear()

  const [rows, setRows] = useState<BulkRow[]>(() => Array.from({ length: INITIAL_ROWS }, emptyRow))
  const [anchor, setAnchor] = useState<CellPos>({ r: 0, c: 0 })
  const [head, setHead]     = useState<CellPos>({ r: 0, c: 0 })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [dragging, setDragging] = useState(false)
  const [undoStack, setUndoStack] = useState<BulkRow[][]>([])

  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [toast, setToast] = useState('')
  const [pastOpponents, setPastOpponents] = useState<string[]>([])
  const [pastStadiums, setPastStadiums]   = useState<string[]>([])

  const sel = useMemo(() => toSel(anchor, head), [anchor, head])
  const errors = useMemo(() => (submitted ? validateRows(rows) : new Map<string, string>()), [rows, submitted])
  const activeCount = useMemo(() => rows.filter(isActiveRow).length, [rows])
  const errorRowCount = useMemo(() => {
    const rs = new Set<number>()
    errors.forEach((_, k) => rs.add(Number(k.split(',')[0])))
    return rs.size
  }, [errors])

  const anchorKey = COL_KEYS[anchor.c]
  const anchorRaw = rows[anchor.r]?.[anchorKey] ?? ''

  /**
   * 選択セルが変わったら input を空に戻す。
   *   非編集中は input を空にしておき、既存値は背面のテキストで見せる。
   *   こうすると「選択して打つと上書き」が selection API のタイミングに依存せず成立し、
   *   IME入力でも取りこぼしが起きない。
   */
  useEffect(() => {
    if (editing) return
    setDraft('')
    inputRef.current?.focus({ preventScroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.r, anchor.c])

  // ── 候補取得 ──
  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('games').select('opponent, stadium').eq('user_id', user.id)
      if (data) {
        setPastOpponents(Array.from(new Set(data.map(g => g.opponent).filter(Boolean))).sort() as string[])
        setPastStadiums(Array.from(new Set(data.map(g => g.stadium).filter(Boolean))).sort() as string[])
      }
    }
    fetchSuggestions()
  }, [supabase])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!dragging) return
    const up = () => setDragging(false)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [dragging])

  // ── 履歴（Undo）──
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-(UNDO_LIMIT - 1)), rows.map(r => ({ ...r }))])
  }, [rows])

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev
      setRows(prev[prev.length - 1])
      setToast('元に戻しました')
      return prev.slice(0, -1)
    })
  }, [])

  const ensureRows = useCallback((n: number) => {
    setRows(prev => {
      const target = Math.min(n, MAX_ROWS)
      if (prev.length >= target) return prev
      return [...prev, ...Array.from({ length: target - prev.length }, emptyRow)]
    })
  }, [])

  // ── セル値の一括適用（スコアが揃っていて勝敗が空なら自動補完） ──
  const applyCells = useCallback((cells: { r: number; c: number; value: string }[]) => {
    setRows(prev => {
      const next = prev.map(r => ({ ...r }))
      for (const { r, c, value } of cells) {
        const key = COL_KEYS[c]
        if (!next[r] || !key) continue
        next[r][key] = value
      }
      for (const r of Array.from(new Set(cells.map(c => c.r)))) {
        const row = next[r]
        if (row && !row.result) {
          const d = deriveResult(row.score_us, row.score_them)
          if (d) row.result = d
        }
      }
      return next
    })
  }, [])

  // ── 移動 ──
  const moveTo = useCallback((r: number, c: number, extend = false) => {
    const rr = Math.max(0, Math.min(r, MAX_ROWS - 1))
    const cc = Math.max(0, Math.min(c, COLUMNS.length - 1))
    if (extend) {
      setHead({ r: rr, c: cc })
    } else {
      setAnchor({ r: rr, c: cc })
      setHead({ r: rr, c: cc })
    }
    ensureRows(rr + 1)
  }, [ensureRows])

  // ── 編集確定 ──
  const commit = useCallback((dir: 'down' | 'right' | 'none' = 'none') => {
    if (editing) {
      const col = COLUMNS[anchor.c]
      const normalized = normalizeCell(col, draft, currentYear)
      if (normalized !== anchorRaw) {
        pushUndo()
        applyCells([{ r: anchor.r, c: anchor.c, value: normalized }])
      }
      setEditing(false)
    }
    if (dir === 'down')  moveTo(anchor.r + 1, anchor.c)
    if (dir === 'right') moveTo(anchor.r, anchor.c + 1)
  }, [editing, anchor, draft, anchorRaw, currentYear, pushUndo, applyCells, moveTo])

  const cancelEdit = useCallback(() => {
    setEditing(false)
    setDraft('')
  }, [])

  // ── 選択範囲のクリア ──
  const clearSelection = useCallback(() => {
    pushUndo()
    setRows(prev => {
      const next = prev.map(r => ({ ...r }))
      for (let r = sel.r1; r <= sel.r2; r++) {
        for (let c = sel.c1; c <= sel.c2; c++) {
          const key = COL_KEYS[c]
          if (next[r] && key) next[r][key] = ''
        }
      }
      return next
    })
    setDraft('')
  }, [sel, pushUndo])

  // ── 選択範囲の TSV ──
  const selectionToTSV = useCallback(() => {
    const matrix: string[][] = []
    for (let r = sel.r1; r <= sel.r2; r++) {
      const line: string[] = []
      for (let c = sel.c1; c <= sel.c2; c++) {
        const key = COL_KEYS[c]
        line.push(displayValue(key, rows[r]?.[key] ?? ''))
      }
      matrix.push(line)
    }
    return toTSV(matrix)
  }, [sel, rows])

  const singleCellSelected = sel.r1 === sel.r2 && sel.c1 === sel.c2

  // ── クリップボード ──
  const handleCopy = useCallback((e: React.ClipboardEvent) => {
    // 編集中、または単一セルで input 内テキストを選択している場合は既定動作に任せる
    if (editing) return
    e.preventDefault()
    e.clipboardData.setData('text/plain', selectionToTSV())
    setToast(
      singleCellSelected
        ? 'セルをコピーしました'
        : `${sel.r2 - sel.r1 + 1}行 × ${sel.c2 - sel.c1 + 1}列をコピーしました`
    )
  }, [editing, selectionToTSV, sel, singleCellSelected])

  const handleCut = useCallback((e: React.ClipboardEvent) => {
    if (editing) return
    e.preventDefault()
    e.clipboardData.setData('text/plain', selectionToTSV())
    clearSelection()
    setToast('切り取りました')
  }, [editing, selectionToTSV, clearSelection])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (editing) return
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()

    const matrix = parseClipboard(text)
    if (matrix.length === 0) return

    const plan = buildPastePlan(matrix, sel.r1, sel.c1, sel, MAX_ROWS, currentYear)
    if (plan.cells.length === 0) return

    pushUndo()
    ensureRows(plan.requiredRows)
    // 行追加の反映後にセルを流し込む
    setTimeout(() => {
      applyCells(plan.cells)
      const cols = new Set(plan.cells.map(c => c.c)).size
      setToast(
        `${plan.affectedRows}行 × ${cols}列を貼り付けました` +
        (plan.headerDetected ? '（見出し行を検出し、列名で対応づけました）' : '')
      )
    }, 0)

    const lastRow = Math.min(plan.requiredRows - 1, MAX_ROWS - 1)
    const maxCol = plan.cells.reduce((m, c) => Math.max(m, c.c), sel.c1)
    setAnchor({ r: sel.r1, c: sel.c1 })
    setHead({ r: Math.max(sel.r1, lastRow), c: maxCol })
  }, [editing, sel, currentYear, pushUndo, ensureRows, applyCells])

  // ── キーボード ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const meta = e.ctrlKey || e.metaKey

    // IME変換中はブラウザに任せる
    if (e.nativeEvent.isComposing) return

    if (meta) {
      const k = e.key.toLowerCase()
      if (k === 'z' && !editing) { e.preventDefault(); undo(); return }
      if (k === 'a' && !editing) {
        e.preventDefault()
        setAnchor({ r: 0, c: 0 })
        setHead({ r: rows.length - 1, c: COLUMNS.length - 1 })
        return
      }
      return  // コピー/切り取り/貼り付けは専用ハンドラへ
    }

    if (editing) {
      if (e.key === 'Enter')       { e.preventDefault(); commit('down') }
      else if (e.key === 'Tab')    { e.preventDefault(); commit('right') }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
      return
    }

    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); moveTo(head.r - 1, head.c, e.shiftKey); return
      case 'ArrowDown':  e.preventDefault(); moveTo(head.r + 1, head.c, e.shiftKey); return
      case 'ArrowLeft':  e.preventDefault(); moveTo(head.r, head.c - 1, e.shiftKey); return
      case 'ArrowRight': e.preventDefault(); moveTo(head.r, head.c + 1, e.shiftKey); return
      case 'Tab':        e.preventDefault(); moveTo(anchor.r, anchor.c + (e.shiftKey ? -1 : 1)); return
      case 'Enter':
      case 'F2':
        // 既存値を引き継いで末尾から追記編集する
        e.preventDefault()
        setEditing(true)
        setDraft(displayValue(anchorKey, anchorRaw))
        requestAnimationFrame(() => {
          const el = inputRef.current
          if (el) el.setSelectionRange(el.value.length, el.value.length)
        })
        return
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        clearSelection()
        return
      case 'Escape':
        e.preventDefault()
        setHead(anchor)
        return
    }
  }, [editing, head, anchor, rows.length, moveTo, commit, cancelEdit, clearSelection, undo])

  // ── input への入力＝編集開始 ──
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editing) setEditing(true)
    setDraft(e.target.value)
  }

  // ── マウス ──
  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus())

  const handleCellMouseDown = useCallback((r: number, c: number, e: React.MouseEvent) => {
    // 既定動作を止めないと Shift+クリック時に input からフォーカスが外れ、
    // 以降の Ctrl+C / Delete などのキー操作を受け取れなくなる
    e.preventDefault()
    if (editing) commit()
    if (e.shiftKey) {
      setHead({ r, c })
    } else {
      setAnchor({ r, c })
      setHead({ r, c })
      setDragging(true)
    }
    focusInput()
  }, [editing, commit])

  const handleCellMouseEnter = useCallback((r: number, c: number) => {
    if (dragging) setHead({ r, c })
  }, [dragging])

  const selectRow = useCallback((r: number, e: React.MouseEvent) => {
    e.preventDefault()
    if (editing) commit()
    if (e.shiftKey) {
      setHead({ r, c: COLUMNS.length - 1 })
    } else {
      setAnchor({ r, c: 0 })
      setHead({ r, c: COLUMNS.length - 1 })
    }
    focusInput()
  }, [editing, commit])

  const selectColumn = useCallback((c: number) => {
    if (editing) commit()
    setAnchor({ r: 0, c })
    setHead({ r: rows.length - 1, c })
    focusInput()
  }, [editing, commit, rows.length])

  // ── 行操作 ──
  const addRows = () => {
    setRows(prev => {
      const add = Math.min(ADD_ROWS_STEP, MAX_ROWS - prev.length)
      return add <= 0 ? prev : [...prev, ...Array.from({ length: add }, emptyRow)]
    })
  }

  const deleteSelectedRows = () => {
    pushUndo()
    setRows(prev => {
      const kept = prev.filter((_, i) => i < sel.r1 || i > sel.r2)
      return kept.length === 0 ? Array.from({ length: INITIAL_ROWS }, emptyRow) : kept
    })
    setAnchor({ r: sel.r1, c: 0 })
    setHead({ r: sel.r1, c: 0 })
    setToast(`${sel.r2 - sel.r1 + 1}行を削除しました`)
  }

  const insertRowsAbove = () => {
    const count = sel.r2 - sel.r1 + 1
    pushUndo()
    setRows(prev => {
      if (prev.length + count > MAX_ROWS) return prev
      const next = [...prev]
      next.splice(sel.r1, 0, ...Array.from({ length: count }, emptyRow))
      return next
    })
  }

  const clearAll = () => {
    pushUndo()
    setRows(Array.from({ length: INITIAL_ROWS }, emptyRow))
    setAnchor({ r: 0, c: 0 })
    setHead({ r: 0, c: 0 })
    setSubmitted(false)
    setToast('すべてクリアしました')
  }

  const copyHeaderTemplate = async () => {
    try {
      await navigator.clipboard.writeText(toTSV([COLUMNS.map(c => c.label)]))
      setToast('見出し行をコピーしました。表計算ソフトに貼り付けてご利用ください')
    } catch {
      setToast('コピーできませんでした')
    }
  }

  // ── 登録 ──
  const handleSubmit = async () => {
    if (editing) commit()
    setSubmitted(true)
    setGlobalError('')

    const active = rows.filter(isActiveRow)
    if (active.length === 0) {
      setGlobalError('対戦相手を少なくとも1件入力してください')
      return
    }

    const errs = validateRows(rows)
    if (errs.size > 0) {
      const rowNums = Array.from(new Set(Array.from(errs.keys()).map(k => Number(k.split(',')[0]))))
      setGlobalError(`入力エラーがあります（${rowNums.length}行）。赤いセルを修正してください。`)
      const first = Math.min(...rowNums)
      setAnchor({ r: first, c: 0 })
      setHead({ r: first, c: COLUMNS.length - 1 })
      document.getElementById(`bulk-row-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const insertRows = active.map(row => ({
      user_id: user.id,
      game_date: row.game_date,
      opponent: row.opponent.trim(),
      result: row.result as ResultValue,
      score_us: parseInt(row.score_us, 10),
      score_them: parseInt(row.score_them, 10),
      stadium: row.stadium.trim() || null,
      notes: row.notes.trim() || null,
      season: parseInt(row.game_date.slice(0, 4), 10),
    }))

    const CHUNK = 50
    let dbError = null
    for (let i = 0; i < insertRows.length; i += CHUNK) {
      const { error } = await supabase.from('games').insert(insertRows.slice(i, i + CHUNK))
      if (error) { dbError = error; break }
    }
    setLoading(false)

    if (dbError) {
      setGlobalError('データベースへの登録に失敗しました。もう一度お試しください。')
      return
    }
    router.push('/games')
  }

  // ─────────────────────────────────────────────────────────────────────────
  const suggestionsFor = (key: ColKey) =>
    key === 'opponent' ? pastOpponents : key === 'stadium' ? pastStadiums : null
  const anchorSuggestions = suggestionsFor(anchorKey)

  return (
    <div className="max-w-6xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/games" className="text-sub2 hover:text-main transition-colors text-sm">
          ← 試合一覧
        </Link>
        <h1 className="text-xl font-bold text-accent">複数試合をまとめて登録</h1>
      </div>
      <p className="text-sm text-sub2 mb-4">
        表計算ソフトのように使えます。<strong className="text-main">Excelやスプレッドシートから範囲コピーしてそのまま貼り付け</strong>できます。
      </p>

      {globalError && (
        <div className="mb-4 flex items-start gap-2 bg-neg/10 border border-neg/40 text-neg-t rounded-xl px-4 py-3 text-sm">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{globalError}</span>
        </div>
      )}

      {/* ツールバー */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button type="button" onClick={addRows} disabled={rows.length >= MAX_ROWS}
          className="text-xs border border-s2 rounded-lg px-3 py-1.5 text-sub1 hover:bg-lv2 transition-colors disabled:opacity-40">
          ＋ {ADD_ROWS_STEP}行追加
        </button>
        <button type="button" onClick={insertRowsAbove}
          className="text-xs border border-s2 rounded-lg px-3 py-1.5 text-sub1 hover:bg-lv2 transition-colors">
          選択行の上に挿入
        </button>
        <button type="button" onClick={deleteSelectedRows}
          className="text-xs border border-s2 rounded-lg px-3 py-1.5 text-sub1 hover:bg-lv2 hover:text-neg-t transition-colors">
          選択行を削除
        </button>
        <button type="button" onClick={undo} disabled={undoStack.length === 0}
          className="text-xs border border-s2 rounded-lg px-3 py-1.5 text-sub1 hover:bg-lv2 transition-colors disabled:opacity-40">
          ↶ 元に戻す
        </button>
        <button type="button" onClick={copyHeaderTemplate}
          className="text-xs border border-s2 rounded-lg px-3 py-1.5 text-sub1 hover:bg-lv2 transition-colors">
          見出し行をコピー
        </button>
        <button type="button" onClick={clearAll}
          className="text-xs border border-s2 rounded-lg px-3 py-1.5 text-sub2 hover:bg-lv2 hover:text-neg-t transition-colors ml-auto">
          すべてクリア
        </button>
      </div>

      {/* グリッド */}
      <div
        ref={gridRef}
        onKeyDown={handleKeyDown}
        onCopy={handleCopy}
        onCut={handleCut}
        onPaste={handlePaste}
        className="border border-s2 rounded-xl overflow-auto bg-lv1"
        style={{ maxHeight: '62vh' }}
      >
        {/* w-full + minWidth で、メモ列が余白を吸収して表が横いっぱいに収まる */}
        <table className="border-collapse text-sm select-none w-full" style={{ minWidth: 900 }}>
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 bg-lv2 border-b border-r border-s2 w-10 text-[10px] text-sub2 font-normal px-1 py-1.5">
                #
              </th>
              {COLUMNS.map((col, c) => (
                <th
                  key={col.key}
                  onMouseDown={e => { e.preventDefault(); selectColumn(c) }}
                  className={`bg-lv2 border-b border-r border-s2 text-xs font-medium px-2 py-1.5 whitespace-nowrap cursor-pointer hover:bg-s2 transition-colors ${col.widthClass} ${
                    sel.c1 <= c && c <= sel.c2 ? 'text-theme' : 'text-sub2'
                  }`}
                  title={col.key === 'result'
                    ? 'クリックで列全体を選択（勝/負/分、○/●/△、W/L/D で入力できます）'
                    : `クリックで列全体を選択（${col.label}）`}
                >
                  {col.label}
                  {col.required && <span className="text-neg-t ml-0.5">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const rowSelected = sel.r1 <= r && r <= sel.r2
              return (
                <tr key={row.id} id={`bulk-row-${r}`}>
                  <td
                    onMouseDown={e => selectRow(r, e)}
                    className={`sticky left-0 z-10 border-b border-r border-s2 text-[10px] text-center px-1 cursor-pointer transition-colors ${
                      rowSelected ? 'bg-theme/20 text-theme font-bold' : 'bg-lv2 text-sub2 hover:bg-s2'
                    }`}
                    title="クリックで行全体を選択"
                  >
                    {r + 1}
                  </td>

                  {COLUMNS.map((col, c) => {
                    const key = col.key
                    const raw = row[key]
                    const isSel = rowSelected && sel.c1 <= c && c <= sel.c2
                    const isAnchor = anchor.r === r && anchor.c === c
                    const err = errors.get(`${r},${c}`)

                    return (
                      <td
                        key={key}
                        onMouseDown={e => handleCellMouseDown(r, c, e)}
                        onMouseEnter={() => handleCellMouseEnter(r, c)}
                        title={err ?? undefined}
                        className={`relative border-b border-r border-s2 p-0 h-8 cursor-cell ${
                          err ? 'bg-neg/15' : isSel && !isAnchor ? 'bg-theme/10' : 'bg-lv1'
                        } ${isAnchor ? 'ring-2 ring-theme ring-inset z-10' : ''}`}
                      >
                        {isAnchor ? (
                          <div className="relative w-full h-8">
                            {/* 非編集中は既存値を背面に表示し、input は空にしておく */}
                            {!editing && (
                              <div
                                className={`absolute inset-0 px-2 py-1.5 truncate pointer-events-none ${
                                  col.align === 'center' ? 'text-center' : 'text-left'
                                } ${
                                  key === 'result' && raw ? RESULT_CLASS[raw as ResultValue]
                                  : raw ? 'text-main' : 'text-sub2'
                                } ${key === 'game_date' ? 'font-mono text-xs' : ''}`}
                              >
                                {displayValue(key, raw) || (r === 0 ? col.placeholder ?? '' : '')}
                              </div>
                            )}
                            <input
                              ref={inputRef}
                              value={editing ? draft : ''}
                              onChange={handleInputChange}
                              onCompositionStart={() => setEditing(true)}
                              onBlur={() => { if (editing) commit() }}
                              list={anchorSuggestions && anchorSuggestions.length > 0 ? 'bulk-suggestions' : undefined}
                              inputMode={col.type === 'number' ? 'numeric' : undefined}
                              aria-label={`${r + 1}行目 ${col.label}`}
                              className={`absolute inset-0 w-full h-full px-2 bg-transparent text-main outline-none caret-theme ${
                                col.align === 'center' ? 'text-center' : 'text-left'
                              } ${col.key === 'game_date' ? 'font-mono text-xs' : 'text-sm'}`}
                            />
                            {anchorSuggestions && anchorSuggestions.length > 0 && (
                              <datalist id="bulk-suggestions">
                                {anchorSuggestions.map(s => <option key={s} value={s} />)}
                              </datalist>
                            )}
                          </div>
                        ) : (
                          <div
                            className={`px-2 py-1.5 truncate ${
                              col.align === 'center' ? 'text-center' : 'text-left'
                            } ${
                              key === 'result' && raw ? RESULT_CLASS[raw as ResultValue]
                              : raw ? 'text-main' : 'text-sub2'
                            } ${key === 'game_date' ? 'font-mono text-xs' : ''}`}
                          >
                            {displayValue(key, raw) || (r === 0 ? col.placeholder ?? '' : '')}
                          </div>
                        )}
                        {err && (
                          <span className="absolute top-0 right-0 w-0 h-0 border-t-[6px] border-l-[6px] border-t-neg-t border-l-transparent pointer-events-none" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ステータスバー */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-sub2">
        <span>
          選択: <strong className="text-main">
            {singleCellSelected
              ? `${sel.r1 + 1}行目 ${COLUMNS[sel.c1].label}`
              : `${sel.r2 - sel.r1 + 1}行 × ${sel.c2 - sel.c1 + 1}列`}
          </strong>
        </span>
        <span>入力済み: <strong className="text-main">{activeCount}</strong> 件</span>
        <span>行数: {rows.length} / {MAX_ROWS}</span>
        {submitted && errorRowCount > 0 && (
          <span className="text-neg-t font-medium">⚠️ エラー: {errorRowCount} 行</span>
        )}
      </div>

      {/* エラー一覧 */}
      {submitted && errors.size > 0 && (
        <div className="mt-3 bg-neg/5 border border-neg/30 rounded-xl px-4 py-3 max-h-40 overflow-y-auto">
          <p className="text-xs font-medium text-neg-t mb-1.5">修正が必要なセル</p>
          <ul className="space-y-0.5">
            {Array.from(errors.entries()).slice(0, 30).map(([k, msg]) => {
              const [r, c] = k.split(',').map(Number)
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => {
                      setAnchor({ r, c }); setHead({ r, c })
                      document.getElementById(`bulk-row-${r}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                    className="text-xs text-sub1 hover:text-main text-left"
                  >
                    <span className="text-neg-t font-medium">{r + 1}行目 {COLUMNS[c].label}</span>
                    <span className="ml-2">{msg}</span>
                  </button>
                </li>
              )
            })}
            {errors.size > 30 && <li className="text-xs text-sub2">ほか {errors.size - 30} 件</li>}
          </ul>
        </div>
      )}

      {/* 送信 */}
      <div className="mt-5 flex items-center gap-3 flex-wrap">
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
      </div>

      {/* 使い方 */}
      <div className="mt-8 bg-lv2 border border-s2 rounded-xl px-4 py-3 text-xs text-sub2 space-y-2">
        <p className="font-medium text-sub1">使い方</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          <p>・Excel等から範囲コピー → セルを選んで <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd> で一括入力</p>
          <p>・見出し行ごと貼り付けると、列名を見て自動で対応づけます</p>
          <p>・<Kbd>Ctrl</Kbd>+<Kbd>C</Kbd> でコピー、<Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> で元に戻す</p>
          <p>・矢印キーで移動、そのまま入力すれば上書き、<Kbd>Enter</Kbd> で追記編集</p>
          <p>・<Kbd>Delete</Kbd> で選択範囲をクリア、ドラッグや <Kbd>Shift</Kbd>+クリックで範囲選択</p>
          <p>・行番号・列見出しのクリックで行/列をまとめて選択</p>
        </div>
        <div className="pt-1.5 border-t border-s2 space-y-1">
          <p className="font-medium text-sub1">入力形式について</p>
          <p>・日付は <code className="bg-lv1 px-1 rounded">2026/6/15</code>・<code className="bg-lv1 px-1 rounded">2026年6月15日</code>・<code className="bg-lv1 px-1 rounded">20260615</code>・<code className="bg-lv1 px-1 rounded">6/15</code>（今年扱い）などを自動変換します</p>
          <p>・勝敗は <code className="bg-lv1 px-1 rounded">勝/負/分</code>・<code className="bg-lv1 px-1 rounded">○/●/△</code>・<code className="bg-lv1 px-1 rounded">W/L/D</code> を認識し、空欄ならスコアから自動判定します</p>
          <p>・対戦相手が空の行は登録されません</p>
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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-lv1 border border-s2 rounded px-1 py-0.5 text-[10px] font-mono text-sub1">
      {children}
    </kbd>
  )
}
