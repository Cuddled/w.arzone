# Marble Glass for Vencord

A CSS companion to the Revenge Marble Glass plugin. It uses a landscape companion to the phone marble texture, pearl panels, rounded chat input and separate marble backings for profile popouts with personal profile colors as translucent tints.

## Install

In Discord, open **Settings → Vencord → Themes → Online Themes** and add:

```
https://raw.githubusercontent.com/Cuddled/w.arzone/main/vencord/MarbleGlass.theme.css
```

Alternatively, download `MarbleGlass.theme.css`, place it in the folder opened by **Themes → Open Themes Folder**, then enable it under Local Themes. Disable other themes during the first check and select Discord's Light appearance for the most consistent result.

The theme loads only its marble JPEG from this repository; it imports no other themes or fonts. CSS variables at the top control panel opacity, sidebar opacity, floating panel opacity, profile tint strength, blur and corner radius. They can also be overridden in QuickCSS:

```css
:root {
  --mg-panel-alpha: 0.22;
  --mg-sidebar-alpha: 0.16;
  --mg-profile-tint: 45%;
  --mg-blur: 12px;
}
```

## Validation and limits

Version 0.1.0 was checked in Chromium with representative chat/profile elements: CSS rules parsed, chat backgrounds were transparent, profile backing was opaque, and pink/black custom profile colors remained in the 55% tint gradient. This is not an end-to-end Discord test. Discord can change its class names or profile structure; screenshots from the installed theme are needed to verify coverage and contrast on the current client. Native Liquid Glass refraction is not implemented. Images, banner artwork, decorations, role colors and presence colors are retained.

Version 0.1.1 adds a 2560 × 1440 desktop texture with fine veins, lowers sidebar opacity to 16%, and removes nested sidebar fills that concealed the backing. Profile tint strength remains 55%.
