import Peer, { type DataConnection } from 'peerjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildView,
  makeCode,
  newState,
  normalize,
  peerIdOf,
  uid,
  type ChatMsg,
  type ClientMsg,
  type HostMsg,
  type HostState,
  type PlayerView,
} from './game'

const HOST_KEY = 'botc_host_state'
const CLIENT_KEY = 'botc_client'

const load = <T,>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

export const hasSavedRoom = () => load<HostState>(HOST_KEY) !== null
export const clearSavedRoom = () => localStorage.removeItem(HOST_KEY)
export const savedClient = () => load<{ code: string; name: string }>(CLIENT_KEY)

const OFFLINE_KEY = 'botc_offline_state'
export const hasSavedOffline = () => load<HostState>(OFFLINE_KEY) !== null
export const clearSavedOffline = () => localStorage.removeItem(OFFLINE_KEY)

export type NetStatus = 'connecting' | 'online' | 'offline' | 'error'

/** 호스트(이야기꾼) 측: 상태를 들고 있고, 접속한 각 플레이어에게 "본인 몫"만 보낸다. */
export function useHost(resume: boolean) {
  const [state, setState] = useState<HostState | null>(() => {
    const saved = resume ? load<HostState>(HOST_KEY) : null
    return saved ? normalize(saved) : null
  })
  const [status, setStatus] = useState<NetStatus>('connecting')
  const [error, setError] = useState('')
  const stateRef = useRef<HostState | null>(state)
  const conns = useRef(new Map<string, DataConnection>())

  const send = useCallback((pid: string) => {
    const s = stateRef.current
    const c = conns.current.get(pid)
    if (!s || !c || !c.open) return
    const view = buildView(s, pid)
    if (view) c.send({ t: 'view', view } satisfies HostMsg)
  }, [])

  const commit = useCallback(
    (next: HostState) => {
      stateRef.current = next
      setState(next)
      save(HOST_KEY, next)
      next.players.forEach((p) => send(p.id))
    },
    [send],
  )

  const update = useCallback(
    (fn: (s: HostState) => HostState) => {
      if (stateRef.current) commit(fn(stateRef.current))
    },
    [commit],
  )

  const setConnected = useCallback(
    (pid: string, connected: boolean) => {
      const s = stateRef.current
      if (!s) return
      commit({ ...s, players: s.players.map((p) => (p.id === pid ? { ...p, connected } : p)) })
    },
    [commit],
  )

  useEffect(() => {
    let peer: Peer | null = null
    let cancelled = false
    let attempts = 0
    const connMap = conns.current

    const handleConn = (conn: DataConnection) => {
      let pid: string | null = null
      conn.on('data', (raw) => {
        const msg = raw as ClientMsg
        const s = stateRef.current
        if (!s) return
        if (msg.t === 'chat') {
          const text = String(msg.text ?? '').trim().slice(0, 300)
          if (!pid || !text) return
          const from = pid
          const chat: ChatMsg = { id: uid(), from: 'player', text, day: s.day, time: s.time, ts: Date.now() }
          commit({
            ...s,
            chats: { ...s.chats, [from]: [...(s.chats[from] ?? []), chat] },
            unread: { ...s.unread, [from]: (s.unread[from] ?? 0) + 1 },
          })
          return
        }
        if (msg.t !== 'hello') return
        // pid로 먼저 찾고, 없으면(브라우저를 닫았다 다시 연 경우) 같은 이름의 끊긴 플레이어로 복구
        const existing =
          s.players.find((p) => p.id === msg.pid) ??
          s.players.find((p) => !p.connected && p.name === msg.name.trim().slice(0, 12))
        if (!existing && s.phase !== 'lobby') {
          conn.send({ t: 'rejected', reason: '이미 게임이 시작되었어요.' } satisfies HostMsg)
          return
        }
        pid = existing?.id ?? msg.pid
        connMap.get(pid)?.close()
        connMap.set(pid, conn)
        if (existing) {
          commit({
            ...s,
            players: s.players.map((p) => (p.id === pid ? { ...p, connected: true } : p)),
          })
        } else {
          commit({
            ...s,
            players: [
              ...s.players,
              { id: pid, name: msg.name.trim().slice(0, 12) || '이름없음', connected: true, alive: true, nominated: false, ghostVoteUsed: false, message: '' },
            ],
          })
        }
      })
      conn.on('close', () => {
        if (pid && connMap.get(pid) === conn) {
          connMap.delete(pid)
          setConnected(pid, false)
        }
      })
    }

    const start = () => {
      if (cancelled) return
      const resumed = stateRef.current
      const code = resumed?.code ?? makeCode()
      peer = new Peer(peerIdOf(code))
      peer.on('open', () => {
        if (cancelled) return
        if (!resumed) commit(newState(code))
        else
          commit({
            ...resumed,
            players: resumed.players.map((p) => ({ ...p, connected: false })),
          })
        setStatus('online')
      })
      peer.on('connection', handleConn)
      peer.on('disconnected', () => {
        setStatus('offline')
        peer?.reconnect()
      })
      peer.on('error', (e) => {
        if ((e as { type?: string }).type === 'unavailable-id' && attempts < 8) {
          attempts++
          peer?.destroy()
          // 복구 시: 이전 세션 ID가 서버에서 풀릴 때까지 잠시 대기. 새 방이면 코드 재생성.
          if (!resumed) stateRef.current = null
          setTimeout(start, resumed ? 2500 : 0)
        } else if ((e as { type?: string }).type === 'network') {
          setStatus('offline')
        } else {
          setStatus('error')
          setError(String((e as Error).message ?? e))
        }
      })
    }
    start()

    return () => {
      cancelled = true
      peer?.destroy()
    }
  }, [commit, setConnected])

  const kick = useCallback((pid: string) => {
    conns.current.get(pid)?.close()
    conns.current.delete(pid)
  }, [])

  return { state, status, error, update, kick }
}

/** 플레이어 측: 방 코드로 접속하고, 끊기면 자동 재접속. */
export function useClient(code: string, name: string) {
  const [view, setView] = useState<PlayerView | null>(null)
  const [status, setStatus] = useState<NetStatus>('connecting')
  const [error, setError] = useState('')
  const connRef = useRef<DataConnection | null>(null)

  const sendChat = useCallback((text: string) => {
    const c = connRef.current
    if (c?.open) c.send({ t: 'chat', text } satisfies ClientMsg)
  }, [])

  useEffect(() => {
    // pid는 탭 단위(sessionStorage)로 유지: 한 기기에서 탭 여러 개로 테스트해도 서로 안 겹침
    let pid = ''
    try {
      pid = sessionStorage.getItem('botc_pid') ?? ''
      if (!pid) sessionStorage.setItem('botc_pid', (pid = uid()))
    } catch {
      pid = uid()
    }
    save(CLIENT_KEY, { code, name })

    let peer: Peer | null = null
    let conn: DataConnection | null = null
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let gaveUp = false

    const retry = (ms = 2000) => {
      if (cancelled || gaveUp) return
      setStatus('connecting')
      clearTimeout(timer)
      timer = setTimeout(connect, ms)
    }

    const connect = () => {
      if (cancelled || !peer || peer.destroyed) return
      conn = peer.connect(peerIdOf(code), { reliable: true })
      connRef.current = conn
      conn.on('open', () => {
        setStatus('online')
        setError('')
        conn?.send({ t: 'hello', pid, name } satisfies ClientMsg)
      })
      conn.on('data', (raw) => {
        const msg = raw as HostMsg
        if (msg.t === 'view') setView(msg.view)
        else if (msg.t === 'rejected') {
          gaveUp = true
          setError(msg.reason)
          setStatus('error')
        }
      })
      conn.on('close', () => retry())
      conn.on('error', () => retry())
    }

    peer = new Peer()
    peer.on('open', connect)
    peer.on('error', (e) => {
      const type = (e as { type?: string }).type
      if (type === 'peer-unavailable') {
        setError('방을 찾을 수 없어요. 코드를 확인하거나 호스트가 방을 열었는지 확인하세요.')
        retry(3000)
      } else {
        retry(3000)
      }
    })
    peer.on('disconnected', () => peer?.reconnect())

    return () => {
      cancelled = true
      clearTimeout(timer)
      peer?.destroy()
    }
  }, [code, name])

  return { view, status, error, sendChat }
}

/** 오프라인 모드: 네트워크 없이 한 기기에서 진행. 상태만 localStorage 에 저장한다. */
export function useOfflineHost(resume: boolean) {
  const [state, setState] = useState<HostState>(() => {
    const saved = resume ? load<HostState>(OFFLINE_KEY) : null
    return saved ? normalize(saved) : newState('LOCAL')
  })
  const update = useCallback((fn: (s: HostState) => HostState) => {
    setState((prev) => {
      const next = fn(prev)
      save(OFFLINE_KEY, next)
      return next
    })
  }, [])
  const kick = useCallback(() => {}, [])
  return { state, status: 'online' as NetStatus, error: '', update, kick }
}
