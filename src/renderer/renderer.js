const petCharacter = document.querySelector('#pet-character');
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
  setInteractive(petCharacter.contains(target));
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

window.pet.onNotice(showNotice);
window.pet.onEcologyBubble((message) => showSpeechBubble(message, 2600));
window.pet.onBehaviorState(applyBehaviorState);
window.pet.getBehaviorState().then(applyBehaviorState);
window.requestAnimationFrame(animationLoop);
