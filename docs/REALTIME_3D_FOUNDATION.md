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

## Generic activity lifecycle

The independent Debug Window now includes an Activity lifecycle section. Start
the observe test: look around (thinking, 4 seconds), settle (idle, 2 seconds), then
finish. Pause/Resume/Cancel exercise the same main-process runtime. A cooldown
rejection appears beside the controls. No activity starts automatically.

`src/activities/activity-registry.js` provides bounded, cloned definitions, with
neutral public fixtures. Each future character can supply its own definition list
to the registry. This is a data interface; private activities are not loaded yet,
and no scripts from character files are executed.

`ActivityEngine` owns a short-lived activity and tracks active elapsed time,
ordered steps, progress, blockers, completion and cooldown. Data remains in memory.
It does not change ecology drives, relationship scores, or AI bridge mappings.
Definitions reuse the existing behavior intents so both image and 3D adapters work.

Behavior requests pass through EventBus and the existing priority/cooldown checks.
Activities claim behavior only when idle, pause on foreign transitions, and resume
when idle again. A `behavior:release` event checks both source and sequence before
returning a state to idle; stale releases cannot overwrite newer behavior. Local
activity completion is never translated into AI task success.

Click, double-click and quick interactions give a 1.5-second interruption window.
Dragging, hiding and system suspend are separate blockers, and all blockers must
clear before resume. Suspended time is not added to progress. The timer caps an
unusually late tick at one second rather than completing activities in a burst.
Closing the pet cancels the activity, releases only its own behavior and removes
the timer/subscriptions. The activity controls and IPC are development-only;
production has no automatic activities or diagnostic controls.

The transparent WebGL canvas uses alpha zero, max device-pixel-ratio 2 and 30 FPS.
Hidden documents stop drawing. Mesh raycasting gates click, double-click, menu,
hover and drag initiation. Transparent canvas space requests Electron's existing
mouse passthrough; captured drags keep their interaction until released.
WebGL initialization failure/context loss restores the public SVG. Geometries,
materials, renderer and resize observation are released on disposal.

Private models, animations and personality configuration must remain outside the
public repository. No third-party pet code or artwork is included here.
