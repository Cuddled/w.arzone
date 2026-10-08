(function () {
  "use strict";
  // This is deliberately a single expression: the Next loader evaluates `return <script>`.
  var ART = __SHINE_ART__;
  var styleName = "prism";
  var motion = true;
  var speed = "slow";
  var animationControllers = new Set();
  var animationStatus = "not mounted";
  var respectReducedMotion = true;
  function accent() { return {mercury:"#d2e5f3",prism:"#ab96ff",afterimage:"#f466ba",jellyfish:"#80dae8"}[styleName]; }
  var enabled = false;
  var opacity = 0.30;
  var lightTokenSeen = false;
  var lastResolverTheme;
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
  var sheetBackgrounds = new Map();
  var sceneBackgrounds = new Map();
  // Record rendering metadata only: no text, IDs, images, messages or account fields.
  function observeAppearance(type, props) {
    if (!enabled || !props || props.__shineMotion || appearanceSamples.size >= 300) return;
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
            var sheetType = marbleSheetType(args[0], args[1]);
            if (sheetType !== args[0]) { args = args.slice(); args[0] = sheetType; }
            var transformed = renderSurfaceProps(args[0], args[1]);
            if (transformed !== args[1]) { args = args.slice(); args[1] = transformed; }
          } catch (_) {}
          return Reflect.apply(original, this, args);
        }));
      });
    });
    diagnosticsInstalled = true;
  }
  // A modal must obscure the previous screen before adding translucent colors.
  function marbleSheetType(type, props) {
    var name = typeof type === "string" ? type : type && (type.displayName || type.name);
    if (enabled && marble && name === "RNSScreenContentWrapper" && props && !props.__shineMotion) return sceneType(type);
    if (!enabled || !marble || name !== "Background" || !props || props.__shineMotion ||
        !("animatedIndex" in props) || !("animatedPosition" in props)) return type;
    if (!sheetBackgrounds.has(type)) {
      var Wrapped = function ShineSheetBackground(props) {
        useRefresh();
        var React = revenge.react.React;
        var RN = revenge.react.ReactNative;
        if (!enabled || !marble) return React.createElement(type, props);
        var absolute = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 };
        return React.createElement(RN.View, {
          pointerEvents: "none", __shineMotion: true,
          style: [props.style, { backgroundColor: "#070911", overflow: "hidden" }]
        }, React.createElement(Artwork, null), React.createElement(type, Object.assign({}, props, {
          __shineMotion: true, style: [absolute, { backgroundColor: rgba(opacity) }]
        })));
      };
      sheetBackgrounds.set(type, Wrapped);
    }
    return sheetBackgrounds.get(type);
  }
  // Each navigation scene obscures the previous screen with its own animated art.
  // Keep the native wrapper itself and its props; insert an absolute decorative child.
  function sceneType(type) {
    if (!sceneBackgrounds.has(type)) {
      var Scene = function ShineMotionScene(props) {
        useRefresh();
        var React = revenge.react.React;
        if (!enabled || !marble) return React.createElement(type, props);
        var nativeProps = Object.assign({}, props, {__shineMotion:true,
          style:[props.style,{backgroundColor:"#070911",overflow:"hidden"}]});
        return React.createElement(type,nativeProps,React.createElement(Artwork,null),props.children);
      };
      sceneBackgrounds.set(type,Scene);
    }
    return sceneBackgrounds.get(type);
  }
  function copyAppearanceReport() {
    var report = JSON.stringify({ pluginVersion: "0.1.3", style: styleName, motion: motion, speed: speed, animationStatus: animationStatus, respectReducedMotion: respectReducedMotion, observedLightTokens: lightTokenSeen, lastResolverTheme: lastResolverTheme,
      samples: Array.from(appearanceSamples.values()) }, null, 2);
    revenge.externals.ReactNativeClipboard.Clipboard.setString(report);
  }

  function keep(fn) { if (typeof fn === "function") cleanups.push(fn); }
  function notify() { listeners.forEach(function (fn) { fn(); }); }
  function rgba(alpha) { return "rgba(7,9,17," + alpha + ")"; }
  // Alpha stays at RN boundaries; Discord color helpers receive six-digit hex.
  function surface(level) {
    if (level >= 0.58) return "#131724";
    if (level >= 0.16) return "#121623";
    if (level >= 0.08) return "#101420";
    return "#0b0e18";
  }
  function nativeSurface(color, style) {
    // Screen layers must be almost clear: stacking several 30% panels hid the artwork.
    if (color === "#131724") return rgba(Math.min(.94,opacity+.55));
    var c = colorParts(color);
    if (!c || c.a < .6) return undefined;
    var neutral = Math.max(c.r,c.g,c.b)-Math.min(c.r,c.g,c.b) <= 22;
    var dark = Math.max(c.r,c.g,c.b) <= 115 && Math.max(c.r,c.g,c.b) >= 10;
    if (!neutral || !dark) return undefined;
    var rounded = style && (style.borderRadius >= 8 || style.borderTopLeftRadius >= 8);
    var screen = style && (style.flex === 1 || style.flexGrow === 1 || style.height === "100%" ||
      typeof style.height === "number" && style.height > 180 ||
      style.position === "absolute" && style.top === 0 && style.bottom === 0);
    return rgba(rounded && !screen ? Math.max(.14,opacity) : .025);
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
    if (!enabled || !props || props.__shineMotion) return props;
    var name = typeof type === "string" ? type : type && (type.displayName || type.name);
    // Restrict changes to leaf renderers observed on-device, not Discord color helpers.
    if (!name || !/^(View|RCTView|RCTScrollView|ScrollView|AndroidHorizontalScrollView|AndroidHorizontalScrollContentView|ReanimatedView|ClipView|RNLinearGradient|RNSScreen|ScreenContentWrapper|RNSScreenContentWrapper|ScreenStackHeaderConfig|RNSScreenStackHeaderConfig|DCDChat|MessagesConnected|NavTTIView|DCDChatList|ProfileBanner)$/.test(name)) return props;
    var next;
    function put(key, value) { if (!next) next = Object.assign({}, props); next[key] = value; }
    var RN = revenge.react.ReactNative;
    ["style", "contentContainerStyle"].forEach(function (key) {
      if (!props[key]) return;
      var style = RN.StyleSheet.flatten(props[key]);
      if (!style || style.backgroundColor === undefined) return;
      var c = colorParts(style.backgroundColor);
      if (!c || c.a === 0) return;
      var chat = /^(DCDChat|MessagesConnected|NavTTIView|DCDChatList)$/.test(name);
      var big = chat || style.flex === 1 || style.flexGrow === 1 || style.height === "100%" ||
        typeof style.height === "number" && style.height > 180 ||
        style.position === "absolute" && style.top === 0 && style.bottom === 0;
      var neutral = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 18;
      var mapped = typeof style.backgroundColor === "string" ? nativeSurface(style.backgroundColor.toLowerCase(),style) : undefined;
      var background = mapped;
      if (background === undefined && c.numeric) {
        var hex = "#" + ((c.r<<16)|(c.g<<8)|c.b).toString(16).padStart(6,"0");
        if (c.a >= .6) background = nativeSurface(hex,style);
      }
      // Profile colors keep their RGB; only the alpha of broad surfaces is capped.
      if (background === undefined && (big || neutral && Math.min(c.r, c.g, c.b) >= 220)) {
        background = tintAlpha(style.backgroundColor, chat ? opacity : big ? Math.max(opacity, 0.55) : opacity);
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
        var original = props[key];
        if (name === "ProfileBanner" && key === "backgroundColor" && typeof original === "number" && original >= 0 && original <= 0xffffff)
          original = "#" + original.toString(16).padStart(6, "0");
        var mappedHeader = typeof original === "string" && name !== "ProfileBanner" ? nativeSurface(original,{}) : undefined;
        var color = mappedHeader === undefined ? tintAlpha(original, name === "ProfileBanner" ? Math.max(opacity, 0.55) : opacity) : mappedHeader;
        if (color !== props[key]) put(key, color);
      }
    });
    return next || props;
  }

  function semantic(name) {
    if (typeof name !== "string") return undefined;
    if (/^(BG_|BACKGROUND_|CHAT_BACKGROUND|CHANNELTEXTAREA_BACKGROUND|MODAL_BACKGROUND)/.test(name)) {
      if (/BACKDROP|MENTION|MODIFIER|MOD_(FAINT|SUBTLE|STRONG)/.test(name)) return undefined;
      if (/FLOATING|OVERLAY|MODAL/.test(name)) return surface(.58);
      if (/RAISED|TERTIARY|SECONDARY_ALT/.test(name)) return surface(.16);
      if (/SECONDARY|CHANNELTEXTAREA/.test(name)) return surface(.08);
      return surface(0);
    }
    if (/^(TEXT_LINK|TEXT_BRAND)$/.test(name)) return accent();
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
        if (typeof theme === "string") { lastResolverTheme = theme; if (theme === "light") lightTokenSeen = true; }
        // Theme is local to this resolver call. A profile cannot change app-wide gating.
        if (enabled && (theme === "dark" || theme === "darker" || theme === "midnight")) {
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

  function Artwork() {
    useRefresh();
    var React = revenge.react.React, RN = revenge.react.ReactNative;
    var progress = React.useRef(new RN.Animated.Value(0)).current;
    var duration = {mercury:4200,prism:3200,afterimage:1800,jellyfish:5200}[styleName] * (speed === "slow" ? 1.8 : 1);
    React.useEffect(function () {
      var disposed = false, reduced = true, loop;
      var active = !RN.AppState || RN.AppState.currentState == null || RN.AppState.currentState === "active";
      function sync() {
        if (loop) { loop.stop(); loop = undefined; }
        progress.setValue(0);
        animationStatus = !enabled ? "disabled" : !motion ? "motion off" : !active ? "app in background" : reduced && respectReducedMotion ? "system reduced motion" : "running";
        if (!disposed && enabled && motion && active && (!reduced || !respectReducedMotion)) {
          loop = RN.Animated.loop(RN.Animated.sequence([
            RN.Animated.timing(progress,{toValue:1,duration:duration,useNativeDriver:true,isInteraction:false}),
            RN.Animated.timing(progress,{toValue:0,duration:duration,useNativeDriver:true,isInteraction:false})
          ]));
          loop.start();
        }
      }
      animationControllers.add(sync);
      var stateSub = RN.AppState && RN.AppState.addEventListener("change",function(state) { active = state === "active"; sync(); });
      var access = RN.AccessibilityInfo;
      var reduceSub = access && access.addEventListener("reduceMotionChanged",function(value) { reduced = value; sync(); });
      if (access && access.isReduceMotionEnabled) {
        Promise.resolve(access.isReduceMotionEnabled()).then(function(value) { if (!disposed) { reduced = value; sync(); } }).catch(function() { if (!disposed) { reduced = false; sync(); } });
      } else { reduced = false; sync(); }
      return function() {
        disposed = true; if (loop) loop.stop(); progress.stopAnimation();
        animationControllers.delete(sync);
        if (stateSub) stateSub.remove(); if (reduceSub) reduceSub.remove();
      };
    },[styleName,motion,speed,duration,respectReducedMotion]);
    var absolute = {position:"absolute",top:-60,left:-24,right:-24,bottom:-60};
    var translate = styleName === "afterimage" ? 42 : styleName === "jellyfish" ? -36 : 26;
    // Two image layers: an opaque base and moving specular reflection. Text is never animated.
    var base = React.createElement(RN.Image,{__shineMotion:true,source:{uri:ART[styleName]},resizeMode:"cover",
      accessible:false,pointerEvents:"none",style:absolute});
    var reflection = React.createElement(RN.Animated.Image, {
      __shineMotion:true,source:{uri:ART[styleName]},resizeMode:"cover",accessible:false,pointerEvents:"none",
      style:[absolute,{opacity:progress.interpolate({inputRange:[0,1],outputRange:[0,.6]}),
        transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[-translate,translate]})},
          {scale:progress.interpolate({inputRange:[0,1],outputRange:[1.04,1.14]})}]}]
    });
    function shimmer(side,color) {
      return React.createElement(RN.Animated.View,{key:side,__shineMotion:true,accessible:false,pointerEvents:"none",
        style:{position:"absolute",top:"35%",[side]:6,width:8,height:110,borderRadius:8,backgroundColor:color,
          opacity:progress.interpolate({inputRange:[0,.5,1],outputRange:[.08,.65,.08]}),
          transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[-170,240]})}]}});
    }
    return React.createElement(RN.View,{__shineMotion:true,pointerEvents:"none",accessible:false,
      style:{position:"absolute",top:0,right:0,bottom:0,left:0,overflow:"hidden"}},base,reflection,
      shimmer("left",styleName==="mercury"?"#d8efff":"#6cedff"),
      shimmer("right",styleName==="mercury"?"#ffffff":"#e7a0ff"));
  }

  function Backdrop(props) {
    useRefresh();
    var React = revenge.react.React;
    var RN = revenge.react.ReactNative;
    if (!enabled) return props.children;
    return React.createElement(RN.View,{__shineMotion:true,style:{flex:1,backgroundColor:"#070911",overflow:"hidden"}},
      marble ? React.createElement(Artwork,null) : null,
      React.createElement(RN.View,{__shineMotion:true,style:{flex:1}},props.children));
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
              Wrapped = function ShineMotionRoot(props) {
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
      if (!enabled || !props || props.__shineMotion) return args;
      var next;
      ["style", "contentContainerStyle"].forEach(function (key) {
        if (!props[key]) return;
        var style = RN.StyleSheet.flatten(props[key]);
        if (!style || typeof style.backgroundColor !== "string") return;
        var nativeColor = nativeSurface(style.backgroundColor.toLowerCase(),style);
        if (nativeColor === undefined) return;
        var overrides = { backgroundColor: nativeColor };
        if (glassEdges && typeof style.borderRadius === "number" && style.borderRadius >= 8) {
          overrides.borderColor = accent() + "33";
          overrides.borderWidth = .5;
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
    if (key === "styleName" && ART[value]) styleName = value;
    if (key === "motion") motion = value;
    if (key === "speed") speed = value;
    if (key === "respectReducedMotion") respectReducedMotion = value;
    animationControllers.forEach(function(sync){sync();});
    notify();
    if (settingsStore) await settingsStore.set({opacity:opacity,styleName:styleName,motion:motion,speed:speed,respectReducedMotion:respectReducedMotion});
    if (activeApi && (key === "styleName" || key === "opacity")) activeApi.plugin.requireReload();
  }
  function SettingsComponent() {
    useRefresh();
    var React = revenge.react.React, RN = revenge.react.ReactNative;
    function text(label,style) { return React.createElement(RN.Text,{__shineMotion:true,style:Object.assign({color:"#eef2ff",fontSize:16},style)},label); }
    function button(label, action) { return React.createElement(RN.Pressable,{__shineMotion:true,onPress:action,
      style:{padding:16,marginVertical:5,borderRadius:16,backgroundColor:"rgba(17,21,35,.88)",borderColor:accent()+"55",borderWidth:.5}},text(label)); }
    var cards = Object.keys(ART).map(function(name) {
      return React.createElement(RN.Pressable,{key:name,__shineMotion:true,onPress:function(){return save("styleName",name);},
        style:{height:142,overflow:"hidden",marginVertical:8,borderRadius:20,borderColor:styleName===name?accent():"#363a48",borderWidth:styleName===name?2:.5}},
        React.createElement(RN.Image,{__shineMotion:true,source:{uri:ART[name]},resizeMode:"cover",style:{position:"absolute",top:0,bottom:0,right:0,left:0}}),
        text(name.charAt(0).toUpperCase()+name.slice(1)+(styleName===name?"  ✓":""),{margin:20,fontWeight:"700",fontSize:24}));
    });
    return React.createElement(Backdrop,null,React.createElement(RN.ScrollView,{contentContainerStyle:{padding:22,paddingBottom:70}},
      text("Shine + Motion",{fontSize:30,fontWeight:"700",marginBottom:12}),
      text("Use Discord Dark appearance. Disable Marble Glass and other full themes, then reload.",{fontSize:14,color:"#b6bdce",marginBottom:14}),
      ...cards,
      button("Motion: "+(motion?"On":"Off"),function(){return save("motion",!motion);}),
      button("Speed: "+speed,function(){return save("speed",speed==="slow"?"normal":"slow");}),
      button("Respect system reduced motion: "+(respectReducedMotion?"On":"Off"),function(){return save("respectReducedMotion",!respectReducedMotion);}),
      text("Glass opacity: "+Math.round(opacity*100)+"%",{marginTop:16}),
      button("More transparent",function(){return save("opacity",Math.max(.12,+(opacity-.08).toFixed(2)));}),
      button("More frosted",function(){return save("opacity",Math.min(.76,+(opacity+.08).toFixed(2)));}),
      button("Copy appearance report",copyAppearanceReport),
      text("Motion pauses in the background and respects system reduced motion. Style and glass changes need a reload for cached Discord colors.",{fontSize:14,color:"#b6bdce",marginTop:18}),
      text("Animation: "+animationStatus,{fontSize:13,color:"#b6bdce",marginTop:16}),
      text("Colors: "+(resolverInstalled?"connected":"not found")+" · Artwork: "+(rootInstalled?"connected":"reload needed"),{fontSize:13,color:"#b6bdce",marginTop:16})
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
        if (stored && ART[stored.styleName]) styleName = stored.styleName;
        if (stored && typeof stored.motion === "boolean") motion = stored.motion;
        if (stored && typeof stored.respectReducedMotion === "boolean") respectReducedMotion = stored.respectReducedMotion;
        if (stored && (stored.speed === "slow" || stored.speed === "normal")) speed = stored.speed;
        if (stored && typeof stored.glassEdges === "boolean") glassEdges = stored.glassEdges;
      }
      installTokens(revenge.discord.common.tokens.Tokens);
      installViews();
    },
    start: function (api) {
      activeApi = api;
      enabled = true;
      installTokens(revenge.discord.common.tokens.Tokens);
      installRN(revenge.react.ReactNative);
      installViews();
      if (api.plugin.startedLate) api.plugin.requireReload();
      if (!resolverInstalled) throw new Error("Shine + Motion could not find Discord's color resolver on this build. Disable the plugin and report your Discord version.");
      notify();
    },
    stop: function (api) {
      enabled = false;
      animationControllers.forEach(function(sync){sync();});
      cleanups.splice(0).reverse().forEach(function (fn) { fn(); });
      seenTokens = new WeakSet(); seenRN = new WeakSet(); tokenNames = new WeakMap();
      resolverInstalled = false; viewInstalled = false; diagnosticsInstalled = false; appearanceSamples.clear(); sheetBackgrounds.clear(); sceneBackgrounds.clear();
      activeApi = undefined; settingsStore = undefined;
      notify();
      api.plugin.requireReload();
    }
  }) };
})()
