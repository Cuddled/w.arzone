(function () {
  "use strict";
  // This is deliberately a single expression: the Next loader evaluates `return <script>`.
  var MARBLE_URI = "__MARBLE_URI__";
  var enabled = false;
  var opacity = 0.28;
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

  function semantic(name) {
    if (typeof name !== "string") return undefined;
    if (/^(STATUS_|TEXT_(DANGER|WARNING|POSITIVE)|.*(DANGER|WARNING|SUCCESS|RED|GREEN|YELLOW))/.test(name)) return undefined;
    if (/^(BUTTON|CONTROL).*_(TEXT|ICON)/.test(name)) return "#ffffff";
    if (/^(BUTTON|CONTROL).*_(BACKGROUND|BG)/.test(name) && !/SECONDARY|OUTLINED/.test(name)) return "#202126";
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

  function raw(name) {
    if (name === "WHITE") return "#202126";
    var m = /^(PRIMARY|NEUTRAL)_(\d+)$/.exec(name);
    if (m) {
      var n = Number(m[2]);
      if (n >= 500) return surface(n >= 700 ? 0.08 : 0);
      if (n >= 300) return "#70737a";
      return n >= 200 ? "#454850" : "#202126";
    }
    if (/^BRAND_\d+$/.test(name)) return "#292b31";
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
        if (enabled) {
          var name = semanticName(args[1], definitions);
          var color = semantic(name);
          if (color !== undefined) return color;
        }
        return Reflect.apply(orig, this, args);
      }));
      resolverInstalled = true;
    });
    var colors = tokens.RawColor;
    if (!colors) return;
    Object.keys(colors).forEach(function (name) {
      if (raw(name) === undefined) return;
      var descriptor = Object.getOwnPropertyDescriptor(colors, name);
      if (!descriptor || !descriptor.configurable) return;
      var original = colors[name];
      Object.defineProperty(colors, name, {
        configurable: true, enumerable: descriptor.enumerable,
        get: function () {
          if (enabled) return raw(name);
          return descriptor.get ? descriptor.get.call(colors) : original;
        }
      });
      keep(function () { Object.defineProperty(colors, name, descriptor); });
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
      if (!enabled || !props || props.__marbleGlass) return args;
      var next;
      ["style", "contentContainerStyle"].forEach(function (key) {
        if (!props[key]) return;
        var style = RN.StyleSheet.flatten(props[key]);
        if (!style || typeof style.backgroundColor !== "string") return;
        var nativeColor = nativeSurface(style.backgroundColor.toLowerCase());
        if (nativeColor === undefined) return;
        var overrides = { backgroundColor: nativeColor };
        if (glassEdges && typeof style.borderRadius === "number" && style.borderRadius >= 8) {
          overrides.borderColor = "rgba(255,255,255,0.78)";
          overrides.borderWidth = style.borderWidth || 0.75;
        }
        if (!next) next = Object.assign({}, props);
        next[key] = [props[key], overrides];
      });
      return next ? [args[0], next, args[2]] : args;
    }
    [RN.View, RN.Pressable, RN.TextInput, RN.ScrollView].forEach(function (type) {
      if (type) keep(hooks.beforeJSX(type, before));
    });
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
          backgroundColor: "rgba(255,255,255,0.8)", borderWidth: 1, borderColor: "#fff" }
      }, text(label));
    }
    return React.createElement(Backdrop, null, React.createElement(RN.ScrollView,
      { contentContainerStyle: { padding: 22, paddingBottom: 70 } },
      text("Marble Glass", { fontSize: 30, fontWeight: "700", marginBottom: 8 }),
      text("Pearl white. Ink veins. Glass everywhere.", { marginBottom: 22, color: "#5b5e66" }),
      text("Glass opacity: " + Math.round(opacity * 100) + "%", { marginBottom: 6 }),
      button("More transparent", function () { return save("opacity", Math.max(0.12, +(opacity - 0.08).toFixed(2))); }),
      button("More frosted", function () { return save("opacity", Math.min(0.76, +(opacity + 0.08).toFixed(2))); }),
      button("Marble background: " + (marble ? "On" : "Off"), function () { return save("marble", !marble); }),
      button("Glass highlights: " + (glassEdges ? "On" : "Off"), function () { return save("glassEdges", !glassEdges); }),
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
      resolverInstalled = false; viewInstalled = false;
      activeApi = undefined; settingsStore = undefined;
      notify();
      api.plugin.requireReload();
    }
  }) };
})()
