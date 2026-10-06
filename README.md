# Marble Glass

A custom **Revenge Next** appearance plugin for Cuddled: white marble with fine charcoal veins, translucent pearl surfaces, dark text and black accents. Includes an original marble texture in the plugin, so it loads offline without an image host.

## Install

**First select Discord Settings → Appearance → Light.** Native chat and profile screens use Discord’s own theme. In Dark mode, this plugin now preserves original colors to avoid unreadable dark text.

Add this repository URL in **Discord Settings → Revenge → Plugins → Advanced → Repositories**, then find **Marble Glass**, install and enable it, and fully restart Discord:

`https://raw.githubusercontent.com/Cuddled/w.arzone/main/`

Open the plugin's settings to adjust transparency, turn marble on/off, or turn glass highlights on/off. Fully restart Discord after changing settings, enabling or disabling the plugin to refresh cached Discord styles. Disable other appearance plugins before enabling this one.

This is a JS-only Next plugin, packaged using the current [official plugin manifest and repository format](https://github.com/revenge-mod/revenge-plugin-template). It does not install through Classic's theme importer. No Developer Mode or hidden API is required.

## Compatibility and validation

Version 0.2.0 removes raw palette inversion, preserves Dark mode colors, requires Light appearance for the white design, and removes forced white outlines. Color tokens stay six-digit hex; alpha is applied only to view styles. The loader contract, API calls and repository schema were checked against Revenge Next source (bundle commit `481056836bb9682b82945e58d7f2e672ffcf9717`, plugin CLI commit `b41bab26bbc446e450673f8a24fb986b469d1e29`). Automated mocked lifecycle checks cover load, color resolution, background wrapping, settings and restoration when stopped. **No Android device test has been performed.** Discord's internal tokens change between builds; the plugin reports a missing resolver rather than silently presenting a broken theme. Native screens and hardcoded colors may remain unchanged.

This recreates Liquid Glass's translucent appearance using React Native: it does not provide Apple's native refraction or live backdrop blur. Dialogs retain more white tint for readability. Text, attachments and images keep full opacity. Danger and status colors stay distinct.

## Build

Requires Python 3 and Node.js. The finished texture is checked in; Pillow and NumPy are only needed to regenerate it with `python3 scripts/marble.py`.

```sh
python3 scripts/build.py --base-url 'https://raw.githubusercontent.com/Cuddled/w.arzone/main/'
node --check build/index.js
node tests/lifecycle.cjs
```

`pool/cuddled.marble-glass@0.3.1.zip` contains `manifest.json` and a standalone single-expression `index.js`. `index.json` includes its size and SHA-256 digest. The build has no npm dependencies, network calls or SDK requirement. Increment the version in the manifest for every published update. The packager preserves historical index entries; retain the existing pool ZIPs when publishing updates.

## Privacy

No message access, analytics, network requests, permissions prompts or credentials. Settings are stored locally through Revenge's plugin JSON storage API.

## Appearance inspection build

`0.3.0-inspect` is a diagnostic prerelease, not a finished chat/profile transparency fix. It adds **Copy appearance report** in plugin settings. Open chat, the DM list and a profile before copying. Reports contain component names, prop names and color values; they omit personal field values and are copied locally, never uploaded. Stable remains 0.2.0.

## 0.3.0 surface rendering

Device-reported animated views, screen header backgrounds and native gradients now receive alpha at their rendering boundary. Broad custom-colored surfaces and gradient stops retain RGB values; text, username gradients, avatars and attachments are not faded. Native DCDChat internal background coverage is still unverified: the initial diagnostic report hit its sample limit before chat was captured. Appearance reports now omit text/icon entries and collect up to 300 samples.

## 0.3.1

Surface transparency no longer depends on the last semantic resolver theme (profiles use their own theme). Observed MessagesConnected, DCDChat and NavTTIView backgrounds now receive explicit alpha. Profile banner 24-bit RGB colors are handled separately from native ARGB colors. Dark custom profile RGB colors remain dark rather than being replaced with white. Tested with report-derived fixtures; Android visual verification is pending.
