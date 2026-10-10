(function(){
'use strict';
var enabled=false,cleanups=[],storage,apiRef,strength='soft',textGlow=true;
var counts={panels:0,text:0};
function keep(fn){if(typeof fn==='function')cleanups.push(fn);}
function preset(){return {soft:{alpha:.26,radius:7,text:1},normal:{alpha:.42,radius:11,text:2},bright:{alpha:.6,radius:16,text:3}}[strength];}
function modernShadows(){var P=revenge.react.ReactNative.Platform;return !P||P.OS!=='android'||Number(P.Version)>=28;}
function transform(type,props){
 if(!enabled||!props||props.__whiteGlow)return props;
 var name=typeof type==='string'?type:type&&(type.displayName||type.name);
 if(!name||!props.style)return props;
 var N=revenge.react.ReactNative,s=N.StyleSheet.flatten(props.style);if(!s)return props;
 var config=preset(),override;
 if(textGlow&&/^(Text|RCTText|RCTVirtualText)$/.test(name)){
  // Keep the original text color and font. The glow is an extra steady shadow.
  if(s.textShadowColor==='#ffffff'&&s.textShadowRadius===config.text)return props;
  override={textShadowColor:'#ffffff',textShadowRadius:config.text,textShadowOffset:{width:0,height:0}};counts.text++;
 }else if(/^(View|RCTView|ReanimatedView|Pressable|AnimatedPressableHighlightAndroid|PressableCard|FloatingChatInputContainer|ClipView|RNGestureHandlerButton)$/.test(name)){
  var radius=s.borderRadius||s.borderTopLeftRadius||0;
  var screen=s.flex===1&&radius<8||s.height==='100%';
  // Decorate visible card/button surfaces, never every layout wrapper or image mask.
  var surface=s.backgroundColor!==undefined&&s.backgroundColor!=='transparent'&&s.backgroundColor!=='#00000000'||s.borderWidth>0||s.borderColor!==undefined;
  var composer=name==='FloatingChatInputContainer';
  if(screen||!composer&&!(radius>=8&&surface))return props;
  var shadow='0px 0px '+config.radius+'px rgba(255,255,255,'+config.alpha+')';
  if(s.boxShadow===shadow)return props;
  override={borderColor:'rgba(255,255,255,'+config.alpha+')',borderWidth:Math.max(s.borderWidth||0,.75),
   shadowColor:'#ffffff',shadowRadius:config.radius,shadowOpacity:config.alpha,shadowOffset:{width:0,height:0}};
  // Modern Android's boxShadow provides a true white outer glow. Do not use
  // elevation as a substitute: it changes z-order and casts a dark shadow.
  if(modernShadows())override.boxShadow=shadow;
  counts.panels++;
 }
 if(!override)return props;
 return Object.assign({},props,{__whiteGlow:true,style:[props.style,override]});
}
function install(){
 if(cleanups.length)return;
 [revenge.react.ReactJSXRuntime,revenge.react.React].forEach(function(parent){if(!parent)return;
  ['jsx','jsxs','createElement'].forEach(function(key){if(typeof parent[key]!=='function')return;
   keep(revenge.patcher.instead(parent,key,function(args,original){var next=transform(args[0],args[1]);
    if(next!==args[1]){args=args.slice();args[1]=next;}return Reflect.apply(original,this,args);
   }));
  });
 });
}
async function save(key,value){if(key==='strength')strength=value;if(key==='textGlow')textGlow=value;
 if(storage)await storage.set({strength:strength,textGlow:textGlow});
 // Native cached styles may need one explicit reload after a user changes settings.
 if(apiRef)apiRef.plugin.requireReload();
}
function report(){revenge.externals.ReactNativeClipboard.Clipboard.setString(JSON.stringify({version:'0.1.0',strength:strength,textGlow:textGlow,boxShadowEligible:modernShadows(),panels:counts.panels,text:counts.text},null,2));}
function SettingsComponent(){
 var R=revenge.react.React,N=revenge.react.ReactNative,refresh=R.useState(0)[1];
 function text(label,extra){return R.createElement(N.Text,{__whiteGlow:true,style:Object.assign({color:'#f5f5f5',fontSize:16},extra)},label);}
 function button(label,fn){return R.createElement(N.Pressable,{__whiteGlow:true,onPress:fn,
  style:{padding:16,marginVertical:6,borderRadius:16,backgroundColor:'#202126',borderColor:'#ffffff66',borderWidth:1}},text(label));}
 async function update(key,value){await save(key,value);refresh(function(n){return n+1;});}
 return R.createElement(N.ScrollView,{__whiteGlow:true,style:{flex:1,backgroundColor:'#111214'},contentContainerStyle:{padding:22,paddingBottom:60}},
  text('White Glow',{fontSize:28,fontWeight:'700',marginBottom:16}),
  text('Steady white highlights over your existing colors. Looks strongest on dark themes.',{color:'#bbbcc5',marginBottom:20}),
  button('Strength: '+strength,function(){return update('strength',strength==='soft'?'normal':strength==='normal'?'bright':'soft');}),
  button('Text glow: '+(textGlow?'On':'Off'),function(){return update('textGlow',!textGlow);}),
  button('Copy glow report',report),
  text('Outer glow uses modern React Native box shadows. Some Android builds and clipped panels may show only the white outline. Text glow can be switched off for readability.',{color:'#bbbcc5',fontSize:14,marginTop:20}),
  text('Fully restart once after installation. Startup never requests a reload.',{color:'#bbbcc5',fontSize:14,marginTop:16}));
}
return {default:plugin({SettingsComponent:SettingsComponent,
 init:async function(api){storage=api.jsonStorage;apiRef=api;if(storage){var data=await storage.get();if(data&&['soft','normal','bright'].includes(data.strength))strength=data.strength;if(data&&typeof data.textGlow==='boolean')textGlow=data.textGlow;}},
 start:function(api){apiRef=api;enabled=true;install();},
 stop:function(api){enabled=false;cleanups.splice(0).reverse().forEach(function(fn){fn();});storage=undefined;apiRef=undefined;api.plugin.requireReload();}
})};
})()
