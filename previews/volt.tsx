import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DJ } from '../src/ui/DJ'
import { DJBaseline } from './DJBaseline'
import { advanceVolt, newVoltMotion } from '../src/ui/voltAnimation'
import './volt.css'

// Deterministic fixture uses the production selector. It does not simulate Spotify playback.
Object.assign(window, { voltFixture: () => {
  const motion = newVoltMotion()
  return Array.from({ length: 900 }, (_, tick) => {
    const playing = (tick >= 120 && tick < 420) || (tick >= 450 && tick < 470)
    const sample = advanceVolt(motion, 1 / 60, playing)
    return { tick, playing, ...sample, entry: motion.entry, phase: motion.phase }
  })
} })

function Preview() {
  const [playing, setPlaying] = useState(false)
  const [slow, setSlow] = useState(false)
  const [inspect, setInspect] = useState(false)
  const [cel, setCel] = useState(0)
  return <main>
    <header><span className="eyebrow">PLAYBACK / CHARACTER LAB</span><h1>DJ VOLT<span>02</span></h1>
      <p>Rooftop radio. Lime hair. A new groove.</p></header>
    <section className="stages">
      <article><span className="label">ORIGINAL / SVG RIG</span><div className="stage"><DJBaseline dancing={playing} /></div></article>
      <article className="candidate"><span className="label">NEW / WHOLE-BODY CELS</span><div className="stage"><DJ dancing={playing} speed={slow ? 0.25 : 1} inspectCel={inspect ? cel : undefined} /></div><div className="ground" /></article>
    </section>
    <nav aria-label="Animation controls"><button onClick={() => setPlaying(v => !v)}>{playing ? 'Pause music' : 'Play music'}</button>
      <button aria-pressed={slow} onClick={() => setSlow(v => !v)}>Quarter speed</button>
      <button aria-pressed={inspect} onClick={() => setInspect(v => !v)}>Inspect frames</button></nav>
    {inspect && <label className="scrub">Cel {cel}<input aria-label="Cel" type="range" min="0" max="35" value={cel} onChange={e => setCel(+e.target.value)} /></label>}
    <footer>Idle → microphone lift → groove → settle → idle. Pausing reverses the drawn transition.<br />
      100 BPM · Fixed skate registration · Reduced-motion support</footer>
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
