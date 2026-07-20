# Humanoid Chibi Gold Standard

This document defines the canonical visual target for the first supported model type: `humanoid/chibi-v1`.

The product owner's approved character sheet is the source of truth. The approved reference should be stored in this repository as:

```text
docs/reference/gold-standard-humanoid-chibi.webp
```

## Character identity

The gold standard is a friendly, neutral, stylized low-poly childlike humanoid intended as the base body for later clothing, equipment, hair, and character variation.

The baseline presentation is:

- barefoot
- boxer briefs
- white A-frame undershirt
- short faceted brown hair
- no helmet, gear, or accessories
- relaxed neutral standing pose

## Silhouette and proportions

- Approximately 2.6 to 2.8 heads tall.
- Head is the dominant mass and is wider than the upper torso.
- Face is broad and softly rounded with a short chin and minimal muzzle projection.
- Ears are large, simple, and clearly visible in front and side silhouettes.
- Neck is short and narrow.
- Shoulders are narrow and gently sloped.
- Torso is compact with limited waist taper.
- Arms are slightly long for the body and terminate in oversized simplified hands.
- Legs are short and sturdy with broad, oversized bare feet.
- The center of mass reads stable and grounded rather than top-heavy.

## Face and hair language

- Large vertical black oval eyes with no realistic sclera or iris detail.
- Small faceted nose.
- Minimal mouth line with a neutral, approachable expression.
- No realistic skin pores, eyelashes, or facial microdetail.
- Hair reads as a separate faceted cap with a chunky, irregular fringe.
- Features must remain readable at game-camera distance.

## Geometry and surface language

- Deliberately low-poly, faceted construction.
- Target approximately 2,000 triangles for the unclothed base character; an acceptable initial range is 1,500 to 3,000 triangles.
- Silhouette quality takes precedence over evenly distributed topology.
- Joint areas must contain enough topology for clean basic deformation without losing the faceted style.
- Avoid visibly accidental shading gradients, pinching, intersections, detached geometry, and paper-thin body parts.
- Materials should have a soft hand-painted appearance with restrained gradients and no photorealistic texture detail.
- Flat or controlled smooth shading may be mixed intentionally, but facet placement must read as designed.

## Required review views

Every implementation claiming to match this standard must provide comparable renders of:

1. front
2. three-quarter front
3. side
4. three-quarter back
5. back
6. real-time shaded viewport
7. wireframe

All five turnaround views should use the same neutral pose, camera height, focal treatment, and lighting so silhouette differences are easy to inspect.

## Rig and deformation expectations

The rigged result must preserve the gold-standard silhouette in its neutral pose and support basic motion without obvious collapse at:

- shoulders
- elbows
- wrists
- hips
- knees
- ankles
- neck

Hands and feet may use simplified articulation in the first version. Facial rigging and individual fingers are not required for `humanoid/chibi-v1`.

## Acceptance guidance

Visual comparison is part of acceptance, not an optional polish pass. A technically valid GLB is insufficient when the proportions, silhouette, expression, or faceted surface language materially depart from this standard.

Later model types may intentionally use different proportions or styles, but those differences must be declared in their own model type manifests rather than changing this baseline silently.
