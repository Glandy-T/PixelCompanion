const { execFile } = require('node:child_process');

// Privacy: this command reads only the foreground window handle and owning
// process name. It intentionally does not read or emit window titles/content.
const FOREGROUND_PROCESS_COMMAND = `
$source = @'
using System;
using System.Runtime.InteropServices;
public static class PixelCompanionForegroundWindow {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
'@
Add-Type -TypeDefinition $source
$window = [PixelCompanionForegroundWindow]::GetForegroundWindow()
if ($window -eq [IntPtr]::Zero) { exit 0 }
[uint32]$processId = 0
[void][PixelCompanionForegroundWindow]::GetWindowThreadProcessId($window, [ref]$processId)
if ($processId -eq 0) { exit 0 }
$process = Get-Process -Id $processId -ErrorAction Stop
[pscustomobject]@{ processName = $process.ProcessName } | ConvertTo-Json -Compress
`;

function resolveForegroundApp() {
  if (process.platform !== 'win32') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', FOREGROUND_PROCESS_COMMAND],
      { windowsHide: true, timeout: 2000, maxBuffer: 4096 },
      (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve(null);
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(typeof result.processName === 'string' ? { processName: result.processName } : null);
        } catch {
          resolve(null);
        }
      }
    );
  });
}

class ForegroundAppSensor {
  constructor(options = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.resolveApp = options.resolveApp ?? resolveForegroundApp;
    this.setInterval = options.setIntervalFn ?? setInterval;
    this.clearInterval = options.clearIntervalFn ?? clearInterval;
    this.onApp = null;
    this.timer = null;
    this.isPolling = false;
  }

  start(onApp) {
    this.onApp = onApp;
    void this.poll();
    this.timer = this.setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  stop() {
    if (this.timer) {
      this.clearInterval(this.timer);
      this.timer = null;
    }

    this.onApp = null;
  }

  async poll() {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    try {
      const app = await this.resolveApp();
      if (app?.processName) {
        this.onApp?.(app);
      }
    } finally {
      this.isPolling = false;
    }
  }
}

module.exports = {
  ForegroundAppSensor,
  resolveForegroundApp
};
