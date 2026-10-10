# White Glow — Revenge Next

A steady highlight layer for the current theme: white outlines and outer shadows on rounded native panels, cards, buttons and the composer; optional mild white text shadows. It does not recolor backgrounds, text, icons, avatars, or status colors. No animated assets, timers or animation loops.

Install from `pool/cuddled.white-glow@0.1.0.zip` or the repository catalog and restart once. Use plugin settings for Soft/Normal/Bright strength and text glow. Startup never requests a reload. User settings changes and disabling may request one reload for cached native styles.

Modern React Native boxShadow needs supported Android versions and architecture (Android 9+ for outer shadows). The OS check is only eligibility, not feature detection. Older or unsupported builds still receive outlines; ancestor clipping can hide outer glow. Bitmap and vector icon glow and native-only screens are not guaranteed. Soft is the default to protect readability. Existing custom panel borders are replaced by the white highlight while enabled.

Rendering hooks install after the Revenge dispatcher initializes. Props are cloned and event handlers, refs, children and backgrounds retained. Stop restores hooks. Reports contain only settings and render counts. Android device appearance remains unverified.

Build: `python scripts/build-white-glow.py`. Test: `node tests/white-glow.cjs`.
