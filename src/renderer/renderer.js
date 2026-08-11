const petCharacter = document.querySelector('#pet-character');
const characterImage = document.querySelector('#character-image');
const quickActions = document.querySelector('#quick-actions');
const speechBubble = document.querySelector('#speech-bubble');
const notice = document.querySelector('#notice');
const petWindow = document.querySelector('.pet-window');
const petMotion = document.querySelector('#pet-motion');
const stateIndicator = document.querySelector('#state-indicator');

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

const animationController = new window.PixelCompanionAnimationController.AnimationController();
const animationPlayer = new window.PixelCompanionAnimationPlayer.AnimationPlayer({
  root: petWindow,
  motion: petMotion,
  indicator: stateIndicator
});

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
  window.clearTimeout(quickActionsTimer);
  quickActions.classList.add('is-visible');
  quickActions.setAttribute('aria-hidden', 'false');
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
  if (profile?.source !== 'private' || typeof profile.imageUrl !== 'string') {
    return;
  }

  const candidate = new Image();
  candidate.onload = () => {
    characterImage.src = profile.imageUrl;
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

function reportAnimationState(snapshot) {
  const now = Date.now();
  if (now - lastAnimationReportAt < 100) {
    return;
  }

  lastAnimationReportAt = now;
  window.pet.reportAnimationState({
    animation: snapshot.animation?.id ?? 'idle',
    frame: snapshot.frame ?? 0,
    phase: snapshot.phase ?? 'rest',
    transition: snapshot.transition
      ? { from: snapshot.transition.from, to: snapshot.transition.to }
      : null,
    bubble: snapshot.animation?.bubbleText ?? '',
    speed: snapshot.speed ?? 1
  });
}

function renderAnimation(snapshot) {
  if (animationPlayer.apply(snapshot)) {
    reportAnimationState(snapshot);
  }
}

function animationLoop(now) {
  renderAnimation(animationController.tick(now));
  window.requestAnimationFrame(animationLoop);
}

function updateInteractiveTarget(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const overCharacter = petCharacter.contains(target);
  const overQuickActions = quickActions.contains(target);
  setInteractive(overCharacter || overQuickActions);
  if (overCharacter || overQuickActions) {
    showQuickActions();
  } else {
    scheduleQuickActionsHide();
  }
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
  if (event.button !== 0) {
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

petCharacter.addEventListener('click', () => {
  if (Date.now() < suppressClickUntil) {
    return;
  }

  window.clearTimeout(singleClickTimer);
  singleClickTimer = window.setTimeout(showClickFeedback, 220);
});

petCharacter.addEventListener('dblclick', () => {
  window.clearTimeout(singleClickTimer);
  window.pet.recordEcologyInteraction('double-click');
  showSpeechBubble('Hello, Glandy.', 2600, { force: true });
});

petCharacter.addEventListener('contextmenu', (event) => {
  event.preventDefault();
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
window.pet.getCharacterProfile().then(applyCharacterProfile);
window.pet.getBehaviorState().then(applyBehaviorState);
window.requestAnimationFrame(animationLoop);
