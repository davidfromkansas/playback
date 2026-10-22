import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DJ } from '../src/ui/DJ'
import { DJBaseline } from './DJBaseline'
import { advanceVolt, newVoltMotion, VOLT_ROUTINES, VOLT_CELS, type VoltSelection } from '../src/ui/voltAnimation'
import './volt.css'
import { classifyPublicSong, MOOD_ROUTINES, type SongMood, type MoodResult } from '../src/lib/songMood'

// Deterministic fixture uses the production selector. It does not simulate Spotify playback.
Object.assign(window, { voltFixture: () => {
  const motion = newVoltMotion()
  return Array.from({ length: 6600 }, (_, tick) => {
    const playing = (tick >= 120 && tick < 6000) || (tick >= 6300 && tick < 6310)
    const sample = advanceVolt(motion, 1 / 60, playing)
    return { tick, playing, ...sample, entry: motion.entry, phase: motion.phase }
  })
} })

function Preview() {
  const [playing, setPlaying] = useState(false)
  const [slow, setSlow] = useState(false)
  const [inspect, setInspect] = useState(false)
  const [cel, setCel] = useState(0)
  const [routine, setRoutine] = useState<VoltSelection>('auto')
  const [current, setCurrent] = useState('Listening')
  const [mood, setMood] = useState<SongMood | 'all'>('all')
  const [publicResult, setPublicResult] = useState<MoodResult | null>(null)
  const [looking, setLooking] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => {
      const el = document.querySelector<HTMLCanvasElement>('.candidate canvas')
      setCurrent(el?.dataset.motion === 'idle' ? 'Listening'
        : VOLT_ROUTINES.find(r => r.id === el?.dataset.routine)?.label ?? 'Listening')
    }, 200)
    return () => clearInterval(timer)
  }, [])
  return <main>
    <header><span className="eyebrow">PLAYBACK / CHARACTER LAB</span><h1>DJ VOLT<span>02</span></h1>
      <p>Rooftop radio. Lime hair. A new groove.</p></header>
    <section className="stages">
      <article><span className="label">ORIGINAL / SVG RIG</span><div className="stage"><DJBaseline dancing={playing} /></div></article>
      <article className="candidate"><span className="label">{current.toUpperCase()}</span><div className="stage"><DJ dancing={playing} speed={slow ? 0.25 : 1} inspectCel={inspect ? cel : undefined} routine={routine} mood={mood === 'all' ? undefined : mood} /></div><div className="ground" /></article>
    </section>
    <nav aria-label="Animation controls"><button onClick={() => setPlaying(v => !v)}>{playing ? 'Pause music' : 'Play music'}</button>
      <button aria-pressed={slow} onClick={() => setSlow(v => !v)}>Quarter speed</button>
      <button aria-pressed={inspect} onClick={() => setInspect(v => !v)}>Inspect frames</button></nav>
    <label className="routine-picker">Routine <select aria-label="Routine" value={routine} onChange={e => setRoutine(e.target.value as VoltSelection)}>
      <option value="auto">Cycle all 16</option>{VOLT_ROUTINES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
    </select></label>
    <label className="routine-picker">Mood <select aria-label="Mood" value={mood} onChange={e => {
      setMood(e.target.value as SongMood | 'all'); setRoutine('auto')
    }}><option value="all">All routines</option>{Object.keys(MOOD_ROUTINES).map(value =>
      <option key={value} value={value}>{value === 'unknown' ? 'Unknown / general groove' : value}</option>)}
    </select></label>
    <form className="public-song" onSubmit={event => {
      event.preventDefault()
      const fields = new FormData(event.currentTarget)
      setLooking(true); setPublicResult(null)
      void classifyPublicSong(String(fields.get('title')), String(fields.get('artist')),
        Number(fields.get('seconds')) * 1000).then(result => {
        setPublicResult(result); setMood(result.profile?.mood ?? 'unknown'); setRoutine('auto')
      }).catch(() => {
        setPublicResult({ status: 'unavailable', profile: null }); setMood('unknown'); setRoutine('auto')
      }).finally(() => setLooking(false))
    }}>
      <strong>Try a public catalog match</strong>
      <p>MusicBrainz title and artist credits → Jev → mood. This estimates mood; it does not analyze audio.</p>
      <label>Song title<input name="title" required maxLength={240} /></label>
      <label>Artist<input name="artist" required maxLength={240} /></label>
      <label>Duration in seconds<input name="seconds" type="number" required min="1" max="86400" /></label>
      <button disabled={looking}>{looking ? 'Finding recording…' : 'Find song mood'}</button>
      <p role="status">{publicResult?.status === 'not-configured'
        ? 'Local setup needed: set TYPESAFE_API_KEY in .env.local and restart the dev server.'
        : publicResult?.status === 'classified' ? `Estimated mood: ${publicResult.profile?.mood}`
        : publicResult ? `${publicResult.status}: keeping a general groove.` : 'Local pilot · manual mood selection works without an API key.'}</p>
      {publicResult?.source && <a href={publicResult.source.sourceUrl} target="_blank" rel="noreferrer">
        Source: {publicResult.source.title} — {publicResult.source.artists.join(', ')} · MusicBrainz / CC0
      </a>}
    </form>
    {inspect && <label className="scrub">Cel {cel}<input aria-label="Cel" type="range" min="0" max={VOLT_CELS - 1} value={cel} onChange={e => setCel(+e.target.value)} /></label>}
    <footer>16 existing routines · 16 mood families · Expanded artwork is still planned. Changes wait for the complete recovery.<br />
      100 BPM · Whole-body cels · Reduced-motion support</footer>
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
