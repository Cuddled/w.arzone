# Black Cherry — First Test

Small Revenge Next prototype for native DM headers and composer containers. Burgundy fills, a ruby composer border, warm input text, and an optional wine-black native chat surface. No animated wallpaper or replacement layout. This is a native styling test, not a claim to reproduce the concept's photorealistic lacquer.

Install from the repository or `pool/cuddled.black-cherry@0.1.1.zip`. Set Discord Appearance to Dark, disable other theme plugins, and fully restart. Open a DM. Send a phone screenshot to verify the actual header and composer appearance. The settings page contains a metadata-only report for checking whether the composer renderer was found. Device appearance is not verified from this workspace.

Hooks install in start, after Revenge's JSX dispatcher initializes. Props are cloned; event handlers, refs and layout are retained. Stop removes render hooks. Raw and semantic palettes, messages, avatars, profile banners and status colors are untouched.

Build: `python scripts/build-black-cherry.py`. Test: `node tests/black-cherry.cjs`.

0.1.1 removes the unconditional startup reload request that caused repeated Reload Required prompts. Restarting and starting late no longer request a reload. User-triggered settings changes and disabling may still request one reload.
