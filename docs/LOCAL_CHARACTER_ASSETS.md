# Local character asset contract

PixelCompanion ships only the public placeholder. Personal character artwork and animation frames stay outside the repository and outside packaged application files.

Set `PIXEL_COMPANION_PRIVATE_DATA_DIR` to an absolute directory outside the repository. The directory can contain a `character.manifest.json` file and the image files referenced by that manifest.

## Manifest

The manifest supports a static idle image and optional frame animations:

```json
{
  "version": 1,
  "assets": {
    "idle": "sprites/idle.png"
  },
  "animations": {
    "idle": {
      "frames": ["sprites/idle-0.png", "sprites/idle-1.png"],
      "frameDuration": 500,
      "loop": true
    }
  }
}
```

Supported animation keys are `idle`, `thinking`, `working`, `waiting`, `success`, `alert`, and `sleepy`. Paths must be relative to the external private directory. Absolute paths and parent-directory traversal are rejected.

Supported frame formats are PNG, GIF, WebP, JPG/JPEG, and SVG. Each animation supports up to 120 frames. Frame duration is clamped between 50 and 10,000 milliseconds.

Missing or invalid private assets never prevent startup. A missing state falls back to the private idle animation when available, then to the public CSS placeholder animation.

## Personality

An optional `personality.json` in the same external directory may contain a `traits` object. Personal trait values remain local and are not part of this public contract documentation.

No external file is copied into `dist`, logged, uploaded, or shown in the Debug Window.
