import { useState } from 'react'
import { buildView, type HostState } from '../lib/game'
import RoleCardPanel from './RoleCardPanel'

/** 오프라인 토큰 확인 화면: 이름만 보이는 목록 → 본인 확인 → 직업 카드 → 가리고 돌아가기 */
export default function CheckScreen({ state, onExit }: { state: HostState; onExit: () => void }) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [current, setCurrent] = useState<string | null>(null)
  const [step, setStep] = useState<'confirm' | 'card'>('confirm')
  const [shown, setShown] = useState(true)

  const player = state.players.find((p) => p.id === current)
  // 오프라인에서는 게임 시작 전이어도 직업을 보여주고, 악 팀 정보도 함께 보여준다.
  const view = current ? buildView({ ...state, phase: 'playing', revealEvil: true }, current) : null

  const done = () => {
    if (current) setChecked((c) => new Set(c).add(current))
    setCurrent(null)
    setStep('confirm')
    setShown(true)
  }

  if (player && view) {
    return (
      <main className="page narrow">
        {step === 'confirm' ? (
          <section className="card center confirm">
            <p className="muted">이 기기를 아래 분에게 건네주세요</p>
            <h1 className="confirm-name">{player.name}</h1>
            <p className="muted small">본인이 맞고, 다른 사람이 화면을 못 볼 때만 확인하세요.</p>
            <button className="btn primary big" onClick={() => setStep('card')}>
              네, 제가 {player.name}입니다
            </button>
            <button className="btn" onClick={() => setCurrent(null)}>
              ← 취소
            </button>
          </section>
        ) : (
          <>
            <RoleCardPanel view={view} shown={shown} onToggle={() => setShown((x) => !x)} />
            <button className="btn primary big" onClick={done}>
              ✓ 확인했어요 (가리고 돌아가기)
            </button>
          </>
        )}
      </main>
    )
  }

  return (
    <main className="page narrow">
      <h2>🪙 내 이름을 눌러 직업을 확인하세요</h2>
      <p className="muted small">
        {checked.size}/{state.players.length}명 확인 완료 · 한 번에 한 명씩, 다른 사람이 못 보게 해주세요.
      </p>
      <div className="name-grid">
        {state.players.map((p) => (
          <button key={p.id} className={`btn name-btn ${checked.has(p.id) ? 'on' : ''}`} onClick={() => setCurrent(p.id)}>
            {checked.has(p.id) && '✓ '}
            {p.name}
          </button>
        ))}
      </div>
      <button className="btn small" onClick={onExit}>
        이야기꾼 화면으로 돌아가기
      </button>
    </main>
  )
}
