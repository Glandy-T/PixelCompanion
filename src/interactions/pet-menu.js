function buildPetMenuTemplate(options = {}) {
  const currentState = options.currentState ?? 'idle';
  const onInteraction = options.onInteraction ?? (() => {});
  const items = [
    { label: `Status: ${currentState}`, enabled: false },
    {
      label: 'Interact',
      submenu: [
        { label: 'Pat', click: () => onInteraction('pat') },
        { label: 'Say Hello', click: () => onInteraction('hello') },
        { label: 'Surprise Me', click: () => onInteraction('surprise') }
      ]
    },
    { type: 'separator' },
    { label: 'Open ChatGPT', click: options.onOpenChatGPT },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: Boolean(options.alwaysOnTop),
      click: options.onToggleAlwaysOnTop
    },
    { label: 'Hide Pet', click: options.onHide }
  ];

  if (options.launchAtLoginAvailable) {
    items.splice(items.length - 1, 0, {
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

module.exports = { buildPetMenuTemplate };
