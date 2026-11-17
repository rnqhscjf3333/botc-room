import { useState } from 'react'
import { clearSavedOffline, clearSavedRoom, hasSavedOffline, hasSavedRoom } from '../lib/net'

interface Props {
  lastJoin: { code: string; name: string } | null
  onHost: (resume: boolean, offline: boolean) => void
  onJoin: (code: string, name: string) => void
}

export default function Home({ lastJoin, onHost, onJoin }: Props) {
  const urlCode = new URLSearchParams(location.hash.replace(/^#/, '')).get('join') ?? ''
  const [code, setCode] = useState((urlCode || lastJoin?.code || '').toUpperCase())
  const [name, setName] = useState(lastJoin?.name ?? '')
  const saved = hasSavedRoom()
  const savedOffline = hasSavedOffline()

  const canJoin = code.trim().length === 4 && name.trim().length > 0

  return (
    <main className="page narrow">
      <h1 className="title">
        <span className="drop">🩸</span> 시계탑에 흐른 피
        <small>파티룸 도우미</small>
      </h1>

      <section className="card">
        <h2>방 들어가기</h2>
        <label>
          방 코드
          <input
            className="code-input"
            value={code}
            maxLength={4}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ABCD"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </label>
        <label>
          이름
          <input value={name} maxLength={12} placeholder="닉네임" onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn primary" disabled={!canJoin} onClick={() => onJoin(code.trim(), name.trim())}>
          입장
        </button>
      </section>

      <section className="card">
        <h2>이야기꾼(호스트)</h2>
        <p className="muted">노트북/태블릿에서 방을 만들면 4자리 코드가 나와요. 친구들은 폰으로 코드를 입력하면 돼요.</p>
        {saved && (
          <button className="btn" onClick={() => onHost(true, false)}>
            ▶ 이전 방 이어하기
          </button>
        )}
        <button
          className="btn primary"
          onClick={() => {
            if (saved) clearSavedRoom()
            onHost(false, false)
          }}
        >
          새 방 만들기
        </button>
      </section>

      <section className="card">
        <h2>📴 오프라인 모드</h2>
        <p className="muted">
          인터넷·연결 없이 이 기기 하나로 진행해요. 이름을 직접 추가하고 직업을 배정한 뒤, 참가자가 돌아가며 이 기기에서 자기 토큰을 확인합니다.
        </p>
        {savedOffline && (
          <button className="btn" onClick={() => onHost(true, true)}>
            ▶ 이전 게임 이어하기
          </button>
        )}
        <button
          className="btn"
          onClick={() => {
            if (savedOffline && !confirm('저장된 오프라인 게임이 지워져요. 새로 시작할까요?')) return
            clearSavedOffline()
            onHost(false, true)
          }}
        >
          오프라인으로 새 게임
        </button>
      </section>
    </main>
  )
}
