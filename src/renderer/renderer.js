const petCharacter = document.querySelector('#pet-character');
const speechBubble = document.querySelector('#speech-bubble');
const notice = document.querySelector('#notice');
const petWindow = document.querySelector('.pet-window');
const debugPanel = document.querySelector('#debug-panel');
const behaviorReadout = document.querySelector('#behavior-readout');
const environmentApp = document.querySelector('#environment-app');
const environmentCategory = document.querySelector('#environment-category');
const environmentDuration = document.querySelector('#environment-duration');
const environmentIdle = document.querySelector('#environment-idle');
const environmentSwitches = document.querySelector('#environment-switches');

let isPointerOverCharacter = false;
let dragState = null;
let singleClickTimer = null;
let noticeTimer = null;
let bubbleTimer = null;
let suppressClickUntil = 0;

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
  showNotice('Hello!');
  window.setTimeout(() => petCharacter.classList.remove('is-clicked'), 220);
}

function showSpeechBubble(message = 'Hello, Glandy.', durationMs = 2600) {
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
  behaviorReadout.textContent = snapshot.variant ?? snapshot.state;

  if (snapshot.state === 'idle') {
    speechBubble.hidden = true;
    return;
  }

  showSpeechBubble(snapshot.bubbleText || snapshot.state, snapshot.durationMs ?? 2600);
}

function formatSeconds(milliseconds) {
  return `${Math.floor(Math.max(0, milliseconds) / 1000)}s`;
}

function applyEnvironmentState(snapshot) {
  if (!snapshot) {
    return;
  }

  environmentApp.textContent = snapshot.currentApp ?? 'unknown';
  environmentCategory.textContent = snapshot.currentCategory ?? 'other';
  environmentDuration.textContent = formatSeconds(snapshot.activeDurationMs ?? 0);
  environmentIdle.textContent = `${snapshot.idleSeconds ?? 0}s`;
  environmentSwitches.textContent = snapshot.recentSwitches?.length
    ? snapshot.recentSwitches.map((entry) => entry.app).join(' → ')
    : 'none';
}

function updateInteractiveTarget(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const isOverInteractiveSurface = petCharacter.contains(target) || debugPanel.contains(target);
  setInteractive(isOverInteractiveSurface);
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
  showSpeechBubble();
});

petCharacter.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.pet.showMenu();
});

window.pet.onNotice(showNotice);
window.pet.onBehaviorState(applyBehaviorState);
window.pet.onEnvironmentState(applyEnvironmentState);

window.pet.getRuntimeConfig().then((config) => {
  if (!config?.debugEnabled) {
    return;
  }

  debugPanel.hidden = false;
  debugPanel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-behavior]');
    if (button) {
      window.pet.requestBehavior(button.dataset.behavior);
    }
  });
});

window.pet.getBehaviorState().then(applyBehaviorState);
window.pet.getEnvironmentState().then(applyEnvironmentState);
