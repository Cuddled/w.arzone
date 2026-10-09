(function(){
"use strict";
var enabled=false,cleanups=[],apiRef,store;
var tintChat=true,headers=0,composers=0,inputs=0;
var samples=new Map(),headerSamples=new Map();
function transform(type,props){
 if(!enabled||!props||props.__blackCherry)return props;
 var name=typeof type==='string'?type:type&&(type.displayName||type.name);
 var RN=revenge.react.ReactNative,next;
 function put(k,v){if(!next)next=Object.assign({},props);next[k]=v;}
 var style=props.style&&RN.StyleSheet.flatten(props.style);
 if(name&&/^(ScreenStackHeaderConfig|RNSScreenStackHeaderConfig)$/.test(name)){
  put('style',[props.style,{backgroundColor:'#210610'}]);
  put('backgroundColor','#210610');put('color','#f8e6e9');put('titleColor','#f8e6e9');headers++;
 }
 var namedComposer=name&&/^(FloatingChatInputContainer|ChatInputContainer|ChatInputComposer)$/.test(name);
 var observedComposer=name&&/^(View|RCTView|ReanimatedView)$/.test(name)&&props.onLayout&&props.onResponderRelease&&style&&style.borderRadius>=12;
 if(namedComposer||observedComposer){
  // Style only the existing container. No wrapper, ref, touch or layout changes.
  put('style',[props.style,{backgroundColor:'#260912',borderColor:'#a63455',borderWidth:1,
   shadowColor:'#df315f',shadowOpacity:.18,shadowRadius:7,shadowOffset:{width:0,height:0}}]);composers++;
 }
 if(name==='DCDChatInput'){
  put('textColor','#f8e6e9');put('placeholderColor','#c293a1');put('selectionColor','#aa3459');inputs++;
 }
 if(tintChat&&name&&/^(DCDChat|MessagesConnected)$/.test(name))put('style',[props.style,{backgroundColor:'#10060a'}]);
 // Observe custom header renderers without guessing which ones should be recolored.
 var headerConfig=name&&/^(ScreenStackHeaderConfig|RNSScreenStackHeaderConfig)$/.test(name);
 var headerCandidate=name&&/Header|NavigationBar|NavBar/.test(name);
 var headerRow=name&&/^(View|RCTView|ReanimatedView)$/.test(name)&&style&&style.flexDirection==='row'&&
  typeof style.height==='number'&&style.height>=40&&style.height<=100&&style.backgroundColor!=null;
 if(headerCandidate||headerRow){
  var key=name+':'+(headerRow?'row:'+style.height+':'+String(style.backgroundColor):'named');
  var previous=headerSamples.get(key);
  if(previous)previous.renders++;
  else if(headerSamples.size<60){
   var sample={component:name,kind:headerConfig?'navigation-config':headerRow?'row-candidate':'named-header',renders:1,
    propNames:Object.keys(props).filter(function(k){return k!=='children';}),
    layout:style?{height:style.height,minHeight:style.minHeight,flexDirection:style.flexDirection,
     backgroundColor:typeof style.backgroundColor==='string'&&/^#[0-9a-f]{6,8}$/i.test(style.backgroundColor)?style.backgroundColor:undefined}:undefined};
   if(headerConfig){sample.hidden=typeof props.hidden==='boolean'?props.hidden:undefined;
    sample.translucent=typeof props.translucent==='boolean'?props.translucent:undefined;}
   headerSamples.set(key,sample);
  }
 }
 if((namedComposer||observedComposer||name==='DCDChatInput'||name&&/HeaderConfig$/.test(name))&&samples.size<40){
  // Metadata only; do not collect message text, IDs, users, sources or callbacks.
  samples.set(name, {component:name,propNames:Object.keys(props).filter(function(k){return k!=='children';}),
   layout:style?{borderRadius:style.borderRadius,height:style.height,flexDirection:style.flexDirection}:undefined});
 }
 return next||props;
}
function install(){
 if(cleanups.length)return;
 [revenge.react.ReactJSXRuntime,revenge.react.React].forEach(function(parent){
  if(!parent)return;
  ['jsx','jsxs','createElement'].forEach(function(key){
   if(typeof parent[key]!=='function')return;
   cleanups.push(revenge.patcher.instead(parent,key,function(args,original){
    var p=transform(args[0],args[1]);if(p!==args[1]){args=args.slice();args[1]=p;}
    return Reflect.apply(original,this,args);
   }));
  });
 });
}
function copyReport(){revenge.externals.ReactNativeClipboard.Clipboard.setString(JSON.stringify({version:'0.1.2',headers:headers,composers:composers,inputs:inputs,samples:Array.from(samples.values()),headerSamples:Array.from(headerSamples.values())},null,2));}
function SettingsComponent(){
 var R=revenge.react.React,N=revenge.react.ReactNative,state=R.useState(tintChat);
 function text(s,extra){return R.createElement(N.Text,{__blackCherry:true,style:Object.assign({color:'#f8e6e9',fontSize:16},extra)},s);}
 function button(s,fn){return R.createElement(N.Pressable,{__blackCherry:true,onPress:fn,style:{padding:16,marginVertical:8,borderRadius:18,backgroundColor:'#260912',borderColor:'#a63455',borderWidth:1}},text(s));}
 return R.createElement(N.ScrollView,{__blackCherry:true,style:{flex:1,backgroundColor:'#10060a'},contentContainerStyle:{padding:22}},
 text('Black Cherry — first test',{fontSize:27,fontWeight:'700',marginBottom:16}),
 text('Use Discord Dark. Disable Shine + Motion, Marble Glass and other theme plugins, then restart.',{color:'#c293a1',marginBottom:18}),
 text('Tests burgundy native headers and composer surfaces, a ruby composer outline and warm input text. This is a small working style test, not the glossy concept render.',{marginBottom:18}),
 button('Wine-black chat: '+(state[0]?'On':'Off'),async function(){tintChat=!tintChat;state[1](tintChat);if(store)await store.set({tintChat:tintChat});if(apiRef)apiRef.plugin.requireReload();}),
 button('Copy test report',copyReport),
 text('Open a DM, then send a screenshot and the report to check the visible header and composer. Reports contain component names and layout metadata only.',{color:'#c293a1',fontSize:14}));
}
return {default:plugin({SettingsComponent:SettingsComponent,
 init:async function(api){apiRef=api;store=api.jsonStorage;if(store){var saved=await store.get();if(saved&&typeof saved.tintChat==='boolean')tintChat=saved.tintChat;}},
 start:function(api){apiRef=api;enabled=true;install();},
 stop:function(api){enabled=false;cleanups.splice(0).reverse().forEach(function(fn){fn();});apiRef=undefined;store=undefined;api.plugin.requireReload();}
})};
})()
