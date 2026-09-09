export type RasterImage = {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type RubricLevel = 0 | 1 | 2 | 3 | 4

export type CharacterBodyPlan =
  | 'articulated/humanoid-bipedal'
  | 'articulated/quadrupedal'
  | 'articulated/multi-limbed'
  | 'compact/blob-amorphous'
  | 'compact/head-dominant'
  | 'elongated/serpentine'
  | 'radial/other'
  | 'unknown'

export type AssessmentEvidence<T> = {
  value: T | null
  confidence: number | null
  rubricLevel: RubricLevel
  origin: 'measured' | 'inferred' | 'user-provided' | 'unavailable'
  note?: string
}

export type CharacterImageAssessment = {
  schemaVersion: 'character-image-assessment/v1'
  adapterId: 'generic-local-silhouette-v1'
  input: {
    usability: AssessmentEvidence<'usable' | 'limited' | 'unusable'>
    subjectVisibility: AssessmentEvidence<number>
    backgroundSeparation: AssessmentEvidence<number>
  }
  subject: {
    bounds: { left: number; top: number; right: number; bottom: number }
    center: { x: number; y: number }
    coverage: number
    compactness: number
    widthToHeight: number
    lowerSplitRatio: number
    maxLowerSupports: number
  }
  orientation: {
    facing: AssessmentEvidence<'front' | 'side' | 'back' | 'unknown'>
    imageUp: AssessmentEvidence<'up' | 'down' | 'unknown'>
    groundDirection: AssessmentEvidence<'bottom' | 'top' | 'left' | 'right' | 'unknown'>
  }
  bodyPlan: {
    selected: AssessmentEvidence<CharacterBodyPlan>
    candidates: Array<{
      id: CharacterBodyPlan
      confidence: number
      rubricLevel: RubricLevel
      evidence: string[]
      contradictions: string[]
    }>
  }
  features: {
    bodyCore: AssessmentEvidence<boolean>
    face: AssessmentEvidence<boolean>
    eyes: AssessmentEvidence<number>
    mouth: AssessmentEvidence<boolean>
    lowerSupports: AssessmentEvidence<number>
  }
  userPrior?: {
    description: string
    suggestedBodyPlan: CharacterBodyPlan | null
    confidence: number
  }
  decision: {
    outcome: 'classified' | 'unresolved'
    reason: string
  }
}

type Bounds = { left: number; top: number; right: number; bottom: number }
type Component = { area: number; left: number; top: number; right: number; bottom: number; centerX: number; centerY: number }

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function pixelAt(image: RasterImage, x: number, y: number) {
  const offset = (y * image.width + x) * 4
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2], image.data[offset + 3]] as const
}

function luminance(rgb: readonly number[]) {
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}

function colorDistance(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function estimateBackground(image: RasterImage): [number, number, number] {
  const samples = [
    pixelAt(image, 0, 0),
    pixelAt(image, image.width - 1, 0),
    pixelAt(image, 0, image.height - 1),
    pixelAt(image, image.width - 1, image.height - 1),
  ]
  return [0, 1, 2].map((channel) => Math.round(samples.reduce((sum, sample) => sum + sample[channel], 0) / samples.length)) as [number, number, number]
}

function buildForegroundMask(image: RasterImage) {
  const background = estimateBackground(image)
  const mask = new Uint8Array(image.width * image.height)
  let foregroundCount = 0
  let separationSum = 0
  let foregroundLuminance = 0

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixel = pixelAt(image, x, y)
      if (pixel[3] < 24) continue
      const distance = colorDistance(pixel, background)
      if (distance < 34) continue
      mask[y * image.width + x] = 1
      foregroundCount += 1
      separationSum += distance
      foregroundLuminance += luminance(pixel)
    }
  }

  if (foregroundCount === 0) throw new Error('No subject silhouette could be separated from the image background.')
  return {
    mask,
    foregroundCount,
    averageSeparation: separationSum / foregroundCount,
    averageForegroundLuminance: foregroundLuminance / foregroundCount,
  }
}

function boundsForMask(mask: Uint8Array, width: number, height: number): Bounds {
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

function rowRunCount(mask: Uint8Array, width: number, y: number, left: number, right: number) {
  let runs = 0
  let inRun = false
  for (let x = left; x <= right; x += 1) {
    const foreground = mask[y * width + x] === 1
    if (foreground && !inRun) runs += 1
    inRun = foreground
  }
  return runs
}

function lowerSupportMetrics(mask: Uint8Array, width: number, bounds: Bounds) {
  const height = bounds.bottom - bounds.top + 1
  const start = Math.round(bounds.top + height * 0.62)
  const end = Math.round(bounds.top + height * 0.96)
  let rows = 0
  let splitRows = 0
  let maxSupports = 1
  for (let y = start; y <= end; y += 1) {
    const runs = rowRunCount(mask, width, y, bounds.left, bounds.right)
    if (runs === 0) continue
    rows += 1
    if (runs >= 2) splitRows += 1
    maxSupports = Math.max(maxSupports, runs)
  }
  return {
    lowerSplitRatio: rows ? splitRows / rows : 0,
    maxLowerSupports: maxSupports,
  }
}

function darkInteriorComponents(image: RasterImage, mask: Uint8Array, bounds: Bounds, averageForegroundLuminance: number): Component[] {
  const width = image.width
  const height = image.height
  const visited = new Uint8Array(width * height)
  const threshold = averageForegroundLuminance - 42
  const boundWidth = bounds.right - bounds.left + 1
  const boundHeight = bounds.bottom - bounds.top + 1
  const minArea = Math.max(2, Math.round(boundWidth * boundHeight * 0.0008))
  const maxArea = Math.max(minArea + 1, Math.round(boundWidth * boundHeight * 0.08))
  const components: Component[] = []

  const isCandidate = (x: number, y: number) => {
    if (x <= bounds.left || x >= bounds.right || y <= bounds.top || y >= bounds.bottom) return false
    if (!mask[y * width + x]) return false
    return luminance(pixelAt(image, x, y)) <= threshold
  }

  for (let y = bounds.top + 1; y < bounds.bottom; y += 1) {
    for (let x = bounds.left + 1; x < bounds.right; x += 1) {
      const index = y * width + x
      if (visited[index] || !isCandidate(x, y)) continue
      const queue: Array<[number, number]> = [[x, y]]
      visited[index] = 1
      let cursor = 0
      let area = 0
      let left = x
      let right = x
      let top = y
      let bottom = y
      let sumX = 0
      let sumY = 0
      while (cursor < queue.length) {
        const [cx, cy] = queue[cursor++]
        area += 1
        sumX += cx
        sumY += cy
        left = Math.min(left, cx)
        right = Math.max(right, cx)
        top = Math.min(top, cy)
        bottom = Math.max(bottom, cy)
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]] as const) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const nextIndex = ny * width + nx
          if (visited[nextIndex] || !isCandidate(nx, ny)) continue
          visited[nextIndex] = 1
          queue.push([nx, ny])
        }
      }
      if (area >= minArea && area <= maxArea) {
        components.push({ area, left, top, right, bottom, centerX: sumX / area, centerY: sumY / area })
      }
    }
  }
  return components
}

function inferFace(components: Component[], bounds: Bounds) {
  const width = bounds.right - bounds.left + 1
  const height = bounds.bottom - bounds.top + 1
  const upper = components.filter((component) => component.centerY <= bounds.top + height * 0.62)
  const eyePairs: Array<[Component, Component]> = []
  for (let i = 0; i < upper.length; i += 1) {
    for (let j = i + 1; j < upper.length; j += 1) {
      const a = upper[i]
      const b = upper[j]
      const yDifference = Math.abs(a.centerY - b.centerY) / height
      const xDifference = Math.abs(a.centerX - b.centerX) / width
      if (yDifference <= 0.08 && xDifference >= 0.12 && xDifference <= 0.65) eyePairs.push([a, b])
    }
  }
  const eyes = eyePairs.sort((a, b) => Math.abs(a[0].centerY - a[1].centerY) - Math.abs(b[0].centerY - b[1].centerY))[0]
  if (!eyes) return { hasFace: false, eyeCount: 0, hasMouth: false, confidence: 0 }
  const eyeY = (eyes[0].centerY + eyes[1].centerY) / 2
  const mouth = components.find((component) => {
    const componentWidth = component.right - component.left + 1
    const componentHeight = component.bottom - component.top + 1
    return component.centerY > eyeY + height * 0.05 && component.centerY < bounds.top + height * 0.78 && componentWidth >= componentHeight * 1.35
  })
  return { hasFace: true, eyeCount: 2, hasMouth: Boolean(mouth), confidence: mouth ? 0.88 : 0.72 }
}

function descriptionPrior(description?: string): CharacterImageAssessment['userPrior'] {
  const cleaned = description?.trim()
  if (!cleaned) return undefined
  const text = cleaned.toLowerCase()
  let suggestedBodyPlan: CharacterBodyPlan | null = null
  if (/\b(blob|slime|amorphous|goo|jelly)\b/.test(text)) suggestedBodyPlan = 'compact/blob-amorphous'
  else if (/\b(human|humanoid|person|biped|two[- ]legged)\b/.test(text)) suggestedBodyPlan = 'articulated/humanoid-bipedal'
  else if (/\b(quadruped|four[- ]legged|dog|cat|horse|wolf)\b/.test(text)) suggestedBodyPlan = 'articulated/quadrupedal'
  else if (/\b(snake|serpent|worm|eel)\b/.test(text)) suggestedBodyPlan = 'elongated/serpentine'
  return { description: cleaned, suggestedBodyPlan, confidence: suggestedBodyPlan ? 0.72 : 0.25 }
}

function levelForConfidence(confidence: number): RubricLevel {
  if (confidence >= 0.9) return 3
  if (confidence >= 0.72) return 3
  if (confidence >= 0.5) return 2
  if (confidence > 0) return 1
  return 0
}

export function analyzeCharacterRaster(image: RasterImage, options: { description?: string } = {}): CharacterImageAssessment {
  if (image.width < 16 || image.height < 16 || image.data.length !== image.width * image.height * 4) {
    throw new Error('Reference raster must be at least 16 × 16 pixels with RGBA data.')
  }

  const foreground = buildForegroundMask(image)
  const bounds = boundsForMask(foreground.mask, image.width, image.height)
  const subjectWidth = bounds.right - bounds.left + 1
  const subjectHeight = bounds.bottom - bounds.top + 1
  const boxArea = subjectWidth * subjectHeight
  const coverage = foreground.foregroundCount / (image.width * image.height)
  const compactness = foreground.foregroundCount / boxArea
  const widthToHeight = subjectWidth / subjectHeight
  const { lowerSplitRatio, maxLowerSupports } = lowerSupportMetrics(foreground.mask, image.width, bounds)
  const components = darkInteriorComponents(image, foreground.mask, bounds, foreground.averageForegroundLuminance)
  const face = inferFace(components, bounds)
  const prior = descriptionPrior(options.description)

  const tallness = subjectHeight / subjectWidth
  const humanoidScore = clamp((tallness - 1.05) * 0.45 + lowerSplitRatio * 0.72 + (maxLowerSupports === 2 ? 0.12 : 0))
  const blobShape = clamp((1 - Math.abs(widthToHeight - 1) / 0.75) * 0.48 + compactness * 0.42 + (1 - lowerSplitRatio) * 0.28)
  const blobScore = clamp(blobShape * (maxLowerSupports <= 1 ? 1 : 0.72))
  const quadrupedScore = clamp((widthToHeight - 0.95) * 0.5 + (maxLowerSupports >= 3 ? 0.55 : 0) + lowerSplitRatio * 0.2)
  const serpentineScore = clamp((Math.max(widthToHeight, tallness) - 1.8) * 0.45 + (1 - lowerSplitRatio) * 0.18)

  const rawCandidates: Array<{ id: CharacterBodyPlan; score: number; evidence: string[]; contradictions: string[] }> = [
    {
      id: 'articulated/humanoid-bipedal',
      score: humanoidScore,
      evidence: [
        ...(tallness > 1.3 ? ['vertically elongated silhouette'] : []),
        ...(lowerSplitRatio > 0.28 ? ['lower silhouette repeatedly separates into multiple supports'] : []),
        ...(maxLowerSupports === 2 ? ['two lower support regions detected'] : []),
      ],
      contradictions: [
        ...(lowerSplitRatio < 0.12 ? ['lower silhouette remains a single connected mass'] : []),
        ...(widthToHeight > 1.15 ? ['subject is wider than expected for the initial bipedal heuristic'] : []),
      ],
    },
    {
      id: 'compact/blob-amorphous',
      score: blobScore,
      evidence: [
        ...(compactness > 0.58 ? ['silhouette densely fills its bounding region'] : []),
        ...(lowerSplitRatio < 0.12 ? ['no stable lower limb separation detected'] : []),
        ...(widthToHeight > 0.65 && widthToHeight < 1.45 ? ['compact width-to-height proportion'] : []),
      ],
      contradictions: [
        ...(lowerSplitRatio > 0.35 ? ['strong lower support separation suggests articulated limbs'] : []),
        ...(maxLowerSupports >= 3 ? ['several lower supports detected'] : []),
      ],
    },
    {
      id: 'articulated/quadrupedal',
      score: quadrupedScore,
      evidence: [
        ...(widthToHeight > 1.15 ? ['horizontally broad silhouette'] : []),
        ...(maxLowerSupports >= 3 ? ['three or more lower support regions detected'] : []),
      ],
      contradictions: [
        ...(maxLowerSupports <= 1 ? ['no separated lower supports detected'] : []),
      ],
    },
    {
      id: 'elongated/serpentine',
      score: serpentineScore,
      evidence: [
        ...(Math.max(widthToHeight, tallness) > 2 ? ['strongly elongated silhouette'] : []),
        ...(lowerSplitRatio < 0.1 ? ['silhouette lacks stable limb separation'] : []),
      ],
      contradictions: [
        ...(maxLowerSupports >= 2 ? ['multiple lower supports detected'] : []),
      ],
    },
  ]

  if (prior?.suggestedBodyPlan) {
    const candidate = rawCandidates.find((item) => item.id === prior.suggestedBodyPlan)
    if (candidate) {
      candidate.score = clamp(candidate.score + 0.12)
      candidate.evidence.push('user description supplies a weak directional prior')
    }
  }

  const candidates = rawCandidates
    .map((candidate) => ({
      id: candidate.id,
      confidence: Number(candidate.score.toFixed(3)),
      rubricLevel: levelForConfidence(candidate.score),
      evidence: candidate.evidence,
      contradictions: candidate.contradictions,
    }))
    .sort((a, b) => b.confidence - a.confidence)

  const top = candidates[0]
  const second = candidates[1]
  const separation = top.confidence - second.confidence
  const classified = top.confidence >= 0.58 && separation >= 0.08
  const selectedConfidence = classified ? top.confidence : Math.min(top.confidence, 0.49)
  const selectedBodyPlan: CharacterBodyPlan = classified ? top.id : 'unknown'

  const inputVisibility = clamp(coverage / 0.2)
  const backgroundSeparation = clamp((foreground.averageSeparation - 24) / 120)
  const usabilityConfidence = Math.min(inputVisibility, backgroundSeparation)
  const usability = usabilityConfidence >= 0.6 ? 'usable' : usabilityConfidence >= 0.3 ? 'limited' : 'unusable'
  const lowerSupportConfidence = clamp(lowerSplitRatio + (maxLowerSupports > 1 ? 0.25 : 0))

  return {
    schemaVersion: 'character-image-assessment/v1',
    adapterId: 'generic-local-silhouette-v1',
    input: {
      usability: { value: usability, confidence: usabilityConfidence, rubricLevel: levelForConfidence(usabilityConfidence), origin: 'measured' },
      subjectVisibility: { value: coverage, confidence: inputVisibility, rubricLevel: 4, origin: 'measured' },
      backgroundSeparation: { value: foreground.averageSeparation, confidence: backgroundSeparation, rubricLevel: 4, origin: 'measured' },
    },
    subject: {
      bounds,
      center: { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 },
      coverage,
      compactness,
      widthToHeight,
      lowerSplitRatio,
      maxLowerSupports,
    },
    orientation: {
      facing: face.hasFace
        ? { value: 'front', confidence: face.confidence, rubricLevel: levelForConfidence(face.confidence), origin: 'inferred', note: 'paired eye-like marks and mouth-like mark support a front-facing interpretation' }
        : { value: 'unknown', confidence: 0.2, rubricLevel: 1, origin: 'unavailable', note: 'no reliable face-orientation cue detected' },
      imageUp: maxLowerSupports >= 2
        ? { value: 'up', confidence: 0.68, rubricLevel: 2, origin: 'inferred', note: 'separated supports cluster toward the image bottom' }
        : { value: 'unknown', confidence: 0.25, rubricLevel: 1, origin: 'unavailable' },
      groundDirection: maxLowerSupports >= 2
        ? { value: 'bottom', confidence: 0.72, rubricLevel: 3, origin: 'inferred' }
        : { value: 'unknown', confidence: 0.25, rubricLevel: 1, origin: 'unavailable' },
    },
    bodyPlan: {
      selected: classified
        ? { value: selectedBodyPlan, confidence: selectedConfidence, rubricLevel: levelForConfidence(selectedConfidence), origin: 'inferred' }
        : { value: 'unknown', confidence: selectedConfidence, rubricLevel: levelForConfidence(selectedConfidence), origin: 'inferred', note: 'top morphology candidates are not sufficiently separated; abstaining instead of forcing a class' },
      candidates,
    },
    features: {
      bodyCore: { value: true, confidence: 0.98, rubricLevel: 4, origin: 'measured' },
      face: { value: face.hasFace, confidence: face.hasFace ? face.confidence : 0.35, rubricLevel: face.hasFace ? levelForConfidence(face.confidence) : 1, origin: face.hasFace ? 'inferred' : 'unavailable' },
      eyes: { value: face.eyeCount, confidence: face.hasFace ? face.confidence : 0.25, rubricLevel: face.hasFace ? levelForConfidence(face.confidence) : 1, origin: face.hasFace ? 'inferred' : 'unavailable' },
      mouth: { value: face.hasMouth, confidence: face.hasMouth ? face.confidence : face.hasFace ? 0.45 : 0.2, rubricLevel: face.hasMouth ? levelForConfidence(face.confidence) : 1, origin: face.hasMouth ? 'inferred' : 'unavailable' },
      lowerSupports: { value: maxLowerSupports, confidence: lowerSupportConfidence, rubricLevel: 4, origin: 'measured' },
    },
    userPrior: prior,
    decision: classified
      ? { outcome: 'classified', reason: `${top.id} leads the next candidate by ${separation.toFixed(3)} with confidence ${top.confidence.toFixed(3)}.` }
      : { outcome: 'unresolved', reason: `Morphology evidence is ambiguous (${top.id} ${top.confidence.toFixed(3)} vs ${second.id} ${second.confidence.toFixed(3)}); no model type should be selected yet.` },
  }
}
