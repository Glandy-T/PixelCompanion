(function registerPrivateFramePlayer(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.PixelCompanionPrivateFramePlayer = api;
}(globalThis, () => {
  class PrivateFramePlayer {
    constructor(options = {}) {
      if (!options.image) {
        throw new Error('PrivateFramePlayer requires an image element.');
      }
      this.image = options.image;
      this.profile = null;
      this.state = null;
      this.animation = null;
      this.frameIndex = 0;
      this.frameStartedAt = 0;
      this.lastFrameUrl = null;
    }

    setProfile(profile) {
      this.profile = profile?.source === 'private' ? profile : null;
      this.state = null;
      this.animation = null;
      this.frameIndex = 0;
      this.lastFrameUrl = null;
    }

    apply(snapshot, now = performance.now()) {
      const state = snapshot?.animation?.id ?? 'idle';
      const animation = this.profile?.animations?.[state] ?? this.profile?.animations?.idle ?? null;
      if (!animation) {
        return { changed: false, source: this.profile ? 'private-static' : 'placeholder', state, frameIndex: null };
      }

      if (state !== this.state || animation !== this.animation) {
        this.state = state;
        this.animation = animation;
        this.frameIndex = 0;
        this.frameStartedAt = now;
      } else {
        while (now - this.frameStartedAt >= animation.frameDuration) {
          if (animation.loop) {
            this.frameIndex = (this.frameIndex + 1) % animation.frames.length;
            this.frameStartedAt += animation.frameDuration;
          } else if (this.frameIndex < animation.frames.length - 1) {
            this.frameIndex += 1;
            this.frameStartedAt += animation.frameDuration;
          } else {
            this.frameStartedAt = now;
            break;
          }
        }
      }

      const frameUrl = animation.frames[this.frameIndex];
      const changed = frameUrl !== this.lastFrameUrl;
      if (changed) {
        this.image.src = frameUrl;
        this.lastFrameUrl = frameUrl;
      }
      return { changed, source: 'private-frames', state, frameIndex: this.frameIndex };
    }
  }

  return { PrivateFramePlayer };
}));
