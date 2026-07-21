type Point = { x: number; y: number }

type HumanoidLandmarkKey =
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

type HumanoidLandmarks = Record<HumanoidLandmarkKey, Point>

type ConfidenceLevel = 'high' | 'medium' | 'low'

type AnalysisWarning = {
  code: 'low-contrast' | 'cropped-subject' | 'heuristic-landmarks'
  message: string
}

type ColorRegion = {
  name: 'head' | 'torso' | 'lower-body'
  rgb: [number, number, number]
  sampleCount: number
}

type HumanoidReferenceAnalysis = {
  schemaVersion: 'humanoid-reference-analysis/v1'
  modelTypeId: 'humanoid/chibi-v1'
  adapterId: 'humanoid/chibi-local-silhouette-v1'
  imageSize: { width: number; height: number }
  silhouetteBounds: { left: number; top: number; right: number; bottom: number }
  landmarks: HumanoidLandmarks
  confidence: {
    overall: number
    level: ConfidenceLevel
    landmarks: Record<HumanoidLandmarkKey, number>
  }
  colorRegions: ColorRegion[]
  warnings: AnalysisWarning[]
}

type RasterImage = {
  width: number
  height: number
  data: Uint8ClampedArray
}

type ReferenceAnalysisAdapter<Result> = {
  id: string
  modelTypeId: string
  analyzeRaster: (image: RasterImage) => Result
  analyzeImageUrl: (url: string) => Promise<Result>
}

type Span = { left: number; right: number }

const LANDMARK_KEYS: HumanoidLandmarkKey[] = [
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function colorDistance(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function pixelAt(image: RasterImage, x: number, y: number) {
  const index = (y * image.width + x) * 4
  return [image.data[index], image.data[index + 1], image.data[index + 2], image.data[index + 3]] as const
}

function estimateBackground(image: RasterImage): [number, number, number] {
  const insetX = Math.min(2, image.width - 1)
  const insetY = Math.min(2, image.height - 1)
  const samples = [
    pixelAt(image, 0, 0),
    pixelAt(image, image.width - 1, 0),
    pixelAt(image, 0, image.height - 1),
    pixelAt(image, image.width - 1, image.height - 1),
    pixelAt(image, insetX, insetY),
    pixelAt(image, image.width - 1 - insetX, insetY),
  ]
  return [0, 1, 2].map((channel) => Math.round(samples.reduce((sum, sample) => sum + sample[channel], 0) / samples.length)) as [number, number, number]
}

function buildForegroundMask(image: RasterImage) {
  const background = estimateBackground(image)
  const mask = new Uint8Array(image.width * image.height)
  let contrastSum = 0
  let count = 0

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const [r, g, b, alpha] = pixelAt(image, x, y)
      if (alpha < 24) continue
      const distance = colorDistance([r, g, b], background)
      const foreground = alpha < 245 ? alpha > 48 : distance >= 38
      if (!foreground) continue
      mask[y * image.width + x] = 1
      contrastSum += distance
      count += 1
    }
  }

  if (count === 0) throw new Error('No subject silhouette could be separated from the image background.')
  return { mask, background, averageContrast: contrastSum / count, foregroundCount: count }
}

function boundsForMask(mask: Uint8Array, width: number, height: number) {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top) throw new Error('The foreground silhouette is empty.')
  return { left, top, right, bottom }
}

function rowSpan(mask: Uint8Array, width: number, y: number): Span | null {
  let left = width
  let right = -1
  for (let x = 0; x < width; x += 1) {
    if (!mask[y * width + x]) continue
    left = Math.min(left, x)
    right = Math.max(right, x)
  }
  return right >= left ? { left, right } : null
}

function nearestSpan(mask: Uint8Array, width: number, height: number, targetY: number, searchRadius: number) {
  for (let offset = 0; offset <= searchRadius; offset += 1) {
    for (const y of [targetY - offset, targetY + offset]) {
      if (y < 0 || y >= height) continue
      const span = rowSpan(mask, width, y)
      if (span) return { y, span }
    }
  }
  throw new Error(`No silhouette pixels found near row ${targetY}.`)
}

function widestSpan(mask: Uint8Array, width: number, top: number, bottom: number) {
  let result: { y: number; span: Span; width: number } | null = null
  for (let y = top; y <= bottom; y += 1) {
    const span = rowSpan(mask, width, y)
    if (!span) continue
    const spanWidth = span.right - span.left
    if (!result || spanWidth > result.width) result = { y, span, width: spanWidth }
  }
  if (!result) throw new Error('Unable to locate the head silhouette.')
  return result
}

function averageRegionColor(image: RasterImage, mask: Uint8Array, bounds: { left: number; top: number; right: number; bottom: number }, startRatio: number, endRatio: number, name: ColorRegion['name']): ColorRegion {
  const height = bounds.bottom - bounds.top + 1
  const startY = Math.round(bounds.top + height * startRatio)
  const endY = Math.round(bounds.top + height * endRatio)
  let red = 0
  let green = 0
  let blue = 0
  let sampleCount = 0
  for (let y = startY; y <= endY; y += 2) {
    for (let x = bounds.left; x <= bounds.right; x += 2) {
      if (!mask[y * image.width + x]) continue
      const [r, g, b] = pixelAt(image, x, y)
      red += r
      green += g
      blue += b
      sampleCount += 1
    }
  }
  return {
    name,
    rgb: sampleCount ? [Math.round(red / sampleCount), Math.round(green / sampleCount), Math.round(blue / sampleCount)] : [0, 0, 0],
    sampleCount,
  }
}

function analyzeHumanoidRaster(image: RasterImage): HumanoidReferenceAnalysis {
  if (image.width < 16 || image.height < 16 || image.data.length !== image.width * image.height * 4) {
    throw new Error('Reference raster must be at least 16 × 16 pixels with RGBA data.')
  }

  const { mask, averageContrast, foregroundCount } = buildForegroundMask(image)
  const bounds = boundsForMask(mask, image.width, image.height)
  const silhouetteHeight = bounds.bottom - bounds.top + 1
  const silhouetteWidth = bounds.right - bounds.left + 1
  if (silhouetteHeight < image.height * 0.25 || silhouetteWidth < image.width * 0.08) {
    throw new Error('The detected subject is too small for reliable humanoid analysis.')
  }

  const centerX = (bounds.left + bounds.right) / 2
  const headLimit = Math.min(bounds.bottom, Math.round(bounds.top + silhouetteHeight * 0.37))
  const head = widestSpan(mask, image.width, bounds.top, headLimit)
  const headWidth = Math.max(1, head.span.right - head.span.left)
  const chinY = Math.round(bounds.top + silhouetteHeight * 0.34)
  const shoulder = nearestSpan(mask, image.width, image.height, Math.round(bounds.top + silhouetteHeight * 0.43), Math.round(silhouetteHeight * 0.08))
  const waist = nearestSpan(mask, image.width, image.height, Math.round(bounds.top + silhouetteHeight * 0.62), Math.round(silhouetteHeight * 0.08))
  const eyeY = Math.round(bounds.top + silhouetteHeight * 0.19)
  const eyeOffset = headWidth * 0.18

  const landmarks: HumanoidLandmarks = {
    HeadTop: { x: centerX, y: bounds.top },
    Chin: { x: centerX, y: chinY },
    HeadLeft: { x: head.span.left, y: head.y },
    HeadRight: { x: head.span.right, y: head.y },
    EyeLeft: { x: clamp(centerX - eyeOffset, head.span.left, head.span.right), y: eyeY },
    EyeRight: { x: clamp(centerX + eyeOffset, head.span.left, head.span.right), y: eyeY },
    ShoulderLeft: { x: shoulder.span.left, y: shoulder.y },
    ShoulderRight: { x: shoulder.span.right, y: shoulder.y },
    WaistLeft: { x: waist.span.left, y: waist.y },
    WaistRight: { x: waist.span.right, y: waist.y },
    FeetBottom: { x: centerX, y: bounds.bottom },
  }

  const coverage = foregroundCount / (silhouetteWidth * silhouetteHeight)
  const contrastScore = clamp((averageContrast - 25) / 105, 0, 1)
  const coverageScore = clamp((coverage - 0.12) / 0.45, 0, 1)
  const overall = clamp(0.35 + contrastScore * 0.35 + coverageScore * 0.3, 0, 0.92)
  const level: ConfidenceLevel = overall >= 0.75 ? 'high' : overall >= 0.55 ? 'medium' : 'low'
  const confidenceByLandmark = Object.fromEntries(LANDMARK_KEYS.map((key) => [key, key.startsWith('Eye') ? clamp(overall - 0.22, 0.2, 0.8) : overall])) as Record<HumanoidLandmarkKey, number>

  const warnings: AnalysisWarning[] = [{
    code: 'heuristic-landmarks',
    message: 'Landmarks are silhouette-based estimates. Review and drag markers before generation.',
  }]
  if (averageContrast < 62) warnings.push({ code: 'low-contrast', message: 'Subject and background have limited contrast; silhouette estimates may be inaccurate.' })
  if (bounds.left <= 1 || bounds.top <= 1 || bounds.right >= image.width - 2 || bounds.bottom >= image.height - 2) {
    warnings.push({ code: 'cropped-subject', message: 'The detected subject touches an image edge and may be cropped.' })
  }

  return {
    schemaVersion: 'humanoid-reference-analysis/v1',
    modelTypeId: 'humanoid/chibi-v1',
    adapterId: 'humanoid/chibi-local-silhouette-v1',
    imageSize: { width: image.width, height: image.height },
    silhouetteBounds: bounds,
    landmarks,
    confidence: { overall, level, landmarks: confidenceByLandmark },
    colorRegions: [
      averageRegionColor(image, mask, bounds, 0, 0.34, 'head'),
      averageRegionColor(image, mask, bounds, 0.34, 0.67, 'torso'),
      averageRegionColor(image, mask, bounds, 0.67, 1, 'lower-body'),
    ],
    warnings,
  }
}

async function analyzeHumanoidImageUrl(url: string) {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('The front reference could not be decoded for analysis.'))
    image.src = url
  })

  const maxDimension = 512
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(16, Math.round(image.naturalWidth * scale))
  const height = Math.max(16, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas analysis is unavailable in this browser.')
  context.drawImage(image, 0, 0, width, height)
  const raster = context.getImageData(0, 0, width, height)
  const result = analyzeHumanoidRaster({ width, height, data: raster.data })

  if (scale === 1) return result
  const inverse = 1 / scale
  const scalePoint = (point: Point) => ({ x: point.x * inverse, y: point.y * inverse })
  return {
    ...result,
    imageSize: { width: image.naturalWidth, height: image.naturalHeight },
    silhouetteBounds: {
      left: result.silhouetteBounds.left * inverse,
      top: result.silhouetteBounds.top * inverse,
      right: result.silhouetteBounds.right * inverse,
      bottom: result.silhouetteBounds.bottom * inverse,
    },
    landmarks: Object.fromEntries(Object.entries(result.landmarks).map(([key, point]) => [key, scalePoint(point)])) as HumanoidLandmarks,
  }
}

const humanoidChibiAnalysisAdapter: ReferenceAnalysisAdapter<HumanoidReferenceAnalysis> = {
  id: 'humanoid/chibi-local-silhouette-v1',
  modelTypeId: 'humanoid/chibi-v1',
  analyzeRaster: analyzeHumanoidRaster,
  analyzeImageUrl: analyzeHumanoidImageUrl,
}

export { LANDMARK_KEYS, analyzeHumanoidRaster, humanoidChibiAnalysisAdapter }
export type { HumanoidLandmarkKey, HumanoidLandmarks, HumanoidReferenceAnalysis, RasterImage, ReferenceAnalysisAdapter }
