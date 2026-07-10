const behaviorState = document.querySelector('#behavior-state');
const behaviorSource = document.querySelector('#behavior-source');
const behaviorTrigger = document.querySelector('#behavior-trigger');
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
const bridgeLiveValidation = document.querySelector('#bridge-live-validation');
const ecologyEnergy = document.querySelector('#ecology-energy');
const ecologyCuriosity = document.querySelector('#ecology-curiosity');
const ecologyAttention = document.querySelector('#ecology-attention');
const ecologySocialDrive = document.querySelector('#ecology-social-drive');
const ecologyFocus = document.querySelector('#ecology-focus');
const ecologyArousal = document.querySelector('#ecology-arousal');
const ecologyTimePeriod = document.querySelector('#ecology-time-period');
const ecologyTickHealth = document.querySelector('#ecology-tick-health');
const ecologyLastEvent = document.querySelector('#ecology-last-event');
const ecologyLastDecision = document.querySelector('#ecology-last-decision');
const ecologyCooldown = document.querySelector('#ecology-cooldown');
const ecologyMemoryCount = document.querySelector('#ecology-memory-count');
const ecologyObserveOpportunity = document.querySelector('#ecology-observe-opportunity');
const ecologyRandom = document.querySelector('#ecology-random');

function formatSeconds(milliseconds) {
  return `${Math.floor(Math.max(0, milliseconds) / 1000)}s`;
}

function applyBehaviorState(snapshot) {
  if (snapshot?.state) {
    behaviorState.textContent = snapshot.variant ?? snapshot.state;
    behaviorSource.textContent = snapshot.source ?? 'system';
    behaviorTrigger.textContent = snapshot.triggerEventType ?? snapshot.lastTriggerEventType ?? 'none';
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
  const validation = snapshot.sqlite?.validation;
  bridgeLiveValidation.textContent = validation?.observedAt
    ? `jobs ${validation.agentJobsRowCount}, items ${validation.agentJobItemsRowCount}, WAL ${validation.walBytes} B, SHM ${validation.shmBytes} B${validation.metadataChanged ? ' (changed)' : ''}`
    : 'not observed';
}

function formatDrive(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function applyEcologyState(snapshot) {
  if (!snapshot) {
    return;
  }

  const drives = snapshot.drives ?? {};
  ecologyEnergy.textContent = formatDrive(drives.energy);
  ecologyCuriosity.textContent = formatDrive(drives.curiosity);
  ecologyAttention.textContent = formatDrive(drives.attention);
  ecologySocialDrive.textContent = formatDrive(drives.socialDrive);
  ecologyFocus.textContent = formatDrive(drives.focus);
  ecologyArousal.textContent = formatDrive(drives.arousal);
  ecologyTimePeriod.textContent = snapshot.timePeriod ?? 'unknown';
  ecologyTickHealth.textContent = snapshot.paused ? 'paused' : (snapshot.tick?.healthy ? 'healthy' : 'unknown');
  ecologyLastEvent.textContent = snapshot.lastEcologyEvent?.name ?? 'none';
  ecologyLastDecision.textContent = snapshot.lastProactiveDecision
    ? `${snapshot.lastProactiveDecision.type}: ${snapshot.lastProactiveDecision.reason}`
    : 'none';
  ecologyCooldown.textContent = `${Math.round((snapshot.proactiveCooldownMs ?? 0) / 1000)}s`;
  const memory = snapshot.memory ?? {};
  ecologyMemoryCount.textContent = String(
    (memory.recentAppCategoryCount ?? 0) +
    (memory.recentAppSwitchCount ?? 0) +
    (memory.recentUserInteractionCount ?? 0) +
    (memory.recentBehaviorStateCount ?? 0) +
    (memory.recentProactiveActionCount ?? 0) +
    (memory.recentLocalDialogueCount ?? 0)
  );
  ecologyObserveOpportunity.textContent = snapshot.lastObserveOpportunity ? 'recorded' : 'none';
  ecologyRandom.textContent = `${snapshot.random?.mode ?? 'unknown'} / ${snapshot.random?.seed ?? 'n/a'}`;
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

document.querySelector('.ecology-actions').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-ecology-action]');
  if (button) {
    applyEcologyState(await window.debug.ecologyDebugAction(button.dataset.ecologyAction));
  }
});

window.debug.onBehaviorState(applyBehaviorState);
window.debug.onEnvironmentState(applyEnvironmentState);
window.debug.onAnimationState(applyAnimationState);
window.debug.onBridgeState(applyBridgeState);
window.debug.onEcologyState(applyEcologyState);
window.debug.getBehaviorState().then(applyBehaviorState);
window.debug.getEnvironmentState().then(applyEnvironmentState);
window.debug.getBridgeState().then(applyBridgeState);
window.debug.getEcologyState().then(applyEcologyState);
