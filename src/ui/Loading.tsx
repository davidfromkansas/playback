// Loading states, drawn with Generative Loaders (generativeloaders.com, MIT).
import { useProgress } from '@react-three/drei'
import { ImageLoader, TextLoader } from 'generative-loaders'
import { useEffect, useState } from 'react'

/** A big animated loader with a line of text under it, centred on the screen. */
export function LoadingCard({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`loading-card ${className}`}>
      <ImageLoader variant="tiles" size="4.5rem" radius="50%" label={text} />
      <TextLoader text={text} variant="wave" color="currentColor" />
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
