const petCharacter = document.querySelector('#pet-character');
const characterImage = document.querySelector('#character-image');
const quickActions = document.querySelector('#quick-actions');
const speechBubble = document.querySelector('#speech-bubble');
const notice = document.querySelector('#notice');
const petWindow = document.querySelector('.pet-window');
const petMotion = document.querySelector('#pet-motion');
const stateIndicator = document.querySelector('#state-indicator');
const threeCanvas = document.querySelector('#character-3d');
let threePlayer = null;
const wantsThree = new URLSearchParams(window.location.search).get('renderer') === '3d';

let isPointerOverCharacter = false;
let dragState = null;
let singleClickTimer = null;
let noticeTimer = null;
let bubbleTimer = null;
let suppressClickUntil = 0;
let lastBubbleMessage = '';
let lastBubbleAt = 0;
let lastAnimationReportAt = 0;
let quickActionsTimer = null;
let quickActionsEnabled = true;

const animationController = new window.PixelCompanionAnimationController.AnimationController();
const animationPlayer = new window.PixelCompanionAnimationPlayer.AnimationPlayer({
  root: petWindow,
  motion: petMotion,
  indicator: stateIndicator
});
const privateFramePlayer = new window.PixelCompanionPrivateFramePlayer.PrivateFramePlayer({ image: characterImage });

function toScreenPoint(event) {
  return { screenX: event.screenX, screenY: event.screenY };
}

function setInteractive(isInteractive) {
  if (isPointerOverCharacter === isInteractive) {
    return;
  }

  isPointerOverCharacter = isInteractive;
  window.pet.setInteractive(isInteractive);
}

function showQuickActions() {
  if (!quickActionsEnabled) {
    return;
  }
  window.clearTimeout(quickActionsTimer);
  quickActions.classList.add('is-visible');
  quickActions.setAttribute('aria-hidden', 'false');
}

function applyUiSettings(settings) {
  quickActionsEnabled = settings?.quickActionsEnabled !== false;
  if (!quickActionsEnabled) {
    window.clearTimeout(quickActionsTimer);
    quickActions.classList.remove('is-visible');
    quickActions.setAttribute('aria-hidden', 'true');
  }
}

function scheduleQuickActionsHide() {
  window.clearTimeout(quickActionsTimer);
  quickActionsTimer = window.setTimeout(() => {
    quickActions.classList.remove('is-visible');
    quickActions.setAttribute('aria-hidden', 'true');
  }, 260);
}

function showNotice(message) {
  notice.textContent = message;
  notice.classList.add('is-visible');
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => notice.classList.remove('is-visible'), 1800);
}

function showClickFeedback() {
  petCharacter.classList.add('is-clicked');
  window.pet.recordEcologyInteraction('single-click');
  showNotice('Hello!');
  window.setTimeout(() => petCharacter.classList.remove('is-clicked'), 220);
}

function showSpeechBubble(message = 'Hello, Glandy.', durationMs = 2600, options = {}) {
  const now = Date.now();
  if (!options.force && message === lastBubbleMessage && now - lastBubbleAt < 1400) {
    return;
  }

  lastBubbleMessage = message;
  lastBubbleAt = now;
  speechBubble.textContent = message;
  speechBubble.hidden = false;
  window.clearTimeout(bubbleTimer);
  bubbleTimer = window.setTimeout(() => {
    speechBubble.hidden = true;
  }, durationMs);
}

function applyCharacterProfile(profile) {
  if (wantsThree) return;
  if (profile?.source !== 'private' || typeof profile.imageUrl !== 'string') {
    return;
  }

  const candidate = new Image();
  candidate.onload = () => {
    characterImage.src = profile.imageUrl;
    privateFramePlayer.setProfile(profile);
    characterImage.alt = 'Local pixel character';
    petCharacter.setAttribute('aria-label', 'Local pixel character');
  };
  // Keep the public placeholder visible if a local file disappears or fails to decode.
  candidate.onerror = () => {};
  candidate.src = profile.imageUrl;
}

function applyBehaviorState(snapshot) {
  if (!snapshot?.state) {
    return;
  }

  petWindow.dataset.behavior = snapshot.state;
  const animationSnapshot = animationController.setState(snapshot.state);
  renderAnimation(animationSnapshot);
  const bubbleText = animationSnapshot.animation.bubbleText || snapshot.bubbleText || snapshot.state;
  showSpeechBubble(bubbleText, Math.min(snapshot.durationMs ?? 2200, 2400));
}

function reportAnimationState(snapshot, privateFrame) {
  const now = Date.now();
  if (now - lastAnimationReportAt < 100) {
    return;
  }

  lastAnimationReportAt = now;
  window.pet.reportAnimationState({
    animation: snapshot.animation?.id ?? 'idle',
    frame: privateFrame?.frameIndex ?? snapshot.frame ?? 0,
    phase: snapshot.phase ?? 'rest',
    transition: snapshot.transition
      ? { from: snapshot.transition.from, to: snapshot.transition.to }
      : null,
    bubble: snapshot.animation?.bubbleText ?? '',
    speed: snapshot.speed ?? 1,
    assetSource: privateFrame?.source ?? 'placeholder'
  });
}

function renderAnimation(snapshot) {
  if (threePlayer) {
    threePlayer.setState(snapshot.animation.id, { speed: snapshot.speed });
    const motion = threePlayer.tick(performance.now());
    animationPlayer.apply(snapshot);
    reportAnimationState({ ...snapshot, phase: motion.phase }, { source: 'placeholder-3d', frameIndex: 0 });
    return;
  }
  const privateFrame = privateFramePlayer.apply(snapshot);
  if (animationPlayer.apply(snapshot) || privateFrame.changed) {
    reportAnimationState(snapshot, privateFrame);
  }
}

function animationLoop(now) {
  renderAnimation(animationController.tick(now));
  window.requestAnimationFrame(animationLoop);
}

function updateInteractiveTarget(event) {
  if (dragState) { setInteractive(true); return; }
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const overCharacter = petCharacter.contains(target) && hitsCharacter(event);
  const overQuickActions = quickActions.contains(target);
  setInteractive(overCharacter || overQuickActions);
  if (overCharacter || overQuickActions) {
    showQuickActions();
  } else {
    scheduleQuickActionsHide();
  }
}

function hitsCharacter(event) {
  return !threePlayer || threePlayer.hitTest(event.clientX, event.clientY);
}

document.addEventListener('mousemove', updateInteractiveTarget);

document.addEventListener('mouseleave', () => {
  if (!dragState) {
    setInteractive(false);
  }
});

document.addEventListener('pointermove', (event) => {
  updateInteractiveTarget(event);

  if (!dragState) {
    return;
  }

  const movedDistance = Math.hypot(
    event.screenX - dragState.startX,
    event.screenY - dragState.startY
  );

  if (movedDistance > 4) {
    dragState.didMove = true;
  }

  window.pet.moveDrag(toScreenPoint(event));
});

petCharacter.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || !hitsCharacter(event)) {
    return;
  }

  petCharacter.setPointerCapture(event.pointerId);
  dragState = {
    pointerId: event.pointerId,
    startX: event.screenX,
    startY: event.screenY,
    didMove: false
  };
  window.pet.beginDrag(toScreenPoint(event));
});

petCharacter.addEventListener('pointerup', (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }

  if (dragState.didMove) {
    suppressClickUntil = Date.now() + 250;
  }

  dragState = null;
  window.pet.endDrag();
});

petCharacter.addEventListener('pointercancel', () => {
  dragState = null;
  window.pet.endDrag();
});

petCharacter.addEventListener('click', (event) => {
  if ((event.detail !== 0 && !hitsCharacter(event)) || Date.now() < suppressClickUntil) {
    return;
  }

  window.clearTimeout(singleClickTimer);
  singleClickTimer = window.setTimeout(showClickFeedback, 220);
});

petCharacter.addEventListener('dblclick', (event) => {
  if (!hitsCharacter(event)) return;
  window.clearTimeout(singleClickTimer);
  window.pet.recordEcologyInteraction('double-click');
  showSpeechBubble('Hello, Glandy.', 2600, { force: true });
});

petCharacter.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (!hitsCharacter(event)) return;
  window.pet.showMenu();
});

quickActions.addEventListener('pointerenter', showQuickActions);
quickActions.addEventListener('pointerleave', scheduleQuickActionsHide);
quickActions.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-pet-action]');
  if (!button) {
    return;
  }

  if (button.dataset.petAction === 'more') {
    window.pet.showMenu();
    return;
  }

  const reaction = await window.pet.interact(button.dataset.petAction);
  if (reaction?.message) {
    showSpeechBubble(reaction.message, 2200, { force: true });
  }
});

window.pet.onNotice(showNotice);
window.pet.onEcologyBubble((message) => showSpeechBubble(message, 2600));
window.pet.onInteractionResponse((reaction) => {
  if (reaction?.message) {
    showSpeechBubble(reaction.message, 2200, { force: true });
  }
});
window.pet.onBehaviorState(applyBehaviorState);
window.pet.onUiSettingsChanged(applyUiSettings);
window.pet.getCharacterProfile().then(applyCharacterProfile);
window.pet.getUiSettings().then(applyUiSettings);
window.pet.getBehaviorState().then(applyBehaviorState);
window.requestAnimationFrame(animationLoop);

function restoreImageFallback(reason) {
  threePlayer?.dispose();
  threePlayer = null;
  threeCanvas.hidden = true;
  characterImage.hidden = false;
  petCharacter.classList.remove('is-3d');
  petWindow.dataset.renderer = '2d-fallback';
  petWindow.dataset.rendererError = reason;
}

if (wantsThree) {
  import('../animation/three-placeholder.mjs').then(({ createThreePlaceholder }) => {
    threeCanvas.hidden = false;
    petCharacter.classList.add('is-3d');
    threePlayer = createThreePlaceholder({ canvas: threeCanvas, onFailure: restoreImageFallback });
    characterImage.hidden = true;
    petWindow.dataset.renderer = '3d';
    petCharacter.setAttribute('aria-label', '几何体 3D 占位角色');
  }).catch(error => {
    console.warn('3D placeholder unavailable; using public image fallback.', error);
    restoreImageFallback('3d-initialization-failed');
  });
} else {
  petWindow.dataset.renderer = '2d';
}
window.addEventListener('beforeunload', () => threePlayer?.dispose());
