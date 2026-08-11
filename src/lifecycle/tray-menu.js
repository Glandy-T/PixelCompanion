function buildTrayMenuTemplate(options = {}) {
  const items = [
    {
      label: options.petVisible ? 'Hide Pet' : 'Show Pet',
      click: options.onTogglePet
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: Boolean(options.alwaysOnTop),
      click: options.onToggleAlwaysOnTop
    },
    { label: 'Settings...', click: options.onOpenSettings }
  ];

  if (options.launchAtLoginAvailable) {
    items.push({
      label: 'Launch at Login',
      type: 'checkbox',
      checked: Boolean(options.launchAtLogin),
      click: options.onToggleLaunchAtLogin
    });
  }

  if (options.debugEnabled) {
    items.push(
      { type: 'separator' },
      { label: 'Toggle Debug Window', click: options.onToggleDebug }
    );
  }

  items.push(
    { type: 'separator' },
    { label: 'Quit', click: options.onQuit }
  );
  return items;
}

module.exports = { buildTrayMenuTemplate };
