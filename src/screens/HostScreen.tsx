import { useState } from 'react'
import { ROLES, SCRIPTS, TEAM_LABEL, getScript, type Team } from '../data/roles'
import { randomAssign, randomBluffs, uid, type HostPlayer, type HostState } from '../lib/game'
import { clearSavedOffline, clearSavedRoom, useHost, useOfflineHost, type NetStatus } from '../lib/net'
import { useWakeLock } from '../lib/useWakeLock'
import CheckScreen from './CheckScreen'

const STATUS_LABEL: Record<NetStatus, string> = {
  connecting: '서버 연결 중…',
  online: '온라인',
  offline: '연결 끊김(재시도 중)',
  error: '오류',
}

const TEAMS: Team[] = ['townsfolk', 'outsider', 'minion', 'demon']

function RoleSelect({
  scriptId,
  value,
  onChange,
  empty,
}: {
  scriptId: string
  value: string | undefined
  onChange: (v: string | undefined) => void
  empty: string
}) {
  const roles = getScript(scriptId).roles
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{empty}</option>
      {TEAMS.map((t) => (
        <optgroup key={t} label={TEAM_LABEL[t]}>
          {roles
            .filter((r) => ROLES[r].team === t)
            .map((r) => (
              <option key={r} value={r}>
                {ROLES[r].ko}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  )
}

interface HostCtl {
  state: HostState | null
  status: NetStatus
  error: string
  update: (fn: (s: HostState) => HostState) => void
  kick: (pid: string) => void
}

export default function HostScreen({ resume, offline, onExit }: { resume: boolean; offline: boolean; onExit: () => void }) {
  return offline ? <OfflineHost resume={resume} onExit={onExit} /> : <OnlineHost resume={resume} onExit={onExit} />
}

function OnlineHost({ resume, onExit }: { resume: boolean; onExit: () => void }) {
  return <HostView ctl={useHost(resume)} offline={false} onExit={onExit} />
}

function OfflineHost({ resume, onExit }: { resume: boolean; onExit: () => void }) {
  return <HostView ctl={useOfflineHost(resume)} offline onExit={onExit} />
}

function HostView({ ctl, offline, onExit }: { ctl: HostCtl; offline: boolean; onExit: () => void }) {
  const { state, status, error, update, kick } = ctl
  const [copied, setCopied] = useState(false)
  const [checkMode, setCheckMode] = useState(false)
  const [newName, setNewName] = useState('')
  useWakeLock()

  if (!state) {
    return (
      <main className="page narrow center">
        <p className="muted">{status === 'error' ? `연결 실패: ${error}` : '방을 만드는 중…'}</p>
        <button className="btn" onClick={onExit}>
          돌아가기
        </button>
      </main>
    )
  }

  const playing = state.phase === 'playing'
  const patchPlayer = (id: string, patch: Partial<HostPlayer>) =>
    update((s) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const move = (i: number, d: -1 | 1) =>
    update((s) => {
      const j = i + d
      if (j < 0 || j >= s.players.length) return s
      const players = [...s.players]
      ;[players[i], players[j]] = [players[j], players[i]]
      return { ...s, players }
    })
  const remove = (p: HostPlayer) => {
    if (!confirm(`${p.name} 님을 내보낼까요?`)) return
    kick(p.id)
    update((s) => ({ ...s, players: s.players.filter((x) => x.id !== p.id) }))
  }
  const toggleTime = () =>
    update((s) =>
      s.time === 'night'
        ? { ...s, time: 'day' }
        : { ...s, time: 'night', day: s.day + 1, players: s.players.map((p) => ({ ...p, nominated: false })) },
    )
  const backToLobby = () => {
    if (!confirm('게임을 종료하고 로비로 돌아갈까요? (직업 배정은 유지됩니다)')) return
    update((s) => ({
      ...s,
      phase: 'lobby',
      revealEvil: false,
      day: 0,
      time: 'night',
      players: s.players.map((p) => ({ ...p, alive: true, nominated: false, message: '' })),
    }))
  }
  const closeRoom = () => {
    if (!confirm(offline ? '이 게임을 끝낼까요? 저장된 내용이 삭제됩니다.' : '방을 닫을까요? 모든 참가자의 연결이 끊어지고 저장된 방도 삭제됩니다.')) return
    if (offline) clearSavedOffline()
    else clearSavedRoom()
    onExit()
  }
  const join = `${location.origin}${location.pathname}#join=${state.code}`
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(join)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      prompt('링크를 복사하세요', join)
    }
  }

  const addPlayer = () => {
    const name = newName.trim().slice(0, 12)
    if (!name) return
    update((s) => ({
      ...s,
      players: [...s.players, { id: uid(), name, connected: true, alive: true, nominated: false, message: '' }],
    }))
    setNewName('')
  }

  if (checkMode) return <CheckScreen state={state} onExit={() => setCheckMode(false)} />

  const allAssigned = state.players.length > 0 && state.players.every((p) => p.roleId)
  const enough = state.players.length >= 5

  return (
    <main className="page">
      <header className="host-head">
        {offline ? (
          <div>
            <div className="muted small">오프라인 모드 (이 기기 하나로 진행)</div>
            <div className="offline-title">📴 토큰 확인 방식</div>
          </div>
        ) : (
          <div>
            <div className="muted small">방 코드</div>
            <div className="room-code">{state.code}</div>
          </div>
        )}
        <div className="head-right">
          {!offline && <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>}
          {!offline && (
            <button className="btn small" onClick={copyLink}>
              {copied ? '복사됨 ✓' : '입장 링크 복사'}
            </button>
          )}
          <button className="btn small danger" onClick={closeRoom}>
            {offline ? '게임 끝내기' : '방 닫기'}
          </button>
        </div>
      </header>

      {playing ? (
        <section className="card controls">
          <div className="time-badge" data-time={state.time}>
            {state.time === 'night' ? '🌙' : '☀️'} {state.day}일차 {state.time === 'night' ? '밤' : '낮'}
          </div>
          <button className="btn primary" onClick={toggleTime}>
            {state.time === 'night' ? '☀️ 낮으로' : '🌙 밤으로'}
          </button>
          <button
            className={`btn ${state.revealEvil ? 'on' : ''}`}
            onClick={() => update((s) => ({ ...s, revealEvil: !s.revealEvil }))}
            title="하수인·악마에게 서로의 정체(와 악마에게 블러프 3개)를 보여줍니다"
          >
            {state.revealEvil ? '😈 악 팀 정보 공개 중' : '😈 악 팀 정보 공개'}
          </button>
          <button className="btn" onClick={backToLobby}>
            ⏹ 로비로
          </button>
        </section>
      ) : (
        <section className="card">
          <h2>1. 시나리오</h2>
          <select
            value={state.scriptId}
            onChange={(e) =>
              update((s) => ({
                ...s,
                scriptId: e.target.value,
                bluffs: [],
                players: s.players.map((p) => ({ ...p, roleId: undefined, shownRoleId: undefined })),
              }))
            }
          >
            {SCRIPTS.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </select>
        </section>
      )}

      {!playing && (
        <section className="card">
          <h2>2. 직업 배정</h2>
          <p className="muted small">
            {state.players.length}명 접속 중{!enough && ' · 5명 이상부터 자동 배정할 수 있어요'}. 자동 배정 후 각 직업을
            직접 바꿀 수도 있어요.
          </p>
          <div className="row">
            <button className="btn primary" disabled={!enough} onClick={() => update((s) => randomAssign(s))}>
              🎲 {allAssigned ? '다시 ' : ''}자동 배정
            </button>
          </div>
          <h3>악마의 블러프 (미지정 직업 3개)</h3>
          <div className="row wrap">
            {[0, 1, 2].map((i) => (
              <RoleSelect
                key={i}
                scriptId={state.scriptId}
                value={state.bluffs[i]}
                empty="(선택)"
                onChange={(v) =>
                  update((s) => {
                    const b = [...s.bluffs]
                    b[i] = v as string
                    return { ...s, bluffs: b }
                  })
                }
              />
            ))}
            <button className="btn small" onClick={() => update((s) => ({ ...s, bluffs: randomBluffs(s) }))}>
              🎲 랜덤
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>
          {playing ? '플레이어' : '3. 플레이어'} <span className="muted small">(위→아래 = 좌석 순서)</span>
        </h2>
        {offline && !playing && (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              addPlayer()
            }}
          >
            <input
              style={{ flex: 1 }}
              value={newName}
              maxLength={12}
              placeholder="플레이어 이름 추가"
              onChange={(e) => setNewName(e.target.value)}
            />
            <button className="btn primary" type="submit" disabled={!newName.trim()}>
              추가
            </button>
          </form>
        )}
        {state.players.length === 0 && (
          <p className="muted">
            {offline ? '위에서 참가자 이름을 한 명씩 추가하세요.' : (
              <>아직 아무도 없어요. 친구들이 <b>{state.code}</b> 코드로 입장하면 여기에 나타나요.</>
            )}
          </p>
        )}
        <ul className="players">
          {state.players.map((p, i) => (
            <PlayerRow
              key={p.id}
              p={p}
              i={i}
              state={state}
              playing={playing}
              offline={offline}
              onPatch={(patch) => patchPlayer(p.id, patch)}
              onMove={(d) => move(i, d)}
              onRemove={() => remove(p)}
            />
          ))}
        </ul>
      </section>

      {!playing && (
        <section className="card">
          <h2>4. 시작</h2>
          <button
            className="btn primary big"
            disabled={!allAssigned}
            onClick={() => update((s) => ({ ...s, phase: 'playing', time: 'night', day: 1, revealEvil: false }))}
          >
            ▶ 게임 시작 (플레이어에게 직업이 표시됩니다)
          </button>
          {!allAssigned && <p className="muted small">모든 플레이어에게 직업을 배정해야 시작할 수 있어요.</p>}
        </section>
      )}

      {offline && allAssigned && (
        <section className="card">
          <h2>{playing ? '토큰 다시 확인' : '토큰 확인'}</h2>
          <p className="muted small">
            이 화면에는 모두의 직업이 보여요. 참가자가 확인할 때는 아래 버튼으로 <b>이름만 보이는 화면</b>으로 바꿔서 한 명씩 건네주세요.
          </p>
          <button className="btn primary big" onClick={() => setCheckMode(true)}>
            🪙 토큰 확인 화면 열기
          </button>
        </section>
      )}
    </main>
  )
}

function PlayerRow({
  p,
  i,
  state,
  playing,
  offline,
  onPatch,
  onMove,
  onRemove,
}: {
  p: HostPlayer
  i: number
  state: HostState
  playing: boolean
  offline: boolean
  onPatch: (patch: Partial<HostPlayer>) => void
  onMove: (d: -1 | 1) => void
  onRemove: () => void
}) {
  const role = p.roleId ? ROLES[p.roleId] : undefined
  const [open, setOpen] = useState(false)
  const disguised = p.shownRoleId && p.shownRoleId !== p.roleId

  return (
    <li className={`player ${p.alive ? '' : 'dead'}`}>
      <div className="player-main">
        <span className="seat">{i + 1}</span>
        {!offline && <span className={`dot ${p.connected ? 'on' : ''}`} title={p.connected ? '접속 중' : '끊김'} />}
        <span className="pname">{p.name}</span>
        {role && (
          <span className={`badge ${role.team}`}>
            {role.ko}
            {disguised && ` → ${ROLES[p.shownRoleId!].ko}`}
          </span>
        )}
        {p.nominated && <span className="flag">👉 지목됨</span>}
        {!p.alive && <span className="flag skull">💀 사망</span>}
        <span className="spacer" />
        {playing && (
          <>
            <button className={`btn small ${p.alive ? '' : 'on'}`} onClick={() => onPatch({ alive: !p.alive })}>
              {p.alive ? '💀 사망' : '♻ 부활'}
            </button>
            <button className={`btn small ${p.nominated ? 'on' : ''}`} onClick={() => onPatch({ nominated: !p.nominated })}>
              👉 지목
            </button>
          </>
        )}
        <button className="btn small" onClick={() => setOpen((o) => !o)}>
          {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div className="player-more">
          <label>
            실제 직업
            <RoleSelect
              scriptId={state.scriptId}
              value={p.roleId}
              empty="(미배정)"
              onChange={(v) => onPatch({ roleId: v })}
            />
          </label>
          <label>
            본인에게 보일 직업 <span className="muted small">(주정뱅이·광인처럼 속일 때만)</span>
            <RoleSelect
              scriptId={state.scriptId}
              value={p.shownRoleId}
              empty="(실제 직업과 동일)"
              onChange={(v) => onPatch({ shownRoleId: v })}
            />
          </label>
          <label>
            개인 메시지 <span className="muted small">(밤 정보 등, 이 사람 폰에만 표시)</span>
            <textarea
              rows={2}
              value={p.message}
              placeholder="예: 3번과 5번 중 한 명이 사서입니다."
              onChange={(e) => onPatch({ message: e.target.value })}
            />
          </label>
          <div className="row">
            <button className="btn small" onClick={() => onMove(-1)} disabled={i === 0}>
              ↑ 위로
            </button>
            <button className="btn small" onClick={() => onMove(1)} disabled={i === state.players.length - 1}>
              ↓ 아래로
            </button>
            <span className="spacer" />
            <button className="btn small danger" onClick={onRemove}>
              내보내기
            </button>
          </div>
          {role && <p className="muted small">{role.ability}</p>}
        </div>
      )}
    </li>
  )
}
