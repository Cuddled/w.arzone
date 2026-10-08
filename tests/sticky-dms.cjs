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
const revenge={react:{React,ReactNative:RN},patcher:{instead(parent,key,cb){const orig=parent[key];parent[key]=function(...args){return cb.call(this,args,orig)};return ()=>parent[key]=orig}},modules:{finders:{filters:{withProps:(...keys)=>keys},waitForModules:()=>()=>{},*lookupModules(keys){for(const m of modules)if(keys.every(k=>k in m))yield [m,1]}}},externals:{ReactNativeClipboard:{Clipboard:{setString:value=>report=value}}}};
const context=vm.createContext({revenge,plugin:x=>x});
const options=vm.runInContext('('+fs.readFileSync('plugins/sticky-dms/js/index.js','utf8')+').default',context);
const origSort=sortStore.getPrivateChannelIds, origCreate=React.createElement;
const api={jsonStorage:{async get(){return {accounts:{100:['2','1'],200:['3']},indicator:'⭐'}},async set(value){saved=value}}};
function flatten(node){if(!node)return [];if(Array.isArray(node))return node.flatMap(flatten);return typeof node==='object'?[node,...flatten(node.props?.children)]:[];}
function button(name){return flatten(options.SettingsComponent()).find(n=>n.type==='Pressable'&&n.props.children[0]?.props.children[0]===name)}
(async()=>{
 await options.init(api);options.start(api);
 assert.deepEqual([...sortStore.getPrivateChannelIds()],['2','1','3']);
 order=['1','3','2'];assert.deepEqual([...sortStore.getPrivateChannelIds()],['2','1','3'],'new messages cannot reorder pins');
 assert.deepEqual(order,['1','3','2'],'cached source never mutated');
 assert.deepEqual([...sortStore.getSortedChannels()].map(x=>x.channelId),['2','1','3']);
 assert.deepEqual([...channelStore.getSortedPrivateChannels()].map(x=>x.id),['2','1','3']);
 currentUser='200';assert.deepEqual([...sortStore.getPrivateChannelIds()],['3','1','2'],'pins isolated per account');currentUser='100';
 let originals=0;const props=Object.freeze({channel:channels['2'],title:'Friend 2',onLongPress(){originals++}});
 const row=React.createElement('DMListItem',props);
 assert.equal(row.props.title,'Friend 2 ⭐');assert.equal(props.title,'Friend 2');
 row.props.onLongPress();alert[2][1].onPress();assert.equal(originals,1,'original menu accessible');
 await button('↓').props.onPress();assert.deepEqual([...sortStore.getPrivateChannelIds()],['1','2','3']);
 await button('Pin Friend 3').props.onPress();assert.deepEqual([...saved.accounts['100']],['1','2','3']);
 await button('Copy compatibility report').props.onPress();assert.ok(!report.includes('Friend'));assert.ok(!report.includes('recipients'));
 options.stop();assert.equal(sortStore.getPrivateChannelIds,origSort);assert.equal(React.createElement,origCreate);
 const again=vm.runInContext('('+fs.readFileSync('plugins/sticky-dms/js/index.js','utf8')+').default',context);await again.init({jsonStorage:{get:async()=>saved,set:api.jsonStorage.set}});again.start(api);assert.deepEqual([...sortStore.getPrivateChannelIds()],['1','2','3'],'pins persist across restart');again.stop();
 console.log('PASS: fixed ordering after messages, unpinned order, immutable caches, account isolation, persistence, indicator, original menu and cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
