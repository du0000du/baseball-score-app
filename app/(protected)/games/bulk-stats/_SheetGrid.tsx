'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { parseClipboard, toTSV } from '@/lib/bulk-parse'

// ────────────────────────────────────────────────
// 表計算風グリッド（成績まとめ編集で打撃・投手の両タブから使う共通部品）
//   選択セルには常に input を置き、IME入力の取りこぼしを防ぐ方式。
// ────────────────────────────────────────────────

export interface SheetColumn {
  key: string
  label: string
  /** px 幅 */
  width: number
  align?: 'left' | 'center' | 'right'
  /** 編集不可（貼り付けの対象からも外れる） */
  readOnly?: boolean
  /** ヘッダーの title 属性 */
  hint?: string
  /** 見出しの強調表示 */
  accent?: boolean
}

export type SheetRow = Record<string, string>

interface Props {
  columns: SheetColumn[]
  rows: SheetRow[]
  /** 行の一意キー */
  rowKey: (rowIndex: number) => string
  /** 行ラベル（左端の固定列に出す。省略時は行番号） */
  rowLabel?: (rowIndex: number) => React.ReactNode
  rowLabelWidth?: number
  /** `${r},${c}` をキーにしたセル単位のエラー */
  errors?: Map<string, string>
  /** 値の正規化（確定時・貼り付け時に呼ばれる） */
  normalize?: (colKey: string, raw: string) => string
  onCellsChange: (cells: { r: number; c: number; value: string }[]) => void
  onUndo?: () => void
  onToast?: (msg: string) => void
  maxHeight?: string
}

type CellPos = { r: number; c: number }

export default function SheetGrid({
  columns, rows, rowKey, rowLabel, rowLabelWidth = 128,
  errors, normalize, onCellsChange, onUndo, onToast, maxHeight = '58vh',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [anchor, setAnchor] = useState<CellPos>({ r: 0, c: 0 })
  const [head, setHead] = useState<CellPos>({ r: 0, c: 0 })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [dragging, setDragging] = useState(false)

  const sel = useMemo(() => ({
    r1: Math.min(anchor.r, head.r), r2: Math.max(anchor.r, head.r),
    c1: Math.min(anchor.c, head.c), c2: Math.max(anchor.c, head.c),
  }), [anchor, head])

  const anchorCol = columns[anchor.c]
  const anchorRaw = rows[anchor.r]?.[anchorCol?.key ?? ''] ?? ''

  // 選択セルが変わったら input を空に戻す（打てば上書きになる）
  useEffect(() => {
    if (editing) return
    setDraft('')
    inputRef.current?.focus({ preventScroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.r, anchor.c])

  useEffect(() => {
    if (!dragging) return
    const up = () => setDragging(false)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [dragging])

  const clampPos = useCallback((r: number, c: number): CellPos => ({
    r: Math.max(0, Math.min(r, rows.length - 1)),
    c: Math.max(0, Math.min(c, columns.length - 1)),
  }), [rows.length, columns.length])

  const moveTo = useCallback((r: number, c: number, extend = false) => {
    const p = clampPos(r, c)
    if (extend) setHead(p)
    else { setAnchor(p); setHead(p) }
  }, [clampPos])

  const commit = useCallback((dir: 'down' | 'right' | 'none' = 'none') => {
    if (editing && anchorCol && !anchorCol.readOnly) {
      const value = normalize ? normalize(anchorCol.key, draft) : draft
      if (value !== anchorRaw) {
        onCellsChange([{ r: anchor.r, c: anchor.c, value }])
      }
    }
    setEditing(false)
    setDraft('')
    if (dir === 'down')  moveTo(anchor.r + 1, anchor.c)
    if (dir === 'right') moveTo(anchor.r, anchor.c + 1)
  }, [editing, anchorCol, draft, anchorRaw, anchor, normalize, onCellsChange, moveTo])

  const clearSelection = useCallback(() => {
    const cells: { r: number; c: number; value: string }[] = []
    for (let r = sel.r1; r <= sel.r2; r++) {
      for (let c = sel.c1; c <= sel.c2; c++) {
        if (columns[c]?.readOnly) continue
        cells.push({ r, c, value: '' })
      }
    }
    if (cells.length > 0) onCellsChange(cells)
  }, [sel, columns, onCellsChange])

  const selectionToTSV = useCallback(() => {
    const matrix: string[][] = []
    for (let r = sel.r1; r <= sel.r2; r++) {
      const line: string[] = []
      for (let c = sel.c1; c <= sel.c2; c++) line.push(rows[r]?.[columns[c].key] ?? '')
      matrix.push(line)
    }
    return toTSV(matrix)
  }, [sel, rows, columns])

  const handleCopy = useCallback((e: React.ClipboardEvent) => {
    if (editing) return
    e.preventDefault()
    e.clipboardData.setData('text/plain', selectionToTSV())
    onToast?.(`${sel.r2 - sel.r1 + 1}行 × ${sel.c2 - sel.c1 + 1}列をコピーしました`)
  }, [editing, selectionToTSV, sel, onToast])

  const handleCut = useCallback((e: React.ClipboardEvent) => {
    if (editing) return
    e.preventDefault()
    e.clipboardData.setData('text/plain', selectionToTSV())
    clearSelection()
    onToast?.('切り取りました')
  }, [editing, selectionToTSV, clearSelection, onToast])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (editing) return
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()

    const matrix = parseClipboard(text)
    if (matrix.length === 0) return

    const cells: { r: number; c: number; value: string }[] = []
    let skippedReadOnly = 0

    // 1x1 は選択範囲すべてに複製
    if (matrix.length === 1 && matrix[0].length === 1) {
      const raw = matrix[0][0]
      for (let r = sel.r1; r <= sel.r2; r++) {
        for (let c = sel.c1; c <= sel.c2; c++) {
          if (columns[c]?.readOnly) { skippedReadOnly++; continue }
          cells.push({ r, c, value: normalize ? normalize(columns[c].key, raw) : raw })
        }
      }
    } else {
      matrix.forEach((rowCells, ri) => {
        const r = sel.r1 + ri
        if (r >= rows.length) return
        rowCells.forEach((raw, ci) => {
          const c = sel.c1 + ci
          if (c >= columns.length) return
          if (columns[c].readOnly) { skippedReadOnly++; return }
          cells.push({ r, c, value: normalize ? normalize(columns[c].key, raw) : raw })
        })
      })
    }

    if (cells.length === 0) {
      onToast?.('貼り付け先が編集できない列のため、反映しませんでした')
      return
    }
    onCellsChange(cells)

    const rowsAffected = new Set(cells.map(c => c.r)).size
    const colsAffected = new Set(cells.map(c => c.c)).size
    onToast?.(
      `${rowsAffected}行 × ${colsAffected}列を貼り付けました` +
      (skippedReadOnly > 0 ? `（編集できない列 ${skippedReadOnly} セルは除外）` : '')
    )

    const lastRow = Math.min(sel.r1 + matrix.length - 1, rows.length - 1)
    const lastCol = cells.reduce((m, c) => Math.max(m, c.c), sel.c1)
    setHead({ r: Math.max(sel.r1, lastRow), c: lastCol })
  }, [editing, sel, columns, rows.length, normalize, onCellsChange, onToast])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    const meta = e.ctrlKey || e.metaKey

    if (meta) {
      const k = e.key.toLowerCase()
      if (k === 'z' && !editing && onUndo) { e.preventDefault(); onUndo(); return }
      if (k === 'a' && !editing) {
        e.preventDefault()
        setAnchor({ r: 0, c: 0 })
        setHead({ r: rows.length - 1, c: columns.length - 1 })
      }
      return
    }

    if (editing) {
      if (e.key === 'Enter')       { e.preventDefault(); commit('down') }
      else if (e.key === 'Tab')    { e.preventDefault(); commit('right') }
      else if (e.key === 'Escape') { e.preventDefault(); setEditing(false); setDraft('') }
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
        e.preventDefault()
        if (anchorCol?.readOnly) return
        setEditing(true)
        setDraft(anchorRaw)
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
  }, [editing, head, anchor, anchorCol, anchorRaw, rows.length, columns.length, moveTo, commit, clearSelection, onUndo])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (anchorCol?.readOnly) return
    if (!editing) setEditing(true)
    setDraft(e.target.value)
  }

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus())

  const onCellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    // 既定動作を止めないと、Shift+クリック時にフォーカスが input から外れ
    // 以降のキー操作（コピー・削除など）を受け取れなくなる
    e.preventDefault()
    if (editing) commit()
    if (e.shiftKey) setHead({ r, c })
    else { setAnchor({ r, c }); setHead({ r, c }); setDragging(true) }
    focusInput()
  }

  const alignClass = (a?: string) =>
    a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left'

  const totalWidth = rowLabelWidth + columns.reduce((s, c) => s + c.width, 0)

  return (
    <div
      onKeyDown={handleKeyDown}
      onCopy={handleCopy}
      onCut={handleCut}
      onPaste={handlePaste}
      className="border border-s2 rounded-xl overflow-auto bg-lv1"
      style={{ maxHeight }}
    >
      <table className="border-collapse text-sm select-none" style={{ width: totalWidth }}>
        <thead className="sticky top-0 z-20">
          <tr>
            <th
              className="sticky left-0 z-30 bg-lv2 border-b border-r border-s2 text-[10px] text-sub2 font-normal px-2 py-1.5 text-left"
              style={{ width: rowLabelWidth, minWidth: rowLabelWidth }}
            >
              試合
            </th>
            {columns.map((col, c) => (
              <th
                key={col.key}
                title={col.hint}
                onMouseDown={e => { e.preventDefault(); setAnchor({ r: 0, c }); setHead({ r: rows.length - 1, c }); focusInput() }}
                className={`bg-lv2 border-b border-r border-s2 text-xs font-medium px-1.5 py-1.5 whitespace-nowrap cursor-pointer hover:bg-s2 transition-colors ${alignClass(col.align)} ${
                  sel.c1 <= c && c <= sel.c2 ? 'text-theme' : col.accent ? 'text-sub1' : 'text-sub2'
                }`}
                style={{ width: col.width, minWidth: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => {
            const rowSelected = sel.r1 <= r && r <= sel.r2
            return (
              <tr key={rowKey(r)} id={`sheet-row-${r}`}>
                <td
                  onMouseDown={e => {
                    e.preventDefault()
                    if (editing) commit()
                    if (e.shiftKey) setHead({ r, c: columns.length - 1 })
                    else { setAnchor({ r, c: 0 }); setHead({ r, c: columns.length - 1 }) }
                    focusInput()
                  }}
                  className={`sticky left-0 z-10 border-b border-r border-s2 text-[11px] px-2 py-1 cursor-pointer transition-colors ${
                    rowSelected ? 'bg-theme/20 text-theme' : 'bg-lv2 text-sub1 hover:bg-s2'
                  }`}
                  style={{ width: rowLabelWidth, minWidth: rowLabelWidth }}
                >
                  {rowLabel ? rowLabel(r) : r + 1}
                </td>

                {columns.map((col, c) => {
                  const raw = row[col.key] ?? ''
                  const isSel = rowSelected && sel.c1 <= c && c <= sel.c2
                  const isAnchor = anchor.r === r && anchor.c === c
                  const err = errors?.get(`${r},${c}`)

                  return (
                    <td
                      key={col.key}
                      onMouseDown={e => onCellMouseDown(r, c, e)}
                      onMouseEnter={() => { if (dragging) setHead({ r, c }) }}
                      title={err ?? undefined}
                      className={`relative border-b border-r border-s2 p-0 h-8 ${
                        col.readOnly ? 'cursor-default' : 'cursor-cell'
                      } ${
                        err ? 'bg-neg/15'
                        : col.readOnly ? (isSel && !isAnchor ? 'bg-theme/10' : 'bg-lv2/40')
                        : isSel && !isAnchor ? 'bg-theme/10' : 'bg-lv1'
                      } ${isAnchor ? 'ring-2 ring-theme ring-inset z-10' : ''}`}
                      style={{ width: col.width, minWidth: col.width }}
                    >
                      {isAnchor ? (
                        <div className="relative w-full h-8">
                          {!editing && (
                            <div className={`absolute inset-0 px-1.5 py-1.5 truncate pointer-events-none ${alignClass(col.align)} ${
                              col.readOnly ? 'text-sub1' : raw ? 'text-main' : 'text-sub2'
                            }`}>
                              {raw}
                            </div>
                          )}
                          <input
                            ref={inputRef}
                            value={editing ? draft : ''}
                            onChange={handleInputChange}
                            onCompositionStart={() => { if (!anchorCol?.readOnly) setEditing(true) }}
                            onBlur={() => { if (editing) commit() }}
                            readOnly={col.readOnly}
                            aria-label={`${r + 1}行目 ${col.label}`}
                            className={`absolute inset-0 w-full h-full px-1.5 bg-transparent text-main outline-none caret-theme text-sm ${alignClass(col.align)}`}
                          />
                        </div>
                      ) : (
                        <div className={`px-1.5 py-1.5 truncate ${alignClass(col.align)} ${
                          col.readOnly ? 'text-sub1' : raw ? 'text-main' : 'text-sub2'
                        }`}>
                          {raw}
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
  )
}
