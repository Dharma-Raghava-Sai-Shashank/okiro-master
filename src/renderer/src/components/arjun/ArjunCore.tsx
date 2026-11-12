// "Arjun Core": the assistant's arc-reactor-style visual. A WebGL plasma core, rotating HUD rings
// and a radial audio spectrum, all driven by the voice state and the live mic/speaker level.
import { useEffect, useRef } from 'react'
import { voice } from '../../voice/engine'
import type { VoiceState } from '../../voice/store'

type RGB = [number, number, number]

const PALETTE: Record<VoiceState, { core: RGB; deep: RGB; ring: string }> = {
  off: { core: [0.2, 0.62, 0.78], deep: [0.07, 0.16, 0.38], ring: '#22d3ee' },
  loading: { core: [0.38, 0.65, 0.98], deep: [0.1, 0.18, 0.45], ring: '#60a5fa' },
  listening: { core: [0.4, 0.91, 0.98], deep: [0.03, 0.45, 0.56], ring: '#67e8f9' },
  transcribing: { core: [0.4, 0.91, 0.98], deep: [0.03, 0.45, 0.56], ring: '#67e8f9' },
  thinking: { core: [0.66, 0.55, 0.98], deep: [0.3, 0.11, 0.58], ring: '#a78bfa' },
  speaking: { core: [0.88, 0.95, 1.0], deep: [0.22, 0.74, 0.97], ring: '#bae6fd' },
  error: { core: [0.98, 0.75, 0.14], deep: [0.47, 0.21, 0.06], ring: '#fbbf24' }
}

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`
const FRAG = `
precision mediump float;
uniform float t; uniform float lvl; uniform vec2 res; uniform vec3 c1; uniform vec3 c2;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*res) / (0.5*res.y);
  float r = length(uv);
  float ang = atan(uv.y, uv.x);
  float n = fbm(vec2(ang*1.6 + t*0.18, r*3.2 - t*0.7));
  float edge = 0.74 + 0.07*n + 0.12*lvl;
  float body = smoothstep(edge, edge - 0.28, r);
  float plasma = fbm(uv*2.6 + vec2(t*0.22, -t*0.27) + n);
  float core = smoothstep(0.42 + 0.14*lvl, 0.0, r);
  float halo = exp(-7.0*max(r - edge*0.92, 0.0)) * (1.0 - body);
  float bands = 0.5 + 0.5*sin(r*28.0 - t*3.0 + n*6.0);
  vec3 col = mix(c2, c1, plasma) * body * (0.5 + 0.7*plasma) + c1*core*(0.7 + 1.1*lvl) + c1*halo*0.45 + c1*body*bands*0.08;
  float a = clamp(body*0.95 + core + halo*0.6, 0.0, 1.0);
  gl_FragColor = vec4(col*a, a);
}`

function setupGl(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true })
  if (!gl) return null
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
  }
  const vs = compile(gl.VERTEX_SHADER, VERT)
  const fs = compile(gl.FRAGMENT_SHADER, FRAG)
  if (!vs || !fs) return null
  const prog = gl.createProgram()!
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'p')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  const u = (n: string) => gl.getUniformLocation(prog, n)
  return { gl, t: u('t'), lvl: u('lvl'), res: u('res'), c1: u('c1'), c2: u('c2') }
}

const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]

export interface ArjunCoreProps {
  size: number
  state: VoiceState
  /** 0..1 while models download. */
  progress?: number | null
  /** Draw the radial spectrum and outer rings (off for the tiny dock version). */
  detailed?: boolean
  onClick?: () => void
}

export function ArjunCore({ size, state, progress, detailed = true, onClick }: ArjunCoreProps) {
  const glCanvas = useRef<HTMLCanvasElement>(null)
  const specCanvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const coreSize = Math.round(size * 0.62)
    const glc = glCanvas.current!
    glc.width = coreSize * dpr
    glc.height = coreSize * dpr
    const g = setupGl(glc)
    const spec = specCanvas.current
    const sctx = spec?.getContext('2d') ?? null
    if (spec) {
      spec.width = size * dpr
      spec.height = size * dpr
    }
    const bins = new Uint8Array(new ArrayBuffer(128))
    const bars = 72
    const smooth = new Float32Array(bars)
    let c1: RGB = PALETTE[stateRef.current].core
    let c2: RGB = PALETTE[stateRef.current].deep
    let level = 0
    let raf = 0
    const start = performance.now()
    const frame = (now: number) => {
      const st = stateRef.current
      const { out, mic } = voice.levels()
      const target = st === 'speaking' ? out : st === 'listening' || st === 'transcribing' ? mic : st === 'thinking' ? 0.25 + 0.15 * Math.sin(now / 260) : 0.06
      level += (target - level) * 0.18
      c1 = mix(c1, PALETTE[st].core, 0.06)
      c2 = mix(c2, PALETTE[st].deep, 0.06)
      wrap.current?.style.setProperty('--lvl', level.toFixed(3))
      if (g) {
        const { gl } = g
        gl.viewport(0, 0, glc.width, glc.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.uniform1f(g.t, (now - start) / 1000)
        gl.uniform1f(g.lvl, level)
        gl.uniform2f(g.res, glc.width, glc.height)
        gl.uniform3f(g.c1, ...c1)
        gl.uniform3f(g.c2, ...c2)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      if (sctx && spec) {
        const hasSpec = st === 'speaking' && voice.spectrum(bins)
        const w = spec.width
        sctx.clearRect(0, 0, w, w)
        const cx = w / 2
        const inner = w * 0.335
        const maxLen = w * 0.11
        sctx.lineCap = 'round'
        sctx.lineWidth = Math.max(1.5, w * 0.0065)
        const [r, gg, b] = c1.map((x) => Math.round(x * 255))
        for (let i = 0; i < bars; i++) {
          let v: number
          if (hasSpec) v = bins[Math.floor((i % (bars / 2)) * 1.4) + 2] / 255
          else v = level * (0.55 + 0.45 * Math.sin(i * 0.9 + now / 180)) + 0.04
          smooth[i] += (v - smooth[i]) * 0.3
          const len = 2 + smooth[i] * maxLen
          const a = (i / bars) * Math.PI * 2 - Math.PI / 2
          const cos = Math.cos(a)
          const sin = Math.sin(a)
          sctx.strokeStyle = `rgba(${r},${gg},${b},${0.25 + smooth[i] * 0.75})`
          sctx.beginPath()
          sctx.moveTo(cx + cos * inner, cx + sin * inner)
          sctx.lineTo(cx + cos * (inner + len), cx + sin * (inner + len))
          sctx.stroke()
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [size])

  const ring = PALETTE[state].ring
  const busy = state === 'thinking' || state === 'loading' || state === 'transcribing'
  const speed = busy ? 0.35 : 1
  const R = size / 2
  const progressArc = progress != null ? 2 * Math.PI * (R * 0.9) * (1 - progress) : null

  return (
    <div
      ref={wrap}
      onClick={onClick}
      className="relative grid shrink-0 cursor-pointer select-none place-items-center"
      style={{ width: size, height: size, ['--ring' as string]: ring }}
      title={state === 'off' ? 'Talk to Arjun (⌥Space)' : undefined}
    >
      {detailed && <canvas ref={specCanvas} className="pointer-events-none absolute inset-0 h-full w-full" />}
      <svg viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0 h-full w-full" style={{ transform: 'scale(calc(1 + var(--lvl, 0) * 0.06))' }}>
        <defs>
          <filter id="arc-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={size * 0.006} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#arc-glow)" fill="none" stroke={ring} style={{ transition: 'stroke 400ms' }}>
          {detailed && (
            <g className="arc-spin" style={{ animationDuration: `${60 * speed}s`, transformOrigin: 'center' }}>
              <circle cx={R} cy={R} r={R * 0.97} strokeOpacity={0.18} strokeWidth={1} />
              <circle cx={R} cy={R} r={R * 0.97} strokeOpacity={0.6} strokeWidth={size * 0.006} strokeDasharray={`${size * 0.004} ${size * 0.026}`} />
            </g>
          )}
          <g className="arc-spin-rev" style={{ animationDuration: `${22 * speed}s`, transformOrigin: 'center' }}>
            <circle
              cx={R}
              cy={R}
              r={R * 0.84}
              strokeOpacity={0.75}
              strokeWidth={size * 0.012}
              strokeDasharray={`${R * 0.84 * 1.4} ${R * 0.84 * 0.7}`}
              strokeLinecap="round"
            />
          </g>
          <g className="arc-spin" style={{ animationDuration: `${12 * speed}s`, transformOrigin: 'center' }}>
            <circle cx={R} cy={R} r={R * 0.74} strokeOpacity={0.35} strokeWidth={size * 0.004} strokeDasharray={`${R * 0.2} ${R * 0.12} ${R * 0.05} ${R * 0.12}`} />
          </g>
          {progressArc !== null && (
            <circle
              cx={R}
              cy={R}
              r={R * 0.9}
              strokeWidth={size * 0.014}
              stroke="#60a5fa"
              strokeDasharray={2 * Math.PI * R * 0.9}
              strokeDashoffset={progressArc}
              strokeLinecap="round"
              transform={`rotate(-90 ${R} ${R})`}
            />
          )}
        </g>
      </svg>
      <canvas ref={glCanvas} className="pointer-events-none relative" style={{ width: size * 0.62, height: size * 0.62 }} />
    </div>
  )
}
