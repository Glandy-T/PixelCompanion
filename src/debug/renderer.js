const behaviorState = document.querySelector('#behavior-state');
const animationName = document.querySelector('#animation-name');
const animationFrame = document.querySelector('#animation-frame');
const animationTransition = document.querySelector('#animation-transition');
const animationBubble = document.querySelector('#animation-bubble');
const animationSpeed = document.querySelector('#animation-speed');
const environmentApp = document.querySelector('#environment-app');
const environmentCategory = document.querySelector('#environment-category');
const environmentDuration = document.querySelector('#environment-duration');
const environmentIdle = document.querySelector('#environment-idle');
const environmentSwitches = document.querySelector('#environment-switches');

function formatSeconds(milliseconds) {
  return `${Math.floor(Math.max(0, milliseconds) / 1000)}s`;
}

function applyBehaviorState(snapshot) {
  if (snapshot?.state) {
    behaviorState.textContent = snapshot.variant ?? snapshot.state;
  }
}

function applyAnimationState(snapshot) {
  if (!snapshot) {
    return;
  }

  animationName.textContent = snapshot.animation ?? 'idle';
  animationFrame.textContent = `${snapshot.frame ?? 0} / ${snapshot.phase ?? 'rest'}`;
  animationTransition.textContent = snapshot.transition
    ? `${snapshot.transition.from} → ${snapshot.transition.to}`
    : 'settled';
  animationBubble.textContent = snapshot.bubble || '...';
  animationSpeed.textContent = `${snapshot.speed ?? 1}x`;
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

document.querySelector('.debug-actions').addEventListener('click', (event) => {
  const button = event.target.closest('[data-behavior]');
  if (button) {
    window.debug.requestBehavior(button.dataset.behavior);
  }
});

window.debug.onBehaviorState(applyBehaviorState);
window.debug.onEnvironmentState(applyEnvironmentState);
window.debug.onAnimationState(applyAnimationState);
window.debug.getBehaviorState().then(applyBehaviorState);
window.debug.getEnvironmentState().then(applyEnvironmentState);
