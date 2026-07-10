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
const bridgeChatGPTProcess = document.querySelector('#bridge-chatgpt-process');
const bridgeChatGPTForeground = document.querySelector('#bridge-chatgpt-foreground');
const bridgeCodexProcess = document.querySelector('#bridge-codex-process');
const bridgeCodexHost = document.querySelector('#bridge-codex-host');
const bridgeMode = document.querySelector('#bridge-mode');
const bridgeHealth = document.querySelector('#bridge-health');
const bridgeSqliteEnabled = document.querySelector('#bridge-sqlite-enabled');
const bridgeSqliteSchema = document.querySelector('#bridge-sqlite-schema');
const bridgeAgentJobs = document.querySelector('#bridge-agent-jobs');
const bridgeAgentJobItems = document.querySelector('#bridge-agent-job-items');
const bridgeLastStatus = document.querySelector('#bridge-last-status');
const bridgeUnknownStatus = document.querySelector('#bridge-unknown-status');
const bridgeLastEvent = document.querySelector('#bridge-last-event');
const bridgePollingHealth = document.querySelector('#bridge-polling-health');
const bridgeLastError = document.querySelector('#bridge-last-error');

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

function asStatus(value) {
  return value ? 'present' : 'absent';
}

function tableStatus(table) {
  return table?.available ? (table.statusAvailable ? 'status available' : 'status unavailable') : 'unavailable';
}

function applyBridgeState(snapshot) {
  if (!snapshot) {
    return;
  }

  bridgeChatGPTProcess.textContent = asStatus(snapshot.chatgpt?.present);
  bridgeChatGPTForeground.textContent = snapshot.chatgpt?.foreground ? 'foreground' : 'background';
  bridgeCodexProcess.textContent = asStatus(snapshot.codex?.present);
  bridgeCodexHost.textContent = asStatus(snapshot.codex?.hostPresent);
  bridgeMode.textContent = snapshot.mode ?? 'unavailable';
  bridgeHealth.textContent = snapshot.health?.status ?? 'unknown';
  bridgeSqliteEnabled.checked = Boolean(snapshot.sqlite?.enabled);
  bridgeSqliteSchema.textContent = snapshot.sqlite?.schemaHealth ?? 'disabled';
  bridgeAgentJobs.textContent = tableStatus(snapshot.sqlite?.agentJobs);
  bridgeAgentJobItems.textContent = tableStatus(snapshot.sqlite?.agentJobItems);
  bridgeLastStatus.textContent = snapshot.sqlite?.lastObservedStatus ?? 'none';
  bridgeUnknownStatus.textContent = snapshot.sqlite?.rawUnknownStatus ?? 'none';
  bridgeLastEvent.textContent = snapshot.lastEvent?.type ?? 'none';
  bridgePollingHealth.textContent = snapshot.health?.status === 'healthy' ? 'healthy' : 'degraded';
  bridgeLastError.textContent = snapshot.sqlite?.lastError ?? 'none';
}

document.querySelector('.debug-actions').addEventListener('click', (event) => {
  const button = event.target.closest('[data-behavior]');
  if (button) {
    window.debug.requestBehavior(button.dataset.behavior);
  }
});

bridgeSqliteEnabled.addEventListener('change', async () => {
  const snapshot = await window.debug.setSqliteObservationEnabled(bridgeSqliteEnabled.checked);
  applyBridgeState(snapshot);
});

window.debug.onBehaviorState(applyBehaviorState);
window.debug.onEnvironmentState(applyEnvironmentState);
window.debug.onAnimationState(applyAnimationState);
window.debug.onBridgeState(applyBridgeState);
window.debug.getBehaviorState().then(applyBehaviorState);
window.debug.getEnvironmentState().then(applyEnvironmentState);
window.debug.getBridgeState().then(applyBridgeState);
