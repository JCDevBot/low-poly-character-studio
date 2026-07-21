import assert from 'node:assert/strict'
import { analyzeHumanoidRaster, type RasterImage } from './reference-analysis'

function makeRaster(width: number, height: number, subject: (x: number, y: number) => boolean): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const foreground = subject(x, y)
      data[offset] = foreground ? 190 : 245
      data[offset + 1] = foreground ? 110 : 245
      data[offset + 2] = foreground ? 75 : 245
      data[offset + 3] = 255
    }
  }
  return { width, height, data }
}

const humanoid = makeRaster(100, 160, (x, y) => {
  const head = y >= 10 && y <= 58 && Math.abs(x - 50) <= 24 - Math.abs(y - 34) * 0.16
  const torso = y > 58 && y <= 112 && Math.abs(x - 50) <= (y < 78 ? 19 : 14)
  const leftLeg = y > 112 && y <= 148 && x >= 34 && x <= 48
  const rightLeg = y > 112 && y <= 148 && x >= 52 && x <= 66
  return head || torso || leftLeg || rightLeg
})

const result = analyzeHumanoidRaster(humanoid)
assert.equal(result.schemaVersion, 'humanoid-reference-analysis/v1')
assert.equal(result.modelTypeId, 'humanoid/chibi-v1')
assert.equal(result.adapterId, 'humanoid/chibi-local-silhouette-v1')
assert.ok(result.landmarks.HeadTop.y <= 11)
assert.ok(result.landmarks.FeetBottom.y >= 147)
assert.ok(result.landmarks.HeadLeft.x < result.landmarks.HeadRight.x)
assert.ok(result.landmarks.ShoulderLeft.x < result.landmarks.ShoulderRight.x)
assert.ok(result.landmarks.WaistLeft.x < result.landmarks.WaistRight.x)
assert.ok(result.landmarks.EyeLeft.x < result.landmarks.EyeRight.x)
assert.ok(result.confidence.overall > 0.5)
assert.equal(result.colorRegions.length, 3)
assert.ok(result.warnings.some((warning) => warning.code === 'heuristic-landmarks'))

const cropped = makeRaster(80, 120, (x, y) => x >= 0 && x <= 45 && y >= 0 && y <= 119)
const croppedResult = analyzeHumanoidRaster(cropped)
assert.ok(croppedResult.warnings.some((warning) => warning.code === 'cropped-subject'))

const blank = makeRaster(40, 40, () => false)
assert.throws(() => analyzeHumanoidRaster(blank), /No subject silhouette/)

const invalid: RasterImage = { width: 10, height: 10, data: new Uint8ClampedArray(400) }
assert.throws(() => analyzeHumanoidRaster(invalid), /at least 16/)

console.log('reference analysis contract tests passed')
