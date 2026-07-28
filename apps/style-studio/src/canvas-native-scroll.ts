function isCanvasWheelTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('.canvas'))
}

function preserveNativeCanvasScroll(event: WheelEvent) {
  if (!isCanvasWheelTarget(event.target)) return
  if (event.ctrlKey || event.metaKey) return

  // The landmark editor's React wheel handler owns modified-wheel zoom.
  // Unmodified wheel and trackpad gestures must retain their browser default
  // so an overflowed reference can be scrolled to every landmark.
  event.stopPropagation()
}

function installCanvasNativeScroll() {
  document.addEventListener('wheel', preserveNativeCanvasScroll, {
    capture: true,
    passive: true,
  })
}

export { installCanvasNativeScroll, isCanvasWheelTarget, preserveNativeCanvasScroll }
