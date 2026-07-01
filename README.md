# Low Poly Soldier Maker Studio

## Vision
Build a procedural asset compiler for stylized low-poly humans and military assets.

### Milestone 1
Generate a base GI:
- chibi proportions
- boxer shorts
- A-frame undershirt
- Blender export (.blend/.glb)


## Style Studio

Run the landmark-based StyleDNA editor:

```bash
pnpm install
./scripts/build.sh -studio
```

See `docs/style-studio.md`.


## Local development

Start the API and Style Studio together:

```bash
./scripts/build.sh -dev
```

Then open:

```text
http://localhost:5173/
```
