import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cx, ratingColor } from '../lib/format'

export function Glass({ className, children, strong }: { className?: string; children: ReactNode; strong?: boolean }) {
  return <div className={cx(strong ? 'glass-strong' : 'glass', 'rounded-3xl', className)}>{children}</div>
}

/** The standard page card: Glass + padding + a Label header row. */
export function Card({
  title,
  icon,
  right,
  className,
  children
}: {
  title?: string
  icon?: ReactNode
  right?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Glass className={cx('p-5', className)}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {icon}
            {title && <Label>{title}</Label>}
          </div>
          {right}
        </div>
      )}
      {children}
    </Glass>
  )
}

type Variant = 'primary' | 'ghost' | 'soft' | 'danger' | 'success'

export function Button({
  variant = 'soft',
  size = 'md',
  className,
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-semibold transition disabled:opacity-40 disabled:pointer-events-none select-none'
  const sizes = size === 'sm' ? 'text-xs px-2.5 py-1.5 rounded-lg' : 'text-[13px] px-3.5 py-2 rounded-xl'
  const variants: Record<Variant, string> = {
    primary: 'accent-grad accent-glow text-white hover:brightness-110 active:scale-[0.98]',
    soft: 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08]',
    ghost: 'text-slate-300 hover:text-white hover:bg-white/[0.06]',
    danger: 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-400/20',
    success: 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-400/20'
  }
  return (
    <button className={cx(base, sizes, variants[variant], className)} {...rest}>
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  )
}

export function RatingPill({ rating, className }: { rating: number | null | undefined; className?: string }) {
  const c = ratingColor(rating)
  return (
    <span
      className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums', className)}
      style={{ color: c, background: `${c}1f`, border: `1px solid ${c}33` }}
    >
      {rating ?? '—'}
    </span>
  )
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'rounded-full px-3 py-1 text-xs font-semibold transition border',
        active ? 'bg-blue-500/20 text-blue-200 border-blue-400/40' : 'bg-white/[0.04] text-slate-400 border-white/[0.07] hover:text-slate-200'
      )}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-2xl border border-white/[0.07] bg-black/30 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-xl px-3.5 py-1.5 text-xs font-bold transition',
            value === o.value ? 'accent-grad accent-glow text-white' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ProgressRing({ value, max, size = 120, stroke = 10, children }: { value: number; max: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  const id = `ring-${size}-${stroke}`
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function Bar({ value, max, color = '#3b82f6' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('animate-spin text-blue-300', className ?? 'size-5')} />
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="text-sm font-bold text-slate-200">{title}</div>
      {children && <div className="max-w-md text-xs text-slate-400">{children}</div>}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500">{children}</div>
}

export function Flame({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <defs>
        <linearGradient id="flame-g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="60%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path fill="url(#flame-g)" d="M12 2c0 2 1 3.6 2 5.2c1.7 2.6 4 4.8 4 8.3a6 6 0 0 1-12 0c0-2.7 1-4.6 2-6.2c.8 1.7 1.7 1.7 1.7-.4c0-2 1.1-4.5 2.3-6.9z" />
      <path fill="#0b1220" d="M12 11c0 1 .5 1.7 1 2.5c.8 1.2 1.6 2.1 1.6 3.5a2.6 2.6 0 0 1-5.2 0c0-1.2.4-2 .9-2.8c.4.7.7.7.7-.2c0-.9.4-2 1-3z" />
    </svg>
  )
}
