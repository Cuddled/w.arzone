# Black Cherry — First Test

Small Revenge Next prototype for native DM headers and composer containers. Burgundy fills, a ruby composer border, warm input text, and an optional wine-black native chat surface. No animated wallpaper or replacement layout. This is a native styling test, not a claim to reproduce the concept's photorealistic lacquer.

Install from the repository or `pool/cuddled.black-cherry@0.1.2.zip`. Set Discord Appearance to Dark, disable other theme plugins, and fully restart. Open a DM. Send a phone screenshot to verify the actual header and composer appearance. The settings page contains a metadata-only report for checking whether the composer renderer was found. Device appearance is not verified from this workspace.

Hooks install in start, after Revenge's JSX dispatcher initializes. Props are cloned; event handlers, refs and layout are retained. Stop removes render hooks. Raw and semantic palettes, messages, avatars, profile banners and status colors are untouched.

Build: `python scripts/build-black-cherry.py`. Test: `node tests/black-cherry.cjs`.

0.1.1 removes the unconditional startup reload request that caused repeated Reload Required prompts. Restarting and starting late no longer request a reload. User-triggered settings changes and disabling may still request one reload.

0.1.2 also supplies the burgundy background through header config styles. This is an unverified fallback, not confirmation that the visible Android DM header is fixed. The 0.1.1 phone screenshot shows the wine-black chat and burgundy composer, while the header remains gray. Reports now include bounded metadata for named custom headers and possible native header rows, plus navigation-config hidden/translucent flags and render counts. Candidate rows are observed only, not recolored. No title, message, user, ID or callback values are recorded.
