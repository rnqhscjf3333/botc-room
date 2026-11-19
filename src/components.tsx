import { useEffect, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent } from 'react'
import type { ChatMsg } from './lib/game'
import { ROLES, SCRIPTS, TEAM_LABEL, getScript, type Team } from './data/roles'

const TEAMS: Team[] = ['townsfolk', 'outsider', 'minion', 'demon']

/** 커스텀 시계탑(botc.vnamu.com)에서 가져온 아이콘. 없으면 이니셜 원으로 대체. */
export function RoleIcon({ id, size = 48 }: { id: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const role = ROLES[id]
  if (failed || !role) {
    return (
      <span className={`role-icon fallback ${role?.team ?? ''}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
        {role?.ko.slice(0, 1) ?? '?'}
      </span>
    )
  }
  return (
    <img
      className="role-icon"
      src={`${import.meta.env.BASE_URL}icons/${id}.webp`}
      alt={role.ko}
      width={size}
      height={size}
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}

export function Modal({ title, onClose, children, wide }: { title?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  // 모달 안에서 누른 채 바깥에서 떼도 닫히지 않도록, 누르기 시작한 곳이 배경일 때만 닫는다.
  const pressedBackdrop = useRef(false)
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressedBackdrop.current) onClose()
        pressedBackdrop.current = false
      }}
    >
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn small" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

/** 시나리오 직업을 아이콘 칸으로 보여주고 하나를 고르는 그리드 (커스텀 시계탑 스타일) */
export function RoleGrid({
  scriptId,
  selected,
  onPick,
  disabledIds,
}: {
  scriptId: string
  selected?: string
  onPick: (id: string) => void
  disabledIds?: Set<string>
}) {
  const roles = getScript(scriptId).roles
  return (
    <div className="role-grid-wrap">
      {TEAMS.map((t) => {
        const list = roles.filter((r) => ROLES[r].team === t)
        if (!list.length) return null
        return (
          <section key={t}>
            <h3 className={`grid-title ${t}`}>{TEAM_LABEL[t]}</h3>
            <div className="role-grid">
              {list.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`role-cell ${t} ${selected === r ? 'sel' : ''}`}
                  disabled={disabledIds?.has(r)}
                  onClick={() => onPick(r)}
                  title={ROLES[r].ability}
                >
                  <RoleIcon id={r} size={52} />
                  <span>{ROLES[r].ko}</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function RoleDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const r = ROLES[id]
  return (
    <Modal onClose={onClose} title={r.ko}>
      <div className="detail">
        <RoleIcon id={id} size={96} />
        <span className={`badge ${r.team}`}>{TEAM_LABEL[r.team]}</span>
        <div className="muted small">{r.en}</div>
        <p className="ability">{r.ability}</p>
        {r.ability.includes('*') && <p className="muted small">* 첫날 밤에는 해당되지 않습니다</p>}
      </div>
    </Modal>
  )
}

export function ScriptPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {SCRIPTS.map((sc) => (
        <option key={sc.id} value={sc.id}>
          {sc.name}
        </option>
      ))}
    </select>
  )
}

export interface TableSeat {
  key: string
  name: string
  dead: boolean
  roleId?: string
  badge?: ReactNode // 토큰 모서리에 붙는 작은 표시
  highlight?: boolean
  cls?: string // 추가 클래스 (actor, picked, targetable 등)
}

export interface TableArrow {
  id: string
  from?: string // 좌석 key. 없으면 대상에 표식만 그린다(사망 등)
  to: string
  kind: 'nominate' | 'ability' | 'death' | 'revive'
  roleId?: string
  hot?: boolean // 가장 최근 이벤트 강조
}

const ARROW_COLOR: Record<TableArrow['kind'], string> = {
  nominate: '#ff9f43',
  ability: '#9b95fa',
  death: '#ff5c5c',
  revive: '#4cd68a',
}

/**
 * 원형 좌석 배치. 0번 좌석이 12시 방향이고 시계 방향으로 진행.
 * onSwap 이 있으면 토큰을 드래그해서 다른 자리와 위치를 맞바꿀 수 있고,
 * 드래그하지 않고 눌렀을 때는 onSelect 가 호출된다.
 */
export function CircleTable({
  seats,
  center,
  showRole,
  arrows,
  onSelect,
  onSwap,
}: {
  seats: TableSeat[]
  arrows?: TableArrow[]
  center?: ReactNode
  showRole?: boolean
  onSelect?: (i: number) => void
  onSwap?: (a: number, b: number) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ i: number; x: number; y: number } | null>(null)
  const start = useRef<{ i: number; x: number; y: number; moved: boolean } | null>(null)
  const n = seats.length
  const R = 38 // 중심에서 토큰 중심까지 거리(%)
  const size = n <= 8 ? 17 : n <= 11 ? 14.5 : 12.5 // 토큰 지름(%)

  const slot = (i: number) => {
    const a = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2
    return { x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) }
  }
  const toPct = (e: { clientX: number; clientY: number }) => {
    const r = boxRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }
  }

  const down = (e: RPointerEvent, i: number) => {
    start.current = { i, x: e.clientX, y: e.clientY, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move = (e: RPointerEvent) => {
    const s = start.current
    if (!s || !onSwap) return
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8) return
    s.moved = true
    setDrag({ i: s.i, ...toPct(e) })
  }
  const up = (e: RPointerEvent) => {
    const s = start.current
    start.current = null
    setDrag(null)
    if (!s) return
    if (!s.moved) {
      onSelect?.(s.i)
      return
    }
    const p = toPct(e)
    let best = s.i
    let bestD = Infinity
    for (let j = 0; j < n; j++) {
      const q = slot(j)
      const d = Math.hypot(q.x - p.x, q.y - p.y)
      if (d < bestD) {
        bestD = d
        best = j
      }
    }
    if (best !== s.i) onSwap?.(s.i, best)
  }

  const idx = (key?: string) => seats.findIndex((x) => x.key === key)
  const r = size / 2

  return (
    <div className="table-box" ref={boxRef}>
      <div className="table-ring" />
      {arrows && arrows.length > 0 && (
        <svg className="table-arrows" viewBox="0 0 100 100" aria-hidden>
          <defs>
            {(Object.keys(ARROW_COLOR) as TableArrow['kind'][]).map((k) => (
              <marker key={k} id={`ah-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill={ARROW_COLOR[k]} />
              </marker>
            ))}
          </defs>
          {arrows.map((a) => {
            const ti = idx(a.to)
            if (ti < 0) return null
            const T = slot(ti)
            const color = ARROW_COLOR[a.kind]
            const fi = idx(a.from)
            if (fi < 0) {
              // 출발점이 없는 표식(사망/부활)
              return (
                <text key={a.id} x={T.x} y={T.y + 1.5} fontSize={r * 1.25} textAnchor="middle" opacity={a.hot ? 1 : 0.8}>
                  {a.kind === 'death' ? '💀' : '♻'}
                </text>
              )
            }
            const F = slot(fi)
            const dx = T.x - F.x
            const dy = T.y - F.y
            const len = Math.hypot(dx, dy) || 1
            const ux = dx / len
            const uy = dy / len
            // 서로 마주 보는 화살표가 겹치지 않도록 진행 방향의 왼쪽으로 살짝 휘게 한다
            const bend = Math.min(7, len * 0.12)
            const cx = (F.x + T.x) / 2 + uy * bend
            const cy = (F.y + T.y) / 2 - ux * bend
            const sx = F.x + ux * (r + 0.8)
            const sy = F.y + uy * (r + 0.8)
            const ex = T.x - ux * (r + 2.2)
            const ey = T.y - uy * (r + 2.2)
            const mx = 0.25 * sx + 0.5 * cx + 0.25 * ex
            const my = 0.25 * sy + 0.5 * cy + 0.25 * ey
            return (
              <g key={a.id} opacity={a.hot ? 1 : 0.75}>
                <path d={`M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}`} fill="none" stroke={color} strokeWidth={a.hot ? 1.1 : 0.8} strokeLinecap="round" markerEnd={`url(#ah-${a.kind})`} strokeDasharray={a.kind === 'nominate' ? '2 1.4' : undefined} />
                {a.kind === 'ability' && a.roleId ? (
                  <>
                    <circle cx={mx} cy={my} r={3.2} fill="#161621" stroke={color} strokeWidth={0.5} />
                    <image href={`${import.meta.env.BASE_URL}icons/${a.roleId}.webp`} x={mx - 2.8} y={my - 2.8} width={5.6} height={5.6} />
                  </>
                ) : (
                  <text x={mx} y={my + 1.6} fontSize={4.6} textAnchor="middle">
                    {a.kind === 'nominate' ? '👉' : ''}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      {center && <div className="table-center">{center}</div>}
      {seats.map((seat, i) => {
        const dragging = drag?.i === i
        const pos = dragging ? { x: drag.x, y: drag.y } : slot(i)
        const role = showRole && seat.roleId ? ROLES[seat.roleId] : undefined
        return (
          <div
            key={seat.key}
            className={`token ${seat.dead ? 'dead' : ''} ${dragging ? 'dragging' : ''} ${seat.highlight ? 'hl' : ''} ${onSwap || onSelect ? 'interactive' : ''} ${seat.cls ?? ''}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${size}%` }}
            onPointerDown={onSelect || onSwap ? (e) => down(e, i) : undefined}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => {
              start.current = null
              setDrag(null)
            }}
          >
            <div className={`token-face ${role ? role.team : 'plain'}`}>
              {role ? <RoleIcon id={role.id} size={200} /> : <span className="token-initial">{seat.name.slice(0, 1)}</span>}
            </div>
            {seat.badge && <span className="token-badge">{seat.badge}</span>}
            <div className="token-name">{seat.name}</div>
          </div>
        )
      })}
    </div>
  )
}

const hhmm = (ts: number) => new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

/** 호스트↔플레이어 1:1 대화창. side 는 지금 보는 쪽. */
export function ChatModal({
  title,
  side,
  messages,
  onSend,
  onClose,
}: {
  title: ReactNode
  side: 'host' | 'player'
  messages: ChatMsg[]
  onSend: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])
  const submit = () => {
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }
  return (
    <Modal title={title} onClose={onClose}>
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && <p className="muted small center">아직 대화가 없어요.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.from === side ? 'me' : 'other'}`}>
            {m.text}
            <small>{hhmm(m.ts)}</small>
          </div>
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input value={text} maxLength={300} placeholder="메시지 입력" onChange={(e) => setText(e.target.value)} autoFocus />
        <button className="btn primary" type="submit" disabled={!text.trim()}>
          보내기
        </button>
      </form>
    </Modal>
  )
}
