# Sticky DMs — Revenge Next beta

Keep selected open DMs and group DMs at the top in a manually chosen order. New messages do not change the pinned order; unpinned conversations retain Discord's normal relative order. Pins are saved locally per Discord account. The plugin changes returned sort arrays, not message timestamps or channel records.

## Install and use

Use the same static repository as Marble Glass:

```
https://raw.githubusercontent.com/Cuddled/w.arzone/main/
```

Refresh the repository under Revenge → Plugins → Advanced → Repositories, install **Sticky DMs**, and enable it. Open the DM list, then open the plugin settings. Search existing DMs, select **Pin**, and use the arrows to choose the order. Change the indicator field to a pin, star, emoji or an empty string.

On recognized DM rows with exposed name/title and long-press props, the plugin adds an indicator beside the name and a Pin/Unpin prompt on long press. **Original DM options** opens the original handler. Row structure varies by Discord version; the settings interface provides pinning independently of these row integrations.

## Compatibility

This first beta is for Revenge Next, matching the loader format used by Marble Glass. It has not been tested on an Android device. It looks for private-channel sorting getters and handles ID arrays, channel arrays and channelId records. Unrecognized return shapes are left unchanged. No method that exists only on a general guild-channel store is patched as a private sort getter.

The settings page shows connected sort hooks and observed row hooks. If pinning does not change the list, open the DM list and use **Copy compatibility report** in settings. The report contains method and component names and connection flags, with no user names, DM contents, channel IDs or account IDs.

Mock tests cover stable pin order after incoming-message reorder, immutable original arrays, account isolation, saving/restarting, string name indicators, original long-press access and cleanup. Installed-device ordering and row indicators still need verification. The plugin lists existing open DMs only; it does not open closed DMs, contact anyone or make network requests.
