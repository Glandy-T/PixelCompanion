# Realtime 3D foundation

Run `npm run start:3d` for the code-generated geometric placeholder. `npm start`
retains the existing image/private-frame path. No model, texture, external service,
or personal character definition is required. Three.js is installed locally and
included as a production dependency; the app never loads it from a CDN.

Development requires Node.js 24 or newer. Run `npm ci`, then `npm start` or
`npm run start:3d`. The prestart scripts use Electron's own installer to ensure
the native binary exists (a fresh install may download it). This is needed with
the current Electron npm package, which exposes install.js but does not declare
a postinstall lifecycle script. Packaged applications do not run npm or download
Electron at launch.

Maintenance baseline: Electron 43.8.7 and electron-builder 26.18.0. A scoped npm
override upgrades only minimatch 7–10 in the development toolchain to 11.0.5 for
GHSA-g3hv-75wg-m249. Legacy minimatch 3/5 instances are not replaced. Remove the
override once the upstream toolchain declares patched versions. Re-run `npm test`,
`npm run pack`, and packaged 2D/3D smoke tests when changing this override.

The main process passes only a renderer selection query. Behavior, ecology and
bridge mappings are unchanged. Renderer-local motion receives the same seven
behavior intents and never changes BehaviorEngine state.

`MotionDriver` is a renderer-neutral procedural animation contract:

- `setState(intent, { speed }, now)` selects an intent; missing intent uses idle.
- `tick(now)` returns a finite pose and transition/phase snapshot.
- Interruption blends from the current pose over 220 ms without cumulative offsets.
- Success is a one-shot, invokes `onComplete` once, then visually rests. This does
  not claim task completion or alter behavior state.
- The adapter provides `hitTest(clientX, clientY)` and `dispose()`.

`three-placeholder.mjs` maps that contract onto geometric body/head/arm groups.
A future private skeletal adapter can use Three.js AnimationMixer and named clips
behind the same intent boundary. Model loading, VRM, GLB manifests and character
specific ecology remain future work. This phase does not claim to load real models.

The transparent WebGL canvas uses alpha zero, max device-pixel-ratio 2 and 30 FPS.
Hidden documents stop drawing. Mesh raycasting gates click, double-click, menu,
hover and drag initiation. Transparent canvas space requests Electron's existing
mouse passthrough; captured drags keep their interaction until released.
WebGL initialization failure/context loss restores the public SVG. Geometries,
materials, renderer and resize observation are released on disposal.

Private models, animations and personality configuration must remain outside the
public repository. No third-party pet code or artwork is included here.
