import { useEffect, useMemo, useState } from 'react'
import { ROLES } from '../data/roles'
import { CircleTable, type TableArrow } from '../components'
import { buildSteps, describeEvent, phaseKey, phaseLabel } from '../lib/events'
import type { HostState } from '../lib/game'

/** 게임 기록 재현: 낮/밤별로 이벤트를 한 단계씩 되짚어 본다. */
export default function ReplayScreen({
  state,
  onClose,
  onNewGame,
}: {
  state: HostState
  onClose?: () => void
  onNewGame?: () => void
}) {
  const steps = useMemo(() => buildSteps(state), [state])
  const [cur, setCur] = useState(Math.max(0, steps.length - 1))
  const [auto, setAuto] = useState(false)
  const last = steps.length - 1

  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => {
      setCur((c) => {
        if (c >= last) {
          setAuto(false)
          return c
        }
        return c + 1
      })
    }, 1600)
    return () => clearInterval(t)
  }, [auto, last])

  const step = steps[cur]
  const phases = useMemo(() => {
    const seen: { key: string; day: number; time: 'day' | 'night'; first: number }[] = []
    steps.forEach((s, i) => {
      const key = phaseKey(s.day, s.time)
      if (!seen.some((p) => p.key === key)) seen.push({ key, day: s.day, time: s.time, first: i })
    })
    return seen
  }, [steps])

  if (!step) {
    return (
      <main className="page">
        <section className="card center">
          <p className="muted">기록된 이벤트가 없어요.</p>
          {onClose && (
            <button className="btn" onClick={onClose}>
              ← 돌아가기
            </button>
          )}
          {onNewGame && (
            <button className="btn primary" onClick={onNewGame}>
              🔄 새 게임
            </button>
          )}
        </section>
      </main>
    )
  }

  const curKey = phaseKey(step.day, step.time)
  const inPhase = steps.map((s, i) => ({ s, i })).filter(({ s }) => phaseKey(s.day, s.time) === curKey)

  // 현재 단계까지의 생사 상태
  const dead = new Set<string>()
  steps.slice(0, cur + 1).forEach((s) => {
    if (s.type !== 'event') return
    if (s.ev.kind === 'death') s.ev.targetIds.forEach((t) => dead.add(t))
    if (s.ev.kind === 'revive') s.ev.targetIds.forEach((t) => dead.delete(t))
  })

  // 같은 낮/밤 안에서 현재 단계까지 일어난 일을 화살표로
  const arrows: TableArrow[] = inPhase
    .filter(({ i, s }) => i <= cur && s.type === 'event' && s.ev.kind !== 'phase')
    .flatMap(({ i, s }) => {
      if (s.type !== 'event') return []
      const e = s.ev
      const hot = i === cur
      return e.targetIds.map((t) => ({
        id: e.id + t,
        from: e.kind === 'death' || e.kind === 'revive' ? undefined : e.actorId,
        to: t,
        kind: e.kind as TableArrow['kind'],
        roleId: e.roleId,
        hot,
      }))
    })

  const nameOf = (id?: string) => state.players.find((p) => p.id === id)?.name ?? '(나간 플레이어)'
  const line = (i: number) => {
    const s = steps[i]
    if (s.type === 'chat') {
      const who = nameOf(s.pid)
      return s.msg.from === 'host' ? `💬 이야기꾼 → ${who}: ${s.msg.text}` : `💬 ${who} → 이야기꾼: ${s.msg.text}`
    }
    return describeEvent(s.ev, state.players)
  }
  const cls = (i: number) => (steps[i].type === 'chat' ? 'chat' : steps[i].type === 'event' ? (steps[i] as { ev: { kind: string } }).ev.kind : '')

  return (
    <main className="page">
      <header className="host-head">
        <h1 style={{ fontSize: '1.4rem' }}>📜 게임 기록</h1>
        <div className="head-right">
          {onClose && (
            <button className="btn small" onClick={onClose}>
              ← 게임으로
            </button>
          )}
          {onNewGame && (
            <button className="btn small primary" onClick={onNewGame}>
              🔄 새 게임 (로비로)
            </button>
          )}
        </div>
      </header>

      {state.winner && (
        <div className={`winner ${state.winner}`}>{state.winner === 'good' ? '😇 선한 팀 승리' : '😈 악한 팀 승리'}</div>
      )}

      <div className="chips">
        {phases.map((p) => (
          <button key={p.key} className={`chip ${p.key === curKey ? 'on' : ''}`} onClick={() => { setAuto(false); setCur(p.first) }}>
            {p.time === 'night' ? '🌙' : '☀️'} {phaseLabel(p.day, p.time)}
          </button>
        ))}
      </div>

      <div className="host-layout">
        <section className="card">
          <CircleTable
            showRole
            arrows={arrows}
            seats={state.players.map((p) => ({ key: p.id, name: p.name, dead: dead.has(p.id), roleId: p.roleId }))}
            center={<span className="table-center-text">{phaseLabel(step.day, step.time)}</span>}
          />
          <div className="replay-ctl">
            <button className="btn small" onClick={() => { setAuto(false); setCur(0) }} disabled={cur === 0}>⏮</button>
            <button className="btn small" onClick={() => { setAuto(false); setCur((c) => Math.max(0, c - 1)) }} disabled={cur === 0}>◀</button>
            <button className={`btn small ${auto ? 'on' : ''}`} onClick={() => { if (!auto && cur >= last) setCur(0); setAuto((a) => !a) }}>
              {auto ? '⏸ 일시정지' : '▶ 자동 재생'}
            </button>
            <button className="btn small" onClick={() => { setAuto(false); setCur((c) => Math.min(last, c + 1)) }} disabled={cur >= last}>▶</button>
            <button className="btn small" onClick={() => { setAuto(false); setCur(last) }} disabled={cur >= last}>⏭</button>
            <span className="muted small">
              {cur + 1} / {steps.length}
            </span>
          </div>
          <div className="legend">
            <span><i style={{ borderColor: '#ff9f43', borderTopStyle: 'dashed' }} />지목</span>
            <span><i style={{ borderColor: '#9b95fa' }} />능력</span>
            <span>💀 사망 · ♻ 부활</span>
          </div>
        </section>

        <aside className="card">
          <h2>
            {step.time === 'night' ? '🌙' : '☀️'} {phaseLabel(step.day, step.time)}
          </h2>
          <ul className="events">
            {inPhase.map(({ i }) => (
              <li key={i} className={`ev ${cls(i)} ${i === cur ? 'cur' : ''}`} onClick={() => { setAuto(false); setCur(i) }} style={{ cursor: 'pointer', opacity: i > cur ? 0.45 : 1 }}>
                <div className="ev-main">
                  <span>{line(i)}</span>
                </div>
                {(() => {
                  const s = steps[i]
                  return s.type === 'event' && s.ev.text ? <span className="muted small">📝 {s.ev.text}</span> : null
                })()}
              </li>
            ))}
          </ul>
          {step.type === 'event' && step.ev.roleId && <p className="muted small">{ROLES[step.ev.roleId]?.ability}</p>}
        </aside>
      </div>
    </main>
  )
}
