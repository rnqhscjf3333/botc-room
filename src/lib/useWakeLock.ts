import { useEffect } from 'react'

/** 화면 꺼짐 방지(지원하는 브라우저에서만). 파티 중 폰이 잠기면 연결이 끊기기 쉬워서 필요. */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const acquire = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null
      } catch {
        /* 무시 */
      }
    }
    const onVis = () => document.visibilityState === 'visible' && acquire()
    acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      lock?.release().catch(() => {})
    }
  }, [])
}
