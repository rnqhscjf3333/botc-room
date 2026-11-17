import { DISTRIBUTION, ROLES, getScript, isEvil, type Team } from '../data/roles'

export interface HostPlayer {
  id: string
  name: string
  connected: boolean
  roleId?: string // 실제 직업
  shownRoleId?: string // 본인에게 보여줄 직업 (주정뱅이/광인 등 속이는 경우)
  alive: boolean
  nominated: boolean // 오늘 지목됨
  ghostVoteUsed: boolean // 사망 후 1회 투표권 사용 여부
  message: string // 이야기꾼이 이 플레이어에게 보내는 개인 메시지
}

export interface HostState {
  code: string
  scriptId: string
  players: HostPlayer[] // 배열 순서 = 좌석 순서
  bluffs: string[] // 악마용 미지정 직업 3개
  phase: 'lobby' | 'playing'
  time: 'day' | 'night'
  day: number
  revealEvil: boolean // 악 팀 정보(동료, 블러프) 공개 여부
}

export interface SeatView {
  name: string
  alive: boolean
  nominated: boolean
  isMe: boolean
}

export interface PlayerView {
  code: string
  phase: 'lobby' | 'playing'
  time: 'day' | 'night'
  day: number
  scriptId: string
  me: { name: string; roleId: string | null; alive: boolean; ghostVoteUsed: boolean; message: string }
  seats: SeatView[]
  evil: { mates: { name: string; roleId: string }[]; bluffs: string[] } | null
}

export const newState = (code: string): HostState => ({
  code,
  scriptId: 'tb',
  players: [],
  bluffs: [],
  phase: 'lobby',
  time: 'night',
  day: 0,
  revealEvil: false,
})

const shuffle = <T,>(a: T[]): T[] => {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

const pick = (scriptId: string, team: Team, n: number) =>
  shuffle(getScript(scriptId).roles.filter((r) => ROLES[r].team === team)).slice(0, n)

/** 인원 수에 맞춰 랜덤 배정. 남작이 뽑히면 외지인 +2, 마을주민 -2 로 보정. */
export function randomAssign(state: HostState): HostState {
  const n = Math.min(15, Math.max(5, state.players.length))
  const [t, o, m, d] = DISTRIBUTION[n]
  const minions = pick(state.scriptId, 'minion', m)
  const baron = minions.includes('baron') ? 2 : 0
  const bag = [
    ...pick(state.scriptId, 'townsfolk', Math.max(0, t - baron)),
    ...pick(state.scriptId, 'outsider', o + baron),
    ...minions,
    ...pick(state.scriptId, 'demon', d),
  ]
  const shuffled = shuffle(bag)
  const players = state.players.map((p, i) => ({
    ...p,
    roleId: shuffled[i],
    shownRoleId: undefined,
    alive: true,
    nominated: false,
    ghostVoteUsed: false,
  }))
  return { ...state, players, bluffs: randomBluffs({ ...state, players }) }
}

/** 게임에 쓰이지 않은 선한 직업 중 3개를 무작위 추천 */
export function randomBluffs(state: HostState): string[] {
  const used = new Set(state.players.map((p) => p.roleId))
  const pool = getScript(state.scriptId).roles.filter(
    (r) => !used.has(r) && (ROLES[r].team === 'townsfolk' || ROLES[r].team === 'outsider'),
  )
  return shuffle(pool).slice(0, 3)
}

export function buildView(state: HostState, pid: string): PlayerView | null {
  const me = state.players.find((p) => p.id === pid)
  if (!me) return null
  const started = state.phase === 'playing'
  const myRole = me.roleId ? ROLES[me.roleId] : undefined
  let evil: PlayerView['evil'] = null
  if (started && state.revealEvil && myRole && isEvil(myRole.team)) {
    const mates = state.players
      .filter((p) => p.id !== me.id && p.roleId && isEvil(ROLES[p.roleId].team))
      .map((p) => ({ name: p.name, roleId: p.roleId! }))
    evil = { mates, bluffs: myRole.team === 'demon' ? state.bluffs.filter(Boolean) : [] }
  }
  return {
    code: state.code,
    phase: state.phase,
    time: state.time,
    day: state.day,
    scriptId: state.scriptId,
    me: {
      name: me.name,
      roleId: started ? (me.shownRoleId ?? me.roleId ?? null) : null,
      alive: me.alive,
      ghostVoteUsed: me.ghostVoteUsed,
      message: me.message,
    },
    seats: state.players.map((p) => ({
      name: p.name,
      alive: p.alive,
      nominated: p.nominated,
      isMe: p.id === pid,
    })),
    evil,
  }
}

export type ClientMsg = { t: 'hello'; pid: string; name: string }
export type HostMsg = { t: 'view'; view: PlayerView } | { t: 'rejected'; reason: string }

export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const makeCode = () =>
  Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
export const peerIdOf = (code: string) => `botc-room-${code.toUpperCase()}`
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
