# Privacy boundaries

PixelCompanion is local-first. The public framework follows these boundaries:

- no screenshots, OCR, clipboard reads, keyboard hooks, mouse hooks, or process-memory access;
- no chat messages, prompts, responses, window body text, or private character content are stored;
- environment state and relationship memory contain only bounded metadata and counters;
- local settings, window coordinates, and relationship state are stored under Electron `userData`;
- private character and personality data are loaded only when an external directory is explicitly configured;
- private data directories are excluded from Git and from packaged application files;
- no environment, relationship, personality, or private asset data is uploaded.

The experimental Codex SQLite observer remains opt-in, read-only, schema-discovered, and behavior-independent unless a later version establishes stronger evidence and explicit user consent.
