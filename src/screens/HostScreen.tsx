import { useState } from 'react'
import { ROLES, TEAM_LABEL, getScript } from '../data/roles'
import { CircleTable, Modal, RoleGrid, RoleIcon, ScriptPicker } from '../components'
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
  const [selected, setSelected] = useState<string | null>(null) // 편집 중인 플레이어 id
  const [bluffSlot, setBluffSlot] = useState<number | null>(null)
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
  const swap = (a: number, b: number) =>
    update((s) => {
      const players = [...s.players]
      ;[players[a], players[b]] = [players[b], players[a]]
      return { ...s, players }
    })
  const remove = (p: HostPlayer) => {
    if (!confirm(`${p.name} 님을 내보낼까요?`)) return
    kick(p.id)
    setSelected(null)
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
      players: s.players.map((p) => ({ ...p, alive: true, nominated: false, ghostVoteUsed: false, message: '' })),
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
      players: [...s.players, { id: uid(), name, connected: true, alive: true, nominated: false, ghostVoteUsed: false, message: '' }],
    }))
    setNewName('')
  }

  if (checkMode) return <CheckScreen state={state} onExit={() => setCheckMode(false)} />

  const allAssigned = state.players.length > 0 && state.players.every((p) => p.roleId)
  const enough = state.players.length >= 5
  const usedRoles = new Set(state.players.map((p) => p.roleId).filter(Boolean) as string[])
  const editing = state.players.find((p) => p.id === selected)

  const timeLabel = playing ? `${state.time === 'night' ? '🌙' : '☀️'} ${state.day}일차 ${state.time === 'night' ? '밤' : '낮'}` : '대기 중'

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

      <div className="host-layout">
        <div className="host-main">
          <section className="card">
            <h2>
              좌석 <span className="muted small">· 드래그해서 자리 바꾸기 · 눌러서 편집</span>
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
            {state.players.length === 0 ? (
              <p className="muted">
                {offline ? (
                  '위에서 참가자 이름을 한 명씩 추가하세요.'
                ) : (
                  <>
                    아직 아무도 없어요. 친구들이 <b>{state.code}</b> 코드로 입장하면 여기에 나타나요.
                  </>
                )}
              </p>
            ) : (
              <CircleTable
                showRole
                seats={state.players.map((p) => ({
                  key: p.id,
                  name: p.name,
                  dead: !p.alive,
                  roleId: p.roleId,
                  badge: (
                    <>
                      {p.nominated && '👉'}
                      {!p.alive && (p.ghostVoteUsed ? '🚫' : '🗳')}
                    </>
                  ),
                  highlight: !offline && !p.connected,
                }))}
                center={<span className="table-center-text">{timeLabel}</span>}
                onSelect={(i) => setSelected(state.players[i].id)}
                onSwap={swap}
              />
            )}
            <p className="muted small">
              {[
                playing && state.players.length > 0 && '👉 지목됨 · 🗳 유령 투표권 남음 · 🚫 유령 투표권 사용',
                !offline && '보라색 테두리 = 접속 끊김',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </section>
        </div>

        <aside className="host-side">
          {playing ? (
            <section className="card controls">
              <div className="time-badge" data-time={state.time}>
                {timeLabel}
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
            <>
              <section className="card">
                <h2>1. 시나리오</h2>
                <ScriptPicker
                  value={state.scriptId}
                  onChange={(id) =>
                    update((s) => ({
                      ...s,
                      scriptId: id,
                      bluffs: [],
                      players: s.players.map((p) => ({ ...p, roleId: undefined, shownRoleId: undefined })),
                    }))
                  }
                />
              </section>

              <section className="card">
                <h2>2. 직업 배정</h2>
                <p className="muted small">
                  {state.players.length}명{offline ? ' 추가됨' : ' 접속 중'}
                  {!enough && ' · 5명 이상부터 자동 배정할 수 있어요'}. 자동 배정 후 토큰을 눌러 직업을 바꿀 수 있어요.
                </p>
                <button className="btn primary" disabled={!enough} onClick={() => update((s) => randomAssign(s))}>
                  🎲 {allAssigned ? '다시 ' : ''}자동 배정
                </button>
                <h3>악마의 블러프 (미지정 직업 3개)</h3>
                <div className="bluff-slots">
                  {[0, 1, 2].map((i) => {
                    const id = state.bluffs[i]
                    return (
                      <button key={i} className={`slot ${id ? ROLES[id].team : ''}`} onClick={() => setBluffSlot(i)}>
                        {id ? (
                          <>
                            <RoleIcon id={id} size={44} />
                            <span>{ROLES[id].ko}</span>
                          </>
                        ) : (
                          <span className="slot-empty">＋</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <button className="btn small" onClick={() => update((s) => ({ ...s, bluffs: randomBluffs(s) }))}>
                  🎲 블러프 랜덤
                </button>
              </section>

              <section className="card">
                <h2>3. 시작</h2>
                <button
                  className="btn primary big"
                  disabled={!allAssigned}
                  onClick={() => update((s) => ({ ...s, phase: 'playing', time: 'night', day: 1, revealEvil: false }))}
                >
                  ▶ 게임 시작
                </button>
                {!allAssigned && <p className="muted small">모든 플레이어에게 직업을 배정해야 시작할 수 있어요.</p>}
              </section>
            </>
          )}

          {offline && allAssigned && (
            <section className="card">
              <h2>{playing ? '토큰 다시 확인' : '토큰 확인'}</h2>
              <p className="muted small">
                이 화면에는 모두의 직업이 보여요. 참가자가 확인할 때는 <b>이름만 보이는 화면</b>으로 바꿔서 한 명씩 건네주세요.
              </p>
              <button className="btn primary big" onClick={() => setCheckMode(true)}>
                🪙 토큰 확인 화면 열기
              </button>
            </section>
          )}
        </aside>
      </div>

      {editing && (
        <PlayerModal
          key={editing.id}
          p={editing}
          state={state}
          offline={offline}
          playing={playing}
          onPatch={(patch) => patchPlayer(editing.id, patch)}
          onRemove={() => remove(editing)}
          onClose={() => setSelected(null)}
        />
      )}

      {bluffSlot !== null && (
        <Modal title={`블러프 ${bluffSlot + 1} 선택`} wide onClose={() => setBluffSlot(null)}>
          <p className="muted small">이미 배정된 직업은 선택할 수 없어요.</p>
          <RoleGrid
            scriptId={state.scriptId}
            selected={state.bluffs[bluffSlot]}
            disabledIds={usedRoles}
            onPick={(id) => {
              const i = bluffSlot
              update((s) => {
                const b = [...s.bluffs]
                b[i] = id
                return { ...s, bluffs: b }
              })
              setBluffSlot(null)
            }}
          />
        </Modal>
      )}
    </main>
  )
}

function PlayerModal({
  p,
  state,
  offline,
  playing,
  onPatch,
  onRemove,
  onClose,
}: {
  p: HostPlayer
  state: HostState
  offline: boolean
  playing: boolean
  onPatch: (patch: Partial<HostPlayer>) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'role' | 'shown'>('role')
  const role = p.roleId ? ROLES[p.roleId] : undefined
  const script = getScript(state.scriptId)

  return (
    <Modal wide onClose={onClose} title={<>{p.name}{!offline && <span className={`dot inline ${p.connected ? 'on' : ''}`} />}</>}>
      <div className="pm">
        <div className="pm-cur">
          {role ? (
            <>
              <RoleIcon id={role.id} size={56} />
              <div>
                <div>
                  <b>{role.ko}</b> <span className={`badge ${role.team}`}>{TEAM_LABEL[role.team]}</span>
                </div>
                <div className="muted small">{role.ability}</div>
              </div>
            </>
          ) : (
            <span className="muted">직업 미배정 — 아래에서 선택하세요</span>
          )}
        </div>

        <div className="pm-flags">
          <button className={`btn ${p.alive ? '' : 'on'}`} onClick={() => onPatch(p.alive ? { alive: false } : { alive: true, ghostVoteUsed: false })}>
            {p.alive ? '💀 사망 처리' : '♻ 부활 처리'}
          </button>
          {!p.alive && (
            <label className="check">
              <input type="checkbox" checked={p.ghostVoteUsed} onChange={(e) => onPatch({ ghostVoteUsed: e.target.checked })} />
              유령 투표권 사용함
            </label>
          )}
          {playing && (
            <button className={`btn ${p.nominated ? 'on' : ''}`} onClick={() => onPatch({ nominated: !p.nominated })}>
              👉 {p.nominated ? '지목됨' : '지목 표시'}
            </button>
          )}
        </div>

        <label>
          개인 메시지 <span className="muted small">(밤 정보 등, 이 사람 화면에만 표시)</span>
          <textarea
            rows={2}
            value={p.message}
            placeholder="예: 3번과 5번 중 한 명이 세탁부입니다."
            onChange={(e) => onPatch({ message: e.target.value })}
          />
        </label>

        <div className="pm-tabs">
          <button className={`tab ${tab === 'role' ? 'on' : ''}`} onClick={() => setTab('role')}>
            실제 직업
          </button>
          <button className={`tab ${tab === 'shown' ? 'on' : ''}`} onClick={() => setTab('shown')}>
            본인에게 보일 직업{p.shownRoleId && p.shownRoleId !== p.roleId ? ' ✱' : ''}
          </button>
        </div>
        {tab === 'role' ? (
          <RoleGrid scriptId={script.id} selected={p.roleId} onPick={(id) => onPatch({ roleId: id })} />
        ) : (
          <>
            <p className="muted small">주정뱅이·광인처럼 본인이 다른 직업으로 알고 있어야 할 때만 지정하세요.</p>
            <button className="btn small" onClick={() => onPatch({ shownRoleId: undefined })} disabled={!p.shownRoleId}>
              실제 직업과 동일하게
            </button>
            <RoleGrid scriptId={script.id} selected={p.shownRoleId} onPick={(id) => onPatch({ shownRoleId: id })} />
          </>
        )}

        <div className="row">
          <span className="spacer" />
          <button className="btn small danger" onClick={onRemove}>
            내보내기
          </button>
          <button className="btn primary" onClick={onClose}>
            완료
          </button>
        </div>
      </div>
    </Modal>
  )
}
