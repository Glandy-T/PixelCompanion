(function registerAnimationPlayer(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.PixelCompanionAnimationPlayer = api;
}(globalThis, () => {
  class AnimationPlayer {
    constructor(options) {
      if (!options?.root || !options?.motion || !options?.indicator) {
        throw new Error('AnimationPlayer requires root, motion, and indicator elements.');
      }

      this.root = options.root;
      this.motion = options.motion;
      this.indicator = options.indicator;
      this.lastSignature = '';
    }

    apply(snapshot) {
      const { animation, transition } = snapshot;
      const signature = [animation.id, snapshot.frameIndex, transition ? 'transitioning' : 'settled'].join(':');
      if (signature === this.lastSignature) {
        return false;
      }

      this.lastSignature = signature;
      this.root.dataset.animation = animation.id;
      this.root.dataset.animationFrame = snapshot.frame;
      this.root.classList.toggle('is-animation-transitioning', Boolean(transition));
      this.motion.style.setProperty('--animation-scale', animation.scale);
      this.motion.style.setProperty('--animation-offset-x', `${animation.offsetX}px`);
      this.motion.style.setProperty('--animation-offset-y', `${animation.offsetY}px`);
      this.motion.style.setProperty('--animation-transition', `${animation.transitionDuration}ms`);
      this.motion.style.setProperty('--animation-duration', `${snapshot.frameDuration * animation.frames.length}ms`);
      this.indicator.textContent = animation.indicator;
      this.indicator.hidden = !animation.indicator;
      return true;
    }
  }

  return { AnimationPlayer };
}));
