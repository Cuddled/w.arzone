# Shine + Motion for Revenge Next

Four selectable dark styles in one plugin: Mercury (silver reflections), Prism (spectral rims), Afterimage (cyan/pink light trails), and Jellyfish (bioluminescent bells).

Add repository `https://raw.githubusercontent.com/Cuddled/w.arzone/main/` in Plugins → Advanced → Repositories, refresh, and install **Shine + Motion**. Alternatively install `pool/cuddled.shine-motion@0.1.2.zip` from file.

Set Discord Appearance to Dark. Disable Marble Glass and other full theme plugins. Reload, then open this plugin's settings to choose a style. Reload after style or opacity changes because Discord caches native styles. Motion and speed changes apply immediately. Slow is the default; system reduced motion disables animation by default; the settings toggle can override it if desired. Motion stops when the app goes into the background.

Artwork is embedded in the ZIP; no image downloads or telemetry. Native-driver transforms and opacity create ambient movement; this is simulated material lighting, not physical refraction or a replacement Discord layout. Profile sheet backdrops have their own opaque backing so chat does not show through them. Custom profile colors keep their RGB. Text, status and button contrast colors are left to Discord.

The settings screen includes artwork previews and a component/color report for troubleshooting. Reports exclude message text, usernames, IDs and avatar URLs.

Validated with loader, mocked React Native lifecycle, color boundaries, settings, animation cancellation and packaging checks. Actual Android visual behavior and battery impact still need device verification; internal Discord renderers can change between versions.

Version 0.1.1 replaces the initial procedural outlines with original generated chrome, refractive glass, light-sculpture and jellyfish artwork. The committed JPEG assets are the artwork source. The older `shine-art.py` and `preview.jpg` describe the initial 0.1.0 artwork only. Use `assets/shine-motion/preview.html` for a current illustrative chat layout, not an Android screenshot. Run `python scripts/shine-preview.py` to update that preview and `python scripts/build-shine-motion.py` to package. The unbundled source in `plugins/shine-motion/js/index.js` contains an artwork placeholder and is not itself installable.

0.1.1: shorter 1.8–9.4 second motion legs, an animated reflection layer plus traveling edge highlights, null AppState startup recovery, accessibility-query failure recovery, and animation-state diagnostics. The HTML preview illustrates the artwork; native animation behavior is covered by mocked lifecycle tests and needs device confirmation.

0.1.2: cached neutral dark backgrounds on DM lists, member screens, scroll containers and headers now become nearly transparent; rounded cards retain a darker glass tint, floating surfaces remain frosted, and brand/status colors and pure-black masks are preserved. This broadens coverage across native screen renderers; device screenshots remain needed to confirm every screen.
