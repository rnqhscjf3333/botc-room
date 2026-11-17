import { useEffect, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent } from 'react'
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
  onSelect,
  onSwap,
}: {
  seats: TableSeat[]
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

  return (
    <div className="table-box" ref={boxRef}>
      <div className="table-ring" />
      {center && <div className="table-center">{center}</div>}
      {seats.map((seat, i) => {
        const dragging = drag?.i === i
        const pos = dragging ? { x: drag.x, y: drag.y } : slot(i)
        const role = showRole && seat.roleId ? ROLES[seat.roleId] : undefined
        return (
          <div
            key={seat.key}
            className={`token ${seat.dead ? 'dead' : ''} ${dragging ? 'dragging' : ''} ${seat.highlight ? 'hl' : ''} ${onSwap || onSelect ? 'interactive' : ''}`}
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
