(function registerAnimationController(root, factory) {
  const api = factory(root.PixelCompanionAnimationRegistry);
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./animation-registry'));
  }
  root.PixelCompanionAnimationController = api;
}(globalThis, (registry) => {
  class AnimationController {
    constructor(options = {}) {
      if (!registry) {
        throw new Error('AnimationController requires an animation registry.');
      }

      this.getAnimation = options.getAnimation ?? registry.getAnimation;
      this.now = options.now ?? (() => performance.now());
      this.animation = this.getAnimation(options.initialState ?? 'idle');
      this.frameIndex = 0;
      this.frameStartedAt = this.now();
      this.transition = null;
      this.lastState = this.animation.id;
    }

    setState(state, now = this.now()) {
      const nextAnimation = this.getAnimation(state);
      if (nextAnimation.id === this.animation.id) {
        return this.getSnapshot(now);
      }

      const previousAnimation = this.animation;
      this.animation = nextAnimation;
      this.frameIndex = 0;
      this.frameStartedAt = now;
      this.lastState = nextAnimation.id;
      this.transition = {
        from: previousAnimation.id,
        to: nextAnimation.id,
        startedAt: now,
        duration: nextAnimation.transitionDuration
      };

      return this.getSnapshot(now);
    }

    tick(now = this.now()) {
      const frameDuration = this.getEffectiveFrameDuration();
      while (now - this.frameStartedAt >= frameDuration) {
        if (this.animation.loop) {
          this.frameIndex = (this.frameIndex + 1) % this.animation.frames.length;
          this.frameStartedAt += frameDuration;
        } else if (this.frameIndex < this.animation.frames.length - 1) {
          this.frameIndex += 1;
          this.frameStartedAt += frameDuration;
        } else {
          this.frameStartedAt = now;
          break;
        }
      }

      if (this.transition && now - this.transition.startedAt >= this.transition.duration) {
        this.transition = null;
      }

      return this.getSnapshot(now);
    }

    getSnapshot(now = this.now()) {
      const frame = this.animation.frames[this.frameIndex];
      const transition = this.transition && {
        ...this.transition,
        progress: Math.min(1, Math.max(0, (now - this.transition.startedAt) / this.transition.duration))
      };

      return {
        animation: this.animation,
        state: this.lastState,
        frameIndex: this.frameIndex,
        frame,
        phase: transition ? `enter:${frame}` : frame,
        transition,
        speed: this.animation.speed,
        frameDuration: this.getEffectiveFrameDuration()
      };
    }

    getEffectiveFrameDuration() {
      return Math.max(1, Math.round(this.animation.frameDuration / this.animation.speed));
    }
  }

  return { AnimationController };
}));
