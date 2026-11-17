import { useState } from 'react'
import { savedClient } from './lib/net'
import Home from './screens/Home'
import HostScreen from './screens/HostScreen'
import PlayerScreen from './screens/PlayerScreen'

type Route =
  | { page: 'home' }
  | { page: 'host'; resume: boolean; offline: boolean }
  | { page: 'player'; code: string; name: string }

export default function App() {
  const [route, setRoute] = useState<Route>({ page: 'home' })
  const home = () => setRoute({ page: 'home' })

  if (route.page === 'host') return <HostScreen resume={route.resume} offline={route.offline} onExit={home} />
  if (route.page === 'player') return <PlayerScreen code={route.code} name={route.name} onExit={home} />
  return (
    <Home
      lastJoin={savedClient()}
      onHost={(resume, offline) => setRoute({ page: 'host', resume, offline })}
      onJoin={(code, name) => setRoute({ page: 'player', code, name })}
    />
  )
}
