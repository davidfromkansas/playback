// Loading states. The big ones use Playback's own MixtapeLoader; small inline ones elsewhere use
// Generative Loaders (generativeloaders.com, MIT).
import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { MixtapeLoader } from './MixtapeLoader'

/** A big animated loader with a line of text under it, centred on the screen. */
export function LoadingCard({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`loading-card ${className}`}>
      <MixtapeLoader text={text} />
    </div>
  )
}

/**
 * Covers the 3D scene while its models and fonts first load. Only for the first load: cover art
 * loading later while you scroll shouldn't bring it back.
 */
export function SceneLoading({ text }: { text: string }) {
  const { active, loaded, total } = useProgress()
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (done || active || !total || loaded < total) return
    // Models load one after another, so wait for a quiet moment before calling it finished.
    const t = setTimeout(() => setDone(true), 800)
    return () => clearTimeout(t)
  }, [active, loaded, total, done])
  if (done) return null
  return <LoadingCard text={text} className="scene-loading" />
}
