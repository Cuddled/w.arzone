# Sticky DMs — Revenge Next beta

Keep selected open DMs and group DMs at the top in a manually chosen order. New messages do not change the pinned order; unpinned conversations retain Discord’s normal relative order. Pins are saved locally per Discord account.

## Install and use

Refresh this repository under Revenge → Plugins → Advanced → Repositories:

```
https://raw.githubusercontent.com/Cuddled/w.arzone/main/
```

Install **Sticky DMs**, enable it, then force-stop and reopen Discord. Open the DM list, then open plugin settings. Search existing DMs, select **Pin**, and use the arrows to choose their order.

In **Plugin pin color**, choose a preset or enter a six-digit hex color and select **Apply custom color**. Plugin pins use Discord’s existing pin glyph with the selected color. Ordinary Discord pins keep their normal color unless that conversation is also pinned by this plugin. There is no additional emoji badge or overlay. Old emoji settings are ignored while saved pins are retained.

On recognized DM rows with a long-press prop, the plugin adds a Pin/Unpin prompt. **Original DM options** opens the original handler. Settings provide pinning independently of this optional shortcut.

## Rendering and compatibility

The mobile list is identified by `listItemHeight` and a `data` object containing `channels`, `channelFavorites`, `sections`, and `dataKey`. The plugin reorders visual records and changes the layout cache key. Section counts remain identical. Native channel records, favorites membership, and message timestamps are not changed.

The row is `MessagesItemChannelContent`, unwrapped through memo/forwardRef. A layout-free context provider gives only plugin-pinned rows a color override. A plugin pin passes `favorite: true` to the rendered row locally so it uses the native glyph even without a native favorite. The `MessagesItemChannelContentIcon` helper gives its favorite-only branch a second scoped color context. The generic image `Icon` renderer reads that context and applies `tintColor` to the original asset. Named pin icon variants also remain supported. Muted, blocked and ignored helper branches receive no tint override. No icon SVG or new icon is drawn. Other icons and rows without a plugin pin retain their original color props.

This is a beta. The list/row bindings match a [published Discord Android 342.16 capture](https://github.com/dataterminals/RevengeQuickFormat/blob/main/docs/surfaces.md#direct-message-list). The user’s later screenshot confirmed the row wrapper was active, but the new native icon tint still needs verification on the installed build. If it remains gray, open the DM list and select **Copy compatibility report** in settings. That includes content-icon helper names, named pin icon names and a colored-render count, without message text, channel IDs, user names, or account IDs.

## Checks and history

Mock checks cover fixed order after new messages, immutable caches, account isolation, saved pins after restart, mobile list memoization, unchanged section counts, row unread props, reuse of the original pin icon, ordinary pin color preservation, custom hex validation, original long-press access, and cleanup.

0.1.0 used connected store getters that did not control the user’s visible list. 0.1.1 added the mobile list and row bindings but installed a JSX hook too early. 0.1.2 removed the preInit hook to fix recursive proxies. A regression check reproduces the early-capture failure and confirms profile rendering works when core JSX initialization happens first. 0.1.3 replaces the emoji overlay with the native pin glyph and selectable row-scoped color. No Android device tests have been run in this workspace.

### 0.1.4 image-renderer binding

The user's 0.1.3 report showed the list and row wrappers rendering, with no named `PinIcon`. The [mobile row source](https://github.com/Wumpus-Central/discord-mobile-datamining/blob/main/discord_app/modules/main_tabs_v2/native/tabs/messages/items/channel/MessagesItemChannelContent.tsx) shows `MessagesItemChannelContentIcon` rendering a bundled source through `native.Icon` with a `style.tintColor`. The update targets that helper and image renderer instead of assuming a named vector icon. Additional tests preserve the bundled source and original cached styles, tint only plugin pin branches, and leave muted icons and ordinary native pins unchanged. Installed-device appearance still needs confirmation.
