(function () {
  "use strict";
  // This is deliberately a single expression: the Next loader evaluates `return <script>`.
  var MARBLE_URI = "__MARBLE_URI__";
  var enabled = false;
  var opacity = 0.38;
  var lightAppearance = false;
  var marble = true;
  var glassEdges = true;
  var settingsStore;
  var activeApi;
  var listeners = new Set();
  var seenTokens = new WeakSet();
  var seenRN = new WeakSet();
  var rootInstalled = false;
  var resolverInstalled = false;
  var viewInstalled = false;
  var tokenNames = new WeakMap();
  var registrationCleanup;
  var cleanups = [];
  var appearanceSamples = new Map();
  var diagnosticsInstalled = false;
  // Record rendering metadata only: no text, IDs, images, messages or account fields.
  function observeAppearance(type, props) {
    if (!enabled || !props || props.__marbleGlass || appearanceSamples.size >= 300) return;
    var name = typeof type === "string" ? type : type && (type.displayName || type.name);
    if (!name || /Text|Icon|Image|Profiler|ActivityStatus/.test(name)) return;
    var picked = {};
    function collect(obj, path, depth) {
      if (!obj || typeof obj !== "object" || depth > 3) return;
      Object.keys(obj).slice(0, 80).forEach(function (key) {
        if (!/color|background|gradient|theme|style|tint/i.test(key)) return;
        var value = obj[key];
        var full = path ? path + "." + key : key;
        if (/color|background|tint/i.test(key) &&
          ((typeof value === "string" && /^(#[0-9a-f]{3,8}|rgba?\([\d., %]+\)|transparent|white|black)$/i.test(value)) ||
           typeof value === "number" && Number.isFinite(value))) picked[full] = value;
        else if (Array.isArray(value) && /color/i.test(key)) {
          var colors = value.filter(function (v) { return typeof v === "number" || typeof v === "string" && /^(#[0-9a-f]{3,8}|rgba?\([\d., %]+\))$/i.test(v); });
          if (colors.length) picked[full] = colors.slice(0, 8);
        } else if (key === "style" || key === "contentContainerStyle") {
          collect(revenge.react.ReactNative.StyleSheet.flatten(value), full, depth + 1);
        } else if (value && typeof value === "object") collect(value, full, depth + 1);
      });
    }
    collect(props, "", 0);
    if (!Object.keys(picked).length && !/DCDChat|Profile|Gradient/i.test(name)) return;
    var record = { component: name, propNames: Object.keys(props).filter(function (k) { return k !== "children"; }).slice(0, 70), colors: picked };
    appearanceSamples.set(name + JSON.stringify(picked), record);
  }
  function installDiagnostics() {
    if (diagnosticsInstalled) return;
    [revenge.react.ReactJSXRuntime, revenge.react.React].forEach(function (parent) {
      if (!parent) return;
      ["jsx", "jsxs", "createElement"].forEach(function (key) {
        if (typeof parent[key] !== "function") return;
        keep(revenge.patcher.instead(parent, key, function (args, original) {
          try {
            observeAppearance(args[0], args[1]);
            var transformed = renderSurfaceProps(args[0], args[1]);
            if (transformed !== args[1]) { args = args.slice(); args[1] = transformed; }
          } catch (_) {}
          return Reflect.apply(original, this, args);
        }));
      });
    });
    diagnosticsInstalled = true;
  }
  function copyAppearanceReport() {
    var report = JSON.stringify({ pluginVersion: "0.3.0", lightAppearance: lightAppearance,
      samples: Array.from(appearanceSamples.values()) }, null, 2);
    revenge.externals.ReactNativeClipboard.Clipboard.setString(report);
  }

  function keep(fn) { if (typeof fn === "function") cleanups.push(fn); }
  function notify() { listeners.forEach(function (fn) { fn(); }); }
  function rgba(alpha) { return "rgba(255,255,255," + alpha + ")"; }
  // Discord helpers require six-digit hex. Apply alpha only at RN style boundaries.
  function surface(level) {
    if (level >= 0.58) return "#fdfdfe";
    if (level >= 0.16) return "#e9e9ee";
    if (level >= 0.08) return "#efeff2";
    return "#f5f5f7";
  }
  function nativeSurface(color) {
    switch (color) {
      case "#ffffff":
      case "#f2f3f5":
      case "#f8f9fa":
      case "#f5f5f7": return rgba(opacity);
      case "#efeff2": return rgba(Math.min(0.96, opacity + 0.08));
      case "#e9e9ee": return rgba(Math.min(0.96, opacity + 0.16));
      case "#fdfdfe": return rgba(Math.min(0.96, opacity + 0.58));
      case "#d0d1d3": return "rgba(20,22,28,0.22)";
      case "#e6e6eb": return "rgba(40,42,48,0.09)";
      case "#e3e3e8": return "rgba(35,37,43,0.045)";
      default: return undefined;
    }
  }

  function colorParts(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      var n = value >>> 0;
      return { r: (n >>> 16) & 255, g: (n >>> 8) & 255, b: n & 255, a: (n >>> 24) / 255, numeric: true };
    }
    if (typeof value !== "string") return undefined;
    var color = value.trim().toLowerCase();
    if (color === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    if (color === "white") color = "#ffffff";
    if (color === "black") color = "#000000";
    var m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(color);
    if (m) { var hex = parseInt(m[1], 16); return { r: (hex >>> 16) & 255, g: (hex >>> 8) & 255, b: hex & 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 }; }
    m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(color);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  function tintAlpha(value, maxAlpha) {
    var c = colorParts(value);
    if (!c || c.a <= maxAlpha) return value;
    var alpha = Math.min(c.a, maxAlpha);
    // Native processed colors are ARGB integers. Preserve representation and RGB bits.
    if (c.numeric) return ((Math.round(alpha * 255) << 24) | (c.r << 16) | (c.g << 8) | c.b) >>> 0;
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + alpha + ")";
  }
  function renderSurfaceProps(type, props) {
    if (!enabled || !lightAppearance || !props || props.__marbleGlass) return props;
    var name = typeof type === "string" ? type : type && (type.displayName || type.name);
    // Restrict changes to leaf renderers observed on-device, not Discord color helpers.
    if (!name || !/^(RCTView|ReanimatedView|ClipView|RNLinearGradient|RNSScreen|RNSScreenContentWrapper|RNSScreenStackHeaderConfig|DCDChat)$/.test(name)) return props;
    var next;
    function put(key, value) { if (!next) next = Object.assign({}, props); next[key] = value; }
    var RN = revenge.react.ReactNative;
    ["style", "contentContainerStyle"].forEach(function (key) {
      if (!props[key]) return;
      var style = RN.StyleSheet.flatten(props[key]);
      if (!style || style.backgroundColor === undefined) return;
      var c = colorParts(style.backgroundColor);
      if (!c || c.a === 0) return;
      var big = style.flex === 1 || style.flexGrow === 1 || style.height === "100%" ||
        typeof style.height === "number" && style.height > 180 ||
        style.position === "absolute" && style.top === 0 && style.bottom === 0;
      var neutral = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 18;
      var mapped = typeof style.backgroundColor === "string" ? nativeSurface(style.backgroundColor.toLowerCase()) : undefined;
      var background = mapped;
      // Profile colors keep their RGB; only the alpha of broad surfaces is capped.
      if (background === undefined && (big || neutral && Math.min(c.r, c.g, c.b) >= 220)) {
        if (neutral && big && Math.max(c.r, c.g, c.b) < 75) background = rgba(opacity);
        else background = tintAlpha(style.backgroundColor, big ? Math.max(opacity, 0.55) : opacity);
      }
      if (background !== undefined && background !== style.backgroundColor)
        put(key, [props[key], { backgroundColor: background }]);
    });
    if (name === "RNLinearGradient" && Array.isArray(props.colors)) {
      // Do not lower opacity on the whole component: children remain fully opaque.
      put("colors", props.colors.map(function (color) { return tintAlpha(color, Math.max(opacity, 0.55)); }));
    }
    ["backgroundColor", "largeTitleBackgroundColor"].forEach(function (key) {
      if (props[key] !== undefined) {
        var color = tintAlpha(props[key], opacity);
        if (color !== props[key]) put(key, color);
      }
    });
    return next || props;
  }

  function semantic(name) {
    if (typeof name !== "string") return undefined;
    if (/^(STATUS_|TEXT_(DANGER|WARNING|POSITIVE)|.*(DANGER|WARNING|SUCCESS|RED|GREEN|YELLOW))/.test(name)) return undefined;
    if (/^(BUTTON|CONTROL).*_(TEXT|ICON)/.test(name)) return undefined;
    if (/^(BUTTON|CONTROL)/.test(name)) return undefined;
    if (/^(TEXT_LINK|TEXT_BRAND|BRAND_)/.test(name)) return "#292b31";
    if (/^(TEXT_|HEADER_|INTERACTIVE_|CHANNELS_|ICON_)/.test(name)) {
      if (/MUTED|DISABLED|PLACEHOLDER/.test(name)) return "#70737a";
      if (/SECONDARY|NORMAL|DEFAULT/.test(name)) return "#454850";
      return "#1d1f24";
    }
    if (/^(BG_BACKDROP|BACKGROUND_BACKDROP)/.test(name)) return "#d0d1d3";
    if (/^(BG_|BACKGROUND_|CHAT_BACKGROUND|CHANNELTEXTAREA_BACKGROUND|MODAL_BACKGROUND)/.test(name)) {
      if (/MENTION/.test(name)) return "#e6e6eb";
      if (/MODIFIER|MOD_(FAINT|SUBTLE|STRONG)/.test(name)) return "#e3e3e8";
      if (/FLOATING|OVERLAY|MODAL/.test(name)) return surface(0.58);
      if (/RAISED|TERTIARY|SECONDARY_ALT/.test(name)) return surface(0.16);
      if (/SECONDARY|CHANNELTEXTAREA/.test(name)) return surface(0.08);
      return surface(0);
    }
    if (/BORDER|DIVIDER|SEPARATOR/.test(name)) return "#dadbe0";
    if (/SCROLLBAR/.test(name)) return "#bcbec4";
    return undefined;
  }

  function semanticName(token, definitions) {
    if (typeof token === "string") return token;
    if (!token || typeof token !== "object") return undefined;
    var known = tokenNames.get(token);
    if (known) return known;
    var syms = Object.getOwnPropertySymbols(token);
    for (var i = 0; i < syms.length; i++) {
      var value = token[syms[i]];
      if (typeof value === "string" && definitions && value in definitions) return value;
    }
    return undefined;
  }

  function installTokens(tokens) {
    if (!tokens || seenTokens.has(tokens)) return;
    seenTokens.add(tokens);
    var definitions = tokens.SemanticColor || {};
    Object.keys(definitions).forEach(function (name) {
      var value = definitions[name];
      if (value && typeof value === "object") tokenNames.set(value, name);
    });
    var parents = [tokens, tokens.default, tokens.default && tokens.default.meta,
      tokens.default && tokens.default.internal, tokens.meta, tokens.internal];
    var patched = new WeakSet();
    parents.forEach(function (parent) {
      if (!parent || (typeof parent !== "object" && typeof parent !== "function") || patched.has(parent)) return;
      patched.add(parent);
      if (typeof parent.resolveSemanticColor !== "function") return;
      keep(revenge.patcher.instead(parent, "resolveSemanticColor", function (args, orig) {
        var theme = args[0];
        if (typeof theme === "string") lightAppearance = theme === "light";
        if (enabled && lightAppearance) {
          var name = semanticName(args[1], definitions);
          var color = semantic(name);
          if (color !== undefined) return color;
        }
        return Reflect.apply(orig, this, args);
      }));
      resolverInstalled = true;
    });
  }

  function useRefresh() {
    var React = revenge.react.React;
    var state = React.useState(0);
    React.useEffect(function () {
      function update() { state[1](function (n) { return n + 1; }); }
      listeners.add(update);
      return function () { listeners.delete(update); };
    }, []);
  }

  function Backdrop(props) {
    useRefresh();
    var React = revenge.react.React;
    var RN = revenge.react.ReactNative;
    if (!enabled) return props.children;
    var absolute = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 };
    return React.createElement(RN.View, { style: { flex: 1, backgroundColor: "#f7f7f8" }, __marbleGlass: true },
      marble ? React.createElement(RN.Image, {
        source: { uri: MARBLE_URI }, style: absolute, resizeMode: "cover",
        pointerEvents: "none", accessible: false, __marbleGlass: true
      }) : null,
      React.createElement(RN.View, { style: { flex: 1 }, __marbleGlass: true }, props.children));
  }

  function installRN(RN) {
    if (!RN || seenRN.has(RN.AppRegistry)) return;
    seenRN.add(RN.AppRegistry);
    if (typeof RN.AppRegistry.registerComponent === "function") {
      registrationCleanup = revenge.patcher.instead(RN.AppRegistry, "registerComponent", function (args, orig) {
        var provider = args[1];
        if (typeof provider === "function") {
          var App;
          var Wrapped;
          args[1] = function () {
            if (!Wrapped) {
              App = provider();
              Wrapped = function MarbleGlassRoot(props) {
                return revenge.react.React.createElement(Backdrop, null,
                  revenge.react.React.createElement(App, props));
              };
              rootInstalled = true;
            }
            return Wrapped;
          };
        }
        return Reflect.apply(orig, this, args);
      });
      keep(registrationCleanup);
    }
  }

  function watch(props, callback) {
    var finders = revenge.modules.finders;
    var filter = finders.filters.withProps.apply(null, props);
    keep(finders.waitForModules(filter, callback));
    for (var pair of finders.lookupModules(filter, { initialize: false, cached: false })) {
      if (pair[0]) callback(pair[0]);
    }
  }

  function installViews() {
    if (viewInstalled) return;
    var RN = revenge.react.ReactNative;
    var hooks = revenge.react.jsxRuntime;
    if (!RN || !hooks || typeof hooks.beforeJSX !== "function") return;
    function before(args) {
      var props = args[1];
      if (!enabled || !lightAppearance || !props || props.__marbleGlass) return args;
      var next;
      ["style", "contentContainerStyle"].forEach(function (key) {
        if (!props[key]) return;
        var style = RN.StyleSheet.flatten(props[key]);
        if (!style || typeof style.backgroundColor !== "string") return;
        var nativeColor = nativeSurface(style.backgroundColor.toLowerCase());
        if (nativeColor === undefined) return;
        var overrides = { backgroundColor: nativeColor };
        if (glassEdges && typeof style.borderRadius === "number" && style.borderRadius >= 8) {
          overrides.borderColor = "rgba(32,33,38,0.08)";
          overrides.borderWidth = Math.min(style.borderWidth || 0, 0.5);
        }
        if (!next) next = Object.assign({}, props);
        next[key] = [props[key], overrides];
      });
      return next ? [args[0], next, args[2]] : args;
    }
    [RN.View, RN.Pressable, RN.TextInput, RN.ScrollView].forEach(function (type) {
      if (type) keep(hooks.beforeJSX(type, before));
    });
    installDiagnostics();
    viewInstalled = true;
  }

  async function save(key, value) {
    if (key === "opacity") opacity = value;
    if (key === "marble") marble = value;
    if (key === "glassEdges") glassEdges = value;
    notify();
    if (settingsStore) await settingsStore.set({ opacity: opacity, marble: marble, glassEdges: glassEdges });
    if (activeApi) activeApi.plugin.requireReload();
  }

  function SettingsComponent() {
    useRefresh();
    var React = revenge.react.React;
    var RN = revenge.react.ReactNative;
    function text(label, style) {
      return React.createElement(RN.Text, { style: Object.assign({ color: "#202126", fontSize: 16 }, style) }, label);
    }
    function button(label, action) {
      return React.createElement(RN.Pressable, { onPress: action,
        style: { padding: 14, marginVertical: 5, borderRadius: 18,
          backgroundColor: "rgba(255,255,255,0.8)", borderWidth: 0.5, borderColor: "rgba(32,33,38,0.10)" }
      }, text(label));
    }
    return React.createElement(Backdrop, null, React.createElement(RN.ScrollView,
      { contentContainerStyle: { padding: 22, paddingBottom: 70 } },
      text("Marble Glass", { fontSize: 30, fontWeight: "700", marginBottom: 8 }),
      text("Use Discord Appearance → Light for this theme.", { marginBottom: 22, color: "#5b5e66" }),
      text("Glass opacity: " + Math.round(opacity * 100) + "%", { marginBottom: 6 }),
      button("More transparent", function () { return save("opacity", Math.max(0.12, +(opacity - 0.08).toFixed(2))); }),
      button("More frosted", function () { return save("opacity", Math.min(0.76, +(opacity + 0.08).toFixed(2))); }),
      button("Marble background: " + (marble ? "On" : "Off"), function () { return save("marble", !marble); }),
      button("Glass highlights: " + (glassEdges ? "On" : "Off"), function () { return save("glassEdges", !glassEdges); }),
      button("Copy appearance report", copyAppearanceReport),
      text("Open a chat and a profile first, then copy this report and paste it to Codex. It contains component names and colors only.", { marginTop: 14, fontSize: 14, color: "#5b5e66" }),
      text("Reload Discord after changing settings so cached styles update.", { marginTop: 20, color: "#5b5e66", fontSize: 14 }),
      text("Theme hooks: " + (resolverInstalled ? "connected" : "not found") + " · Background: " +
        (rootInstalled ? "connected" : "reload needed"), { marginTop: 14, color: "#5b5e66", fontSize: 13 })
    ));
  }

  return { default: plugin({
    SettingsComponent: SettingsComponent,
    preInit: function () {
      enabled = true;
      watch(["RawColor", "SemanticColor"], installTokens);
      watch(["AppRegistry"], installRN);
    },
    init: async function (api) {
      activeApi = api;
      settingsStore = api.jsonStorage;
      if (settingsStore) {
        var stored = await settingsStore.get();
        if (stored && typeof stored.opacity === "number" && Number.isFinite(stored.opacity)) opacity = Math.min(0.76, Math.max(0.12, stored.opacity));
        if (stored && typeof stored.marble === "boolean") marble = stored.marble;
        if (stored && typeof stored.glassEdges === "boolean") glassEdges = stored.glassEdges;
      }
      installTokens(revenge.discord.common.tokens.Tokens);
      installViews();
    },
    start: function (api) {
      activeApi = api;
      enabled = true;
      installViews();
      if (api.plugin.startedLate) api.plugin.requireReload();
      if (!resolverInstalled) throw new Error("Marble Glass could not find Discord's color resolver on this build. Disable the plugin and report your Discord version.");
      notify();
    },
    stop: function (api) {
      enabled = false;
      cleanups.splice(0).reverse().forEach(function (fn) { fn(); });
      seenTokens = new WeakSet(); seenRN = new WeakSet(); tokenNames = new WeakMap();
      resolverInstalled = false; viewInstalled = false; diagnosticsInstalled = false; appearanceSamples.clear();
      activeApi = undefined; settingsStore = undefined;
      notify();
      api.plugin.requireReload();
    }
  }) };
})()
