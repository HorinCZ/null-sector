const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),B=require(path.join(root,'vendor/babylon.js'));
let tick,dt=1/60,now=0,timers=[],seed=Number(process.env.NS_TEST_SEED||84531),pointerLockAllowed=true;
class Element{
 constructor(id=''){this.id=id;this.children=[];this.style={};this.dataset={};this._text='';this.events={};this.hidden=false;this.value='';this.checked=true;this.classNames=new Set();this.classList={add:(s)=>this.classNames.add(s),remove:(s)=>this.classNames.delete(s),contains:(s)=>this.classNames.has(s),toggle:(s,force)=>{const add=force??!this.classNames.has(s);add?this.classNames.add(s):this.classNames.delete(s);}};}
 set textContent(s){this._text=String(s)}get textContent(){return this._text}set innerHTML(s){this._html=s}get innerHTML(){return this._html}
 get firstElementChild(){return this.children[0]||(this.children[0]=new Element())}get lastChild(){return this.children.at(-1)}
 append(e){this.children.push(e);e.parent=this}prepend(e){this.children.unshift(e);e.parent=this}replaceChildren(...e){this.children=e}remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this)}
 querySelectorAll(q){if(q==='i'&&!this.children.length){this.children=[new Element(),new Element()]}return this.children}
 addEventListener(name,fn){(this.events[name]??=[]).push(fn)}dispatch(name,e){for(const fn of this.events[name]||[])fn(e)}click(){this.onclick?.();this.dispatch('click',{})}focus(){}getContext(){return draw}
 getBoundingClientRect(){return {left:0,right:1280,top:0,bottom:720}}
 requestPointerLock(){if(!pointerLockAllowed){doc.dispatch('pointerlockerror',{});return Promise.resolve()}doc.pointerLockElement=this;doc.dispatch('pointerlockchange',{});return Promise.resolve()}
}
const draw=new Proxy({measureText:()=>({width:100}),canvas:{width:512,height:512}},{get:(o,p)=>p in o?o[p]:(()=>{}),set:(o,p,v)=>(o[p]=v,true)});
const elements=new Map(),html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const m of html.matchAll(/<[^>]+id="([^"]+)"[^>]*>/g)){const el=new Element(m[1]);if(m[0].includes('hidden'))el.classList.add('hidden');elements.set(m[1],el);}
const doc=new Element('document');doc.getElementById=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};doc.createElement=()=>new Element();doc.body=new Element('body');doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatch('pointerlockchange',{})};
const slots=[0,1,2].map(i=>{const e=new Element();e.dataset.slot=String(i);return e}),difficulties=['easy','normal','hard'].map(v=>{const e=new Element();e.dataset.difficulty=v;return e});doc.querySelectorAll=q=>q.includes('data-slot')?slots:q.includes('data-difficulty')?difficulties:[];
class TestEngine extends B.NullEngine{constructor(){super({renderWidth:1280,renderHeight:720,textureSize:512,deterministicLockstep:true,lockstepMaxSteps:4})}getDeltaTime(){return dt*1000}getFps(){return 60}runRenderLoop(f){tick=f}setHardwareScalingLevel(){}}
class TestTexture extends B.Texture{constructor(name,options,scene){super(null,scene);this.name=name}getContext(){return draw}update(){}}
class TestScene extends B.Scene{render(){} }
const storage=new Map(),context={console,document:doc,BABYLON:{...B,Engine:TestEngine,DynamicTexture:TestTexture,Scene:TestScene},devicePixelRatio:1,structuredClone,performance,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout:(fn,ms)=>timers.push({fn,time:now+ms/1000}),clearTimeout:()=>{},Math:Object.create(Math)};
context.Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};context.window=context;context.addEventListener=()=>{};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'core.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'game.js'),'utf8'),context);
function step(n=1){for(let i=0;i<n;i++){now+=dt;tick();const ready=timers.filter(t=>t.time<=now);timers=timers.filter(t=>t.time>now);for(const t of ready)t.fn();}assert.equal(context.nullSector.snapshot().stats.errors.length,0,elements.get('error').textContent)}
const snap=()=>context.nullSector.snapshot();const key=(code,down=true)=>doc.dispatch(down?'keydown':'keyup',{code,preventDefault(){},repeat:false});const tap=code=>{key(code);key(code,false)};
assert.equal(snap().state,'menu');elements.get('start').click();step(2);assert.equal(snap().state,'countdown');
const gameCanvas=elements.get('game');
const pointer=(kind,button,buttons,x=640,y=360)=>{
 const e={button,buttons,clientX:x,clientY:y,pointerId:1,target:gameCanvas,movementX:0,movementY:0,preventDefault(){}};
 (kind==='pointerdown'||kind==='pointercancel'||kind==='lostpointercapture'?gameCanvas:doc).dispatch(kind,e);
};
// Babylon suppresses compatibility mouse events. Exercise only Pointer Events.
pointer('pointerdown',0,1);pointer('pointerup',0,0);assert.equal(snap().player.ammo[0],27);step(15);assert.equal(snap().shots,1);
pointer('pointerdown',0,1);step(24);assert(snap().shots>=4);pointer('pointerup',0,0);const releasedShots=snap().shots;step(20);assert.equal(snap().shots,releasedShots);
// A denied lock must enable drag-look, never pause or eat the shot. Chording
// right + left emits pointermove with buttons=3, not a second pointerdown.
elements.get('quit').click();pointerLockAllowed=false;elements.get('start').click();step(1);assert.equal(snap().input.mode,'drag');
doc.dispatch('pointerlockchange',{});assert.equal(snap().state,'countdown');
pointer('pointerdown',2,2,640,360);pointer('pointermove',-1,2,740,370);assert(snap().player.yaw>.19);assert.equal(snap().input.aiming,true);
pointer('pointermove',0,3,750,370);assert.equal(snap().shots,1);assert.equal(snap().input.mouseDown,true);assert.equal(snap().input.aiming,true);
step(20);pointer('pointermove',0,2,750,370);const chordShots=snap().shots;step(20);assert.equal(snap().shots,chordShots);assert.equal(snap().input.aiming,true);
pointer('pointermove',-1,2,1275,370);const edgeYaw=snap().player.yaw;step(20);assert(snap().player.yaw>edgeYaw+.4);
pointer('pointerup',2,0);const stoppedYaw=snap().player.yaw;step(20);assert.equal(snap().player.yaw,stoppedYaw);
pointer('pointerdown',0,1,640,360);const leftYaw=snap().player.yaw;pointer('pointermove',-1,1,740,360);assert(snap().player.yaw>leftYaw+.19);pointer('pointercancel',0,0);const cancelled=snap().shots;step(20);assert.equal(snap().shots,cancelled);
console.log('PASS: real pointer buttons, hold/release, denied pointer lock, drag-look, button chording, edge-look and cancellation');
// Simulate returning to a browser that has granted pointer lock.
elements.get('quit').click();pointerLockAllowed=true;elements.get('start').click();gameCanvas.requestPointerLock();step(2);
// A short tap must fire even when both input events happen between rendered frames.
tap('KeyF');assert.equal(snap().player.ammo[0],27);step(20);tap('Digit2');step(15);tap('KeyF');assert.equal(snap().player.ammo[1],7);step(45);tap('Digit3');step(15);tap('KeyF');assert.equal(snap().player.ammo[2],4);step(60);tap('KeyR');step(140);assert.equal(snap().player.ammo[2],5);
// Pause must stop the simulation and resuming must return to combat.
tap('KeyP');const paused=snap().runTime;step(120);assert.equal(snap().runTime,paused);elements.get('resume').click();step(1);assert.equal(snap().state,'playing');
// Real movement inputs and dash, with no direct mutation of the game state.
const z0=snap().player.z;key('KeyW');step(20);key('KeyW',false);assert(snap().player.z>z0+2);tap('ShiftLeft');step(12);assert(snap().player.dash<1.5);tap('Space');step(10);assert(snap().player.y>0);step(65);
console.log('PASS: launch, all weapons, quick taps, reload, pause, movement, dash, jump');
// Start a clean run, then exercise the entire encounter system using a deterministic bot.
elements.get('quit').click();difficulties.find(e=>e.dataset.difficulty===(process.env.NS_TEST_DIFFICULTY||'normal')).click();elements.get('start').click();
let lastWave=0,visited=new Set(),sawBoss=false,upgradeCount=0;const held=new Set();
function setKeys(wanted){for(const c of held)if(!wanted.includes(c)){key(c,false);held.delete(c)}for(const c of wanted)if(!held.has(c)){key(c);held.add(c)}}
for(let block=0;block<24000;block++){
 const s=snap();if(s.wave!==lastWave){console.log('wave',s.wave,'time',Math.round(s.runTime),'hp',Math.round(s.player.hp),'kills',s.kills);lastWave=s.wave;}visited.add(s.wave);sawBoss||=s.enemies.some(e=>e.type==='boss');
 if(s.state==='upgrade'){setKeys([]);const cards=elements.get('upgrade-cards').children;assert.equal(cards.length,3);cards[0].click();upgradeCount++;continue;}
 if(s.state==='dead'||s.state==='victory'){console.log('ended',s.state,'time',Math.round(s.runTime),'kills',s.kills,'wave',s.wave,'meshes',s.meshes);break;}
 const p=s.player;let target=s.enemies.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
 if(target){const dx=target.x-p.x,dz=target.z-p.z,distance=Math.hypot(dx,dz);const scale=target.type==='boss'?2.1:target.type==='heavy'?1.45:1;let yaw=Math.atan2(dx,dz),pitch=-Math.atan2(1.95*scale+(target.type==='shooter'?.5:0)-(p.y+1.72),distance);let dy=yaw-p.yaw;while(dy>Math.PI)dy-=Math.PI*2;while(dy<-Math.PI)dy+=Math.PI*2;doc.dispatch('pointermove',{movementX:dy/.002,movementY:(pitch-p.pitch)/.002,buttons:0,target:gameCanvas});
   if(distance<9&&p.pulse>=100)tap('KeyE');const weapon=distance<10?1:target.type==='heavy'||target.type==='boss'?2:0;if(weapon!==p.weapon)tap('Digit'+(weapon+1));
   const move=[];if(distance<9)move.push('KeyS');else if(distance>20)move.push('KeyW');move.push(block%500<250?'KeyA':'KeyD');move.push('KeyF');if(s.enemies.some(e=>e.type==='boss'))move.push('Space');setKeys(move);if(distance<5&&p.dash>=1)tap('ShiftLeft');
 }else setKeys([]);
 step(4);
}
const final=snap();console.log(JSON.stringify({state:final.state,wave:final.wave,kills:final.kills,score:final.score,accuracy:final.hits/final.shots,visited:[...visited],sawBoss,upgradeCount,maxEnemies:final.stats.maxEnemies,errors:final.stats.errors},null,2));
assert.equal(final.state,'victory','Bot should complete the campaign to exercise every encounter.');assert(sawBoss);assert.equal(upgradeCount,5);
elements.get('endless').click();step(200);assert.equal(snap().wave,7);assert.equal(snap().state,'playing');elements.get('quit').click();elements.get('start').click();assert.equal(snap().wave,1);assert.equal(snap().kills,0);console.log('PASS: six waves, five upgrades, boss, victory, endless mode and clean restart');
setKeys([]);for(let i=0;i<3600&&snap().state!=='dead';i++)step();assert.equal(snap().state,'dead');assert.equal(snap().player.hp,0);const deathTime=snap().runTime;step(120);assert.equal(snap().runTime,deathTime);elements.get('retry').click();step(1);assert.equal(snap().state,'countdown');assert.equal(snap().player.hp,100);assert.equal(snap().enemies.length,0);assert.equal(snap().projectiles,0);assert.equal(snap().kills,0);console.log('PASS: damage, death, frozen game-over state and restart cleanup');

