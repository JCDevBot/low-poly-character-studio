import React, { useMemo, useRef, useState } from 'react'

type LandmarkKey =
  | 'HeadTop'
  | 'Chin'
  | 'HeadLeft'
  | 'HeadRight'
  | 'EyeLeft'
  | 'EyeRight'
  | 'ShoulderLeft'
  | 'ShoulderRight'
  | 'WaistLeft'
  | 'WaistRight'
  | 'FeetBottom'

type Point = { x: number; y: number }
type Landmarks = Partial<Record<LandmarkKey, Point>>

const referenceImages = [
  { label: 'Front', src: '/references/little-guy/front.png' },
  { label: 'Side', src: '/references/little-guy/side.png' },
  { label: 'Back', src: '/references/little-guy/back.png' },
  { label: 'Character Sheet', src: '/references/little-guy/character_sheet.png' },
  { label: 'M60 Sheet', src: '/references/little-guy/M60_character_sheet.png' },
]

const landmarkOrder: LandmarkKey[] = [
  'HeadTop',
  'Chin',
  'HeadLeft',
  'HeadRight',
  'EyeLeft',
  'EyeRight',
  'ShoulderLeft',
  'ShoulderRight',
  'WaistLeft',
  'WaistRight',
  'FeetBottom',
]

const descriptions: Record<LandmarkKey, string> = {
  HeadTop: 'Top of head/helmet silhouette.',
  Chin: 'Bottom of visible face/head silhouette.',
  HeadLeft: 'Image-left edge of head.',
  HeadRight: 'Image-right edge of head.',
  EyeLeft: 'Left eye as seen in the image.',
  EyeRight: 'Right eye as seen in the image.',
  ShoulderLeft: 'Image-left shoulder edge.',
  ShoulderRight: 'Image-right shoulder edge.',
  WaistLeft: 'Image-left waist/hip edge.',
  WaistRight: 'Image-right waist/hip edge.',
  FeetBottom: 'Lowest visible foot/boot point.',
}

function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function computeStyleDNA(source: string, landmarks: Landmarks, imageSize: { width: number; height: number }) {
  const headTop = landmarks.HeadTop
  const chin = landmarks.Chin
  const headLeft = landmarks.HeadLeft
  const headRight = landmarks.HeadRight
  const eyeLeft = landmarks.EyeLeft
  const eyeRight = landmarks.EyeRight
  const shoulderLeft = landmarks.ShoulderLeft
  const shoulderRight = landmarks.ShoulderRight
  const waistLeft = landmarks.WaistLeft
  const waistRight = landmarks.WaistRight
  const feetBottom = landmarks.FeetBottom

  const headHeightPx = headTop && chin ? Math.abs(chin.y - headTop.y) : null
  const totalHeightPx = headTop && feetBottom ? Math.abs(feetBottom.y - headTop.y) : null
  const headWidthPx = headLeft && headRight ? Math.abs(headRight.x - headLeft.x) : null
  const eyeSpacingPx = eyeLeft && eyeRight ? Math.abs(eyeRight.x - eyeLeft.x) : null
  const shoulderWidthPx = shoulderLeft && shoulderRight ? Math.abs(shoulderRight.x - shoulderLeft.x) : null
  const waistWidthPx = waistLeft && waistRight ? Math.abs(waistRight.x - waistLeft.x) : null

  const headHeightRatio = headHeightPx && totalHeightPx ? headHeightPx / totalHeightPx : null
  const headWidthToHeight = headWidthPx && headHeightPx ? headWidthPx / headHeightPx : null
  const eyeHeightFromTopRatio = eyeLeft && headTop && headHeightPx ? (eyeLeft.y - headTop.y) / headHeightPx : null
  const eyeSpacingToHeadWidth = eyeSpacingPx && headWidthPx ? eyeSpacingPx / headWidthPx : null
  const shoulderWidthToHeadWidth = shoulderWidthPx && headWidthPx ? shoulderWidthPx / headWidthPx : null
  const waistWidthToHeadWidth = waistWidthPx && headWidthPx ? waistWidthPx / headWidthPx : null
  const torsoHeightRatio = chin && feetBottom && totalHeightPx ? (feetBottom.y - chin.y) / totalHeightPx : null

  return {
    source,
    imageSize,
    landmarks,
    measurements: {
      totalHeightPx,
      headHeightPx,
      headWidthPx,
      eyeSpacingPx,
      shoulderWidthPx,
      waistWidthPx,
      headHeightRatio,
      headWidthToHeight,
      eyeHeightFromTopRatio,
      eyeSpacingToHeadWidth,
      shoulderWidthToHeadWidth,
      waistWidthToHeadWidth,
      torsoHeightRatio,
    },
    blenderHints: {
      totalHeight: 1.35,
      headWidth: headWidthToHeight ? clamp(headWidthToHeight * 0.42, 0.32, 0.55) : 0.42,
      headDepth: 0.36,
      headHeight: 0.42,
      eyeSpacing: eyeSpacingToHeadWidth ? clamp(eyeSpacingToHeadWidth * 0.42, 0.12, 0.28) : 0.18,
      eyeZ: eyeHeightFromTopRatio ? 1.35 - eyeHeightFromTopRatio * 0.42 : 1.03,
      torsoWidth: shoulderWidthToHeadWidth ? clamp(shoulderWidthToHeadWidth * 0.42, 0.20, 0.42) : 0.26,
      waistWidth: waistWidthToHeadWidth ? clamp(waistWidthToHeadWidth * 0.42, 0.18, 0.38) : 0.24,
      legLength: 0.27,
    },
  }
}

function App() {
  const [selectedImage, setSelectedImage] = useState(referenceImages[0])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [landmarks, setLandmarks] = useState<Landmarks>({})
  const [imageSize, setImageSize] = useState({ width: 960, height: 540 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [showLabels, setShowLabels] = useState(true)
  const [draggingLandmark, setDraggingLandmark] = useState<LandmarkKey | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const dragStart = useRef<Point | null>(null)
  const panStart = useRef<Point | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const currentLandmark = landmarkOrder[currentIndex]
  const styleDNA = useMemo(
    () => computeStyleDNA(selectedImage.src, landmarks, imageSize),
    [selectedImage, landmarks, imageSize]
  )

  function resetForImage(image: typeof referenceImages[number]) {
    setSelectedImage(image)
    setCurrentIndex(0)
    setLandmarks({})
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  function imageToScreen(point: Point) {
    return {
      x: point.x * zoom + pan.x,
      y: point.y * zoom + pan.y,
    }
  }

  function screenToImage(point: Point) {
    return {
      x: (point.x - pan.x) / zoom,
      y: (point.y - pan.y) / zoom,
    }
  }

  function onCanvasClick(event: React.MouseEvent<HTMLDivElement>) {
    if (draggingLandmark || isPanning) return
    const rect = event.currentTarget.getBoundingClientRect()
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const img = screenToImage(screen)

    if (img.x < 0 || img.y < 0 || img.x > imageSize.width || img.y > imageSize.height) return

    setLandmarks((prev) => ({ ...prev, [currentLandmark]: img }))
    setCurrentIndex((idx) => Math.min(idx + 1, landmarkOrder.length - 1))
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const before = screenToImage(mouse)

    const nextZoom = clamp(zoom * (event.deltaY < 0 ? 1.12 : 0.88), 0.3, 8)
    setZoom(nextZoom)

    setPan({
      x: mouse.x - before.x * nextZoom,
      y: mouse.y - before.y * nextZoom,
    })
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.dataset.landmark) return

    // Shift-drag or middle-zone drag pans without placing a landmark.
    if (event.shiftKey || event.altKey) {
      setIsPanning(true)
      dragStart.current = { x: event.clientX, y: event.clientY }
      panStart.current = pan
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (draggingLandmark) {
      const rect = event.currentTarget.getBoundingClientRect()
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const img = screenToImage(screen)
      setLandmarks((prev) => ({
        ...prev,
        [draggingLandmark]: {
          x: clamp(img.x, 0, imageSize.width),
          y: clamp(img.y, 0, imageSize.height),
        },
      }))
      return
    }

    if (isPanning && dragStart.current && panStart.current) {
      setPan({
        x: panStart.current.x + event.clientX - dragStart.current.x,
        y: panStart.current.y + event.clientY - dragStart.current.y,
      })
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    setDraggingLandmark(null)
    setIsPanning(false)
    dragStart.current = null
    panStart.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {}
  }

  const markerSize = 14

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>Low Poly Character Studio</h1>
          <p>Reference landmarks → StyleDNA → Blender-ready proportions</p>
        </div>
        <div className="actions">
          <button onClick={() => download('little_guy_landmarks.json', { source: selectedImage.src, landmarks, imageSize })}>
            Download Landmarks
          </button>
          <button onClick={() => download('little_guy_style_dna.json', styleDNA)}>
            Download StyleDNA
          </button>
        </div>
      </header>

      <section className="layout">
        <aside className="panel sidebar">
          <h2>References</h2>
          {referenceImages.map((image) => (
            <button
              key={image.src}
              className={image.src === selectedImage.src ? 'reference active' : 'reference'}
              onClick={() => resetForImage(image)}
            >
              {image.label}
            </button>
          ))}

          <div className="controls">
            <h2>Canvas</h2>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>Reset View</button>
            <button onClick={() => setShowLabels((v) => !v)}>
              {showLabels ? 'Hide Labels' : 'Show Labels'}
            </button>
            <p>Wheel = zoom. Shift/Alt + drag = pan. Drag markers to refine.</p>
          </div>

          <h2>Landmarks</h2>
          <p className="hint">Left/right means image-left and image-right, not anatomical character-left.</p>
          <div className="landmarkList">
            {landmarkOrder.map((key, index) => (
              <button
                key={key}
                className={index === currentIndex ? 'landmark active' : 'landmark'}
                onClick={() => setCurrentIndex(index)}
              >
                <span>{key}</span>
                <small>
                  {landmarks[key]
                    ? `${Math.round(landmarks[key]!.x)}, ${Math.round(landmarks[key]!.y)}`
                    : 'unset'}
                </small>
              </button>
            ))}
          </div>
        </aside>

        <section className="workspace">
          <div className="current">
            Current landmark: <strong>{currentLandmark}</strong>. {descriptions[currentLandmark]}
          </div>

          <div
            className={isPanning ? 'canvas panning' : 'canvas'}
            onClick={onCanvasClick}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <div
              className="imageLayer"
              style={{
                width: imageSize.width,
                height: imageSize.height,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <img
                ref={imgRef}
                src={selectedImage.src}
                draggable={false}
                onLoad={(event) => {
                  setImageSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                  setZoom(1)
                  setPan({ x: 0, y: 0 })
                }}
              />

              {Object.entries(landmarks).map(([key, point]) => {
                const selected = key === currentLandmark
                return (
                  <div
                    key={key}
                    data-landmark={key}
                    className={selected ? 'marker selected' : 'marker'}
                    style={{
                      left: point.x,
                      top: point.y,
                      width: markerSize / zoom,
                      height: markerSize / zoom,
                      marginLeft: -(markerSize / 2) / zoom,
                      marginTop: -(markerSize / 2) / zoom,
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      setDraggingLandmark(key as LandmarkKey)
                      setCurrentIndex(landmarkOrder.indexOf(key as LandmarkKey))
                      event.currentTarget.setPointerCapture(event.pointerId)
                    }}
                  >
                    {showLabels || selected ? (
                      <span
                        className="label"
                        style={{
                          transform: `scale(${1 / zoom})`,
                          transformOrigin: 'left center',
                          left: 18 / zoom,
                        }}
                      >
                        {key}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <aside className="panel dnaPanel">
          <h2>StyleDNA</h2>
          <pre>{JSON.stringify(styleDNA, null, 2)}</pre>
        </aside>
      </section>
    </main>
  )
}

export { App }
