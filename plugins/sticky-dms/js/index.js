(function () {
  "use strict";
  var enabled = false, api, data = { accounts: {}, pinColor: "#a855f7" };
  var channelStore, userStore, cleanups = [], stores = new Set(), patched = new WeakSet();
  var listeners = new Set(), rowNames = new Set(), sortHooks = [], rowHooks = 0;
  var writeQueue = Promise.resolve(), error = "", search = "";
  var rowsInstalled = false, wrappers = new Map(), revision = 0, listHooks = 0, listSamples = new Map();
  var React = revenge.react.React, RN = revenge.react.ReactNative;
  var PinColorContext, PinGlyphContext, contentIconNames = new Set(), pinColorDraft = "#a855f7", pinIconNames = new Set(), coloredPinRenders = 0;
  function account() {
    var user = userStore && userStore.getCurrentUser();
    return user && typeof user.id === "string" ? user.id : undefined;
  }
  function pins() { var id = account(); return id && data.accounts[id] || []; }
  function idOf(item) {
    if (typeof item === "string") return item;
    return item && (typeof item.channelId === "string" ? item.channelId :
      typeof item.id === "string" ? item.id : item.channel && item.channel.id);
  }
  function reorder(list) {
    if (!enabled || !Array.isArray(list) || !pins().length) return list;
    if (!list.every(function (item) { return typeof idOf(item) === "string"; })) return list;
    var rank = new Map(pins().map(function (id, index) { return [id, index]; }));
    // Preserve every original entry and the exact relative order of unpinned DMs.
    return list.map(function (value, index) { return { value: value, index: index }; })
      .sort(function (a, b) {
        var ar = rank.has(idOf(a.value)) ? rank.get(idOf(a.value)) : Infinity;
        var br = rank.has(idOf(b.value)) ? rank.get(idOf(b.value)) : Infinity;
        return ar === br ? a.index - b.index : ar < br ? -1 : 1;
      }).map(function (entry) { return entry.value; });
  }
  function refresh() {
    revision++;
    listeners.forEach(function (fn) { fn(); });
    stores.forEach(function (store) { if (typeof store.emitChange === "function") store.emitChange(); });
  }
  function persist() {
    var snapshot = JSON.parse(JSON.stringify(data));
    writeQueue = writeQueue.catch(function () {}).then(function () { return api.jsonStorage.set(snapshot); });
    return writeQueue.then(function () { error = ""; refresh(); }, function () {
      error = "Could not save pins. Try again before restarting Discord."; refresh();
    });
  }
  function toggle(id) {
    var owner = account();
    if (!owner) { error = "Your account is still loading."; refresh(); return Promise.resolve(); }
    var list = pins().slice(), i = list.indexOf(id);
    if (i < 0) list.push(id); else list.splice(i, 1);
    data.accounts[owner] = list; refresh(); return persist();
  }
  function move(id, offset) {
    var owner = account(), list = pins().slice(), i = list.indexOf(id), j = i + offset;
    if (!owner || i < 0 || j < 0 || j >= list.length) return Promise.resolve();
    list.splice(i, 1); list.splice(j, 0, id); data.accounts[owner] = list; refresh(); return persist();
  }
  function keep(fn) { if (typeof fn === "function") cleanups.push(fn); }
  function watch(keys, callback) {
    var f = revenge.modules.finders, filter = f.filters.withProps.apply(null, keys);
    keep(f.waitForModules(filter, callback));
    for (var pair of f.lookupModules(filter, { initialize: false, cached: false })) if (pair[0]) callback(pair[0]);
  }
  function installSort(store) {
    if (!store || patched.has(store)) return;
    patched.add(store);
    var isPrivate = typeof store.getPrivateChannelIds === "function" ||
      typeof store.getName === "function" && /PrivateChannel/.test(store.getName());
    ["getPrivateChannelIds", "getSortedPrivateChannels", "getSortedChannels"].forEach(function (key) {
      if (typeof store[key] !== "function" || key === "getSortedChannels" && !isPrivate) return;
      keep(revenge.patcher.instead(store, key, function (args, orig) {
        return reorder(Reflect.apply(orig, this, args));
      }));
      sortHooks.push(key); stores.add(store);
    });
  }
  function channel(id) { return channelStore && channelStore.getChannel(id); }
  function label(id) {
    var c = channel(id);
    if (!c) return "Unavailable DM · " + id;
    if (c.name) return c.name;
    var recipient = c.recipients && c.recipients[0];
    var user = userStore && userStore.getUser && userStore.getUser(recipient);
    return user && (user.globalName || user.global_name || user.username) || "Direct message · " + id;
  }
  function typeName(type) {
    for (var i = 0; type && i < 5; i++) {
      if (typeof type === "string") return type;
      if (type.displayName) return type.displayName;
      if (type.name) return type.name;
      type = type.type || type.render;
    }
    return "anonymous";
  }
  function isDMList(props) {
    var d = props && props.data;
    return !!(props && props.listItemHeight !== undefined && d &&
      Array.isArray(d.channels) && Array.isArray(d.sections) && "dataKey" in d &&
      d.channels.every(function (item) { return item && typeof item.channelId === "string"; }));
  }
  function listProps(props) {
    var d = props.data;
    listHooks++;
    listSamples.set("main", { dataKeys: Object.keys(d), sectionCounts: d.sections.slice(0, 12),
      channelCount: d.channels.length, favoriteCount: Array.isArray(d.channelFavorites) ? d.channelFavorites.length : 0,
      pinnedMatches: d.channels.filter(function (item) { return pins().includes(item.channelId); }).length });
    if (!pins().length) return props;
    var next = Object.assign({}, d), favorites = d.channelFavorites;
    // Redistribute visual slots, not native favorite membership. Section counts
    // remain identical: no removed rows, duplicated cells or changed timestamps.
    if (Array.isArray(favorites) && favorites.every(function (item) { return item && typeof item.channelId === "string"; }) &&
        !favorites.some(function (f) { return d.channels.some(function (c) { return c.channelId === f.channelId; }); })) {
      var sorted = reorder(favorites.concat(d.channels));
      next.channelFavorites = sorted.slice(0, favorites.length);
      next.channels = sorted.slice(favorites.length);
    } else {
      next.channels = reorder(d.channels);
      if (Array.isArray(favorites)) next.channelFavorites = reorder(favorites);
    }
    // Layout is memoized on dataKey; include the exact rendered order and our
    // settings revision so unchanged incoming keys cannot reuse an old layout.
    next.dataKey = String(d.dataKey) + "|sticky:" + revision + ":" +
      (next.channelFavorites || []).concat(next.channels).map(idOf).join(",");
    return Object.assign({}, props, { data: next });
  }
  function wrapperFor(type, kind) {
    var types = wrappers.get(type);
    if (!types) wrappers.set(type, types = {});
    if (!types[kind]) {
      types[kind] = function StickyDMRender(props) {
        if (kind === "pin-slot") {
          var rowColor = React.useContext(PinColorContext);
          // Discord gives blocked/ignored/muted icons precedence over the pin.
          var pinBranch = props.favorite && !props.blocked && !props.ignored && !props.muted;
          return React.createElement(PinGlyphContext.Provider, { value: enabled && pinBranch ? rowColor : null, __stickyDM: true },
            React.createElement(type, Object.assign({}, props, { __stickyDM: true })));
        }
        if (kind === "icon" || kind === "image-icon") {
          var color = React.useContext(kind === "icon" ? PinColorContext : PinGlyphContext);
          var iconProps = Object.assign({}, props, { __stickyDM: true });
          if (enabled && color) {
            iconProps.color = color;
            iconProps.style = [props.style, { tintColor: color }];
            coloredPinRenders++;
          }
          return React.createElement(type, iconProps);
        }
        useRefresh();
        var raw = Object.assign({}, props, { __stickyDM: true });
        if (!enabled) return React.createElement(type, raw);
        if (kind === "list") return React.createElement(type, listProps(raw));
        var c = props.channel || channel(props.channelId);
        var pinned = !!(c && pins().includes(c.id));
        var row = rowProps(type, raw, true);
        // This is a visual prop only. No channel/favorite store is changed.
        if (pinned) row = Object.assign({}, row, { favorite: true });
        return React.createElement(PinColorContext.Provider, { value: pinned ? data.pinColor : null, __stickyDM: true },
          React.createElement(type, row));
      };
    }
    return types[kind];
  }
  function renderType(type, props) {
    if (!enabled || !props || props.__stickyDM) return type;
    if (typeName(type) === "MessagesItemChannelContentIcon") {
      contentIconNames.add(typeName(type));
      return wrapperFor(type, "pin-slot");
    }
    if (/^(Icon|BaseIconImage|Image|RCTImageView)$/.test(typeName(type)) && props.source !== undefined) {
      return wrapperFor(type, "image-icon");
    }
    if (/^Pin(?:[A-Z][A-Za-z]*)?Icon$/.test(typeName(type))) {
      pinIconNames.add(typeName(type));
      return wrapperFor(type, "icon");
    }
    if (isDMList(props)) return wrapperFor(type, "list");
    if (typeName(type) === "MessagesItemChannelContent" && props.channel &&
        (props.channel.type === 1 || props.channel.type === 3)) {
      rowNames.add(typeName(type)); rowHooks++;
      return wrapperFor(type, "row");
    }
    return type;
  }
  function rowProps(type, props, internal) {
    if (!enabled || !props || props.__stickyDM && !internal) return props;
    var name = typeName(type);
    // Target only identifiable DM rows. Never modify shared user/channel objects.
    if (!name || !/^(PrivateChannel|PrivateChannelRow|DMListItem|DirectMessageListItem|DMRow|MessagesItemChannelContent)$/.test(name)) return props;
    var c = props.channel || channel(props.channelId);
    if (!c || (c.type !== 1 && c.type !== 3) || typeof c.id !== "string") return props;
    rowNames.add(name);
    var next = Object.assign({}, props), pinned = pins().indexOf(c.id) >= 0;
    if (typeof props.onLongPress === "function" && RN.Alert && RN.Alert.alert) {
      var original = props.onLongPress;
      next.onLongPress = function () {
        var self = this, args = arguments;
        RN.Alert.alert("Sticky DMs", label(c.id), [
          { text: pins().indexOf(c.id) >= 0 ? "Unpin DM" : "Pin DM", onPress: function () { toggle(c.id); } },
          { text: "Original DM options", onPress: function () { original.apply(self, args); } },
          { text: "Cancel", style: "cancel" }
        ]);
      };
    }
    next.__stickyDM = true; rowHooks++; return next;
  }
  function installRows() {
    if (rowsInstalled) return;
    rowsInstalled = true;
    [revenge.react.ReactJSXRuntime, React].forEach(function (parent) {
      if (!parent) return;
      ["jsx", "jsxs", "createElement"].forEach(function (key) {
        if (typeof parent[key] !== "function") return;
        keep(revenge.patcher.instead(parent, key, function (args, orig) {
          var target = renderType(args[0], args[1]);
          if (target !== args[0]) { args = args.slice(); args[0] = target; }
          var next = rowProps(args[0], args[1]);
          if (next !== args[1]) { args = args.slice(); args[1] = next; }
          return Reflect.apply(orig, this, args);
        }));
      });
    });
  }
  function useRefresh() {
    var state = React.useState(0);
    React.useEffect(function () {
      var fn = function () { state[1](function (n) { return n + 1; }); };
      listeners.add(fn); return function () { listeners.delete(fn); };
    }, []);
  }
  function SettingsComponent() {
    useRefresh();
    function text(value, extra) { return React.createElement(RN.Text, { style: Object.assign({ color: "#22252b", fontSize: 16 }, extra) }, value); }
    function button(value, fn) { return React.createElement(RN.Pressable, { onPress: fn, style: { padding: 12, marginVertical: 3, backgroundColor: "#e9eaed", borderRadius: 12 } }, text(value)); }
    var all = channelStore && channelStore.getMutablePrivateChannels ? Object.keys(channelStore.getMutablePrivateChannels()) : [];
    var available = all.filter(function (id) { var c = channel(id); return c && (c.type === 1 || c.type === 3) && !pins().includes(id) && label(id).toLowerCase().includes(search.toLowerCase()); });
    return React.createElement(RN.ScrollView, { style: { flex: 1, backgroundColor: "#f7f7f8" }, contentContainerStyle: { padding: 20, paddingBottom: 60 } },
      text("Sticky DMs", { fontSize: 28, fontWeight: "700" }),
      text("Pins stay in your chosen order. Unpinned DMs follow recent messages.", { marginVertical: 12 }),
      error ? text(error, { color: "#a62030" }) : null,
      text("Pinned conversations", { fontWeight: "700", marginTop: 12 }),
      pins().length ? pins().map(function (id, i) { return React.createElement(RN.View, { key: id, style: { marginVertical: 6 } },
        text((i + 1) + ". " + label(id)),
        React.createElement(RN.View, { style: { flexDirection: "row", gap: 8 } },
          i > 0 ? button("↑", function () { return move(id, -1); }) : null,
          i < pins().length - 1 ? button("↓", function () { return move(id, 1); }) : null,
          button("Unpin", function () { return toggle(id); })));
      }) : text("No pins yet."),
      text("Plugin pin color", { fontWeight: "700", marginTop: 20 }),
      text("Only plugin pins use this color. Normal Discord pins keep their default color.", { fontSize: 13, marginVertical: 8 }),
      React.createElement(RN.View, { style: { flexDirection: "row", gap: 8, flexWrap: "wrap" } },
        ["#a855f7", "#ec4899", "#3b82f6", "#22c55e", "#f59e0b", "#202126"].map(function (color) {
          return React.createElement(RN.Pressable, { key: color, accessibilityLabel: "Pin color " + color,
            onPress: function () { data.pinColor = color; pinColorDraft = color; refresh(); return persist(); },
            style: { width: 34, height: 34, borderRadius: 17, backgroundColor: color,
              borderWidth: data.pinColor === color ? 3 : 0, borderColor: "#ffffff" } });
        })),
      React.createElement(RN.TextInput, { value: pinColorDraft, maxLength: 7, autoCapitalize: "none", autoCorrect: false,
        placeholder: "#a855f7", placeholderTextColor: "#696d76",
        style: { color: "#22252b", padding: 12, marginTop: 8, backgroundColor: "#e9eaed", borderRadius: 12 },
        onChangeText: function (value) { pinColorDraft = value; refresh(); } }),
      button("Apply custom color", function () {
        if (!/^#[0-9a-f]{6}$/i.test(pinColorDraft)) { error = "Enter a six-digit hex color, such as #a855f7."; refresh(); return Promise.resolve(); }
        data.pinColor = pinColorDraft.toLowerCase(); error = ""; refresh(); return persist();
      }),
      text("Add a pin", { fontWeight: "700", marginTop: 20 }),
      React.createElement(RN.TextInput, { value: search, placeholder: "Search open DMs", placeholderTextColor: "#696d76", style: { color: "#22252b", padding: 12, backgroundColor: "#e9eaed", borderRadius: 12 }, onChangeText: function (value) { search = value; refresh(); } }),
      available.map(function (id) { return React.createElement(RN.View, { key: id }, button("Pin " + label(id), function () { return toggle(id); })); }),
      !all.length ? text("Open the DM list first, then return here. Only existing DMs are listed.") : null,
      text("Compatibility: " + (sortHooks.length ? sortHooks.join(", ") : "DM sort hook not found") + " · List renders: " + listHooks + " · Row hooks: " + rowHooks, { fontSize: 12, marginTop: 20 }),
      text("This beta needs verification on your Discord build. Name indicators and long-press shortcuts depend on the DM row component.", { fontSize: 13, marginTop: 10 }),
      button("Copy compatibility report", function () {
        revenge.externals.ReactNativeClipboard.Clipboard.setString(JSON.stringify({ version: "0.1.4", contentIconNames: Array.from(contentIconNames), pinIconNames: Array.from(pinIconNames), coloredPinRenders: coloredPinRenders, pinnedCount: pins().length, listHooks: listHooks, listSamples: Array.from(listSamples.values()), sortHooks: sortHooks, rowNames: Array.from(rowNames), rowHooks: rowHooks, channelStore: !!channelStore, userStore: !!userStore, accountLoaded: !!account() }, null, 2));
      }));
  }
  function connect() {
    watch(["getChannel", "getMutablePrivateChannels"], function (store) { channelStore = store; installSort(store); });
    watch(["getCurrentUser", "getUser"], function (store) { userStore = store; });
    watch(["getPrivateChannelIds"], installSort);
    watch(["getSortedPrivateChannels"], installSort);
    installRows();
  }
  return { default: plugin({ SettingsComponent: SettingsComponent,
    init: async function (value) {
      api = value;
      var stored = await api.jsonStorage.get();
      if (stored && stored.accounts && typeof stored.accounts === "object" && !Array.isArray(stored.accounts)) {
        Object.keys(stored.accounts).filter(function (id) { return /^\d+$/.test(id); }).forEach(function (id) {
          if (Array.isArray(stored.accounts[id])) data.accounts[id] = Array.from(new Set(stored.accounts[id].filter(function (v) { return typeof v === "string" && /^\d+$/.test(v); })));
        });
      }
      if (stored && typeof stored.pinColor === "string" && /^#[0-9a-f]{6}$/i.test(stored.pinColor)) data.pinColor = stored.pinColor.toLowerCase();
      pinColorDraft = data.pinColor;
      refresh();
    },
    start: function (value) { api = value; enabled = true;
      if (!PinColorContext) PinColorContext = React.createContext(null);
      if (!PinGlyphContext) PinGlyphContext = React.createContext(null);
      connect(); refresh();
      if (api.plugin && api.plugin.startedLate) api.plugin.requireReload(); },
    stop: function () { enabled = false; cleanups.splice(0).reverse().forEach(function (fn) { fn(); }); refresh(); stores.clear(); patched = new WeakSet(); sortHooks = []; rowNames.clear(); rowHooks = 0; rowsInstalled = false; wrappers.clear(); listSamples.clear(); listHooks = 0; pinIconNames.clear(); contentIconNames.clear(); coloredPinRenders = 0; }
  }) };
})()
