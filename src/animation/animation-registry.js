(function registerAnimationRegistry(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.PixelCompanionAnimationRegistry = api;
}(globalThis, () => {
  const ANIMATIONS = Object.freeze({
    idle: Object.freeze({
      id: 'idle',
      frames: Object.freeze(['rest', 'breathe', 'float']),
      frameDuration: 1300,
      loop: true,
      transitionDuration: 220,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      cssClass: 'animation-idle',
      fallback: 'idle',
      bubbleText: '...',
      indicator: '',
      speed: 0.8
    }),
    thinking: Object.freeze({
      id: 'thinking',
      frames: Object.freeze(['look-left', 'look-right']),
      frameDuration: 460,
      loop: true,
      transitionDuration: 180,
      scale: 1.03,
      offsetX: 0,
      offsetY: -3,
      cssClass: 'animation-thinking',
      fallback: 'idle',
      bubbleText: 'Thinking...',
      indicator: '···',
      speed: 1
    }),
    working: Object.freeze({
      id: 'working',
      frames: Object.freeze(['lean', 'step-right', 'step-left']),
      frameDuration: 300,
      loop: true,
      transitionDuration: 160,
      scale: 1.04,
      offsetX: 1,
      offsetY: 1,
      cssClass: 'animation-working',
      fallback: 'idle',
      bubbleText: 'Working.',
      indicator: '',
      speed: 1.35
    }),
    waiting: Object.freeze({
      id: 'waiting',
      frames: Object.freeze(['listen', 'look-up']),
      frameDuration: 850,
      loop: true,
      transitionDuration: 190,
      scale: 1.04,
      offsetX: 0,
      offsetY: -4,
      cssClass: 'animation-waiting',
      fallback: 'idle',
      bubbleText: 'Need something?',
      indicator: '?',
      speed: 0.9
    }),
    success: Object.freeze({
      id: 'success',
      frames: Object.freeze(['launch', 'peak', 'settle']),
      frameDuration: 210,
      loop: false,
      transitionDuration: 150,
      scale: 1.08,
      offsetX: 0,
      offsetY: -4,
      cssClass: 'animation-success',
      fallback: 'idle',
      bubbleText: 'Done.',
      indicator: '✦',
      speed: 1.3
    }),
    alert: Object.freeze({
      id: 'alert',
      frames: Object.freeze(['shake-left', 'shake-right']),
      frameDuration: 120,
      loop: true,
      transitionDuration: 100,
      scale: 1.06,
      offsetX: 0,
      offsetY: 0,
      cssClass: 'animation-alert',
      fallback: 'idle',
      bubbleText: 'Hm?',
      indicator: '!',
      speed: 1.7
    }),
    sleepy: Object.freeze({
      id: 'sleepy',
      frames: Object.freeze(['droop', 'doze']),
      frameDuration: 1500,
      loop: true,
      transitionDuration: 300,
      scale: 0.95,
      offsetX: 0,
      offsetY: 6,
      cssClass: 'animation-sleepy',
      fallback: 'idle',
      bubbleText: 'Zzz...',
      indicator: 'z',
      speed: 0.55
    })
  });

  function getAnimation(state) {
    return ANIMATIONS[state] ?? ANIMATIONS.idle;
  }

  function listAnimations() {
    return Object.values(ANIMATIONS);
  }

  return {
    ANIMATIONS,
    getAnimation,
    listAnimations
  };
}));
