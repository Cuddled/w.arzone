const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let currentUser = '100', order = ['3','1','2'], saved, report, alert;
const channels = Object.fromEntries(['1','2','3'].map(id=>[id,{id,type:1,recipients:[id]}]));
const sortStore = { getName:()=> 'PrivateChannelSortStore', getPrivateChannelIds:()=>order, getSortedChannels:()=>order.map(channelId=>({channelId})), emitChange(){} };
const channelStore = {getChannel:id=>channels[id],getMutablePrivateChannels:()=>channels,getSortedPrivateChannels:()=>order.map(id=>channels[id]),emitChange(){}};
const users = {getCurrentUser:()=>({id:currentUser}),getUser:id=>({username:'Friend '+id})};
const modules=[sortStore,channelStore,users];
const React={createElement(type,props,...children){return {type,props:{...props,children}}},useState(){return [0,()=>{}]},useEffect(){}};
const RN={View:'View',Text:'Text',TextInput:'TextInput',Pressable:'Pressable',ScrollView:'ScrollView',Alert:{alert(...args){alert=args}}};
// Stable, mutable proxies reproduce the critical Revenge patcher behavior.
const patchStates=new WeakMap();
const patcher={instead(parent,key,cb){
 let state=patchStates.get(parent[key]);
 if(!state){state={target:parent[key],hooks:[]};const proxy=new Proxy(state.target,{apply(_target,self,args){return invoke(state,0,self,args)}});state.proxy=proxy;parent[key]=proxy;patchStates.set(proxy,state);}
 const node={cb};state.hooks.unshift(node);
 return ()=>{state.hooks.splice(state.hooks.indexOf(node),1);if(!state.hooks.length&&parent[key]===state.proxy)parent[key]=state.target};
}};
function invoke(state,index,self,args){const node=state.hooks[index];return node?node.cb.call(self,args,function(...nextArgs){return invoke(state,index+1,this,nextArgs)}):Reflect.apply(state.target,self,args)}
const jsxRuntime={jsx:React.createElement.bind(React),jsxs:React.createElement.bind(React)};
// Core captures raw JSX before installing its dispatcher. Profile plugins use
// the captured factory to create elements without recursively re-entering hooks.
const coreRawJSX=jsxRuntime.jsx;
for(const key of ['jsx','jsxs'])patcher.instead(jsxRuntime,key,function(args,orig){
 if(args[0]==='UserProfilePrimaryInfo')return coreRawJSX(...args);
 return Reflect.apply(orig,this,args);
});
const capturedAppJSX=jsxRuntime.jsx;
// Regression: patching before core captures JSX creates a self-referential proxy.
const earlyRuntime={jsx:(_type,props)=>props};
const undoEarly=patcher.instead(earlyRuntime,'jsx',function(args,orig){return Reflect.apply(orig,this,args)});
const earlyCaptured=earlyRuntime.jsx;
const undoCore=patcher.instead(earlyRuntime,'jsx',function(args){return earlyCaptured(...args)});
assert.throws(()=>earlyRuntime.jsx('UserProfilePrimaryInfo',{}),RangeError,'old startup timing reproduces recursive proxy failure');
undoCore();undoEarly();

const revenge={react:{React,ReactNative:RN,ReactJSXRuntime:jsxRuntime},patcher,modules:{finders:{filters:{withProps:(...keys)=>keys},waitForModules:()=>()=>{},*lookupModules(keys){for(const m of modules)if(keys.every(k=>k in m))yield [m,1]}}},externals:{ReactNativeClipboard:{Clipboard:{setString:value=>report=value}}}};
const context=vm.createContext({revenge,plugin:x=>x});
const options=vm.runInContext('('+fs.readFileSync('plugins/sticky-dms/js/index.js','utf8')+').default',context);
const origSort=sortStore.getPrivateChannelIds, origCreate=React.createElement;
const api={jsonStorage:{async get(){return {accounts:{100:['2','1'],200:['3']},indicator:'⭐'}},async set(value){saved=value}}};
function flatten(node){if(!node)return [];if(Array.isArray(node))return node.flatMap(flatten);return typeof node==='object'?[node,...flatten(node.props?.children)]:[];}
function button(name){return flatten(options.SettingsComponent()).find(n=>n.type==='Pressable'&&n.props.children[0]?.props.children[0]===name)}
(async()=>{
 assert.equal(options.preInit,undefined,"never patch JSX during preInit");await options.init(api);options.start(api);
 assert.deepEqual([...sortStore.getPrivateChannelIds()],['2','1','3']);
 assert.doesNotThrow(()=>capturedAppJSX('UserProfilePrimaryInfo',{user:{id:'100'}}),'profile JSX hook does not recurse');
 order=['1','3','2'];assert.deepEqual([...sortStore.getPrivateChannelIds()],['2','1','3'],'new messages cannot reorder pins');
 assert.deepEqual(order,['1','3','2'],'cached source never mutated');
 assert.deepEqual([...sortStore.getSortedChannels()].map(x=>x.channelId),['2','1','3']);
 assert.deepEqual([...channelStore.getSortedPrivateChannels()].map(x=>x.id),['2','1','3']);
 currentUser='200';assert.deepEqual([...sortStore.getPrivateChannelIds()],['3','1','2'],'pins isolated per account');currentUser='100';
 // Reproduce the anonymous memoized mobile list, which reads no store getter.
 const listType={type:function(){}};
 const mobileData=Object.freeze({channels:Object.freeze([{channelId:'3',lastMessageId:'999'},{channelId:'1',lastMessageId:'100'},{channelId:'2',lastMessageId:'200'}]),channelFavorites:Object.freeze([]),sections:Object.freeze([1,3,0,0,0]),dataKey:'20'});
 const mobile=React.createElement(listType,{listItemHeight:72,data:mobileData});
 assert.notEqual(mobile.type,listType,'anonymous memo list identified by captured prop structure');
 const actual=mobile.type(mobile.props);
 assert.deepEqual([...actual.props.data.channels].map(x=>x.channelId),['2','1','3'],'visible mobile list ordered independently of getters');
 assert.equal(actual.props.data.sections,mobileData.sections,'section counts unchanged');
 assert.notEqual(actual.props.data.dataKey,mobileData.dataKey,'layout memo key invalidated');
 assert.equal(mobileData.channels[0].channelId,'3','original memo data immutable');
 const updated=React.createElement(listType,{listItemHeight:72,data:{...mobileData,channels:[{channelId:'1',lastMessageId:'9999'},{channelId:'3',lastMessageId:'999'},{channelId:'2',lastMessageId:'200'}]}});
 assert.deepEqual([...updated.type(updated.props).props.data.channels].map(x=>x.channelId),['2','1','3'],'message changes cannot move fixed pins');
 const withFavorites=React.createElement(listType,{listItemHeight:72,data:{...mobileData,channels:[{channelId:'1'},{channelId:'2'}],channelFavorites:[{channelId:'3',isFavorite:true}],sections:[1,2,1]}});
 const split=withFavorites.type(withFavorites.props).props.data;
 assert.deepEqual([...split.channelFavorites].map(x=>x.channelId),['2']);
 assert.deepEqual([...split.channels].map(x=>x.channelId),['1','3']);
 assert.equal(split.channels[1].isFavorite,true,'native favorite membership unchanged');
 assert.deepEqual([...split.sections],[1,2,1]);
 const contentType={type:function MessagesItemChannelContent(){}};
 const content=React.createElement(contentType,{channel:channels['2'],favorite:false,hasUnreadMessages:true});
 const rendered=content.type(content.props);
 assert.equal(rendered.type,'View');
 assert.equal(rendered.props.children[1].props.children[0],'⭐','indicator works without string name/title props');
 assert.equal(rendered.props.children[0].props.hasUnreadMessages,true);
 let originals=0;const props=Object.freeze({channel:channels['2'],title:'Friend 2',onLongPress(){originals++}});
 const row=React.createElement('DMListItem',props);
 assert.equal(row.props.title,'Friend 2 ⭐');assert.equal(props.title,'Friend 2');
 row.props.onLongPress();alert[2][1].onPress();assert.equal(originals,1,'original menu accessible');
 await button('↓').props.onPress();assert.deepEqual([...sortStore.getPrivateChannelIds()],['1','2','3']);
 await button('Pin Friend 3').props.onPress();assert.deepEqual([...saved.accounts['100']],['1','2','3']);
 await button('Copy compatibility report').props.onPress();assert.ok(!report.includes('Friend'));assert.ok(!report.includes('recipients'));assert.ok(JSON.parse(report).listHooks>0);
 options.stop();assert.equal(sortStore.getPrivateChannelIds,origSort);assert.equal(React.createElement,origCreate);
 const again=vm.runInContext('('+fs.readFileSync('plugins/sticky-dms/js/index.js','utf8')+').default',context);await again.init({jsonStorage:{get:async()=>saved,set:api.jsonStorage.set}});again.start(api);assert.deepEqual([...sortStore.getPrivateChannelIds()],['1','2','3'],'pins persist across restart');again.stop();
 console.log('PASS: fixed ordering after messages, unpinned order, immutable caches, account isolation, persistence, mobile memo list, native row indicator, original menu and cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
