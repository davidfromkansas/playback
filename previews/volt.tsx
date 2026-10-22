import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DJ } from '../src/ui/DJ'
import { DJBaseline } from './DJBaseline'
import { advanceVolt, newVoltMotion, VOLT_ROUTINES, VOLT_CELS, type VoltSelection } from '../src/ui/voltAnimation'
import './volt.css'

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
      <article className="candidate"><span className="label">{current.toUpperCase()}</span><div className="stage"><DJ dancing={playing} speed={slow ? 0.25 : 1} inspectCel={inspect ? cel : undefined} routine={routine} /></div><div className="ground" /></article>
    </section>
    <nav aria-label="Animation controls"><button onClick={() => setPlaying(v => !v)}>{playing ? 'Pause music' : 'Play music'}</button>
      <button aria-pressed={slow} onClick={() => setSlow(v => !v)}>Quarter speed</button>
      <button aria-pressed={inspect} onClick={() => setInspect(v => !v)}>Inspect frames</button></nav>
    <label className="routine-picker">Routine <select aria-label="Routine" value={routine} onChange={e => setRoutine(e.target.value as VoltSelection)}>
      <option value="auto">Cycle all 16</option>{VOLT_ROUTINES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
    </select></label>
    {inspect && <label className="scrub">Cel {cel}<input aria-label="Cel" type="range" min="0" max={VOLT_CELS - 1} value={cel} onChange={e => setCel(+e.target.value)} /></label>}
    <footer>16 routines · Street grooves, locking, waving and breaking. Changes wait for the complete recovery.<br />
      100 BPM · Whole-body cels · Reduced-motion support</footer>
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
