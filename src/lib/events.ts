import { ROLES } from '../data/roles'
import type { ChatMsg, GameEvent, HostPlayer, HostState, Time } from './game'

export const phaseLabel = (day: number, time: Time) => `${day}일차 ${time === 'night' ? '밤' : '낮'}`
export const phaseKey = (day: number, time: Time) => `${day}-${time}`

const CAUSE: Record<NonNullable<GameEvent['cause']>, string> = {
  execution: '처형',
  night: '밤에 사망',
  other: '사망',
}

export function describeEvent(e: GameEvent, players: HostPlayer[]): string {
  const nm = (id?: string) => players.find((p) => p.id === id)?.name ?? '(나간 플레이어)'
  const targets = e.targetIds.map(nm).join(', ')
  switch (e.kind) {
    case 'phase':
      return `${phaseLabel(e.day, e.time)} 시작`
    case 'nominate':
      return `👉 ${nm(e.actorId)} → ${targets} 지목`
    case 'ability': {
      const r = e.roleId ? ROLES[e.roleId]?.ko : ''
      return `✨ ${nm(e.actorId)}(${r}) 능력${targets ? ` → ${targets}` : ' 사용'}`
    }
    case 'death':
      return `💀 ${targets} ${CAUSE[e.cause ?? 'other']}`
    case 'revive':
      return `♻ ${targets} 부활`
  }
}

export type Step =
  | { type: 'event'; ev: GameEvent; day: number; time: Time; ts: number }
  | { type: 'chat'; msg: ChatMsg; pid: string; day: number; time: Time; ts: number }

/** 이벤트와 대화를 시간순으로 합친 재생용 단계 목록 */
export function buildSteps(state: HostState): Step[] {
  const steps: Step[] = state.events.map((ev) => ({ type: 'event', ev, day: ev.day, time: ev.time, ts: ev.ts }))
  for (const [pid, list] of Object.entries(state.chats)) {
    for (const msg of list) if (msg.day > 0) steps.push({ type: 'chat', msg, pid, day: msg.day, time: msg.time, ts: msg.ts })
  }
  return steps.sort((a, b) => a.ts - b.ts)
}
