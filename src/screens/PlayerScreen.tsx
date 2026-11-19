import { useRef, useState } from 'react'
import { ROLES, getScript, TEAM_LABEL, type Team } from '../data/roles'
import { ChatModal, CircleTable, RoleDetail, RoleIcon } from '../components'
import { useClient } from '../lib/net'
import { useWakeLock } from '../lib/useWakeLock'
import RoleCardPanel from './RoleCardPanel'

const TEAMS: Team[] = ['townsfolk', 'outsider', 'minion', 'demon']
const TABS = ['내 직업', '좌석', '직업 목록']

export default function PlayerScreen({ code, name, onExit }: { code: string; name: string; onExit: () => void }) {
  const { view, status, error, sendChat } = useClient(code, name)
  const [shown, setShown] = useState(false)
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [seen, setSeen] = useState(0) // 마지막으로 확인한 호스트 메시지 수
  const scroller = useRef<HTMLDivElement>(null)
  useWakeLock()

  const playing = !!view && view.phase !== 'lobby'
  const ended = view?.phase === 'ended'
  const hostCount = view ? view.chat.filter((m) => m.from === 'host').length : 0
  const unread = chatOpen ? 0 : Math.max(0, hostCount - seen)
  const pages = playing ? 3 : 1

  const goto = (i: number) => {
    const el = scroller.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }
  const onScroll = () => {
    const el = scroller.current
    if (el) setPage(Math.round(el.scrollLeft / el.clientWidth))
  }

  const header = (
    <header className="player-head">
      <div>
        <b>{name}</b> <span className="muted">· 방 {code}</span>
      </div>
      <span className={`pill ${status}`}>
        {status === 'online' ? '연결됨' : status === 'connecting' ? '연결 중…' : '문제 발생'}
      </span>
    </header>
  )

  if (!view) {
    return (
      <main className="page narrow">
        {header}
        {error && <p className="notice error">{error}</p>}
        <section className="card center">
          <p className="muted">{status === 'online' ? '불러오는 중…' : '호스트에 연결하는 중…'}</p>
          <button className="btn" onClick={onExit}>
            나가기
          </button>
        </section>
      </main>
    )
  }

  const timeLabel = ended
    ? '🏁 게임 종료'
    : playing
    ? `${view.time === 'night' ? '🌙' : '☀️'} ${view.day}일차 ${view.time === 'night' ? '밤' : '낮'}`
    : '⏳ 게임 시작 대기 중'
  const script = getScript(view.scriptId)

  const seatsView = (
    <>
      <CircleTable
        showRole={ended}
        seats={view.seats.map((s, i) => ({ key: String(i), name: s.name, dead: !s.alive, highlight: s.isMe, roleId: s.roleId }))}
        center={<span className="table-center-text">{timeLabel}</span>}
      />
      <p className="muted small center">{ended ? '게임이 끝나 모두의 직업이 공개됐어요 · ' : ''}회색 = 사망 · 보라색 테두리 = 나</p>
    </>
  )

  return (
    <main className="player-app">
      <div className="pa-top">
        {header}
        {error && <p className="notice error">{error}</p>}
        {playing && (
          <nav className="tabs" aria-label="화면 이동">
            {TABS.map((t, i) => (
              <button key={t} className={`tab ${page === i ? 'on' : ''}`} onClick={() => goto(i)}>
                {t}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="pager" ref={scroller} onScroll={onScroll} style={{ ['--pages' as string]: pages }}>
        {playing ? (
          <>
            <section className="pane">
              <div className="time-badge" data-time={ended ? 'lobby' : view.time}>
                {timeLabel}
              </div>
              {ended && view.winner && (
                <div className={`winner ${view.winner}`}>{view.winner === 'good' ? '😇 선한 팀 승리' : '😈 악한 팀 승리'}</div>
              )}
              <RoleCardPanel view={view} shown={shown} onToggle={() => setShown((x) => !x)} />
            </section>

            <section className="pane">
              <h3 className="pane-title">좌석 ({view.seats.length}명)</h3>
              {seatsView}
            </section>

            <section className="pane">
              <h3 className="pane-title">{script.name}</h3>
              <p className="muted small">직업을 누르면 설명을 볼 수 있어요.</p>
              {TEAMS.map((t) => {
                const list = script.roles.filter((r) => ROLES[r].team === t)
                return (
                  <div key={t}>
                    <h3 className={`grid-title ${t}`}>{TEAM_LABEL[t]}</h3>
                    <div className="role-grid">
                      {list.map((r) => (
                        <button key={r} className={`role-cell ${t}`} onClick={() => setDetail(r)}>
                          <RoleIcon id={r} size={52} />
                          <span>{ROLES[r].ko}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>
          </>
        ) : (
          <section className="pane">
            <div className="time-badge" data-time="lobby">
              {timeLabel}
            </div>
            <h3 className="pane-title">현재 참가자 ({view.seats.length}명)</h3>
            {seatsView}
          </section>
        )}
      </div>

      {playing && (
        <div className="dots" aria-hidden>
          {TABS.map((_, i) => (
            <span key={i} className={page === i ? 'on' : ''} />
          ))}
        </div>
      )}

      <div className="pa-bottom">
        <button className="btn small" onClick={onExit}>
          나가기
        </button>
      </div>

      {detail && <RoleDetail id={detail} onClose={() => setDetail(null)} />}

      <button className="fab" onClick={() => setChatOpen(true)} aria-label="이야기꾼과 대화">
        💬{unread > 0 && <span className="unread">{unread}</span>}
      </button>
      {chatOpen && (
        <ChatModal
          title="💬 이야기꾼과 대화"
          side="player"
          messages={view.chat}
          onSend={sendChat}
          onClose={() => {
            setChatOpen(false)
            setSeen(hostCount)
          }}
        />
      )}
    </main>
  )
}
