/* NULL SECTOR — original local arena FPS. Babylon.js handles the 3D scene;
   deterministic kinematic movement and combat rules live in core.js. */
(() => {
'use strict';
const $=id=>document.getElementById(id), C=window.NS, B=window.BABYLON;
const show=id=>$(id).classList.remove('hidden'), hide=id=>$(id).classList.add('hidden');
const safeRead=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const safeWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const settings=Object.assign({sensitivity:1,fov:90,volume:40,quality:'high',shake:true},safeRead('ns-settings',{}));
const rng=(a,b)=>a+Math.random()*(b-a), choose=a=>a[Math.floor(Math.random()*a.length)];
let seed=93241;const seeded=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const vec=(x=0,y=0,z=0)=>new B.Vector3(x,y,z), col=hex=>B.Color3.FromHexString(hex);
let engine,scene,camera,glow,shadows,weaponRoot,muzzleLight,reactorCore,reactorRings=[],player=C.createPlayer();
let state='menu',settingsReturn='menu',difficulty='normal',enemies=[],projectiles=[],effects=[],pickups=[],hazards=[];
let wave=0,plan=[],spawnClock=0,waveKills=0,waveTotal=0,countdown=0,flowClock=0;
let score=0,kills=0,shots=0,hits=0,combo=0,comboTime=0,runTime=0,endless=false,totalTime=0;
let recoil=0,shake=0,hitTime=0,damageTime=0,announceTime=0,toastTime=0,hudClock=0,musicClock=0,flashTime=0;
let locked=false,mouseDown=false,aiming=false,gunSwitch=0,lastHudText={},menuAngle=0;
let dragLook=false,lockPending=false,lastPointer=null,edgeLook={x:0,y:0};
const keys=new Set(),obstacles=[],worldMeshes=[],enemyMats={},portalPositions=[[-23,-23],[23,-23],[-23,23],[23,23],[0,26],[-26,0],[26,0]];
const stats={frames:0,maxEnemies:0,errors:[],renderMs:0};
const canvas=$('game');

function fatal(error){stats.errors.push(String(error));$('error').textContent='Hru se nepodařilo spustit.\n'+String(error)+'\n\nZkus aktuální Chrome nebo Edge s hardwarovou akcelerací.';show('error');hide('loading');}
window.addEventListener('error',e=>fatal(e.error||e.message));
window.addEventListener('unhandledrejection',e=>{if(!String(e.reason).includes('lock'))fatal(e.reason);});
if(!B){fatal('Chybí lokální engine vendor/babylon.js.');return;}

// All sound is synthesized locally. No audio files or remote requests.
class Synth {
  constructor(){this.ctx=null;this.master=null;this.noise=null;}
  init(){if(this.ctx){this.ctx.resume().catch(()=>{});return;}try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=settings.volume/100*.65;const compressor=this.ctx.createDynamicsCompressor();compressor.threshold.value=-12;compressor.ratio.value=6;this.master.connect(compressor);compressor.connect(this.ctx.destination);this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);const d=this.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}catch{}}
  volume(){if(this.master)this.master.gain.setTargetAtTime(settings.volume/100*.65,this.ctx.currentTime,.03);}
  tone(freq,dur,volume=.2,type='sine',endFreq=freq){if(!this.ctx||this.ctx.state!=='running')return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(1,endFreq),t+dur);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+dur+.01);o.onended=()=>{o.disconnect();g.disconnect();};}
  burst(dur=.12,volume=.25,freq=1200){if(!this.ctx||this.ctx.state!=='running')return;const t=this.ctx.currentTime,s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();s.buffer=this.noise;f.type='lowpass';f.frequency.value=freq;g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(this.master);s.start(t);s.stop(t+dur);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};}
  shoot(i){if(i===0){this.burst(.085,.35,3400);this.tone(170,.11,.28,'sawtooth',45);}if(i===1){this.burst(.27,.65,1900);this.tone(95,.25,.48,'triangle',22);}if(i===2){this.tone(1600,.24,.26,'sawtooth',75);this.burst(.12,.35,7000);}}
  hit(head){this.tone(head?1300:720,.06,.17,'triangle',350);}
  kill(){this.tone(400,.08,.14,'sine',650);}
  click(){this.tone(680,.035,.1,'square',340);}
}
const audio=new Synth();

function material(name,color,emissive=null,alpha=1){const m=new B.StandardMaterial(name,scene);m.diffuseColor=col(color);m.specularColor=col('#273c42');if(emissive)m.emissiveColor=col(emissive);m.alpha=alpha;return m;}
let mats={};
function box(name,x,y,z,w,h,d,mat,parent=null){const m=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);m.material=mat;m.isPickable=false;if(parent)m.parent=parent;return m;}
function cylinder(name,x,y,z,height,diameter,mat,tess=16,parent=null){const m=B.MeshBuilder.CreateCylinder(name,{height,diameter,tessellation:tess},scene);m.position.set(x,y,z);m.material=mat;m.isPickable=false;if(parent)m.parent=parent;return m;}
function sphere(name,x,y,z,diameter,mat,parent=null,segments=8){const m=B.MeshBuilder.CreateSphere(name,{diameter,segments},scene);m.position.set(x,y,z);m.material=mat;m.isPickable=false;if(parent)m.parent=parent;return m;}
function torus(name,x,y,z,diameter,thickness,mat,parent=null){const m=B.MeshBuilder.CreateTorus(name,{diameter,thickness,tessellation:40},scene);m.position.set(x,y,z);m.material=mat;m.isPickable=false;if(parent)m.parent=parent;return m;}
function obstacle(x,z,w,h,d,mat=mats.metal){obstacles.push({x,z,w,h,d});const m=box('cover',x,h/2,z,w,h,d,mat);m.receiveShadows=true;shadows.addShadowCaster(m);return m;}
function label(text,x,y,z,width,height,rotation=0,color='#a5ffcf',size=110){const tex=new B.DynamicTexture('sign-'+text,{width:1024,height:256},scene,false);tex.hasAlpha=true;const ctx=tex.getContext();ctx.clearRect(0,0,1024,256);ctx.font=`bold ${size}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,512,128);tex.update();const mat=new B.StandardMaterial('sign',scene);mat.diffuseTexture=tex;mat.emissiveTexture=tex;mat.useAlphaFromDiffuseTexture=true;mat.disableLighting=true;mat.backFaceCulling=false;const plane=B.MeshBuilder.CreatePlane('sign',{width,height},scene);plane.material=mat;plane.position.set(x,y,z);plane.rotation.y=rotation;plane.isPickable=false;return plane;}
function groundMark(x,z,w,d,mat){return box('floor-mark',x,.025,z,w,.012,d,mat);}

function createWorld(){
  engine=new B.Engine(canvas,true,{antialias:true,stencil:true,preserveDrawingBuffer:true,powerPreference:'high-performance'},true);
  engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio/1.4));
  scene=new B.Scene(engine);scene.clearColor=new B.Color4(.024,.049,.065,1);scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogDensity=.008;scene.fogColor=new B.Color3(.045,.09,.105);scene.skipPointerMovePicking=true;
  camera=new B.FreeCamera('operator',vec(0,1.7,-21),scene);camera.minZ=.055;camera.maxZ=230;camera.fov=settings.fov*Math.PI/180;camera.inputs.clear();camera.rotation.set(0,0,0);
  const hemi=new B.HemisphericLight('sky',vec(.2,1,.3),scene);hemi.intensity=.66;hemi.diffuse=col('#9dbeca');hemi.groundColor=col('#19292c');
  const sun=new B.DirectionalLight('moon',vec(-.65,-1,.42),scene);sun.position=vec(25,45,-30);sun.diffuse=col('#bedde1');sun.intensity=1.45;
  shadows=new B.ShadowGenerator(1024,sun);shadows.useBlurExponentialShadowMap=true;shadows.blurKernel=12;shadows.darkness=.4;shadows.setDarkness(.4);
  const reactorLight=new B.PointLight('reactor-light',vec(0,4,0),scene);reactorLight.diffuse=col('#ff773d');reactorLight.intensity=2;reactorLight.range=19;
  muzzleLight=new B.PointLight('muzzle-light',vec(0,0,0),scene);muzzleLight.diffuse=col('#acffd3');muzzleLight.intensity=0;muzzleLight.range=7;
  glow=new B.GlowLayer('emission',scene,{mainTextureRatio:.4,blurKernelSize:24});glow.intensity=.48;
  mats={floor:material('floor','#34464b'),metal:material('metal','#30464c'),dark:material('graphite','#131f25'),light:material('trim','#677d7c'),mint:material('mint','#6eaf95','#79dcb0'),orange:material('orange','#cd552c','#f56428'),blue:material('ice','#82bdd1','#6fcbef'),purple:material('purple','#a15ec2','#ac62cf'),white:material('white','#b8ccc6'),black:material('black','#0d1316'),yellow:material('caution','#c49d50'),dim:material('dim-light','#354a45','#20362e'),glass:material('glass','#306664','#16372f',.3)};
  const ground=box('arena-floor',0,-.26,0,62,.5,62,mats.floor);ground.receiveShadows=true;
  // Procedural slab texture, deterministic and completely offline.
  const floorTex=new B.DynamicTexture('concrete',{width:512,height:512},scene,false),ctx=floorTex.getContext();ctx.fillStyle='#899997';ctx.fillRect(0,0,512,512);for(let i=0;i<19000;i++){const v=100+seeded()*100;ctx.fillStyle=`rgba(${v},${v},${v},0.08)`;ctx.fillRect(seeded()*512,seeded()*512,seeded()*3+1,1);}ctx.strokeStyle='#5c7372';ctx.lineWidth=3;ctx.strokeRect(2,2,508,508);floorTex.update();floorTex.uScale=16;floorTex.vScale=16;mats.floor.diffuseTexture=floorTex;
  for(let a=-28;a<=28;a+=4){groundMark(a,0,.025,59,mats.dim);groundMark(0,a,59,.025,mats.dim);}
  for(const x of [-28,28]){groundMark(x,0,.1,56,mats.mint);for(let z=-26;z<=26;z+=4)groundMark(x+Math.sign(x)*.4,z,.5,.14,mats.white);}
  for(const z of [-28,28])groundMark(0,z,56,.1,mats.mint);
  for(const x of [-8,8])groundMark(x,0,.09,50,mats.yellow);
  for(let z=-25;z<25;z+=3){groundMark(-8.35,z,.6,.3,mats.yellow);groundMark(8.35,z,.6,.3,mats.yellow);}
  const landing=torus('landing-ring',0,.03,-20,7,.045,mats.mint);landing.scaling.y=.3;
  // Outer bulkheads, supports, ventilation and overhead structures.
  for(const z of [-31,31]){box('bulkhead',0,4,z,64,8,2,mats.dark);for(let x=-28;x<=28;x+=7){box('wall-bay',x,3.2,z-Math.sign(z)*1.04,6,5.7,.18,mats.metal);for(let y=1;y<5;y+=.5)box('vent',x,y,z-Math.sign(z)*1.18,3.9,.1,.08,mats.black);box('wall-pillar',x+3.3,5,z-Math.sign(z)*1.5,.5,10,1,mats.light);box('light-strip',x,6.25,z-Math.sign(z)*1.3,3.5,.14,.12,mats.mint);}}
  for(const x of [-31,31]){box('sidewall',x,4,0,2,8,62,mats.dark);for(let z=-28;z<=28;z+=7){box('wall-panel',x-Math.sign(x)*1.05,3.5,z,.2,6,6.6,mats.metal);box('side-pillar',x-Math.sign(x)*1.4,5,z+3.3,1,10,.5,mats.light);box('side-light',x-Math.sign(x)*1.2,6.6,z,.15,.15,4,mats.mint);}}
  label('NULL  /  SECTOR',0,6.2,29.82,13,3.2,0);label('09',-17,3.8,29.78,4,3.5,0,'#b1c3b7',170);label('REACTOR ACCESS',0,2.8,-29.79,9,2.2,Math.PI,'#a5ffcf',80);
  for(const z of [-16,16]){box('gantry',0,10.5,z,63,.7,.6,mats.dark);box('gantry-lamp',0,10.08,z,38,.06,.14,mats.mint);for(const x of [-21,21]){const brace=box('brace',x,9,z,.6,5,.6,mats.metal);brace.rotation.z=Math.sign(x)*-.65;}}
  for(const x of [-11,11]){const pts=[];for(let j=0;j<=20;j++)pts.push(vec(x,12-Math.sin(j/20*Math.PI)*3.6,-31+j/20*62));const cable=B.MeshBuilder.CreateTube('suspended-cable',{path:pts,radius:.085,tessellation:6},scene);cable.material=mats.black;}
  // Central reactor is a major piece of cover, with a suspended rotating core.
  obstacle(0,0,6.8,3.6,6.8,mats.dark);cylinder('reactor-base',0,.4,0,.8,8.5,mats.light,8);cylinder('reactor-foot',0,1,0,.4,7.6,mats.black,8);
  for(const x of [-3.3,3.3])for(const z of [-3.3,3.3]){box('reactor-column',x,4,z,.75,8,.75,mats.metal);box('reactor-powerline',x,4,z-Math.sign(z)*.4,.13,5,.08,mats.orange);}
  cylinder('reactor-top',0,7.5,0,.7,8.8,mats.dark,8);cylinder('core-glass',0,4.7,0,4.5,3.8,mats.glass,24);
  reactorCore=B.MeshBuilder.CreatePolyhedron('reactor-core',{type:1,size:1.5},scene);reactorCore.position.y=4.8;reactorCore.material=mats.orange;
  for(const y of [3,4.8,6.6]){const r=torus('reactor-ring',0,y,0,5,.12,mats.orange);reactorRings.push(r);}
  for(const z of [-4,4])label('DANGER   /   CORE',0,2,z,4,1,z>0?Math.PI:0,'#ff9764',80);
  // Asymmetric cover with open flanking lanes.
  for(const [x,z,w,h,d] of [[-14,-12,5,2.6,3],[15,11,6,2.8,3],[-15,12,3,2.5,6],[14,-13,3,2.4,5],[-22,-5,4,1.2,3],[22,4,4,1.2,3],[-5,19,4,1.35,2.8],[6,-20,3,1.35,3]]){
    obstacle(x,z,w,h,d,mats.metal);box('crate-top',x,h+.05,z,w+.12,.1,d+.12,mats.light);for(const side of [-1,1]){box('crate-band',x+side*w*.32,h/2,z-d/2-.035,.12,h,.05,mats.dark);box('crate-id',x,h*.65,z+side*(d/2+.025),w*.38,.12,.06,mats.mint);}box('crate-caution',x,h*.23,z-d/2-.04,w*.5,.1,.04,mats.yellow);
  }
  for(const [x,z] of [[-13,2],[13,-2]]){obstacle(x,z,2.7,5,2.7,mats.dark);box('terminal',x,2.5,z-1.4,2,1.3,.14,mats.black);box('terminal-screen',x,2.6,z-1.5,1.6,.85,.05,mats.mint);for(let y=0;y<3;y++)box('terminal-data',x,2.4+y*.2,z-1.54,1.1,.04,.025,mats.dark);}
  // Spawn pads with concentric luminous rings and upright beacons.
  portalPositions.forEach(([x,z],i)=>{cylinder('spawn-platform',x,.05,z,.1,3.7,mats.dark,24);torus('spawn-ring',x,.12,z,3.15,.07,mats.orange);for(const dx of [-1.65,1.65]){box('beacon',x+dx,1.25,z,.18,2.5,.18,mats.dark);box('beacon-light',x+dx,1.6,z,.2,.75,.2,mats.orange);}const sign=label('0'+(i+1),x,.15,z,1.5,.7,0,'#dfb28c',150);sign.rotation.x=Math.PI/2;});
  // Industrial silhouettes beyond the arena.
  for(let i=0;i<50;i++){const a=seeded()*Math.PI*2,r=65+seeded()*70,h=12+seeded()*60;box('distant-tower',Math.sin(a)*r,h/2-8,Math.cos(a)*r,5+seeded()*10,h,5+seeded()*10,mats.dark);}
  const moon=sphere('moon',-65,65,95,11,material('moon','#7dabad','#486569'),null,24);
  const starPositions=[];for(let i=0;i<180;i++){let x=(seeded()-.5)*300,y=30+seeded()*130,z=(seeded()-.5)*300;starPositions.push(x,y,z);}const starMesh=new B.Mesh('stars',scene),vd=new B.VertexData();vd.positions=starPositions;vd.indices=starPositions.map((_,i)=>i).filter(i=>i<180);vd.applyToMesh(starMesh);const starMat=material('starlight','#a0c9cc','#688e99');starMat.pointsCloud=true;starMat.pointSize=1.6;starMat.disableLighting=true;starMesh.material=starMat;
  worldMeshes.push(...scene.meshes);for(const m of worldMeshes){if(m!==reactorCore&&!reactorRings.includes(m))m.freezeWorldMatrix();}
  for(const [type,def] of Object.entries(C.TYPES))enemyMats[type]=material(type+'-emission',def.color,def.color);
  createWeapon();applySettings();
  engine.onContextLostObservable.add(()=>{pauseGame();toast('Grafický kontext byl ztracen. Obnov stránku, pokud se obraz nevrátí.');});
}

let gunMeshes=[],muzzle=null;
function createWeapon(){
  if(weaponRoot)weaponRoot.dispose();weaponRoot=new B.TransformNode('view-weapon',scene);weaponRoot.parent=camera;weaponRoot.position.set(.34,-.32,.67);gunMeshes=[];
  const i=player.weapon,trim=i===0?mats.mint:i===1?mats.orange:mats.blue;
  const add=(name,x,y,z,w,h,d,m)=>{const mesh=box(name,x,y,z,w,h,d,m,weaponRoot);mesh.renderingGroupId=2;gunMeshes.push(mesh);return mesh;};
  add('receiver',0,0,.12,.19,.2,.52,mats.dark);add('upper-slide',0,.12,.12,.21,.065,.48,mats.light);add('rear-stock',0,-.01,-.22,.14,.17,.2,mats.metal);add('grip',0,-.17,-.02,.12,.25,.14,mats.black).rotation.x=-.22;
  add('powercell',.105,.015,.06,.018,.085,.23,trim);for(let j=0;j<4;j++)add('cell-segment',.117,.02,-.03+j*.056,.015,.09,.013,mats.dark);
  if(i===0){add('handguard',0,0,.48,.16,.15,.38,mats.metal);add('rail',0,.11,.4,.07,.055,.32,mats.black);add('barrel',0,.02,.76,.07,.07,.25,mats.dark);add('sight-back',0,.18,-.035,.11,.045,.07,mats.black);add('sight-front',0,.17,.54,.025,.065,.025,trim);}
  if(i===1){for(const x of [-.062,.062]){add('twin-barrel',x,.015,.57,.085,.085,.55,mats.light);add('barrel-tip',x,.015,.86,.1,.1,.09,mats.black);}add('pump',0,-.09,.42,.22,.1,.23,mats.metal);for(let j=0;j<4;j++)add('pump-rib',0,-.14,.32+j*.055,.24,.025,.018,mats.black);add('shell-loader',.13,-.04,.05,.08,.1,.35,trim);}
  if(i===2){add('rail-lower',0,-.04,.64,.14,.09,.65,mats.metal);for(const x of [-.08,.08]){add('coil-rail',x,.075,.62,.05,.1,.72,mats.dark);add('coil',x,.14,.62,.035,.025,.61,trim);}add('optic',0,.23,.05,.115,.16,.24,mats.black);add('optic-glass',0,.23,-.076,.08,.11,.009,trim);}
  // Hands, sleeves and magazine are actual 3D geometry attached to the view model.
  add('trigger-glove',.025,-.21,-.075,.16,.16,.17,mats.metal);add('right-sleeve',.09,-.34,-.13,.19,.24,.24,mats.dark).rotation.z=.25;
  add('support-glove',-.015,-.125,.43,.19,.1,.2,mats.metal);add('left-sleeve',-.13,-.28,.4,.17,.3,.2,mats.dark).rotation.z=-.6;
  add('magazine',0,-.22,.16,.12,.29,.16,mats.metal);
  muzzle=sphere('muzzle-flash',0,.02,i===2?1.06:.94,.19,trim,weaponRoot,4);muzzle.renderingGroupId=2;muzzle.setEnabled(false);gunMeshes.push(muzzle);
}

function createEnemy(type,x,z){
  const def=C.TYPES[type],root=new B.TransformNode('enemy-'+type,scene),boss=type==='boss',heavy=type==='heavy',scale=boss?2.1:heavy?1.45:1;
  const e={type,x,z,y:0,hp:def.hp*C.DIFFICULTIES[difficulty].hp*(endless?1+(wave-6)*.12:1),maxHp:0,radius:def.radius,root,phase:rng(0,Math.PI*2),attack:rng(1.2,2.4),stun:.6,flash:0,dead:false,telegraph:0,legs:[],parts:[],scale,age:0,strafe:Math.random()<.5?1:-1};e.maxHp=e.hp;
  const mat=enemyMats[type];const part=(name,px,py,pz,w,h,d,m)=>{const mesh=box(name,px,py,pz,w,h,d,m,root);e.parts.push(mesh);return mesh;};
  part('armor-chest',0,1.25,0,.95,.82,.57,mats.metal);part('chest-plate',0,1.32,.32,.72,.49,.12,mats.dark);part('weak-core',0,1.32,.4,.31,.25,.08,mat);
  const head=sphere('head',0,1.95,.03,.61,mats.dark,root,4);e.parts.push(head);part('visor',0,1.97,.3,.48,.13,.07,mat);part('antenna',.23,2.29,0,.045,.36,.045,mats.light);
  if(type==='shooter'){part('drone-wing',0,1.35,-.15,1.7,.15,.35,mats.dark);for(const px of [-.69,.69]){const jet=cylinder('jet',px,1.12,-.12,.25,.3,mat,8,root);e.parts.push(jet);}part('cannon',.65,1.35,.37,.22,.25,.65,mats.metal);}
  else{for(const side of [-1,1]){const leg=new B.TransformNode('leg',scene);leg.parent=root;leg.position.set(side*.31,.82,0);const a=box('thigh',0,-.21,0,.25,.48,.3,mats.dark,leg);const b=box('shin',0,-.59,.025,.22,.36,.22,mats.metal,leg);const foot=box('foot',0,-.77,.14,.34,.14,.48,mats.black,leg);e.parts.push(a,b,foot);e.legs.push(leg);part('shoulder',side*.65,1.5,0,.35,.4,.43,mats.dark);part('arm',side*.66,1.06,.12,.24,.65,.25,mats.metal);part('claw',side*.67,.73,.25,.14,.3,.1,mat);}}
  if(heavy||boss){part('heavy-mantle',0,1.65,-.09,1.8,.4,.7,mats.dark);for(const side of [-1,1]){part('heavy-pod',side*.84,1.42,.18,.4,.52,.75,mats.metal);part('pod-light',side*.84,1.45,.57,.28,.2,.03,mat);}part('crown',0,2.42,0,.75,.12,.25,mat);}
  const ring=torus('enemy-shadow-ring',0,.04,0,1.4,.025,mat,root);e.parts.push(ring);root.scaling.setAll(scale);root.position.set(x,0,z);
  e.parts.forEach(m=>shadows.addShadowCaster(m));enemies.push(e);stats.maxEnemies=Math.max(stats.maxEnemies,enemies.length);
  burst(vec(x,1,z),mat,12,.9);return e;
}

function disposeEnemy(e){e.root.getChildMeshes().forEach(m=>shadows.removeShadowCaster(m));e.root.dispose();}
function burst(pos,mat,count=10,power=1){for(let i=0;i<count;i++){if(effects.length>180)break;const m=box('debris',pos.x,pos.y,pos.z,rng(.04,.12),rng(.04,.12),rng(.04,.12),mat);effects.push({mesh:m,life:rng(.25,.65),max:.7,velocity:vec(rng(-3,3)*power,rng(1,5)*power,rng(-3,3)*power),gravity:8});}}
function beam(from,to,mat,width=.025,life=.09){if(effects.length>180)return;const d=to.subtract(from),len=d.length();if(len<.01)return;const m=cylinder('tracer',0,0,0,len,width,mat,6);m.position=from.add(to).scale(.5);m.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,d.normalize(),new B.Quaternion());effects.push({mesh:m,life,max:life});}
function ringEffect(pos,mat,size=10,life=.5){const m=torus('shock-ring',pos.x,pos.y,pos.z,1,.055,mat);effects.push({mesh:m,life,max:life,expand:size});}
function fireProjectile(pos,dir,speed,damage,mat,size=.25){const m=sphere('hostile-projectile',pos.x,pos.y,pos.z,size,mat);projectiles.push({mesh:m,pos:pos.clone(),dir:dir.clone(),speed,damage,life:5,radius:size*.5});}

function announce(small,big,time=2.5){$('announce-small').textContent=small;$('announce-big').textContent=big;announceTime=time;$('announcement').style.opacity='1';}
function toast(text){$('pickup-toast').textContent=text;toastTime=2;$('pickup-toast').style.opacity='1';}
function feed(text){const el=document.createElement('div');el.textContent=text;$('kill-feed').prepend(el);while($('kill-feed').children.length>4)$('kill-feed').lastChild.remove();setTimeout(()=>el.remove(),3500);}
function clearArena(){for(const e of enemies)disposeEnemy(e);enemies=[];for(const list of [projectiles,effects,pickups,hazards])for(const e of list)e.mesh?.dispose();projectiles=[];effects=[];pickups=[];hazards=[];}
function beginRun(){
  audio.init();clearArena();player=C.createPlayer();wave=0;score=0;kills=0;shots=0;hits=0;combo=0;comboTime=0;runTime=0;endless=false;mouseDown=false;aiming=false;recoil=0;shake=0;damageTime=0;hitTime=0;keys.clear();
  $('kill-feed').replaceChildren();document.body.classList.remove('low-health');for(const id of ['menu','pause','settings','upgrades','end'])hide(id);show('hud');createWeapon();nextWave();requestLock();
}
function nextWave(){wave++;waveKills=0;plan=C.wavePlan(wave,endless);waveTotal=plan.length;spawnClock=0;countdown=3.1;state='countdown';player.invulnerable=3.2;player.reload=0;player.ammo=C.WEAPONS.map((_,i)=>C.capacity(player,i));player.hp=Math.min(player.maxHp,player.hp+25);player.shield=Math.min(player.maxShield,player.shield+35);player.dash=2;for(const b of projectiles)b.mesh.dispose();projectiles=[];for(const h of hazards)h.mesh.dispose();hazards=[];announce('PŘIPRAV SE',wave===6&&!endless?'STRÁŽCE SE PROBOUZÍ':`VLNA ${String(wave).padStart(2,'0')}`,3);audio.tone(190,.55,.15,'sine',380);updateHUD(true);}
function spawnEnemy(){let candidates=portalPositions.filter(([x,z])=>Math.hypot(x-player.x,z-player.z)>15);if(!candidates.length)candidates=portalPositions;const [sx,sz]=choose(candidates);let x=sx+rng(-1,1),z=sz+rng(-1,1);const type=plan.shift();if(!type)return;createEnemy(type,x,z);if(type==='boss')announce('TĚŽKÝ KONTAKT', 'STRÁŽCE / OMEGA',3);}
function completeWave(){
  if(state!=='playing')return;mouseDown=false;aiming=false;if(wave===6&&!endless){endRun(true);return;}
  state='upgrade';releaseLock();hide('boss-hud');$('upgrade-eyebrow').textContent=`VLNA ${String(wave).padStart(2,'0')} DOKONČENA · +${wave*250} BODŮ`;score+=wave*250;const shuffled=C.UPGRADES.slice().sort(()=>Math.random()-.5).slice(0,3);$('upgrade-cards').replaceChildren();
  for(const up of shuffled){const btn=document.createElement('button');btn.innerHTML=`<span class="upgrade-tag">${up.tag}</span><span class="upgrade-arrow">↗</span><span class="upgrade-icon">${up.icon}</span><strong class="upgrade-title">${up.title}</strong><span class="upgrade-desc">${up.desc}</span>`;btn.addEventListener('click',()=>{if(state!=='upgrade')return;C.applyUpgrade(player,up.id);audio.click();hide('upgrades');nextWave();requestLock();});$('upgrade-cards').append(btn);}show('upgrades');audio.tone(520,.3,.2,'triangle',780);
}
function endRun(won){state=won?'victory':'dead';mouseDown=false;releaseLock();hide('hud');hide('pause');show('end');$('end-eyebrow').textContent=won?'PROTOKOL DOKONČEN':'SPOJENÍ PŘERUŠENO';$('end-title').innerHTML=won?'SEKTOR<br>VYČIŠTĚN.':'SIGNÁL<br>ZTRACEN.';$('end-description').textContent=won?'Strážce padl. Stanice je tvoje. Pokračuj proti stále silnějším vlnám, nebo zahaj novou operaci.':`Operace skončila ve vlně ${wave}. Využívej krytí, měň zbraně a úskokem se vyhni palbě.`;if(won)score+=5000;$('end-score').textContent=String(Math.round(score)).padStart(6,'0');$('end-kills').textContent=kills;$('end-time').textContent=formatTime(runTime);$('end-accuracy').textContent=`${shots?Math.round(hits/shots*100):0} %`;$('endless').classList.toggle('hidden',!won);saveBest();audio.tone(won?440:160,1,.25,'triangle',won?880:40);}
function saveBest(){const best=safeRead('ns-best',0);if(score>best)safeWrite('ns-best',Math.round(score));$('best').innerHTML=`OSOBNÍ REKORD <b>${String(Math.max(best,Math.round(score))).padStart(6,'0')}</b>`;}
function toMenu(){saveBest();state='menu';clearArena();releaseLock();keys.clear();mouseDown=false;for(const id of ['hud','pause','upgrades','end','settings'])hide(id);show('menu');weaponRoot.setEnabled(false);$('damage-flash').style.opacity='0';}
function pauseGame(){if(state!=='playing'&&state!=='countdown')return;stateBeforePause=state;state='paused';mouseDown=false;aiming=false;keys.clear();releaseLock();show('pause');hide('lock-tip');}
let stateBeforePause='playing';
function resumeGame(){hide('pause');state=stateBeforePause;audio.init();requestLock();}
function enableDragLook(){
  dragLook=true;lockPending=false;lastPointer=null;edgeLook={x:0,y:0};
  if(['playing','countdown'].includes(state)){
    $('lock-tip').textContent='REŽIM NÁHLEDU · tažení levým = míření + střelba · tažení pravým = míření · F = střelba';
    show('lock-tip');canvas.style.cursor='crosshair';
  }
}
function requestLock(){
  canvas.focus();if(locked||lockPending)return;if(dragLook||typeof canvas.requestPointerLock!=='function'){enableDragLook();return;}
  lockPending=true;
  try{const promise=canvas.requestPointerLock();if(promise&&promise.catch)promise.catch(()=>{if(!locked)enableDragLook();});}catch{enableDragLook();}
}
function releaseLock(){lockPending=false;lastPointer=null;edgeLook={x:0,y:0};if(document.pointerLockElement===canvas)document.exitPointerLock();locked=false;}
function formatTime(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;}

function direction(yaw=player.yaw,pitch=player.pitch){return vec(Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));}
function getEye(){return vec(player.x,player.y+1.72,player.z);}
function wallDistance(o,d,max=100){let nearest=max;for(const b of obstacles)nearest=Math.min(nearest,C.rayBox(o,d,b,nearest));for(const b of [{x:0,z:31,w:64,d:2,h:10},{x:0,z:-31,w:64,d:2,h:10},{x:31,z:0,w:2,d:64,h:10},{x:-31,z:0,w:2,d:64,h:10}])nearest=Math.min(nearest,C.rayBox(o,d,b,nearest));if(d.y<0)nearest=Math.min(nearest,Math.max(0,-o.y/d.y));return nearest;}
function lineClear(from,to){const d=to.subtract(from),len=d.length();return wallDistance(from,d.normalize(),len+.01)>=len-.1;}
function switchWeapon(i){if(i===player.weapon||i<0||i>2)return;player.weapon=i;player.reload=0;player.shot=Math.max(player.shot,.2);gunSwitch=.26;createWeapon();audio.click();updateHUD(true);}
function reload(){if(!['playing','countdown'].includes(state)||player.reload>0||player.ammo[player.weapon]===C.capacity(player,player.weapon))return;player.reload=C.WEAPONS[player.weapon].reload/player.fireRate;audio.burst(.12,.18,1300);toast('PŘEBÍJENÍ');}
function fire(){
  if(player.shot>0||player.reload>0||!['playing','countdown'].includes(state))return;const index=player.weapon,w=C.WEAPONS[index];if(player.ammo[index]<=0){reload();return;}
  player.ammo[index]--;player.shot=w.interval/player.fireRate;recoil=Math.min(recoil+(index===0?.028:index===1?.095:.065),.16);shake=Math.max(shake,index===0?.025:.075);flashTime=.055;audio.shoot(index);shots++;let didHit=false;
  const origin=getEye(),base=direction(),mat=index===0?mats.mint:index===1?mats.orange:mats.blue;
  for(let pellet=0;pellet<w.pellets;pellet++){
    const spread=w.spread*(aiming?.45:1),d=base.add(vec(rng(-spread,spread),rng(-spread,spread),rng(-spread,spread))).normalize();let limit=wallDistance(origin,d,w.range);const targets=[];
    for(const e of enemies){if(e.dead||e.stun>.3&&e.age<.35)continue;const s=e.scale,head=vec(e.x,e.y+1.96*s,e.z),body=vec(e.x,e.y+1.17*s,e.z);const headT=C.raySphere(origin,d,head,.4*s),bodyT=C.raySphere(origin,d,body,.71*s);const t=Math.min(headT,bodyT);if(t<limit)targets.push({e,t,head:headT!==Infinity&&headT<=bodyT+.28*s});}
    targets.sort((a,b)=>a.t-b.t);for(const hit of targets){const falloff=index===1?C.clamp(1-hit.t/48,.3,1):1;damageEnemy(hit.e,w.damage*player.damage*(hit.head?1.75:1)*falloff,hit.head);didHit=true;const impact=origin.add(d.scale(hit.t));burst(impact,enemyMats[hit.e.type],hit.head?5:3,.55);if(index!==2){limit=hit.t;break;}}
    if(index!==1||pellet%3===0){const start=camera.position.add(direction(player.yaw+.06,player.pitch+.07).scale(.8));beam(start,origin.add(d.scale(Math.min(limit,w.range))),mat,index===2?.07:.025,index===2?.18:.065);}
    if(!targets.length&&limit<w.range&&pellet===0)burst(origin.add(d.scale(limit)),mats.white,3,.45);
  }
  if(didHit){hits++;hitTime=.11;audio.hit(false);}if(player.ammo[index]===0)setTimeout(()=>{if(['playing','countdown'].includes(state)&&player.weapon===index)reload();},w.interval*1000+30);
}
function damageEnemy(e,amount,head=false){if(e.dead)return;e.hp-=amount;e.flash=.12;if(head){hitTime=.15;$('hitmarker').style.color='#ffcf75';}else $('hitmarker').style.color='#a5ffcf';if(e.hp<=0)killEnemy(e,head);}
function killEnemy(e,head){if(e.dead)return;e.dead=true;kills++;waveKills++;combo=comboTime>0?combo+1:1;comboTime=4;const multiplier=1+Math.min(4,Math.floor(combo/3))*.25;const earned=Math.round(C.TYPES[e.type].score*multiplier*C.DIFFICULTIES[difficulty].score*(head?1.25:1));score+=earned;player.pulse=Math.min(100,player.pulse+8*player.pulseRate);player.hp=Math.min(player.maxHp,player.hp+player.leech);burst(vec(e.x,e.y+1.2*e.scale,e.z),enemyMats[e.type],e.type==='boss'?36:15,e.type==='boss'?2:1);ringEffect(vec(e.x,.1,e.z),enemyMats[e.type],e.type==='boss'?10:2,.3);audio.kill();feed(`${head?'KRITICKÝ ZÁSAH · ':''}${C.TYPES[e.type].name} +${earned}`);if(Math.random()<.3||e.type==='heavy'||e.type==='boss')createPickup(e.x,e.z,player.hp<player.maxHp*.65?'health':Math.random()<.5?'shield':'energy');}
function takeDamage(amount){if(C.hurt(player,amount*C.DIFFICULTIES[difficulty].damage)>0){damageTime=.4;shake=.12;comboTime=0;audio.burst(.15,.3,480);if(player.hp<=0)endRun(false);}}
function pulse(){if(state!=='playing'||player.pulse<100)return;player.pulse=0;audio.tone(110,.7,.55,'sawtooth',22);audio.burst(.4,.5,600);ringEffect(vec(player.x,.2,player.z),mats.blue,26,.6);shake=.18;for(const e of enemies){const distance=Math.hypot(e.x-player.x,e.z-player.z);if(distance<13){damageEnemy(e,125*player.pulsePower*(1-distance/19));e.stun=1.4;}}for(const p of projectiles)p.mesh.dispose();projectiles=[];toast('EMP IMPULZ · STŘELY ZNEŠKODNĚNY');}
function dash(){if(!['playing','countdown'].includes(state)||player.dash<1||player.dashTime>0)return;let x=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),z=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);if(!x&&!z)z=1;const len=Math.hypot(x,z);x/=len;z/=len;player.dashX=x*Math.cos(player.yaw)+z*Math.sin(player.yaw);player.dashZ=z*Math.cos(player.yaw)-x*Math.sin(player.yaw);player.dash--;player.dashTime=.18;audio.burst(.22,.3,2500);}
function createPickup(x,z,type){if(pickups.length>18){pickups.shift().mesh.dispose();}const mat=type==='health'?mats.mint:type==='shield'?mats.blue:mats.orange;const root=new B.TransformNode('pickup',scene),m=B.MeshBuilder.CreatePolyhedron('pickup-crystal',{type:1,size:.24},scene);m.parent=root;m.material=mat;m.position.y=.7;torus('pickup-base',0,.08,0,.75,.04,mat,root);root.position.set(x,0,z);pickups.push({mesh:root,x,z,type,life:35,phase:rng(0,6)});}

let flow;
function updatePlayer(dt){
  player.invulnerable=Math.max(0,player.invulnerable-dt);player.shot=Math.max(0,player.shot-dt);player.hurtAgo+=dt;player.dash=Math.min(2,player.dash+dt/player.dashCooldown);player.pulse=Math.min(100,player.pulse+dt*1.6*player.pulseRate);
  if(player.hurtAgo>4.5)player.shield=Math.min(player.maxShield,player.shield+dt*9*player.shieldRegen);
  if(player.reload>0){player.reload-=dt;if(player.reload<=0){player.reload=0;player.ammo[player.weapon]=C.capacity(player,player.weapon);audio.click();}}
  if(keys.has('ArrowLeft'))player.yaw-=dt*1.9;if(keys.has('ArrowRight'))player.yaw+=dt*1.9;if(keys.has('ArrowUp'))player.pitch-=dt*1.3;if(keys.has('ArrowDown'))player.pitch+=dt*1.3;
  if(dragLook&&!locked&&(aiming||mouseDown)){player.yaw+=edgeLook.x*dt*1.65*settings.sensitivity;player.pitch+=edgeLook.y*dt*1.15*settings.sensitivity;}player.pitch=C.clamp(player.pitch,-1.35,1.35);
  let mx=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),mz=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);const len=Math.hypot(mx,mz);if(len){mx/=len;mz/=len;}
  const speed=(aiming?4.1:7.5)*player.speed;let dx=(mx*Math.cos(player.yaw)+mz*Math.sin(player.yaw))*speed*dt,dz=(mz*Math.cos(player.yaw)-mx*Math.sin(player.yaw))*speed*dt;
  if(player.dashTime>0){dx=player.dashX*29*dt;dz=player.dashZ*29*dt;player.dashTime=Math.max(0,player.dashTime-dt);}
  C.move(player,dx,dz,.42,obstacles);
  player.vy-=20*dt;player.y+=player.vy*dt;let support=0;for(const b of obstacles){if(Math.abs(player.x-b.x)<b.w/2+.18&&Math.abs(player.z-b.z)<b.d/2+.18&&player.y>=b.h-.3&&player.vy<=0)support=Math.max(support,b.h);}if(player.y<=support){player.y=support;player.vy=0;}
  if(keys.has('Space')&&player.vy===0){player.vy=8;audio.burst(.08,.08,450);}
  if(mouseDown||keys.has('KeyF'))fire();
  const bob=len&&player.y<.1&&player.dashTime<=0?Math.sin(runTime*13)*.035:0;
  camera.position.set(player.x,player.y+1.72+bob,player.z);camera.rotation.set(player.pitch-recoil*.45,player.yaw,0);
  if(settings.shake&&shake>0){camera.rotation.x+=rng(-shake,shake)*.25;camera.rotation.z=rng(-shake,shake)*.12;}
  const targetFov=(settings.fov-(aiming?18:0)+(player.dashTime>0?9:0))*Math.PI/180;camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*12);
  const reloadTotal=C.WEAPONS[player.weapon].reload/player.fireRate,reloadPhase=player.reload>0?Math.sin(player.reload/reloadTotal*Math.PI):0;
  weaponRoot.position.set((aiming?.08:.34)+Math.sin(runTime*6)*len*.012,-.32-bob-reloadPhase*.22-gunSwitch*.45,.67-recoil*.8);weaponRoot.rotation.set(recoil-reloadPhase*.65,0,-reloadPhase*.4);weaponRoot.setEnabled(true);
  muzzle.setEnabled(flashTime>0);if(flashTime>0){muzzle.scaling.setAll(rng(.7,1.6));muzzle.rotation.z=rng(0,6);}muzzleLight.position.copyFrom(camera.position.add(direction().scale(1.3)));muzzleLight.intensity=flashTime>0?3:0;
}

function enemyAttack(e){const target=getEye(),s=e.scale,from=vec(e.x,e.y+1.45*s,e.z),dir=target.subtract(from).normalize();
  if(e.type==='runner'){if(Math.hypot(e.x-player.x,e.z-player.z)<2&&Math.abs(player.y-e.y)<1.4){takeDamage(13);e.attack=.85;}}
  else if(e.type==='shooter'){if(lineClear(from,target)){fireProjectile(from,dir,13+wave*.4,12,enemyMats[e.type],.3);e.attack=rng(1.55,2.3);audio.tone(340,.08,.035,'triangle',150);}else e.attack=.3;}
  else{if(!e.telegraph){e.telegraph=e.type==='boss'?1.25:.9;e.attack=e.telegraph+.15;const m=torus('warning',player.x,.08,player.z,e.type==='boss'?9:6,.09,mats.orange);hazards.push({mesh:m,x:player.x,z:player.z,radius:e.type==='boss'?4.5:3,life:e.telegraph,max:e.telegraph,damage:e.type==='boss'?34:25,triggered:false});} }
}
function updateEnemies(dt){
  flowClock-=dt;if(flowClock<=0){flow.update(player.x,player.z);flowClock=.45;}
  const target=getEye();
  for(const e of enemies){if(e.dead)continue;e.age+=dt;e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);const def=C.TYPES[e.type],dist=Math.hypot(e.x-player.x,e.z-player.z);
    if(e.telegraph>0){e.telegraph-=dt;if(e.telegraph<=0){const from=vec(e.x,e.y+1.6*e.scale,e.z),d=target.subtract(from).normalize();if(lineClear(from,target)){const n=e.type==='boss'?7:3;for(let j=0;j<n;j++){const a=(j-(n-1)/2)*.15,dir=vec(d.x*Math.cos(a)+d.z*Math.sin(a),d.y,d.z*Math.cos(a)-d.x*Math.sin(a)).normalize();fireProjectile(from,dir,e.type==='boss'?15:11,e.type==='boss'?18:16,enemyMats[e.type],.4);}}
      if(e.type==='boss'){const m=torus('boss-shockwave',e.x,.18,e.z,1,.12,mats.orange);hazards.push({mesh:m,x:e.x,z:e.z,radius:.5,life:2.5,max:2.5,damage:22,wave:true,hit:false});}e.attack=e.type==='boss'?3.5:3.8;}}
    if(e.stun<=0){let dx=0,dz=0;const direct=vec(player.x-e.x,0,player.z-e.z).normalize();const from=vec(e.x,1.3,e.z),dest=vec(player.x,1.3,player.z),clear=lineClear(from,dest);let d=clear?{x:direct.x,z:direct.z}:flow.direction(e.x,e.z,player.x,player.z);
      const desired=e.type==='runner'?1.4:e.type==='shooter'?12:e.type==='boss'?9:11;
      if(dist>desired||!clear){dx=d.x;dz=d.z;}else if(e.type==='shooter'){const approach=dist<7?-.7:0;dx=direct.x*approach+direct.z*.7*e.strafe;dz=direct.z*approach-direct.x*.7*e.strafe;}else if(e.type==='boss'&&dist<6){dx=-d.x*.4;dz=-d.z*.4;}
      // Separation prevents stacks while flow-field routing takes enemies around cover.
      for(const other of enemies){if(other===e||other.dead)continue;const sx=e.x-other.x,sz=e.z-other.z,len=Math.hypot(sx,sz),r=e.radius+other.radius;if(len<r+.25&&len>.01){dx+=sx/len*(r+.25-len)*1.6;dz+=sz/len*(r+.25-len)*1.6;}}
      const speed=def.speed*C.DIFFICULTIES[difficulty].speed*(e.telegraph>0?.25:1);C.move(e,dx*speed*dt,dz*speed*dt,e.radius,obstacles);
      e.attack-=dt;if(e.attack<=0)enemyAttack(e);
    }
    e.y=e.type==='shooter'?.48+Math.sin(runTime*3+e.phase)*.18:0;e.root.position.set(e.x,e.y,e.z);e.root.rotation.y=Math.atan2(player.x-e.x,player.z-e.z);e.legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(runTime*(e.type==='runner'?11:5)+e.phase+i*Math.PI)*.45*(e.stun>0?0:1);});
    e.root.scaling.setAll(e.scale*(e.flash>0?1.035:1));
    // Gentle contact displacement keeps melee units from standing inside the operator.
    if(dist<e.radius+.43&&dist>.01){C.move(player,(player.x-e.x)/dist*dt*2,(player.z-e.z)/dist*dt*2,.42,obstacles);}
  }
  enemies=enemies.filter(e=>{if(!e.dead)return true;disposeEnemy(e);return false;});
}
function updateProjectiles(dt){for(const p of projectiles){p.life-=dt;const step=p.speed*dt,eye=getEye(),center=vec(player.x,player.y+1.05,player.z);const hitWall=wallDistance(p.pos,p.dir,step+.05)<=step;const hitPlayer=Math.min(C.raySphere(p.pos,p.dir,center,.62),C.raySphere(p.pos,p.dir,eye,.39))<=step;if(hitWall||hitPlayer){if(hitPlayer&&!hitWall)takeDamage(p.damage);burst(p.pos,mats.orange,4,.4);p.life=0;}p.pos.addInPlace(p.dir.scale(step));p.mesh.position.copyFrom(p.pos);}projectiles=projectiles.filter(p=>{if(p.life>0)return true;p.mesh.dispose();return false;});}
function updateHazards(dt){for(const h of hazards){h.life-=dt;if(h.wave){h.radius+=dt*11;h.mesh.scaling.set(h.radius*2,1,h.radius*2);const d=Math.hypot(player.x-h.x,player.z-h.z);if(!h.hit&&Math.abs(d-h.radius)<.65&&player.y<.65){h.hit=true;takeDamage(h.damage);}}else{const progress=1-h.life/h.max;h.mesh.scaling.setAll(.85+Math.sin(progress*30)*.08);h.mesh.visibility=.5+progress*.5;if(h.life<=0&&!h.triggered){h.triggered=true;if(Math.hypot(player.x-h.x,player.z-h.z)<h.radius&&player.y<1.5)takeDamage(h.damage);burst(vec(h.x,.2,h.z),mats.orange,20,1.3);ringEffect(vec(h.x,.1,h.z),mats.orange,h.radius*2,.4);}}}hazards=hazards.filter(h=>{if(h.life>0)return true;h.mesh.dispose();return false;});}
function updatePickups(dt){for(const p of pickups){p.life-=dt;p.mesh.rotation.y+=dt*1.8;p.mesh.position.y=Math.sin(runTime*3+p.phase)*.12;const d=Math.hypot(player.x-p.x,player.z-p.z);if(d<4){const speed=dt*(4-d)*4;p.x+=(player.x-p.x)*speed;p.z+=(player.z-p.z)*speed;p.mesh.position.x=p.x;p.mesh.position.z=p.z;}if(d<1.1){if(p.type==='health'){player.hp=Math.min(player.maxHp,player.hp+22);toast('+22 INTEGRITA');}if(p.type==='shield'){player.shield=Math.min(player.maxShield,player.shield+25);toast('+25 ŠTÍT');}if(p.type==='energy'){player.pulse=Math.min(100,player.pulse+22);toast('+22 % IMPULZ');}p.life=0;audio.tone(660,.16,.12,'sine',1100);}}pickups=pickups.filter(p=>{if(p.life>0)return true;p.mesh.dispose();return false;});}
function updateEffects(dt){for(const e of effects){e.life-=dt;if(e.velocity){e.velocity.y-=e.gravity*dt;e.mesh.position.addInPlace(e.velocity.scale(dt));e.mesh.rotation.x+=dt*6;if(e.mesh.position.y<.04){e.mesh.position.y=.04;e.velocity.y*=-.3;}}if(e.expand)e.mesh.scaling.setAll(1+(1-e.life/e.max)*e.expand);e.mesh.visibility=C.clamp(e.life/e.max,0,1);}effects=effects.filter(e=>{if(e.life>0)return true;e.mesh.dispose();return false;});}

function setText(id,text){if(lastHudText[id]!==text){$(id).textContent=text;lastHudText[id]=text;}}
function updateHUD(force=false){
  if(force)lastHudText={};setText('health',Math.ceil(player.hp));setText('max-health','/ '+player.maxHp);setText('shield',Math.ceil(player.shield));setText('ammo',String(player.ammo[player.weapon]).padStart(2,'0'));setText('ammo-cap','/ '+C.capacity(player,player.weapon));setText('weapon-name',C.WEAPONS[player.weapon].name);setText('score',String(Math.round(score)).padStart(6,'0'));setText('wave-label',`VLNA ${String(wave).padStart(2,'0')} / ${endless?'∞':'06'}`);setText('enemy-count',state==='countdown'?`KONTAKT ZA ${Math.ceil(countdown)} S`:`${enemies.filter(e=>!e.dead).length+plan.length} ZBÝVAJÍCÍCH CÍLŮ`);setText('combo',comboTime>0&&combo>=3?`ŘETĚZ ${combo} · ×${(1+Math.min(4,Math.floor(combo/3))*.25).toFixed(2)}`:'');setText('pulse-value',Math.floor(player.pulse)+'%');
  $('health-bar').style.width=player.hp/player.maxHp*100+'%';$('shield-bar').style.width=player.shield/player.maxShield*100+'%';$('wave-progress').style.width=waveKills/Math.max(1,waveTotal)*100+'%';$('reload-track').firstElementChild.style.width=player.reload>0?(1-player.reload/(C.WEAPONS[player.weapon].reload/player.fireRate))*100+'%':'0';
  document.querySelectorAll('[data-slot]').forEach(el=>el.classList.toggle('active',+el.dataset.slot===player.weapon));$('dash-indicator').querySelectorAll('i').forEach((el,i)=>el.classList.toggle('unready',player.dash<i+1));$('pulse-indicator').style.opacity=player.pulse>=100?'1':'.45';document.body.classList.toggle('low-health',player.hp<player.maxHp*.3);
  const boss=enemies.find(e=>e.type==='boss'&&!e.dead);$('boss-hud').classList.toggle('hidden',!boss);if(boss)$('boss-health').style.width=boss.hp/boss.maxHp*100+'%';
  const hint=player.pulse>=100?'E · Impulz připraven. Zničí střely a zasáhne okolí.':player.hp<35?'Štít se obnovuje po 4,5 s bez zásahu.':player.weapon===2?'Railgun prostřelí několik nepřátel. Miř na svítící hlavy.':'Úskok tě krátce ochrání. Zásah hlavy způsobí 175 % poškození.';setText('game-hint',hint);
  const spread=aiming?16:24+recoil*100;$('reticle').style.width=spread+'px';$('reticle').style.height=spread+'px';$('reticle').style.opacity=player.reload>0?'.35':'1';setText('fps',Math.round(engine.getFps())+' FPS');drawRadar();
}
function drawRadar(){const ctx=$('radar').getContext('2d'),s=2.1;ctx.clearRect(0,0,150,150);ctx.save();ctx.translate(75,75);ctx.strokeStyle='#a5ffcf22';ctx.lineWidth=.5;for(const r of [25,50,72]){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(-75,0);ctx.lineTo(75,0);ctx.moveTo(0,-75);ctx.lineTo(0,75);ctx.stroke();ctx.fillStyle='#91aaa65a';for(const b of obstacles)ctx.fillRect((b.x-b.w/2)*s,-(b.z+b.d/2)*s,b.w*s,b.d*s);for(const e of enemies){ctx.fillStyle=e.type==='boss'?'#ff4d32':C.TYPES[e.type].color;ctx.beginPath();ctx.arc(e.x*s,-e.z*s,e.type==='boss'?4:2.3,0,7);ctx.fill();}for(const p of pickups){ctx.fillStyle='#a5ffcf';ctx.fillRect(p.x*s-1,-p.z*s-1,2,2);}ctx.translate(player.x*s,-player.z*s);ctx.rotate(player.yaw);ctx.fillStyle='#d2ffe8';ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(3.4,4);ctx.lineTo(0,2);ctx.lineTo(-3.4,4);ctx.closePath();ctx.fill();ctx.restore();}

function applySettings(){if(!engine)return;camera.fov=settings.fov*Math.PI/180;const high=settings.quality==='high';glow.isEnabled=high;scene.shadowsEnabled=high;engine.setHardwareScalingLevel(high?Math.max(1,window.devicePixelRatio/1.4):Math.max(1.3,window.devicePixelRatio));audio.volume();safeWrite('ns-settings',settings);}
function openSettings(from){settingsReturn=from;show('settings');for(const id of ['sensitivity','fov','volume']){$(id).value=settings[id];$(id+'-out').textContent=id==='volume'?settings[id]+' %':id==='fov'?settings[id]+'°':Number(settings[id]).toFixed(1);} $('quality').value=settings.quality;$('shake').checked=settings.shake;}
function bindInputs(){
  $('start').onclick=beginRun;$('retry').onclick=beginRun;$('resume').onclick=resumeGame;$('quit').onclick=toMenu;$('end-menu').onclick=toMenu;
  $('endless').onclick=()=>{endless=true;hide('end');show('hud');player.hp=player.maxHp;player.shield=player.maxShield;nextWave();requestLock();};
  $('settings-open').onclick=()=>openSettings('menu');$('pause-settings').onclick=()=>openSettings('paused');$('settings-close').onclick=()=>{hide('settings');applySettings();};
  document.querySelectorAll('[data-difficulty]').forEach(btn=>btn.onclick=()=>{difficulty=btn.dataset.difficulty;document.querySelectorAll('[data-difficulty]').forEach(b=>b.classList.toggle('selected',b===btn));audio.click();});
  for(const id of ['sensitivity','fov','volume'])$(id).oninput=()=>{settings[id]=+$(id).value;$(id+'-out').textContent=id==='volume'?settings[id]+' %':id==='fov'?settings[id]+'°':settings[id].toFixed(1);applySettings();};$('quality').onchange=()=>{settings.quality=$('quality').value;applySettings();};$('shake').onchange=()=>{settings.shake=$('shake').checked;applySettings();};
  document.addEventListener('pointerlockchange',()=>{
    const wasLocked=locked;locked=document.pointerLockElement===canvas;lockPending=false;lastPointer=null;edgeLook={x:0,y:0};
    if(locked){if(!['playing','countdown'].includes(state)){releaseLock();return;}dragLook=false;hide('lock-tip');canvas.style.cursor='none';}
    else if(wasLocked&&['playing','countdown'].includes(state))pauseGame();
  });
  document.addEventListener('pointerlockerror',()=>{if(!locked)enableDragLook();});
  // Babylon cancels pointerdown's default action, suppressing compatibility
  // mousedown events. Use Pointer Events for buttons; never bind both families.
  canvas.addEventListener('pointerdown',e=>{
    if(!['playing','countdown'].includes(state))return;e.preventDefault();canvas.focus();
    if(!locked)requestLock();lastPointer={x:e.clientX,y:e.clientY};
    if(e.button===0){mouseDown=true;fire();}if(e.button===2)aiming=true;
    if(!locked&&canvas.setPointerCapture){try{canvas.setPointerCapture(e.pointerId);}catch{}}
    audio.init();
  });
  document.addEventListener('pointermove',e=>{
    if(!['playing','countdown'].includes(state))return;
    // With a mouse, pressing the second button emits pointermove (not another
    // pointerdown). The bitmask also covers holding both aim and fire together.
    if(locked||e.target===canvas){const nextFire=(e.buttons&1)!==0;const justPressed=nextFire&&!mouseDown;mouseDown=nextFire;aiming=(e.buttons&2)!==0;if(justPressed)fire();}
    if(locked){player.yaw+=(e.movementX||0)*.002*settings.sensitivity*(aiming?.65:1);player.pitch=C.clamp(player.pitch+(e.movementY||0)*.002*settings.sensitivity*(aiming?.65:1),-1.35,1.35);}
    else if(e.target===canvas&&(e.buttons&3)!==0){
      const dx=lastPointer?e.clientX-lastPointer.x:0,dy=lastPointer?e.clientY-lastPointer.y:0;
      player.yaw+=dx*.002*settings.sensitivity;player.pitch=C.clamp(player.pitch+dy*.002*settings.sensitivity,-1.35,1.35);
      const r=canvas.getBoundingClientRect(),margin=36;
      edgeLook={x:e.clientX>r.right-margin?1:e.clientX<r.left+margin?-1:0,y:e.clientY>r.bottom-margin?1:e.clientY<r.top+margin?-1:0};
    }else edgeLook={x:0,y:0};
    lastPointer={x:e.clientX,y:e.clientY};
  });
  document.addEventListener('pointerup',e=>{mouseDown=(e.buttons&1)!==0;aiming=(e.buttons&2)!==0;if(!(e.buttons&3)){edgeLook={x:0,y:0};lastPointer=null;}});
  const cancelPointer=()=>{mouseDown=false;aiming=false;lastPointer=null;edgeLook={x:0,y:0};};
  canvas.addEventListener('pointercancel',cancelPointer);canvas.addEventListener('lostpointercapture',cancelPointer);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{if(['playing','countdown'].includes(state)){e.preventDefault();switchWeapon((player.weapon+(e.deltaY>0?1:2))%3);}},{passive:false});
  document.addEventListener('keydown',e=>{
    if(e.code==='Escape'){if(!$('settings').classList.contains('hidden')){hide('settings');applySettings();return;}if(state==='paused'){resumeGame();return;}pauseGame();return;}
    if(!['playing','countdown'].includes(state))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;
    if(e.code==='ShiftLeft'||e.code==='ShiftRight')dash();if(e.code==='KeyE')pulse();if(e.code==='KeyR')reload();if(e.code==='KeyF')fire();if(/^Digit[123]$/.test(e.code))switchWeapon(+e.code.slice(-1)-1);
    if(e.code==='Space'&&player.vy===0){player.vy=8;audio.burst(.08,.08,450);}if(e.code==='KeyP')pauseGame();
  });document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();pauseGame();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});window.addEventListener('resize',()=>engine.resize());
}

function frame(){
  const dt=Math.min(engine.getDeltaTime()/1000,.04);totalTime+=dt;stats.frames++;const active=state==='playing'||state==='countdown';
  if(active){runTime+=dt;recoil=Math.max(0,recoil-dt*.22);shake=Math.max(0,shake-dt*.8);flashTime=Math.max(0,flashTime-dt);gunSwitch=Math.max(0,gunSwitch-dt);hitTime=Math.max(0,hitTime-dt);damageTime=Math.max(0,damageTime-dt);comboTime=Math.max(0,comboTime-dt);announceTime=Math.max(0,announceTime-dt);toastTime=Math.max(0,toastTime-dt);updatePlayer(dt);
    if(state==='countdown'){countdown-=dt;if(countdown<=0){state='playing';announce('ELIMINAČNÍ PROTOKOL', 'KONTAKT.',1.1);}}
    if(state==='playing'){spawnClock-=dt;const max=wave===6?9:Math.min(6+wave,14);if(plan.length&&spawnClock<=0&&enemies.length<max){spawnEnemy();spawnClock=wave===1?1.7:1.05;}updateEnemies(dt);if(state==='playing')updateProjectiles(dt);if(state==='playing')updateHazards(dt);if(state==='playing')updatePickups(dt);if(state==='playing'&&plan.length===0&&enemies.length===0)completeWave();}
    updateEffects(dt);hudClock-=dt;if(hudClock<=0){updateHUD();hudClock=.075;}
    if(settings.volume>0){musicClock-=dt;if(musicClock<=0){musicClock=.43;const step=Math.floor(runTime/.43)%8;if(step===0||step===4)audio.tone(43,.18,.08,'sine',26);if(step%2===0)audio.tone([55,55,65.4,49][Math.floor(runTime/3.44)%4],.33,.035,'triangle');}}
  }
  if(state==='menu'){menuAngle+=dt*.025;camera.position.set(18+Math.sin(menuAngle)*3,9.5,-24+Math.cos(menuAngle)*3);camera.setTarget(vec(-1,3,3));camera.fov=75*Math.PI/180;weaponRoot.setEnabled(false);muzzleLight.intensity=0;updateEffects(dt);}
  reactorCore.rotation.y+=dt*.26;reactorCore.rotation.z=Math.sin(totalTime*.4)*.2;reactorRings.forEach((r,i)=>{r.rotation.x=Math.sin(totalTime*.35+i)*.15;r.rotation.z=Math.cos(totalTime*.3+i)*.13;});
  $('hitmarker').style.opacity=hitTime>0?'1':'0';$('damage-flash').style.opacity=active?String(damageTime*1.7):'0';$('announcement').style.opacity=announceTime>0&&active?'1':'0';$('pickup-toast').style.opacity=toastTime>0?'1':'0';
  scene.render();
}

// Diagnostics are read-only and contain no mutation/cheat commands.
window.nullSector={snapshot:()=>({state,wave,score,kills,shots,hits,runTime,enemies:enemies.map(e=>({type:e.type,x:e.x,z:e.z,hp:e.hp})),pending:plan.length,player:structuredClone(player),input:{mode:locked?'locked':dragLook?'drag':'pending',mouseDown,aiming},meshes:scene?.meshes.length,projectiles:projectiles.length,effects:effects.length,fps:engine?.getFps(),stats:structuredClone(stats)})};
try{createWorld();flow=new C.FlowField(obstacles);bindInputs();saveBest();hide('loading');show('menu');engine.runRenderLoop(frame);}catch(error){fatal(error);}
})();
