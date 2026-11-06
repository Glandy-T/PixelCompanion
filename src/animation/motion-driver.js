(function register(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PixelCompanionMotionDriver = api;
}(globalThis, () => {
  const STATES = ['idle', 'thinking', 'working', 'waiting', 'success', 'alert', 'sleepy'];
  const rest = () => ({ x: 0, y: 0, lean: 0, turn: 0, head: 0, arm: 0, scale: 1 });
  function samplePose(state, seconds) {
    const p = rest();
    const wave = Math.sin(seconds * Math.PI * 2);
    switch (state) {
      case 'thinking': p.turn = wave * 0.18; p.head = 0.15; p.arm = -0.65; break;
      case 'working': p.lean = -0.12; p.arm = wave * 0.45; p.y = Math.abs(wave) * 0.04; break;
      case 'waiting': p.head = -0.18; p.arm = 0.25 + wave * 0.1; break;
      case 'success': p.y = Math.max(0, Math.sin(Math.min(seconds / 1.2, 1) * Math.PI)) * 0.4; p.arm = -1.1; break;
      case 'alert': p.x = Math.sin(seconds * 40) * 0.035; p.scale = 1.04; break;
      case 'sleepy': p.y = -0.12; p.head = 0.32; p.scale = 0.96 + Math.sin(seconds * 1.5) * 0.012; break;
      default: p.y = Math.sin(seconds * 2) * 0.035; p.scale = 1 + Math.sin(seconds * 2) * 0.012;
    }
    return p;
  }

  // Renderer-neutral contract: setState, tick, snapshot, completion and fallback.
  // A future skeletal player can implement this contract with AnimationMixer clips.
  class MotionDriver {
    constructor({ now = () => performance.now(), onComplete = () => {}, transitionMs = 220 } = {}) {
      this.now = now;
      this.onComplete = onComplete;
      this.transitionMs = Math.max(1, transitionMs);
      this.state = 'idle';
      this.startedAt = now();
      this.from = rest();
      this.pose = rest();
      this.completed = false;
      this.completedAt = null;
      this.speed = 1;
    }
    setState(state, { speed = 1 } = {}, now = this.now()) {
      const next = STATES.includes(state) ? state : 'idle';
      this.speed = Number.isFinite(speed) ? Math.max(0.1, Math.min(3, speed)) : 1;
      if (next === this.state) return this.snapshot(now);
      this.tick(now);
      this.from = { ...this.pose };
      this.state = next;
      this.startedAt = now;
      this.completed = false;
      this.completedAt = null;
      return this.snapshot(now);
    }
    tick(now = this.now()) {
      const elapsed = Math.max(0, now - this.startedAt);
      if (this.state === 'success' && elapsed * this.speed >= 1200 && !this.completed) {
        this.completed = true;
        this.completedAt = now;
        this.from = { ...this.pose };
        this.onComplete({ state: this.state });
      }
      const target = samplePose(this.completed ? 'idle' : this.state, elapsed / 1000 * this.speed);
      const t = Math.min(1, (this.completedAt === null ? elapsed : now - this.completedAt) / this.transitionMs);
      const blend = t * t * (3 - 2 * t);
      for (const key of Object.keys(target)) this.pose[key] = this.from[key] + (target[key] - this.from[key]) * blend;
      return this.snapshot(now);
    }
    snapshot(now = this.now()) {
      return { state: this.state, pose: { ...this.pose }, speed: this.speed,
        phase: this.completed ? 'rest' : 'playing', completed: this.completed,
        transitioning: now - this.startedAt < this.transitionMs };
    }
  }
  return { MotionDriver, samplePose, STATES };
}));
