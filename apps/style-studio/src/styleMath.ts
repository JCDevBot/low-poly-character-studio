export type Point = { x: number; y: number }

export type LandmarkMap = Record<string, Point | null>

export type StyleDNA = {
  source: string
  imageSize: { width: number; height: number }
  measurements: {
    totalHeightPx: number | null
    headHeightRatio: number | null
    headWidthToHeight: number | null
    eyeHeightFromTopRatio: number | null
    eyeSpacingToHeadWidth: number | null
    shoulderWidthToHeadWidth: number | null
    torsoHeightRatio: number | null
    legLengthRatio: number | null
  }
  blenderHints: {
    totalHeight: number
    headWidth: number
    headDepth: number
    headHeight: number
    eyeSpacing: number
    eyeZ: number
    torsoWidth: number
    torsoHeight: number
    legLength: number
  }
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function get(landmarks: LandmarkMap, key: string): Point | null {
  return landmarks[key] ?? null
}

export function computeStyleDNA(
  source: string,
  imageSize: { width: number; height: number },
  landmarks: LandmarkMap,
): StyleDNA {
  const headTop = get(landmarks, 'HeadTop')
  const chin = get(landmarks, 'Chin')
  const headLeft = get(landmarks, 'HeadLeft')
  const headRight = get(landmarks, 'HeadRight')
  const eyeLeft = get(landmarks, 'EyeLeft')
  const eyeRight = get(landmarks, 'EyeRight')
  const shoulderLeft = get(landmarks, 'ShoulderLeft')
  const shoulderRight = get(landmarks, 'ShoulderRight')
  const waist = get(landmarks, 'Waist')
  const footBottom = get(landmarks, 'FootBottom')

  const totalHeightPx = headTop && footBottom ? Math.abs(footBottom.y - headTop.y) : null
  const headHeightPx = headTop && chin ? Math.abs(chin.y - headTop.y) : null
  const headWidthPx = headLeft && headRight ? distance(headLeft, headRight) : null
  const eyeMid = eyeLeft && eyeRight ? midpoint(eyeLeft, eyeRight) : null
  const shoulderWidthPx = shoulderLeft && shoulderRight ? distance(shoulderLeft, shoulderRight) : null
  const torsoHeightPx = chin && waist ? Math.abs(waist.y - chin.y) : null
  const legLengthPx = waist && footBottom ? Math.abs(footBottom.y - waist.y) : null

  const headHeightRatio = totalHeightPx && headHeightPx ? headHeightPx / totalHeightPx : null
  const headWidthToHeight = headHeightPx && headWidthPx ? headWidthPx / headHeightPx : null
  const eyeHeightFromTopRatio = headTop && chin && eyeMid ? (eyeMid.y - headTop.y) / (chin.y - headTop.y) : null
  const eyeSpacingToHeadWidth = eyeLeft && eyeRight && headWidthPx ? distance(eyeLeft, eyeRight) / headWidthPx : null
  const shoulderWidthToHeadWidth = shoulderWidthPx && headWidthPx ? shoulderWidthPx / headWidthPx : null
  const torsoHeightRatio = totalHeightPx && torsoHeightPx ? torsoHeightPx / totalHeightPx : null
  const legLengthRatio = totalHeightPx && legLengthPx ? legLengthPx / totalHeightPx : null

  // Blender hints are deliberately conservative. They map 2D measurements
  // into our current chibi model scale, not literal real-world dimensions.
  const totalHeight = 1.35
  const headHeight = clamp((headHeightRatio ?? 0.40) * totalHeight * 0.78, 0.34, 0.50)
  const headWidth = clamp(headHeight * (headWidthToHeight ?? 0.95), 0.34, 0.52)
  const headDepth = clamp(headWidth * 0.86, 0.30, 0.46)
  const eyeSpacing = clamp(headWidth * (eyeSpacingToHeadWidth ?? 0.42), 0.14, 0.24)
  const eyeZ = clamp(1.15 - ((eyeHeightFromTopRatio ?? 0.52) * headHeight * 0.55), 0.94, 1.08)
  const torsoWidth = clamp(headWidth * (shoulderWidthToHeadWidth ?? 0.70) * 0.72, 0.24, 0.38)
  const torsoHeight = clamp((torsoHeightRatio ?? 0.27) * totalHeight * 0.70, 0.20, 0.32)
  const legLength = clamp((legLengthRatio ?? 0.28) * totalHeight * 0.70, 0.22, 0.38)

  return {
    source,
    imageSize,
    measurements: {
      totalHeightPx,
      headHeightRatio,
      headWidthToHeight,
      eyeHeightFromTopRatio,
      eyeSpacingToHeadWidth,
      shoulderWidthToHeadWidth,
      torsoHeightRatio,
      legLengthRatio,
    },
    blenderHints: {
      totalHeight,
      headWidth,
      headDepth,
      headHeight,
      eyeSpacing,
      eyeZ,
      torsoWidth,
      torsoHeight,
      legLength,
    },
  }
}
