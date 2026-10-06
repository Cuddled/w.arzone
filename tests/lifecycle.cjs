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
let copiedReport;
revenge.externals = { ReactNativeClipboard: { Clipboard: { setString(text) { copiedReport = text; } } } };
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
  assert.equal(resolver.resolveSemanticColor('light', colorToken), '#f5f5f7');
  assert.equal(resolver.resolveSemanticColor('light', dangerToken), '#ff0000', 'danger colors preserved');
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
    hexWithOpacity(resolver.resolveSemanticColor('light', token), .3);
  }
  for (const name of Object.keys(colors)) hexWithOpacity(colors[name], .3);
  // Raw palette is shared by text, icons and native screens; never invert WHITE.
  assert.equal(colors.WHITE, '#ffffff');
  assert.equal(colors.PRIMARY_600, '#313338');
  assert.equal(resolver.resolveSemanticColor('dark', colorToken), '#313338', 'dark mode retains readable original colors');
  assert.equal(resolver.resolveSemanticColor('light', colorToken), '#f5f5f7');
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
  assert.equal(transformed[1].style[1].borderWidth, 0, 'do not outline every panel');
  assert.equal(transformed[1].style[1].backgroundColor, 'rgba(255,255,255,0.12)');
  const gradient = React.createElement('RNLinearGradient', { colors: ['#664488', '#cc4499', '#12345600'], style: { flex: 1 }, children: 'unchanged' });
  assert.equal(gradient.props.colors[0], 'rgba(102,68,136,0.55)', 'custom RGB retained');
  assert.equal(gradient.props.colors[1], 'rgba(204,68,153,0.55)');
  assert.equal(gradient.props.colors[2], '#12345600', 'transparent stop stays transparent');
  const secondPass = React.createElement('RNLinearGradient', gradient.props);
  assert.equal(secondPass.props.colors[0], gradient.props.colors[0], 'do not compound alpha');
  const native = React.createElement('ReanimatedView', { style: { flex: 1, backgroundColor: '#1d1f24' } });
  assert.equal(native.props.style[1].backgroundColor, 'rgba(29,31,36,0.55)', 'retain dark profile hues');
  const custom = React.createElement('RCTView', { style: { flex: 1, backgroundColor: '#664488' } });
  assert.equal(custom.props.style[1].backgroundColor, 'rgba(102,68,136,0.55)');
  const textStyle = Object.freeze({ color: '#ffffff', backgroundColor: '#664488' });
  const text = React.createElement('RCTText', { style: textStyle, gradientColors: [-1] });
  assert.equal(text.props.style, textStyle, 'leave text rendering intact');
  const nativeInt = React.createElement('RNLinearGradient', { colors: [0xff664488 | 0] }).props.colors[0];
  assert.equal(nativeInt & 0xffffff, 0x664488, 'native ARGB keeps original RGB');
  assert.equal(nativeInt >>> 24, 140);
  const header = React.createElement('RNSScreenStackHeaderConfig', { backgroundColor: '#ffffff', color: '#70737a' });
  assert.equal(header.props.backgroundColor, 'rgba(255,255,255,0.12)');
  assert.equal(header.props.color, '#70737a');
  // Replay the report: a custom/dark profile is rendered after a light chat.
  resolver.resolveSemanticColor('dark', colorToken);
  for (const name of ['DCDChat', 'MessagesConnected', 'NavTTIView']) {
    const frozen = Object.freeze({ backgroundColor: '#fbfbfb' });
    const chat = React.createElement(name, { style: frozen, channelId: 'original' });
    assert.equal(chat.props.style[1].backgroundColor, 'rgba(251,251,251,0.12)', 'profile theme cannot disable chat transparency');
    assert.equal(chat.props.channelId, 'original');
    assert.equal(frozen.backgroundColor, '#fbfbfb');
  }
  const tintedChat = React.createElement('DCDChat', { style: { backgroundColor: '#ffffffcc' } });
  assert.equal(tintedChat.props.style[1].backgroundColor, 'rgba(255,255,255,0.12)');
  const profile = React.createElement('RNLinearGradient', { colors: ['rgba(255, 219, 238, 1)', 'rgba(0, 0, 0, 1)'] });
  assert.equal(profile.props.colors[0], 'rgba(255,219,238,0.55)');
  assert.equal(profile.props.colors[1], 'rgba(0,0,0,0.55)');
  const banner = React.createElement('ProfileBanner', { backgroundColor: 16754133 });
  assert.equal(banner.props.backgroundColor, 'rgba(255,165,213,0.55)', '24-bit profile banner color preserved');
  React.createElement('DCDChat', { messageContent: 'PRIVATE MESSAGE', userId: 'PRIVATE ID', theme: { backgroundColor: '#f5f5f7' } });
  React.createElement('ProfileGradient', { colors: ['#664488', '#cc4499'], username: 'PRIVATE NAME' });
  const diagnosticSettings = options.SettingsComponent().props.children[0];
  diagnosticSettings.props.children[7].props.onPress();
  assert.ok(copiedReport.includes('#664488'), 'retain exact custom gradient colors in report');
  assert.ok(copiedReport.includes('theme.backgroundColor'));
  assert.ok(!copiedReport.includes('PRIVATE'), 'exclude personal field values');
  options.stop(api);
  assert.equal(resolver.resolveSemanticColor, originalResolver, 'resolver restored');
  assert.equal(AppRegistry.registerComponent, originalRegister, 'app registration restored');
  assert.deepEqual(Object.getOwnPropertyDescriptor(colors, 'WHITE'), originalWhite, 'raw descriptor restored');
  assert.equal(hooks.size, 0, 'JSX hooks removed');
  assert.equal(rootElement.type(rootElement.props), rootElement.props.children, 'retained wrapper inert when stopped');
  console.log('PASS: Next loader, color override, status preservation, bundled background, settings, immutable props, complete cleanup');
})().catch(e => { console.error(e); process.exitCode = 1; });
