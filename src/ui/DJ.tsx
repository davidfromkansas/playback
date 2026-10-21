// DJ Volt, the Street theme's pirate-radio host: roller skates, baggy jersey, big headphones,
// goggles and a mic. Skates and grooves on the beat while music plays; leans back and
// vibes to the headphones otherwise.
import { INK } from '../lib/colors'
import { useRig, type RigFrame } from './useRig'

const SKIN = '#c98a5a'
const HAIR = '#c6ff00'
const JERSEY = '#ff8a1f'
const JERSEY_TRIM = '#ffffff'
const PANTS = '#5b3fd1'
const BOOT = '#ffffff'
const WHEEL = '#ff2e93'
const PHONES = '#ff2e93'
const LENS = '#00d0ff'

function pose({ t, b, lerp, set, blinking }: RigFrame) {
  const sway = Math.sin(Math.PI * b) // glides side to side over two beats
  const hit = Math.pow(1 - (b % 1), 5) // sharp on each beat
  const roll = Math.sin(t * 0.9) // chill: rolling back and forth on the skates
  const nod = Math.sin(t * 2.2)

  const x = lerp(roll * 4, sway * 14)
  const y = lerp(Math.sin(t * 1.7) * 1, -Math.abs(Math.sin(Math.PI * b)) * 8)
  set('body', `translate(${x} ${y}) rotate(${lerp(-4 + roll, sway * 9)} 100 280)`)
  set('shadow', `translate(${x} 0)`)
  set('torso', `rotate(${lerp(-3, sway * 4)} 100 205)`)
  // A sharp nod on every beat, or a slow head bob listening to the headphones.
  set('head', `rotate(${lerp(nod * 4 - 4, -hit * 12 + 4)} 100 150)`)
  // Mic hand: pulled to the mouth when dancing, resting at the hip when chilling.
  set('armR', `rotate(${lerp(-12 + Math.sin(t * 1.1) * 3, -128 + hit * 18)} 128 162)`)
  // Free hand: on the headphones when chilling, waving overhead on the beat when dancing.
  set('armL', `rotate(${lerp(150 + nod * 4, 160 + Math.sin(Math.PI * 2 * b) * 25)} 72 162)`)
  // Skating stride: legs push out alternately.
  set('legL', `rotate(${lerp(2, Math.max(0, sway) * 22)} 86 210)`)
  set('legR', `rotate(${lerp(-2, Math.min(0, sway) * 22)} 114 210)`)
  set('eyes', blinking ? 'translate(0 112) scale(1 0.12) translate(0 -112)' : '')
}

function Skate({ side }: { side: -1 | 1 }) {
  const x = side < 0 ? 72 : 108
  return (
    <>
      <path d={`M${x - 4} 246 L${x + 22} 246 L${x + 26} 270 L${x - 10} 270 Q${x - 12} 258 ${x - 4} 246 Z`} fill={BOOT} />
      <path d={`M${x - 2} 254 L${x + 22} 254`} stroke={LENS} strokeWidth="4" />
      <rect x={x - 12} y="270" width="40" height="6" rx="3" fill={INK} />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={x - 8 + i * 11} cy="281" r="5" fill={WHEEL} strokeWidth="3" />
      ))}
    </>
  )
}

export function DJ({ dancing, className }: { dancing: boolean; className?: string }) {
  const ref = useRig(dancing, pose)
  return (
    <svg viewBox="0 -24 200 324" className={className} aria-hidden>
      <g ref={ref('shadow')}>
        <ellipse cx="100" cy="290" rx="50" ry="7" fill="rgba(0,0,0,0.22)" />
      </g>
      <g ref={ref('body')} stroke={INK} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        <g ref={ref('legL')}>
          <path d="M72 205 L98 205 L94 250 L66 250 Z" fill={PANTS} />
          <path d="M70 232 L92 232" fill="none" strokeWidth="2" />
          <Skate side={-1} />
        </g>
        <g ref={ref('legR')}>
          <path d="M102 205 L128 205 L134 250 L106 250 Z" fill={PANTS} />
          <path d="M108 232 L130 232" fill="none" strokeWidth="2" />
          <Skate side={1} />
        </g>
        <g ref={ref('torso')}>
          {/* Free arm (left) — raised to the headphones or waving */}
          <g ref={ref('armL')}>
            <path d="M68 158 L78 158 L80 200 L68 200 Z" fill={SKIN} />
            <circle cx="74" cy="205" r="9" fill={SKIN} />
          </g>
          {/* Oversized jersey */}
          <path d="M66 150 Q100 140 134 150 L140 214 Q100 222 60 214 Z" fill={JERSEY} />
          <path d="M60 206 Q100 214 140 206" fill="none" stroke={JERSEY_TRIM} strokeWidth="5" />
          <text x="100" y="196" textAnchor="middle" fontFamily="Bangers, sans-serif" fontSize="30" fill={JERSEY_TRIM} stroke={INK} strokeWidth="1.5">99</text>
          {/* Headphones resting around the neck band */}
          {/* Mic arm (right) */}
          <g ref={ref('armR')}>
            <path d="M124 156 L134 156 L134 198 L124 198 Z" fill={SKIN} />
            <circle cx="129" cy="203" r="9" fill={SKIN} />
            <rect x="124" y="208" width="10" height="20" rx="3" fill={INK} />
            <circle cx="129" cy="232" r="8" fill="#9aa3b5" />
          </g>
          <g ref={ref('head')}>
            {/* Spiky hair */}
            <path d="M64 96 L58 62 L76 78 L80 44 L96 72 L106 36 L114 70 L132 46 L128 80 L146 66 L138 98 Z" fill={HAIR} />
            {/* Face */}
            <path d="M68 92 L132 92 Q138 122 126 140 Q100 154 74 140 Q62 122 68 92 Z" fill={SKIN} />
            {/* Goggles pushed up on the forehead */}
            <rect x="66" y="80" width="68" height="8" fill={INK} stroke="none" />
            <ellipse cx="86" cy="84" rx="13" ry="10" fill={LENS} />
            <ellipse cx="114" cy="84" rx="13" ry="10" fill={LENS} />
            <path d="M80 80 L86 86" stroke="#ffffff" strokeWidth="3" />
            <path d="M108 80 L114 86" stroke="#ffffff" strokeWidth="3" />
            <g ref={ref('eyes')}>
              <path d="M80 112 Q88 106 96 112" fill="none" />
              <path d="M104 112 Q112 106 120 112" fill="none" />
              <circle cx="88" cy="114" r="3.5" fill={INK} stroke="none" />
              <circle cx="112" cy="114" r="3.5" fill={INK} stroke="none" />
            </g>
            {/* Big grin */}
            <path d="M86 128 Q100 142 114 128 Z" fill="#ffffff" />
            {/* Big headphones */}
            <path d="M62 112 Q60 66 100 62 Q140 66 138 112" fill="none" stroke={INK} strokeWidth="7" />
            <rect x="52" y="104" width="18" height="28" rx="8" fill={PHONES} />
            <rect x="130" y="104" width="18" height="28" rx="8" fill={PHONES} />
          </g>
        </g>
      </g>
    </svg>
  )
}
