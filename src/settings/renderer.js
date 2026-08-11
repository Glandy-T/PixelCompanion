const quickActions = document.querySelector('#quick-actions');
const proactiveEcology = document.querySelector('#proactive-ecology');
const alwaysOnTop = document.querySelector('#always-on-top');
const launchAtLogin = document.querySelector('#launch-at-login');
const launchRow = document.querySelector('#launch-row');
const characterSource = document.querySelector('#character-source');
const saveStatus = document.querySelector('#save-status');

let applying = false;

function applyState(state) {
  if (!state) {
    return;
  }
  applying = true;
  quickActions.checked = Boolean(state.quickActionsEnabled);
  proactiveEcology.checked = Boolean(state.proactiveEcologyEnabled);
  alwaysOnTop.checked = Boolean(state.alwaysOnTop);
  launchAtLogin.checked = Boolean(state.launchAtLogin);
  launchAtLogin.disabled = !state.launchAtLoginAvailable;
  launchRow.title = state.launchAtLoginAvailable ? '' : 'Available after packaging the Windows application.';
  characterSource.textContent = state.characterSource ?? 'placeholder';
  applying = false;
}

async function updateSetting(key, value) {
  if (applying) {
    return;
  }
  saveStatus.textContent = 'Saving...';
  applyState(await window.settings.update({ [key]: value }));
  saveStatus.textContent = 'Settings are saved locally.';
}

quickActions.addEventListener('change', () => updateSetting('quickActionsEnabled', quickActions.checked));
proactiveEcology.addEventListener('change', () => updateSetting('proactiveEcologyEnabled', proactiveEcology.checked));
alwaysOnTop.addEventListener('change', () => updateSetting('alwaysOnTop', alwaysOnTop.checked));
launchAtLogin.addEventListener('change', () => updateSetting('launchAtLogin', launchAtLogin.checked));
window.settings.onStateChanged(applyState);
window.settings.getState().then(applyState);
