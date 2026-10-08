const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const defs={BG_BASE_PRIMARY:{},TEXT_DANGER:{},TEXT_NORMAL:{},TEXT_LINK:{}};
const tokens={RawColor:{WHITE:'#ffffff'},SemanticColor:defs,resolveSemanticColor(theme,token){return token===defs.TEXT_DANGER?'#ff0000':theme==='light'?'#ffffff':'#313338';}};
const originalResolve=tokens.resolveSemanticColor;
const registrations={},hooks=new Map(),effects=[],listeners={};let loopStarts=0,loopStops=0,reduce=false;
const RN={View:'View',Image:'Image',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView',TextInput:'TextInput',
StyleSheet:{flatten(s){return Array.isArray(s)?Object.assign({},...s.map(v=>this.flatten(v))):s;}},
AppRegistry:{registerComponent(k,p){registrations[k]=p;}},
AppState:{currentState:'active',addEventListener(k,cb){listeners[k]=cb;return{remove(){delete listeners[k];}};}},
AccessibilityInfo:{isReduceMotionEnabled(){return Promise.resolve(reduce);},addEventListener(k,cb){listeners[k]=cb;return{remove(){delete listeners[k];}};}},
Animated:{View:'AnimatedView',Image:'AnimatedImage',Value:class{constructor(v){this.value=v;}setValue(v){this.value=v;}stopAnimation(){}interpolate(opts){return opts;}},timing(v,c){assert.equal(c.useNativeDriver,true);assert.equal(c.isInteraction,false);return c;},sequence(c){return c;},loop(c){return{start(){loopStarts++;},stop(){loopStops++;}};}}};
const originalCreate=(type,props,...children)=>({type,props:{...props,children}});
const React={createElement:originalCreate,useState(v){return[v,()=>{}];},useRef(v){return{current:v};},useEffect(fn){effects.push(fn);}};
const revenge={react:{React,ReactNative:RN,jsxRuntime:{beforeJSX(type,cb){hooks.set(type,cb);return()=>hooks.delete(type);}}},
patcher:{instead(parent,key,cb){const orig=parent[key];parent[key]=function(...args){return cb.call(this,args,orig);};return()=>{parent[key]=orig;};}},
modules:{finders:{filters:{withProps(...p){return p;}},waitForModules(){return()=>{};},*lookupModules(p){yield[p[0]==='RawColor'?tokens:RN,1];}}},
discord:{common:{tokens:{Tokens:tokens}}},externals:{ReactNativeClipboard:{Clipboard:{setString(value){assert.ok(!value.includes('PRIVATE'));}}}}};
let saved,reloads=0;const api={jsonStorage:{async get(){return{styleName:'jellyfish',opacity:.2};},async set(v){saved=v;}},plugin:{startedLate:false,requireReload(){reloads++;}}};
const ctx=vm.createContext({revenge,plugin:x=>x,console});
const source=fs.readFileSync('build/shine-motion/index.js','utf8');assert.ok(!source.includes('__SHINE_ART__'));
const options=vm.runInContext('(function(revenge,plugin){return '+source+'\n})(revenge,plugin)',ctx).default;
async function settle(){await Promise.resolve();await Promise.resolve();}
(async()=>{
options.preInit();assert.equal(React.createElement,originalCreate,'no early runtime hook before dispatcher startup');
await options.init(api);options.start(api);
assert.equal(tokens.resolveSemanticColor('dark',defs.BG_BASE_PRIMARY),'#0b0e18');
assert.equal(tokens.resolveSemanticColor('light',defs.BG_BASE_PRIMARY),'#ffffff','light profiles keep their foreground palette');
assert.equal(tokens.resolveSemanticColor('dark',defs.TEXT_DANGER),'#ff0000');
assert.equal(tokens.resolveSemanticColor('dark',defs.TEXT_NORMAL),'#313338','native foreground unchanged');
assert.equal(tokens.RawColor.WHITE,'#ffffff');
for(const token of Object.values(defs))assert.match(tokens.resolveSemanticColor('dark',token),/^#[\da-f]{6}$/i);
const App=()=>null;RN.AppRegistry.registerComponent('Discord',()=>App);const root=registrations.Discord()({});
const backdrop=root.type(root.props);const art=backdrop.props.children[0];const rendered=art.type(art.props);
assert.equal(rendered.type,'View');assert.match(rendered.props.children[0].props.source.uri,/^data:image\/jpeg;base64,/);assert.equal(rendered.props.pointerEvents,'none');assert.equal(rendered.props.children[1].type,'AnimatedImage');assert.equal(rendered.props.children[2].type,'AnimatedView');
// Mount the mocked effects, then drive app lifecycle and reduced motion.
const disposers=effects.splice(0).map(fn=>fn());await settle();assert.equal(loopStarts,1);
listeners.change('background');assert.equal(loopStops,1);assert.equal(loopStarts,1);
listeners.change('active');assert.equal(loopStarts,2);
listeners.reduceMotionChanged(true);assert.equal(loopStops,2);
listeners.change('active');assert.equal(loopStarts,2,'reduced motion prevents restart');
listeners.reduceMotionChanged(false);assert.equal(loopStarts,3);
const frozen=Object.freeze({style:Object.freeze({backgroundColor:'#0b0e18',borderRadius:16})});const mapped=hooks.get('View')(['View',frozen]);assert.notEqual(mapped[1],frozen);assert.equal(mapped[1].style[1].backgroundColor,'rgba(7,9,17,0.2)');
// Replay opaque DM, member-page and settings surface colors from device screenshots.
for (const color of ['#38383e','#36373f','#232428','#28282d','#121214','#313338']) {
 const props=Object.freeze({style:Object.freeze({backgroundColor:color})});
 const view=React.createElement('RCTView',props);
 assert.equal(view.props.style[1].backgroundColor,'rgba(7,9,17,0.025)','cached dark surface becomes nearly clear');
 const twice=React.createElement('RCTView',view.props);
 assert.equal(twice.props.style,view.props.style,'alpha does not compound');
}
const card=React.createElement('View',{style:{backgroundColor:'#38383e',borderRadius:20}});
assert.equal(card.props.style[1].backgroundColor,'rgba(7,9,17,0.2)');
const nativePanel=React.createElement('RCTView',{style:{backgroundColor:0xff38383e>>>0}});
assert.equal(nativePanel.props.style[1].backgroundColor,'rgba(7,9,17,0.025)');
assert.equal(React.createElement('RCTView',{style:{backgroundColor:'#5865f2'}}).props.style.backgroundColor,'#5865f2','brand buttons preserved');
assert.equal(React.createElement('RCTView',{style:{backgroundColor:'#000000'}}).props.style.backgroundColor,'#000000','black masks preserved');
const floating=React.createElement('View',{style:{backgroundColor:'#131724'}});
assert.equal(floating.props.style[1].backgroundColor,'rgba(7,9,17,0.75)','floating surfaces remain legible');
const gradient=React.createElement('RNLinearGradient',{colors:['#ffa5d5','#00000000']});assert.equal(gradient.props.colors[0],'rgba(255,165,213,0.55)');assert.equal(gradient.props.colors[1],'#00000000');
const textStyle={color:'#ffffff'};assert.equal(React.createElement('RCTText',{style:textStyle}).props.style,textStyle);
function Background(){}const props={animatedIndex:{},animatedPosition:{},style:{height:600,backgroundColor:'#ffffff'}};
const sheet=React.createElement(Background,props);const backing=sheet.type(sheet.props);assert.equal(backing.props.style[1].backgroundColor,'#070911');assert.equal(backing.props.children[1].type,Background);assert.equal(backing.props.children[1].props.animatedIndex,props.animatedIndex);
assert.equal(typeof backing.props.children[0].type,'function','profile sheet mounts animated Artwork, not a static image');
const profileArt=backing.props.children[0];const profileVisual=profileArt.type(profileArt.props);
assert.equal(profileVisual.props.children[1].type,'AnimatedImage');
const profileDisposers=effects.splice(0).map(fn=>fn());const beforeProfileStart=loopStarts;await settle();assert.equal(loopStarts,beforeProfileStart+1,'profile owns a live native animation');
const screen=React.createElement('RNSScreenContentWrapper',{stackPresentation:'push',style:{flex:1},children:'members'});
assert.notEqual(screen.type,'RNSScreenContentWrapper');const scene=screen.type({...screen.props,children:'members'});
assert.equal(scene.type,'RNSScreenContentWrapper','original native scene type retained');
assert.equal(scene.props.stackPresentation,'push');assert.equal(scene.props.style[1].backgroundColor,'#070911','opaque scene hides previous chat');
assert.equal(typeof scene.props.children[0].type,'function');assert.equal(scene.props.children[1],'members','original screen content retained');
assert.equal(React.createElement(scene.type,scene.props).type,scene.type,'scene marker prevents recursive wrapping');
const settings=options.SettingsComponent().props.children[0].props.children;
const cards=settings.filter(e=>e?.props?.style?.height===142);assert.equal(cards.length,4);
const images=new Set(cards.map(c=>c.props.children[0].props.source.uri));assert.equal(images.size,4,'all four unique artworks bundled');
for(let i=0;i<4;i++){await cards[i].props.onPress();assert.equal(saved.styleName,['mercury','prism','afterimage','jellyfish'][i]);}
const motionButton=settings.find(e=>e?.props?.children?.[0]?.props?.children?.[0]==='Motion: On');await motionButton.props.onPress();assert.equal(saved.motion,false);
assert.ok(reloads>=4);options.stop(api);assert.equal(loopStops,loopStarts,'save/stop cancels all native animations immediately');const startsBeforeReduced=loopStarts;
assert.equal(React.createElement,originalCreate);assert.equal(tokens.resolveSemanticColor,originalResolve);assert.equal(hooks.size,0);
assert.equal(root.type(root.props),root.props.children,'retained root is inert');
for(const dispose of disposers.concat(profileDisposers))if(dispose)dispose();assert.deepEqual(Object.keys(listeners),[],'event subscriptions cleaned');
// System reduce motion on first mount must never start a loop.
api.jsonStorage.get=async()=>({styleName:"prism",motion:true});reduce=true;RN.AppState.currentState=null;options.preInit();await options.init(api);options.start(api);const again=registrations.Discord()({});const bg=again.type(again.props);bg.props.children[0].type({});
const ds=effects.splice(0).map(fn=>fn());await settle();assert.equal(loopStarts,startsBeforeReduced);options.stop(api);for(const d of ds)if(d)d();
// If the OS cannot answer reduced-motion state, do not leave animation paused forever.
RN.AccessibilityInfo.isReduceMotionEnabled=()=>Promise.reject(Error('unsupported'));options.preInit();await options.init(api);options.start(api);const finalBg=registrations.Discord()({});const finalRoot=finalBg.type(finalBg.props);finalRoot.props.children[0].type({});const fsCleanup=effects.splice(0).map(fn=>fn());await settle();await settle();assert.equal(loopStarts,startsBeforeReduced+1,'unknown AppState and rejected accessibility query recover');options.stop(api);for(const d of fsCleanup)if(d)d();
console.log('PASS: four artworks, loader, no early JSX hook, semantic hex, profile RGB, immutable props, opaque sheet backing, settings persistence, native animations, app pause, reduced motion, stop/unmount cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
