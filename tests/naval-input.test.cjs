const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),B=require(path.join(root,'vendor/babylon.js'));let tick;
const draw=new Proxy({measureText:()=>({width:100}),canvas:{width:512,height:512}},{get:(o,p)=>p in o?o[p]:(()=>{}),set:(o,p,v)=>(o[p]=v,true)});
class Element {
 constructor(id=''){this.id=id;this.children=[];this.style={};this.dataset={};this.events={};this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>{(on??!this.classes.has(x))?this.classes.add(x):this.classes.delete(x)},contains:x=>this.classes.has(x)};}
 append(...els){this.children.push(...els)}after(){}remove(){}replaceChildren(...els){this.children=els}setAttribute(){}focus(){}setPointerCapture(){}getContext(){return draw}getBoundingClientRect(){return {left:0,top:0,width:112,height:112}}querySelector(){return new Element()}
 addEventListener(n,f){(this.events[n]??=[]).push(f)}dispatch(n,e={}){for(const f of this.events[n]||[])f({preventDefault(){},...e})}click(){this.onclick?.();this.dispatch('click')}
}
const elements=new Map(),html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const m of html.matchAll(/id="([^"]+)"/g))elements.set(m[1],new Element(m[1]));
const doc=new Element(),win=new Element();doc.body=new Element();doc.getElementById=id=>elements.get(id);doc.createElement=()=>new Element();doc.querySelectorAll=()=>[];
class Engine extends B.NullEngine{constructor(){super({renderWidth:1280,renderHeight:720,textureSize:512})}getDeltaTime(){return 1000/60}getFps(){return 60}runRenderLoop(f){tick=f}setHardwareScalingLevel(){}}
class Texture extends B.Texture{constructor(n,o,s){super(null,s)}getContext(){return draw}update(){}}
class Scene extends B.Scene{render(){this.updateTransformMatrix()}}
const context={console,document:doc,BABYLON:{...B,Engine,DynamicTexture:Texture,Scene},devicePixelRatio:1,innerWidth:1280,innerHeight:720,localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false}),navigator:{maxTouchPoints:0},addEventListener:win.addEventListener.bind(win)};context.window=context;vm.createContext(context);for(const file of ['naval-core.js','naval-game.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const snap=()=>context.ironTide.snapshot(),step=(n=1)=>{for(let i=0;i<n;i++)tick();assert(!elements.get('error').textContent,elements.get('error').textContent)},key=(code,on=true)=>doc.dispatch(on?'keydown':'keyup',{code,repeat:false});
const ptr=(el,type,id,x=640,y=250,pointerType='touch')=>el.dispatch(type,{pointerId:id,clientX:x,clientY:y,pointerType,button:0});
assert.equal(snap().view,'menu');elements.get('launch').click();step();assert.equal(snap().view,'battle');
const initial=snap().player.z;key('KeyW');step(60);key('KeyW',false);assert(snap().player.z>initial+2);
ptr(elements.get('sea'),'pointerdown',1,640,250,'mouse');ptr(doc,'pointerup',1);assert(snap().shells>0,'Short mouse click must fire between frames');step(240);assert.equal(snap().player.cooldown,0,'Released mouse must stop firing');
key('Space');key('Space',false);assert(snap().player.cooldown>0);key('KeyQ');key('KeyQ',false);assert.equal(snap().torpedoes,3);
key('KeyP');const paused=snap().time;step(90);assert.equal(snap().time,paused);elements.get('resume').click();step();assert(snap().time>paused);
elements.get('quit').click();elements.get('launch').click();step();
// Three independent fingers: steering, aiming, and holding fire.
ptr(elements.get('joystick'),'pointerdown',11,56,20);ptr(elements.get('sea'),'pointerdown',12,800,250);ptr(elements.get('fire-button'),'pointerdown',13);const z=snap().player.z;step(90);assert.equal(snap().touch,true);assert.equal(snap().autoAim,false);assert.equal(snap().input.stickPointer,11);assert.equal(snap().input.firePointers,1);assert(snap().player.z>z+3);
ptr(doc,'pointerup',12);assert.equal(snap().input.stickPointer,11,'Releasing aim must not stop steering');assert.equal(snap().input.firePointers,1);
ptr(doc,'pointercancel',13);ptr(elements.get('joystick'),'lostpointercapture',11);assert.equal(snap().input.firePointers,0);assert.equal(snap().input.stickPointer,null);step(240);assert.equal(snap().player.cooldown,0);
key('KeyW');win.dispatch('blur');assert.equal(snap().view,'pause');assert.equal(snap().input.keys.length,0);elements.get('quit').click();elements.get('launch').click();assert.equal(snap().kills,0);assert.equal(snap().player.hp,360);assert.equal(snap().shells,0);assert.equal(snap().torpedoes,0);
console.log('PASS: real UI handlers, movement, quick click/keyboard shots, torpedoes, pause, three-finger multitouch, cancellation, blur and restart');
