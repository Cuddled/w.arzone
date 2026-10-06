const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const colorToken = { [Symbol('name')]: 'BG_BASE_PRIMARY' };
const dangerToken = { [Symbol('name')]: 'TEXT_DANGER' };
const definitions = { BG_BASE_PRIMARY: {}, TEXT_DANGER: {} };
const resolver = { resolveSemanticColor(theme, token) { return token === dangerToken ? '#ff0000' : '#313338'; } };
const originalResolver = resolver.resolveSemanticColor;
const colors = { PRIMARY_600: '#313338', RED_400: '#ff0000', WHITE: '#ffffff' };
const originalWhite = Object.getOwnPropertyDescriptor(colors, 'WHITE');
const tokens = { RawColor: colors, SemanticColor: definitions, default: { meta: resolver } };
const registrations = {};
const AppRegistry = { registerComponent(key, provider) { registrations[key] = provider; return key; } };
const originalRegister = AppRegistry.registerComponent;
const RN = { AppRegistry, View: 'View', Image: 'Image', ScrollView: 'ScrollView', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput', StyleSheet: { flatten(s) { return Array.isArray(s) ? Object.assign({}, ...s) : s; } } };
const hooks = new Map();
const React = {
  createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  useState() { return [0, () => {}]; }, useEffect() {}
};
const revenge = {
  patcher: { instead(parent, key, cb) {
    const orig = parent[key]; parent[key] = function (...args) { return cb.call(this, args, orig); };
    return () => { parent[key] = orig; };
  } },
  modules: { finders: {
    filters: { withProps(...props) { return props; } },
    waitForModules() { return () => {}; },
    *lookupModules(props) { if (props[0] === 'RawColor') yield [tokens, 1]; else yield [RN, 2]; }
  } },
  react: { React, ReactNative: RN, jsxRuntime: { beforeJSX(type, fn) { hooks.set(type, fn); return () => hooks.delete(type); } } },
  discord: { common: { tokens: { Tokens: tokens } } }
};
let reloads = 0;
let saved;
const api = { plugin: { startedLate: false, requireReload() { reloads++; } }, jsonStorage: {
  async get() { return { opacity: .2, marble: true, glassEdges: true }; },
  async set(data) { saved = data; }
} };
const context = vm.createContext({ revenge, plugin: x => x, console });
const script = fs.readFileSync('build/index.js', 'utf8');
// Reproduce the real external loader, including its default-export contract.
const options = vm.runInContext('(function(revenge,plugin){return ' + script + '\n})(revenge,plugin)', context).default;

(async () => {
  options.preInit(api);
  await options.init(api);
  options.start(api);
  assert.equal(resolver.resolveSemanticColor('dark', colorToken), '#f5f5f7');
  assert.equal(resolver.resolveSemanticColor('dark', dangerToken), '#ff0000', 'danger colors preserved');
  assert.equal(colors.RED_400, '#ff0000', 'raw status colors preserved');
  // Reproduce the sticker greeting's strict hex parser on every overridden token.
  function hexWithOpacity(color, alpha) {
    assert.match(color, /^#[0-9a-f]{6}$/i, 'Discord helper accepts only six-digit hex');
    return color + Math.round(alpha * 255).toString(16).padStart(2, '0');
  }
  for (const name of ['BG_BASE_PRIMARY','BG_BASE_SECONDARY','BG_SURFACE_RAISED',
    'BG_SURFACE_OVERLAY','BG_BACKDROP','BACKGROUND_MENTION','BG_MOD_FAINT',
    'BORDER_SUBTLE','SCROLLBAR_THIN_THUMB','TEXT_NORMAL','BUTTON_FILLED_BACKGROUND']) {
    const token = { [Symbol('name')]: name }; definitions[name] = {};
    hexWithOpacity(resolver.resolveSemanticColor('dark', token), .3);
  }
  for (const name of Object.keys(colors)) hexWithOpacity(colors[name], .3);
  const App = () => 'discord';
  AppRegistry.registerComponent('Discord', () => App);
  const rootElement = registrations.Discord()({ screen: 1 });
  const backdrop = rootElement.type(rootElement.props);
  assert.equal(backdrop.type, 'View');
  assert.match(backdrop.props.children[0].props.source.uri, /^data:image\/jpeg;base64,/);
  const settings = options.SettingsComponent();
  const settingsView = settings.props.children[0];
  await settingsView.props.children[3].props.onPress();
  assert.equal(saved.opacity, .12);
  assert.ok(reloads > 0);
  const viewHook = hooks.get('View');
  const frozenProps = Object.freeze({ style: Object.freeze({ borderRadius: 16, backgroundColor: '#f5f5f7' }) });
  const transformed = viewHook(['View', frozenProps]);
  assert.notEqual(transformed[1], frozenProps, 'never mutate shared React props');
  assert.equal(transformed[1].style[1].borderWidth, .75);
  assert.equal(transformed[1].style[1].backgroundColor, 'rgba(255,255,255,0.12)');
  options.stop(api);
  assert.equal(resolver.resolveSemanticColor, originalResolver, 'resolver restored');
  assert.equal(AppRegistry.registerComponent, originalRegister, 'app registration restored');
  assert.deepEqual(Object.getOwnPropertyDescriptor(colors, 'WHITE'), originalWhite, 'raw descriptor restored');
  assert.equal(hooks.size, 0, 'JSX hooks removed');
  assert.equal(rootElement.type(rootElement.props), rootElement.props.children, 'retained wrapper inert when stopped');
  console.log('PASS: Next loader, color override, status preservation, bundled background, settings, immutable props, complete cleanup');
})().catch(e => { console.error(e); process.exitCode = 1; });
