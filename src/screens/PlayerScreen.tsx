import { useState } from 'react'
import { ROLES, getScript } from '../data/roles'
import RoleCardPanel from './RoleCardPanel'
import { useClient } from '../lib/net'
import { useWakeLock } from '../lib/useWakeLock'

export default function PlayerScreen({ code, name, onExit }: { code: string; name: string; onExit: () => void }) {
  const { view, status, error } = useClient(code, name)
  const [shown, setShown] = useState(false)
  useWakeLock()

  return (
    <main className="page narrow">
      <header className="player-head">
        <div>
          <b>{name}</b> <span className="muted">· 방 {code}</span>
        </div>
        <span className={`pill ${status}`}>
          {status === 'online' ? '연결됨' : status === 'connecting' ? '연결 중…' : '문제 발생'}
        </span>
      </header>

      {error && <p className="notice error">{error}</p>}

      {!view ? (
        <section className="card center">
          <p className="muted">{status === 'online' ? '불러오는 중…' : '호스트에 연결하는 중…'}</p>
          <button className="btn" onClick={onExit}>
            나가기
          </button>
        </section>
      ) : (
        <>
          <div className="time-badge" data-time={view.phase === 'playing' ? view.time : 'lobby'}>
            {view.phase !== 'playing'
              ? '⏳ 게임 시작 대기 중'
              : `${view.time === 'night' ? '🌙' : '☀️'} ${view.day}일차 ${view.time === 'night' ? '밤' : '낮'}`}
          </div>

          {view.phase === 'playing' && (
            <>
              <RoleCardPanel view={view} shown={shown} onToggle={() => setShown((x) => !x)} />
            </>
          )}

          <section className="card">
            <h3>좌석 ({view.seats.length}명)</h3>
            <ol className="seats">
              {view.seats.map((s, i) => (
                <li key={i} className={`${s.alive ? '' : 'dead'} ${s.isMe ? 'me' : ''}`}>
                  <span className="seat">{i + 1}</span>
                  <span className="pname">{s.name}</span>
                  {s.isMe && <span className="muted small">(나)</span>}
                  {s.nominated && <span className="flag">👉 지목됨</span>}
                  {!s.alive && <span className="flag skull">💀</span>}
                </li>
              ))}
            </ol>
          </section>

          {view.phase === 'playing' && (
            <details className="card">
              <summary>시나리오 직업 목록 · {getScript(view.scriptId).name}</summary>
              <ul className="plain scriptlist">
                {getScript(view.scriptId).roles.map((r) => (
                  <li key={r}>
                    <span className={`badge ${ROLES[r].team}`}>{ROLES[r].ko}</span>
                    <span className="muted small">{ROLES[r].ability}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button className="btn small" onClick={onExit}>
            나가기
          </button>
        </>
      )}
    </main>
  )
}
