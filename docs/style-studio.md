# Style Studio v0.1

The Style Studio turns reference art into StyleDNA.

## Run

```bash
pnpm install
./scripts/build.sh -studio
```

Open the local Vite URL.

## Workflow

1. Select `Front`.
2. Click each landmark in order.
3. Download `landmarks.front.json` if you want to preserve raw points.
4. Download `little_guy_style.json`.
5. Copy `little_guy_style.json` to:

```text
packages/style-engine/output/little_guy_style.json
```

The next step will be wiring the Blender generator to read this file directly.
