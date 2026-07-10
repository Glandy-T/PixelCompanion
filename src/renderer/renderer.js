const petCharacter = document.querySelector('#pet-character');
const speechBubble = document.querySelector('#speech-bubble');
const notice = document.querySelector('#notice');

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

function showSpeechBubble() {
  speechBubble.hidden = false;
  window.clearTimeout(bubbleTimer);
  bubbleTimer = window.setTimeout(() => {
    speechBubble.hidden = true;
  }, 2600);
}

function updateInteractiveTarget(event) {
  const isOverCharacter = petCharacter.contains(
    document.elementFromPoint(event.clientX, event.clientY)
  );
  setInteractive(isOverCharacter);
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
