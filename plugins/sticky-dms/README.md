# Sticky DMs — Revenge Next beta

Keep selected open DMs and group DMs at the top in a manually chosen order. New messages do not change the pinned order; unpinned conversations retain Discord's normal relative order. Pins are saved locally per Discord account. The plugin changes returned sort arrays, not message timestamps or channel records.

## Install and use

Use the same static repository as Marble Glass:

```
https://raw.githubusercontent.com/Cuddled/w.arzone/main/
```

Refresh the repository under Revenge → Plugins → Advanced → Repositories, install **Sticky DMs**, and enable it. Open the DM list, then open the plugin settings. Search existing DMs, select **Pin**, and use the arrows to choose the order. Change the indicator field to a pin, star, emoji or an empty string.

Version 0.1.1 targets the mobile `MessagesItemChannelContent` row and adds an indicator in the name area without replacing Discord’s text or unread indicators. On recognized DM rows with a long-press prop it also adds a Pin/Unpin prompt. **Original DM options** opens the original handler. Row structure varies by Discord version; the settings interface provides pinning independently of these row integrations.

Force-stop and reopen Discord after installing this update. JSX hooks must be present before Discord captures its rendering runtime references. Settings changes update mounted plugin list/row wrappers; changing the native layout still needs verification on-device.

## Compatibility

This first beta is for Revenge Next, matching the loader format used by Marble Glass. It has not been tested on an Android device. It intercepts the anonymous memoized mobile DM list identified by `listItemHeight` and a `data` object containing `channels`, `channelFavorites`, `sections`, and `dataKey`. It reorders the rendered channel records and invalidates the layout memo key. Section counts stay unchanged because entries are reordered rather than removed. It also hooks private-channel sorting getters as a fallback for builds that read those. Unrecognized return shapes are left unchanged. No method that exists only on a general guild-channel store is patched as a private sort getter.

The settings page shows connected sort hooks and observed row hooks. If pinning does not change the list, open the DM list and use **Copy compatibility report** in settings. The report contains method and component names, connection flags, pin counts, rendered list counts and data field names, with no user names, DM contents, channel IDs or account IDs.

Mock tests cover stable pin order after incoming-message reorder, immutable original arrays, account isolation, saving/restarting, string name indicators, original long-press access and cleanup. Installed-device ordering and row indicators still need verification. The plugin lists existing open DMs only; it does not open closed DMs, contact anyone or make network requests.

## Version 0.1.1 evidence and validation

The 0.1.0 getters were connected on the user's Android build but did not change the visible list, and none of the guessed row names matched. A published [Discord Android 342.16 surface capture](https://github.com/dataterminals/RevengeQuickFormat/blob/main/docs/surfaces.md#direct-message-list) documents the anonymous memo list data structure and `MessagesItemChannelContent` row. The update uses these observed bindings, unwraps memo/forwardRef component names, and installs JSX hooks during preInit rather than after startup.

Additional mocks reproduce that anonymous list without consulting store getters, a same-key new-message reorder, favorites occupying a separate visual section, unchanged section counts, immutable original data and a row whose name is not supplied as a string prop. A custom badge is rendered independently of name props. This evidence is from a nearby Android build and automated fixtures; the user's current build still needs confirmation.
