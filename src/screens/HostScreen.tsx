import { useEffect, useState } from 'react'
import { ROLES, TEAM_LABEL, abilityTargets, getScript } from '../data/roles'
import { ChatModal, CircleTable, Modal, RoleGrid, RoleIcon, ScriptPicker, type TableArrow } from '../components'
import { describeEvent, phaseLabel } from '../lib/events'
import {
  addEvent,
  randomAssign,
  randomBluffs,
  uid,
  type ChatMsg,
  type GameEvent,
  type HostPlayer,
  type HostState,
} from '../lib/game'
import { clearSavedOffline, clearSavedRoom, useHost, useOfflineHost, type NetStatus } from '../lib/net'
import { useWakeLock } from '../lib/useWakeLock'
import CheckScreen from './CheckScreen'
import ReplayScreen from './ReplayScreen'

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

/** 대상 선택 중인 행동 (지목 / 직업 능력) */
interface Pending {
  kind: 'nominate' | 'ability'
  actorId: string
  roleId?: string
  need: number
  picks: string[]
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
  const [selected, setSelected] = useState<string | null>(null) // 편집 모달
  const [sheetId, setSheetId] = useState<string | null>(null) // 행동 선택 시트
  const [chatId, setChatId] = useState<string | null>(null)
  const [bluffSlot, setBluffSlot] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [endOpen, setEndOpen] = useState(false)
  const [replayOpen, setReplayOpen] = useState(false)
  useWakeLock()

  // 대화창이 열려 있는 동안 도착한 메시지는 바로 읽은 것으로 처리
  const chatUnread = chatId && state ? state.unread[chatId] ?? 0 : 0
  useEffect(() => {
    if (chatId && chatUnread > 0) update((s) => ({ ...s, unread: { ...s.unread, [chatId]: 0 } }))
  }, [chatId, chatUnread, update])

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
  const ended = state.phase === 'ended'
  const nameOf = (id?: string) => state.players.find((p) => p.id === id)?.name ?? ''

  // ───── 상태 변경 ─────
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
    setSheetId(null)
    update((s) => ({ ...s, players: s.players.filter((x) => x.id !== p.id) }))
  }
  const setAlive = (id: string, alive: boolean, cause?: GameEvent['cause']) =>
    update((s) => {
      const next = {
        ...s,
        players: s.players.map((p) => (p.id === id ? { ...p, alive, ghostVoteUsed: alive ? false : p.ghostVoteUsed } : p)),
      }
      if (s.phase !== 'playing') return next
      return addEvent(next, alive ? { kind: 'revive', targetIds: [id] } : { kind: 'death', targetIds: [id], cause: cause ?? 'other' })
    })
  const toggleTime = () => {
    setPending(null)
    update((s) => {
      const next: HostState =
        s.time === 'night'
          ? { ...s, time: 'day' }
          : { ...s, time: 'night', day: s.day + 1, players: s.players.map((p) => ({ ...p, nominated: false })) }
      return addEvent(next, { kind: 'phase' })
    })
  }
  const startGame = () =>
    update((s) =>
      addEvent({ ...s, phase: 'playing', time: 'night', day: 1, revealEvil: false, events: [], chats: {}, unread: {}, winner: undefined }, { kind: 'phase' }),
    )
  const resetToLobby = () =>
    update((s) => ({
      ...s,
      phase: 'lobby',
      revealEvil: false,
      day: 0,
      time: 'night',
      events: [],
      chats: {},
      unread: {},
      winner: undefined,
      players: s.players.map((p) => ({ ...p, alive: true, nominated: false, ghostVoteUsed: false, message: '' })),
    }))
  const backToLobby = () => {
    if (!confirm('게임을 종료하고 로비로 돌아갈까요? (직업 배정은 유지되지만 이번 게임의 기록과 대화는 삭제됩니다)')) return
    setPending(null)
    setReplayOpen(false)
    resetToLobby()
  }
  const endGame = (winner: 'good' | 'evil') => {
    setEndOpen(false)
    setPending(null)
    update((s) => ({ ...s, phase: 'ended', winner }))
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

  // ───── 행동(지목/능력) ─────
  const startAction = (kind: Pending['kind'], actorId: string, roleId?: string) => {
    setSheetId(null)
    const need = kind === 'nominate' ? 1 : abilityTargets(roleId ?? '')
    if (need === 0) {
      update((s) => addEvent(s, { kind, actorId, roleId, targetIds: [] }))
      return
    }
    setPending({ kind, actorId, roleId, need, picks: [] })
  }
  const pickTarget = (targetId: string) => {
    if (!pending || pending.picks.includes(targetId)) return
    const picks = [...pending.picks, targetId]
    if (picks.length < pending.need) {
      setPending({ ...pending, picks })
      return
    }
    const { kind, actorId, roleId } = pending
    update((s) => {
      let next = s
      if (kind === 'nominate') {
        next = { ...s, players: s.players.map((p) => (p.id === targetId ? { ...p, nominated: true } : p)) }
      }
      return addEvent(next, { kind, actorId, roleId, targetIds: picks })
    })
    setPending(null)
  }
  const patchEvent = (id: string, patch: Partial<GameEvent>) =>
    update((s) => ({ ...s, events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
  const removeEvent = (id: string) => update((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }))

  // ───── 대화 ─────
  const sendChat = (pid: string, text: string) =>
    update((s) => {
      const msg: ChatMsg = { id: uid(), from: 'host', text, day: s.day, time: s.time, ts: Date.now() }
      return { ...s, chats: { ...s.chats, [pid]: [...(s.chats[pid] ?? []), msg] } }
    })
  const openChat = (pid: string) => {
    setSheetId(null)
    setChatId(pid)
    update((s) => ({ ...s, unread: { ...s.unread, [pid]: 0 } }))
  }

  if (checkMode) return <CheckScreen state={state} onExit={() => setCheckMode(false)} />
  if (ended) return <ReplayScreen state={state} onNewGame={resetToLobby} />
  if (replayOpen) return <ReplayScreen state={state} onClose={() => setReplayOpen(false)} />

  const allAssigned = state.players.length > 0 && state.players.every((p) => p.roleId)
  const enough = state.players.length >= 5
  const usedRoles = new Set(state.players.map((p) => p.roleId).filter(Boolean) as string[])
  const editing = state.players.find((p) => p.id === selected)
  const sheet = state.players.find((p) => p.id === sheetId)
  const chatPlayer = state.players.find((p) => p.id === chatId)
  const timeLabel = playing ? `${state.time === 'night' ? '🌙' : '☀️'} ${phaseLabel(state.day, state.time)}` : '대기 중'

  // 이번 낮/밤의 이벤트 → 화살표
  const phaseEvents = playing ? state.events.filter((e) => e.day === state.day && e.time === state.time) : []
  const lastEvent = phaseEvents[phaseEvents.length - 1]
  const arrows: TableArrow[] = phaseEvents
    .filter((e) => e.kind !== 'phase')
    .flatMap((e) =>
      e.targetIds.map((t) => ({
        id: e.id + t,
        from: e.kind === 'death' || e.kind === 'revive' ? undefined : e.actorId,
        to: t,
        kind: e.kind as TableArrow['kind'],
        roleId: e.roleId,
        hot: e === lastEvent,
      })),
    )

  const pendingLabel = pending
    ? pending.kind === 'nominate'
      ? '지목'
      : `${ROLES[pending.roleId ?? '']?.ko ?? ''} 능력`
    : ''

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
              좌석{' '}
              <span className="muted small">
                {playing ? '· 눌러서 행동 선택 · 드래그해서 자리 바꾸기' : '· 드래그해서 자리 바꾸기 · 눌러서 편집'}
              </span>
            </h2>

            {pending && (
              <div className="pending">
                <span>
                  <b>{nameOf(pending.actorId)}</b>의 <b>{pendingLabel}</b> — 대상을 선택하세요 ({pending.picks.length}/{pending.need})
                </span>
                <span className="spacer" />
                <button className="btn small" onClick={() => setPending(null)}>
                  취소
                </button>
              </div>
            )}

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
                arrows={arrows}
                seats={state.players.map((p) => ({
                  key: p.id,
                  name: p.name,
                  dead: !p.alive,
                  roleId: p.roleId,
                  badge: (
                    <>
                      {p.nominated && '👉'}
                      {!p.alive && (p.ghostVoteUsed ? '🚫' : '🗳')}
                      {(state.unread[p.id] ?? 0) > 0 && '💬'}
                    </>
                  ),
                  highlight: !offline && !p.connected,
                  cls: pending ? (pending.actorId === p.id ? 'actor targetable' : pending.picks.includes(p.id) ? 'picked' : 'targetable') : '',
                }))}
                center={<span className="table-center-text">{timeLabel}</span>}
                onSelect={(i) => {
                  const p = state.players[i]
                  if (pending) pickTarget(p.id)
                  else if (playing) setSheetId(p.id)
                  else setSelected(p.id)
                }}
                onSwap={pending ? undefined : swap}
              />
            )}
            {playing && (
              <div className="legend">
                <span><i style={{ borderColor: '#ff9f43', borderTopStyle: 'dashed' }} />지목</span>
                <span><i style={{ borderColor: '#9b95fa' }} />능력</span>
                <span>💀 사망 · 👉 지목됨 · 🗳 유령 투표권 · 🚫 사용함{!offline && ' · 💬 새 메시지'}</span>
              </div>
            )}
            {!offline && <p className="muted small">보라색 테두리 = 접속 끊김</p>}
          </section>
        </div>

        <aside className="host-side">
          {playing ? (
            <>
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
                <button className="btn" onClick={() => setReplayOpen(true)}>
                  📜 기록
                </button>
                <button className="btn" onClick={() => setEndOpen(true)}>
                  🏁 게임 종료
                </button>
                <button className="btn" onClick={backToLobby}>
                  ⏹ 로비로
                </button>
              </section>

              <section className="card">
                <h2>이번 {state.time === 'night' ? '밤' : '낮'} 기록</h2>
                <p className="muted small">플레이어를 눌러 지목·능력을 기록하면 화살표로 표시돼요.</p>
                <ul className="events">
                  {phaseEvents.map((e) => (
                    <EventRow
                      key={e.id}
                      e={e}
                      players={state.players}
                      onNote={(text) => patchEvent(e.id, { text })}
                      onRemove={() => removeEvent(e.id)}
                    />
                  ))}
                </ul>
              </section>
            </>
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
                <button className="btn primary big" disabled={!allAssigned} onClick={startGame}>
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

      {/* 플레이어를 눌렀을 때 나오는 행동 선택 시트 */}
      {sheet && playing && (
        <ActionSheet
          p={sheet}
          state={state}
          offline={offline}
          onClose={() => setSheetId(null)}
          onNominate={() => startAction('nominate', sheet.id)}
          onAbility={(roleId) => startAction('ability', sheet.id, roleId)}
          onChat={() => openChat(sheet.id)}
          onEdit={() => {
            setSheetId(null)
            setSelected(sheet.id)
          }}
        />
      )}

      {editing && (
        <PlayerModal
          key={editing.id}
          p={editing}
          state={state}
          offline={offline}
          playing={playing}
          onPatch={(patch) => patchPlayer(editing.id, patch)}
          onSetAlive={(alive, cause) => setAlive(editing.id, alive, cause)}
          onRemove={() => remove(editing)}
          onClose={() => setSelected(null)}
        />
      )}

      {chatPlayer && (
        <ChatModal
          title={`💬 ${chatPlayer.name}`}
          side="host"
          messages={state.chats[chatPlayer.id] ?? []}
          onSend={(text) => sendChat(chatPlayer.id, text)}
          onClose={() => {
            setChatId(null)
            update((s) => ({ ...s, unread: { ...s.unread, [chatPlayer.id]: 0 } }))
          }}
        />
      )}

      {endOpen && (
        <Modal title="🏁 게임 종료" onClose={() => setEndOpen(false)}>
          <p className="muted">어느 팀이 이겼나요? 종료하면 기록 재현 화면이 열리고, 플레이어에게는 모두의 직업이 공개돼요.</p>
          <button className="btn big" onClick={() => endGame('good')}>
            😇 선한 팀 승리
          </button>
          <button className="btn big" onClick={() => endGame('evil')}>
            😈 악한 팀 승리
          </button>
        </Modal>
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

function EventRow({
  e,
  players,
  onNote,
  onRemove,
}: {
  e: GameEvent
  players: HostPlayer[]
  onNote: (text: string) => void
  onRemove: () => void
}) {
  const [draft, setDraft] = useState(e.text ?? '')
  const noteable = e.kind === 'nominate' || e.kind === 'ability' || e.kind === 'death'
  return (
    <li className={`ev ${e.kind}`}>
      <div className="ev-main">
        <span>{describeEvent(e, players)}</span>
        {e.kind !== 'phase' && (
          <button className="x" onClick={onRemove} title="기록 삭제 (사망/부활 상태는 되돌려지지 않아요)" aria-label="기록 삭제">
            ✕
          </button>
        )}
      </div>
      {noteable && (
        <input
          value={draft}
          placeholder="결과 메모 (예: 악마 없음)"
          onChange={(ev) => setDraft(ev.target.value)}
          onBlur={() => draft !== (e.text ?? '') && onNote(draft)}
        />
      )}
    </li>
  )
}

function ActionSheet({
  p,
  state,
  offline,
  onClose,
  onNominate,
  onAbility,
  onChat,
  onEdit,
}: {
  p: HostPlayer
  state: HostState
  offline: boolean
  onClose: () => void
  onNominate: () => void
  onAbility: (roleId: string) => void
  onChat: () => void
  onEdit: () => void
}) {
  const abilityRole = p.shownRoleId ?? p.roleId
  const role = abilityRole ? ROLES[abilityRole] : undefined
  const unread = state.unread[p.id] ?? 0
  const targets = role ? abilityTargets(role.id) : 0
  return (
    <Modal onClose={onClose} title={p.name}>
      <div className="sheet-head">
        {p.roleId && <RoleIcon id={p.roleId} size={52} />}
        <div>
          <b>{p.roleId ? ROLES[p.roleId].ko : '직업 미배정'}</b>
          {!p.alive && <span className="flag skull"> 💀 사망</span>}
          <div className="muted small">{p.roleId ? TEAM_LABEL[ROLES[p.roleId].team] : ''}</div>
        </div>
      </div>
      <div className="sheet-actions">
        {state.time === 'day' && (
          <button className="btn" onClick={onNominate}>
            <span>👉</span>
            <span>
              지목하기
              <small>이 플레이어가 누군가를 지목 → 대상 플레이어를 누르세요</small>
            </span>
          </button>
        )}
        {role && (
          <button className="btn" onClick={() => onAbility(role.id)}>
            <RoleIcon id={role.id} size={36} />
            <span>
              {role.ko} 능력 사용
              <small>{targets === 0 ? '대상 지정 없이 기록' : `대상 ${targets}명을 선택`} · {role.ability.slice(0, 40)}…</small>
            </span>
          </button>
        )}
        {!offline && (
          <button className="btn" onClick={onChat}>
            <span>💬</span>
            <span>
              대화하기{unread > 0 && <span className="unread">{unread}</span>}
              <small>이 플레이어에게 메시지 보내기 / 받은 메시지 보기</small>
            </span>
          </button>
        )}
        <button className="btn" onClick={onEdit}>
          <span>✏️</span>
          <span>
            직업·상태 편집
            <small>직업 변경, 사망/부활, 유령 투표권</small>
          </span>
        </button>
      </div>
    </Modal>
  )
}

function PlayerModal({
  p,
  state,
  offline,
  playing,
  onPatch,
  onSetAlive,
  onRemove,
  onClose,
}: {
  p: HostPlayer
  state: HostState
  offline: boolean
  playing: boolean
  onPatch: (patch: Partial<HostPlayer>) => void
  onSetAlive: (alive: boolean, cause?: GameEvent['cause']) => void
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
          {p.alive ? (
            <>
              <button className="btn" onClick={() => onSetAlive(false, 'execution')}>⚖ 처형으로 사망</button>
              <button className="btn" onClick={() => onSetAlive(false, 'night')}>🌙 밤에 사망</button>
              <button className="btn" onClick={() => onSetAlive(false, 'other')}>💀 기타 사망</button>
            </>
          ) : (
            <>
              <button className="btn on" onClick={() => onSetAlive(true)}>♻ 부활 처리</button>
              <label className="check">
                <input type="checkbox" checked={p.ghostVoteUsed} onChange={(e) => onPatch({ ghostVoteUsed: e.target.checked })} />
                유령 투표권 사용함
              </label>
            </>
          )}
          {playing && (
            <button className={`btn ${p.nominated ? 'on' : ''}`} onClick={() => onPatch({ nominated: !p.nominated })}>
              👉 {p.nominated ? '지목됨' : '지목됨으로 표시'}
            </button>
          )}
        </div>

        {offline && (
          <label>
            개인 메시지 <span className="muted small">(토큰 확인 때 이 사람에게 보여줄 정보)</span>
            <textarea
              rows={2}
              value={p.message}
              placeholder="예: 3번과 5번 중 한 명이 세탁부입니다."
              onChange={(e) => onPatch({ message: e.target.value })}
            />
          </label>
        )}

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
