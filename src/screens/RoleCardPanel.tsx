import { ROLES, TEAM_LABEL } from '../data/roles'
import type { PlayerView } from '../lib/game'

/** 내 직업 카드 + 개인 메시지 + 악 팀 정보. 온라인 플레이어 화면과 오프라인 토큰 확인이 공용으로 쓴다. */
export default function RoleCardPanel({
  view,
  shown,
  onToggle,
}: {
  view: PlayerView
  shown: boolean
  onToggle: () => void
}) {
  const role = view.me.roleId ? ROLES[view.me.roleId] : undefined
  return (
    <>
      {!view.me.alive && <div className="notice dead">💀 사망했습니다 (토론에는 계속 참여할 수 있어요)</div>}

      <section
        className={`role-card ${shown && role ? role.team : 'hidden'}`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      >
        {!shown || !role ? (
          <>
            <div className="big-emoji">🂠</div>
            <p>탭해서 내 직업 확인</p>
            <p className="muted small">주변 사람이 못 보게 조심하세요. 다시 탭하면 가려져요.</p>
          </>
        ) : (
          <>
            <div className="team-label">{TEAM_LABEL[role.team]}</div>
            <h2 className="role-name">{role.ko}</h2>
            <div className="muted small">{role.en}</div>
            <p className="ability">{role.ability}</p>
            <p className="muted small">탭하면 가려져요</p>
          </>
        )}
      </section>

      {shown && view.me.message && (
        <section className="card message">
          <h3>📩 이야기꾼의 메시지</h3>
          <p>{view.me.message}</p>
        </section>
      )}

      {shown && view.evil && (
        <section className="card evil">
          <h3>😈 악 팀 정보</h3>
          {view.evil.mates.length > 0 ? (
            <ul className="plain">
              {view.evil.mates.map((m) => (
                <li key={m.name}>
                  <b>{m.name}</b> <span className={`badge ${ROLES[m.roleId].team}`}>{ROLES[m.roleId].ko}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">동료가 없습니다.</p>
          )}
          {view.evil.bluffs.length > 0 && (
            <>
              <h3>미지정 직업 (블러프)</h3>
              <p className="muted small">이 세 직업은 이번 게임에 없는 선한 직업이에요. 연기에 활용하세요.</p>
              <ul className="bluffs">
                {view.evil.bluffs.map((b) => (
                  <li key={b} className={`badge ${ROLES[b].team}`}>
                    {ROLES[b].ko}
                    <span className="bluff-ability">{ROLES[b].ability}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  )
}
