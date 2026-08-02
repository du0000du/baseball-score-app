// ────────────────────────────────────────────────
// まとめて試合登録：クリップボード貼り付けの解析と正規化
//   Excel / スプレッドシートからのコピーは TSV（タブ区切り）で渡ってくる。
//   表記ゆれ（日付・勝敗）を吸収し、ヘッダー行があれば列を自動対応づける。
// ────────────────────────────────────────────────

export type ColKey =
  | 'game_date' | 'opponent' | 'stadium'
  | 'result' | 'score_us' | 'score_them' | 'notes'

export type ColType = 'date' | 'text' | 'number' | 'result'

export interface ColumnDef {
  key: ColKey
  label: string
  type: ColType
  /** ヘッダー行の自動検出に使う別名（正規化して比較する） */
  aliases: string[]
  required: boolean
  widthClass: string
  align: 'left' | 'center'
  placeholder?: string
}

export const COLUMNS: ColumnDef[] = [
  {
    key: 'game_date', label: '試合日', type: 'date', required: true,
    aliases: ['試合日', '日付', '日にち', '年月日', 'date', 'gamedate', '開催日'],
    widthClass: 'w-32', align: 'center', placeholder: '2026-06-15',
  },
  {
    key: 'opponent', label: '対戦相手', type: 'text', required: true,
    aliases: ['対戦相手', '相手', '対戦チーム', '対戦', 'opponent', 'vs', '相手チーム'],
    widthClass: 'w-44', align: 'left', placeholder: '○○ファイターズ',
  },
  {
    key: 'stadium', label: '球場', type: 'text', required: false,
    aliases: ['球場', '会場', 'グラウンド', 'stadium', 'field', '場所'],
    widthClass: 'w-32', align: 'left',
  },
  {
    key: 'result', label: '勝敗', type: 'result', required: true,
    aliases: ['勝敗', '結果', '勝ち負け', 'result', 'wl', 'w/l'],
    widthClass: 'w-20', align: 'center',
  },
  {
    key: 'score_us', label: '自得点', type: 'number', required: true,
    aliases: ['自得点', '自点', '得点', '自チーム', 'スコア自', 'scoreus', 'us', 'ourscore', '自軍'],
    widthClass: 'w-16', align: 'center',
  },
  {
    key: 'score_them', label: '相手得点', type: 'number', required: true,
    aliases: ['相手得点', '相点', '失点', '相手', 'スコア相手', 'scorethem', 'them', 'their', '相手チーム得点'],
    widthClass: 'w-16', align: 'center',
  },
  {
    key: 'notes', label: 'メモ', type: 'text', required: false,
    aliases: ['メモ', '備考', 'コメント', 'note', 'notes', 'memo', 'remarks'],
    widthClass: 'w-48', align: 'left',
  },
]

export const COL_KEYS: ColKey[] = COLUMNS.map(c => c.key)

export function colIndex(key: ColKey): number {
  return COL_KEYS.indexOf(key)
}

// ────────────────────────────────────────────────
// 文字列正規化
// ────────────────────────────────────────────────

/** 全角英数記号を半角へ */
export function toHalfWidth(s: string): string {
  return s
    .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
}

/** ヘッダー比較用の正規化（記号・空白・大文字小文字を落とす） */
function normalizeHeaderText(s: string): string {
  return toHalfWidth(s)
    .toLowerCase()
    .replace(/[\s_\-*※()（）[\]]/g, '')
    .trim()
}

// ────────────────────────────────────────────────
// クリップボード（TSV）の解析
// ────────────────────────────────────────────────

/**
 * TSV文字列を2次元配列にする。
 * 末尾の空行は落とすが、途中の空行・空セルは保持する。
 */
export function parseClipboard(text: string): string[][] {
  if (!text) return []
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  // 末尾の空行のみ除去（Excelのコピーは末尾に改行が付く）
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
  return lines.map(line => line.split('\t'))
}

/**
 * 1行目がヘッダー行かを判定し、列インデックス → ColKey の対応を返す。
 * ヘッダーでなければ null。
 */
export function detectHeader(row: string[]): (ColKey | null)[] | null {
  if (row.length === 0) return null
  const mapping: (ColKey | null)[] = row.map(cell => {
    const n = normalizeHeaderText(cell)
    if (!n) return null
    for (const col of COLUMNS) {
      if (col.aliases.some(a => normalizeHeaderText(a) === n)) return col.key
    }
    return null
  })
  const nonEmpty = row.filter(c => c.trim() !== '').length
  const matched = mapping.filter(m => m !== null).length
  // 空でないセルの過半数が既知のヘッダー名に一致したらヘッダー行とみなす
  if (nonEmpty === 0) return null
  if (matched >= 2 && matched >= Math.ceil(nonEmpty / 2)) return mapping
  return null
}

// ────────────────────────────────────────────────
// 値の正規化
// ────────────────────────────────────────────────

const DATE_PATTERNS: { re: RegExp; y: number; m: number; d: number }[] = [
  // 2026-06-15 / 2026/6/15 / 2026.6.15 / 2026年6月15日
  { re: /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/, y: 1, m: 2, d: 3 },
  // 20260615
  { re: /^(\d{4})(\d{2})(\d{2})$/, y: 1, m: 2, d: 3 },
]

const MD_PATTERN = /^(\d{1,2})[-/.月](\d{1,2})日?$/

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * 日付の表記ゆれを YYYY-MM-DD に寄せる。
 * 年が無い「6/15」形式は fallbackYear を補う。
 * 解釈できない場合は入力をそのまま返し、バリデーション側でエラーにする。
 */
export function normalizeDate(input: string, fallbackYear: number): string {
  const s = toHalfWidth(input).trim()
  if (!s) return ''
  for (const p of DATE_PATTERNS) {
    const m = s.match(p.re)
    if (m) {
      const y = parseInt(m[p.y], 10)
      const mo = parseInt(m[p.m], 10)
      const d = parseInt(m[p.d], 10)
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return s
      return `${y}-${pad2(mo)}-${pad2(d)}`
    }
  }
  const md = s.match(MD_PATTERN)
  if (md) {
    const mo = parseInt(md[1], 10)
    const d = parseInt(md[2], 10)
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return s
    return `${fallbackYear}-${pad2(mo)}-${pad2(d)}`
  }
  return s
}

const RESULT_WIN  = ['win', 'w', '勝', '勝ち', '○', '◯', '〇', 'o', '1', '勝利']
const RESULT_LOSS = ['loss', 'lose', 'l', '負', '負け', '敗', '敗戦', '●', '×', 'x', '2', '黒星']
const RESULT_DRAW = ['draw', 'd', 'tie', 't', '分', '引', '引分', '引き分け', '分け', '△', '3', 'ドロー']

export type ResultValue = 'win' | 'loss' | 'draw'

/** 勝敗の表記ゆれを win/loss/draw に寄せる。判別できなければ '' */
export function normalizeResult(input: string): ResultValue | '' {
  const s = toHalfWidth(input).trim().toLowerCase()
  if (!s) return ''
  if (RESULT_WIN.includes(s))  return 'win'
  if (RESULT_LOSS.includes(s)) return 'loss'
  if (RESULT_DRAW.includes(s)) return 'draw'
  return ''
}

/** 数値セル：全角を半角にし、先頭の整数だけを取り出す */
export function normalizeNumber(input: string): string {
  const s = toHalfWidth(input).trim()
  if (!s) return ''
  const m = s.match(/\d+/)
  return m ? String(parseInt(m[0], 10)) : ''
}

/** スコアから勝敗を導出する（勝敗セルが空のときの補完用） */
export function deriveResult(scoreUs: string, scoreThem: string): ResultValue | '' {
  const us = parseInt(scoreUs, 10)
  const them = parseInt(scoreThem, 10)
  if (isNaN(us) || isNaN(them)) return ''
  if (us > them) return 'win'
  if (us < them) return 'loss'
  return 'draw'
}

/** 列の型に応じてセル値を正規化する */
export function normalizeCell(col: ColumnDef, raw: string, fallbackYear: number): string {
  switch (col.type) {
    case 'date':   return normalizeDate(raw, fallbackYear)
    case 'number': return normalizeNumber(raw)
    case 'result': return normalizeResult(raw)
    case 'text':   return toHalfWidth(raw).trim() === '' ? '' : raw.trim()
  }
}

// ────────────────────────────────────────────────
// コピー用 TSV 生成
// ────────────────────────────────────────────────

export function toTSV(matrix: string[][]): string {
  return matrix.map(row => row.join('\t')).join('\n')
}

// ────────────────────────────────────────────────
// 貼り付け結果の適用計画
// ────────────────────────────────────────────────

export interface PastePlan {
  /** 適用する値（行 × 列インデックス）。列インデックスは COL_KEYS 基準 */
  cells: { r: number; c: number; value: string }[]
  /** 必要な総行数 */
  requiredRows: number
  /** ヘッダー行を検出して列を対応づけたか */
  headerDetected: boolean
  /** 実際に埋まった行数（重複登録の確認用） */
  affectedRows: number
}

/**
 * 貼り付けデータから「どのセルに何を入れるか」を組み立てる。
 *
 * - 1x1 のデータは選択範囲すべてに同じ値を入れる（表計算ソフトと同じ挙動）
 * - ヘッダー行が含まれる場合は、列位置ではなくヘッダー名で対応づける
 * - それ以外は選択セルを起点に右下方向へ流し込む
 */
export function buildPastePlan(
  matrix: string[][],
  anchorRow: number,
  anchorCol: number,
  selection: { r1: number; c1: number; r2: number; c2: number } | null,
  maxRows: number,
  fallbackYear: number,
): PastePlan {
  const cells: PastePlan['cells'] = []
  if (matrix.length === 0) {
    return { cells, requiredRows: 0, headerDetected: false, affectedRows: 0 }
  }

  // ── 1x1 は選択範囲すべてに複製 ──
  if (matrix.length === 1 && matrix[0].length === 1 && selection) {
    const raw = matrix[0][0]
    for (let r = selection.r1; r <= selection.r2 && r < maxRows; r++) {
      for (let c = selection.c1; c <= selection.c2; c++) {
        const col = COLUMNS[c]
        if (!col) continue
        cells.push({ r, c, value: normalizeCell(col, raw, fallbackYear) })
      }
    }
    return {
      cells,
      requiredRows: Math.min(selection.r2 + 1, maxRows),
      headerDetected: false,
      affectedRows: Math.min(selection.r2, maxRows - 1) - selection.r1 + 1,
    }
  }

  // ── ヘッダー行の検出 ──
  const headerMap = detectHeader(matrix[0])
  const dataRows = headerMap ? matrix.slice(1) : matrix

  let maxRowUsed = anchorRow
  dataRows.forEach((rowCells, ri) => {
    const r = anchorRow + ri
    if (r >= maxRows) return
    rowCells.forEach((raw, ci) => {
      let c: number
      if (headerMap) {
        const key = headerMap[ci]
        if (!key) return                      // 対応する列が無いセルは無視
        c = colIndex(key)
      } else {
        c = anchorCol + ci
      }
      if (c < 0 || c >= COLUMNS.length) return
      const col = COLUMNS[c]
      cells.push({ r, c, value: normalizeCell(col, raw, fallbackYear) })
      if (r > maxRowUsed) maxRowUsed = r
    })
  })

  const affected = Math.min(anchorRow + dataRows.length, maxRows) - anchorRow

  return {
    cells,
    requiredRows: Math.min(anchorRow + dataRows.length, maxRows),
    headerDetected: headerMap !== null,
    affectedRows: Math.max(0, affected),
  }
}
