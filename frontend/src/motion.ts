// Timing shared by the keyframes in motion.css and the transitions between
// Wall and Edit. The transitions follow the animations themselves, not a
// clock, so the window never moves before the last frame has played.
// The canvas sink lasts 180 ms; a sink that never ends, as in a window that
// is not drawing, stops being waited for after this long.
const EXIT_SAFETY_MS = 1_000

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Resolves once the canvas has sunk: at the end of its animation, or at once
// with reduced motion or without a canvas.
export function waitForExit(): Promise<void> {
  const area = document.querySelector('.canvas-area')
  if (!area || prefersReducedMotion()) return Promise.resolve()
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer)
      area.removeEventListener('animationend', onEnd)
      resolve()
    }
    const onEnd = (event: Event) => {
      if (event instanceof AnimationEvent && event.animationName === 'canvas-sink') finish()
    }
    const timer = window.setTimeout(finish, EXIT_SAFETY_MS)
    area.addEventListener('animationend', onEnd)
  })
}
