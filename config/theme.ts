export const colors = {
  primary: {
    light: 'rgb(var(--primary-light) / 1)',
    DEFAULT: 'rgb(var(--primary) / 1)',
    dark: 'rgb(var(--primary-dark) / 1)',
  },
  accent: {
    light: 'rgb(var(--accent-light) / 1)',
    DEFAULT: 'rgb(var(--accent) / 1)',
    dark: 'rgb(var(--accent-dark) / 1)',
  },
  status: {
    success: {
      text: 'text-[rgb(var(--success)/1)]',
      bg: 'bg-[rgb(var(--success)/0.1)]',
      border: 'border-[rgb(var(--success)/0.2)]',
    },
    processing: {
      text: 'text-[rgb(var(--processing)/1)]',
      bg: 'bg-[rgb(var(--processing)/0.1)]',
      border: 'border-[rgb(var(--processing)/0.2)]',
    },
    error: {
      text: 'text-[rgb(var(--error)/1)]',
      bg: 'bg-[rgb(var(--error)/0.1)]',
      border: 'border-[rgb(var(--error)/0.2)]',
    },
  },
  gradients: {
    subtle:
      'from-[rgb(var(--primary)/0.05)] via-transparent to-[rgb(var(--accent)/0.05)]',
    medium:
      'from-[rgb(var(--primary)/0.1)] via-transparent to-[rgb(var(--accent)/0.1)]',
    strong:
      'from-[rgb(var(--primary)/0.2)] via-transparent to-[rgb(var(--accent)/0.2)]',
  },
} as const

export const effects = {
  glow: {
    subtle: 'shadow-[0_0_15px_rgba(37,99,235,0.1)]',
    medium: 'shadow-[0_0_20px_rgba(37,99,235,0.15)]',
    strong: 'shadow-[0_0_30px_rgba(37,99,235,0.2)]',
  },
  scan: {
    line: 'bg-gradient-to-r from-transparent via-blue-500/30 to-transparent',
  },
} as const
