/* IRON TIDE — Babylon.js presentation, audio and keyboard / multitouch input. */
(() => {
  'use strict';
  const N = window.Naval, B = window.BABYLON, $ = id => document.getElementById(id);
  const canvas = $('sea'), show = id => $(id).classList.remove('hidden'), hide = id => $(id).classList.add('hidden');
  const set = (id, value) => {if($(id).textContent !== String(value)) $(id).textContent = value;};
  const read = (key, fallback) => {try{return localStorage.getItem(key) ?? fallback;}catch{return fallback;}};
  const save = (key, value) => {try{localStorage.setItem(key,value);}catch{}};
  let selected = 'cruiser', game, view='menu', engine, scene, camera, water, waterTexture, sun;
  let touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  let autoAim=true, zoom=1, camX=0,camZ=0, visualTime=0,toastTime=0,bannerTime=0,hurt=0;
  let mouse=null,lookPointer=null,stickPointer=null,stickOrigin=null,stickVector={x:0,y:0},joyAngle=null;
  let menuTime=0, hudTime=0, wakeTime=0, pausedFromHelp=false, best=Number(read('iron-tide-best','0'))||0;
  const keys=new Set(),firePointers=new Set(),shipViews=new Map(),shellViews=new Map(),torpViews=new Map(),smokeViews=new Map(),supplyViews=new Map(),effects=[];
  const materials={},sounds={enabled:read('iron-tide-sound','0')==='1',ctx:null};
  let markers,markerContext,aimRing,rangeLine,displayAim={x:0,z:0};
  document.body.classList.toggle('touch',touch);
  function audioInit(){try{if(!sounds.ctx)sounds.ctx=new(window.AudioContext||window.webkitAudioContext)();if(sounds.ctx.state==='suspended')sounds.ctx.resume().catch(()=>{});}catch{}}
  function sound(freq,length=.14,volume=.05,noise=false){if(!sounds.enabled||!sounds.ctx)return;const c=sounds.ctx,g=c.createGain();g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+length);g.connect(c.destination);let s;
    if(noise){const b=c.createBuffer(1,Math.ceil(c.sampleRate*length),c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);s=c.createBufferSource();s.buffer=b;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=freq;s.connect(f);f.connect(g);}else{s=c.createOscillator();s.type='triangle';s.frequency.setValueAtTime(freq,c.currentTime);s.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.4),c.currentTime+length);s.connect(g);}s.start();s.stop(c.currentTime+length);s.onended=()=>{s.disconnect();g.disconnect();};}
  function updateSound(){document.querySelectorAll('.sound-toggle').forEach(b=>{b.textContent=sounds.enabled?'ZVUK ZAP.':'ZVUK VYP.';b.setAttribute('aria-label',sounds.enabled?'Vypnout zvuk':'Zapnout zvuk');});}
  const v=(x,y,z)=>new B.Vector3(x,y,z);
  const color=hex=>B.Color3.FromHexString(hex);
  function mat(name,hex,alpha=1,glow=0){if(materials[name])return materials[name];const m=new B.StandardMaterial(name,scene);m.diffuseColor=color(hex);m.specularColor=new B.Color3(.06,.08,.09);m.alpha=alpha;if(glow)m.emissiveColor=m.diffuseColor.scale(glow);materials[name]=m;return m;}
  function box(name,w,h,d,x,y,z,m,parent){const b=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);b.position.set(x,y,z);b.material=m;b.parent=parent||null;return b;}
  function cylinder(name,diameter,height,x,y,z,m,parent,top){const b=B.MeshBuilder.CreateCylinder(name,{diameter,diameterTop:top??diameter,height,tessellation:12},scene);b.position.set(x,y,z);b.material=m;b.parent=parent||null;return b;}
  function sphere(name,size,x,y,z,m,parent){const b=B.MeshBuilder.CreateSphere(name,{diameter:size,segments:6},scene);b.position.set(x,y,z);b.material=m;b.parent=parent||null;return b;}
  function polygonIsland(island){
    const random=N.rng(island.seed*1723),count=18,outline=[];
    for(let j=0;j<count;j++){const a=j/count*N.TAU,r=island.r*(.86+random()*.14);outline.push({x:Math.sin(a)*r,z:Math.cos(a)*r});}
    function layer(scale,y,hex,name){const mesh=new B.Mesh(name,scene),pos=[island.x,y,island.z],indices=[];
      outline.forEach(p=>pos.push(island.x+p.x*scale,y,island.z+p.z*scale));
      for(let j=0;j<count;j++)indices.push(0,(j+1)%count+1,j+1);
      const data=new B.VertexData();data.positions=pos;data.indices=indices;const normals=[];B.VertexData.ComputeNormals(pos,indices,normals);data.normals=normals;data.applyToMesh(mesh);mesh.material=mat(name,hex);mesh.isPickable=false;return mesh;}
    layer(1.35,.02,'#398f95','reef');layer(1.18,.055,'#76b9ae','shallows');layer(1.05,.1,'#d7c99e','sand');layer(.85,.18,'#738e61','grass');
    for(let j=0;j<7;j++){const a=random()*N.TAU,d=random()*island.r*.6,size=3+random()*island.r*.5;const rock=sphere('limestone',size,island.x+Math.sin(a)*d,.7+size*.1,island.z+Math.cos(a)*d,mat('rock','#8c9b7b'));rock.scaling.y=.5+random()*.4;rock.rotation.y=a;rock.isPickable=false;}
    for(let j=0;j<9;j++){const a=random()*N.TAU,d=(.35+random()*.35)*island.r,x=island.x+Math.sin(a)*d,z=island.z+Math.cos(a)*d;
      cylinder('trunk',.22,2.7,x,1.3,z,mat('trunk','#746953'));const crown=sphere('tree',2.5,x,3,z,mat(j%2?'leaf1':'leaf2',j%2?'#476c55':'#5e8058'));crown.scaling.y=.7;}
    if(island.seed===4){const x=island.x+4,z=island.z-2;cylinder('lighthouse',2.1,6,x,3.3,z,mat('tower','#e8dfc5'));cylinder('stripe',2.16,.8,x,4.8,z,mat('stripe','#d46640'));cylinder('lantern',2.8,1,x,6.8,z,mat('dark','#26454d'));cylinder('light',2.1,.65,x,6.85,z,mat('light','#ffdb92',1,.7));cylinder('roof',3.2,1,x,7.5,z,mat('roof','#923f2c'),null,0);}
  }
  function hull(length,width,height,m,parent){const points=[[0,length*.5],[width*.57,length*.29],[width*.65,-length*.27],[width*.43,-length*.49],[-width*.43,-length*.49],[-width*.65,-length*.27],[-width*.57,length*.29]];const positions=[],indices=[],n=points.length;
    points.forEach(([x,z])=>positions.push(x*.72,0,z*.95));points.forEach(([x,z])=>positions.push(x,height,z));positions.push(0,height,0);
    for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,n+j,i,n+j,n+i,2*n,n+i,n+j);}
    const mesh=new B.Mesh('hull',scene),data=new B.VertexData(),normals=[];B.VertexData.ComputeNormals(positions,indices,normals);data.positions=positions;data.indices=indices;data.normals=normals;data.applyToMesh(mesh);mesh.material=m;mesh.parent=parent;return mesh;
  }
  function makeShip(s){const root=new B.TransformNode('ship-'+s.id,scene),enemy=!!s.team,boss=s.kind==='boss',l=s.length,w=s.width,h=boss?1.3:.82;
    const hullMat=mat(enemy?'enemy-hull':'player-hull',enemy?'#53686b':'#9aacad');const deck=mat(enemy?'enemy-deck':'player-deck',enemy?'#726e5c':'#d3c3a0');const metal=mat('metal','#36515b'),light=mat('boat-light','#c6d0ca'),red=mat('enemy-stripe','#c85a3e');
    hull(l,w,h,hullMat,root);const d=hull(l*.91,w*.86,.08,deck,root);d.position.y=h+.03;
    box('stern-stripe',w, .09,.6,0,h+.16,-l*.32,enemy?red:mat('own-stripe','#ecbc6e'),root);
    box('superstructure',w*.7,.8,l*.22,0,h+.45,0,light,root);box('bridge',w*.85,.65,l*.12,0,h+1.12,l*.04,hullMat,root);
    box('windows',w*.87,.18,l*.125,0,h+1.22,l*.04,metal,root);box('bridge-roof',w*.87,.12,l*.13,0,h+1.48,l*.04,light,root);
    cylinder('funnel',w*.34,.95,0,h+1,-l*.16,metal,root);cylinder('funnel-rim',w*.4,.16,0,h+1.52,-l*.16,mat('smokestack','#203c44'),root);
    cylinder('mast',.09,2.5,0,h+2.3,0,metal,root);box('radar',1.1,.16,.14,0,h+3.35,0,metal,root);
    const flag=box('flag',.7,.4,.03,.35,h+2.8,0,enemy?red:mat('flag','#f3b85c'),root);
    const turretPositions=s.guns>=5?[l*.31,l*.16,-l*.32]:[l*.28,-l*.29],turrets=[];
    turretPositions.forEach((z,index)=>{const t=new B.TransformNode('turret',scene);t.parent=root;t.position.set(0,h+.25,z);cylinder('turret-base',w*.7,.3,0,0,0,metal,t);box('gunhouse',w*.58,.4,w*.65,0,.2,0,hullMat,t);
      const barrels=s.guns>=5?2:1;for(let j=0;j<barrels;j++)box('barrel',.12,.12,w*1.15,(j-(barrels-1)/2)*.23,.25,w*.63,metal,t);turrets.push(t);});
    // Flat shadow keeps small hulls legible on the water without a costly shadow map.
    const shadow=B.MeshBuilder.CreateDisc('ship-shadow',{radius:1,tessellation:20},scene);shadow.rotation.x=Math.PI/2;shadow.position.y=.07;shadow.scaling.set(w*.92,l*.55,1);shadow.material=mat('contact','#082e36',.25);shadow.parent=root;
    root.getChildMeshes().forEach(m=>m.isPickable=false);return {root,turrets,flag,sinkTime:0,smokeTick:0};
  }
  function setupScene(){
    engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:false,powerPreference:'high-performance'});engine.setHardwareScalingLevel(Math.max(1,devicePixelRatio/(touch?1.2:1.6)));
    scene=new B.Scene(engine);scene.clearColor=new B.Color4(.05,.26,.32,1);scene.ambientColor=new B.Color3(.08,.1,.1);
    camera=new B.FreeCamera('tactical-camera',v(0,95,-65),scene);camera.mode=B.Camera.ORTHOGRAPHIC_CAMERA;camera.minZ=.1;camera.maxZ=500;camera.inputs.clear();camera.setTarget(v(0,0,0));
    const hemi=new B.HemisphericLight('sky',v(0,1,0),scene);hemi.intensity=.65;hemi.groundColor=color('#304c51');
    sun=new B.DirectionalLight('sun',v(-.6,-1,.4),scene);sun.intensity=.8;sun.diffuse=color('#fff0cc');
    waterTexture=new B.DynamicTexture('sea-surface',{width:512,height:512},scene,false);const ctx=waterTexture.getContext();ctx.fillStyle='#236e80';ctx.fillRect(0,0,512,512);const random=N.rng(23);
    for(let i=0;i<1300;i++){const x=random()*512,y=random()*512;ctx.strokeStyle=i%3?'rgba(147,220,206,.08)':'rgba(5,50,77,.15)';ctx.lineWidth=.6+random();ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+4,y-2,x+9+random()*9,y);ctx.stroke();}waterTexture.update();waterTexture.uScale=18;waterTexture.vScale=18;
    const wm=mat('water','#ffffff');wm.diffuseTexture=waterTexture;wm.specularColor=new B.Color3(.22,.32,.32);wm.specularPower=70;
    water=B.MeshBuilder.CreateGround('ocean',{width:1100,height:1100},scene);water.material=wm;water.isPickable=false;
    N.ISLANDS.forEach(polygonIsland);
    // The dashed perimeter is a navigational marker, not an invisible wall.
    for(let a=-108;a<=108;a+=18)for(const [x,z]of[[a,-112],[a,112],[-112,a],[112,a]]){cylinder('buoy',.6,1,x,.3,z,mat('buoy','#d38b50'));sphere('buoy-light',.32,x,.95,z,mat('light','#ffd987',1,.7));}
    aimRing=B.MeshBuilder.CreateTorus('impact-marker',{diameter:5.4,thickness:.085,tessellation:40},scene);aimRing.material=mat('aim','#ffcd83',.85, .5);aimRing.isPickable=false;
    const pts=[];for(let i=0;i<=96;i++)pts.push(v(Math.sin(i/96*N.TAU),.09,Math.cos(i/96*N.TAU)));
    rangeLine=B.MeshBuilder.CreateLines('battery-range',{points:pts},scene);rangeLine.color=color('#d2e9ca');rangeLine.alpha=.11;rangeLine.isPickable=false;
    markers=document.createElement('canvas');markers.id='battle-markers';Object.assign(markers.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});canvas.after(markers);markerContext=markers.getContext('2d');
    resize();scene.onPointerObservable.clear();
  }
  function resize(){if(!engine)return;engine.resize();if(markers){markers.width=Math.round(innerWidth*devicePixelRatio);markers.height=Math.round(innerHeight*devicePixelRatio);}updateCamera(0);}
  function updateCamera(dt){if(!camera||!game)return;const playing=view!=='menu',p=game.player;const wide=innerWidth/innerHeight;
    const wantedX=playing?p.x:4,wantedZ=playing?p.z+9:5;camX+=(wantedX-camX)*(dt?Math.min(1,dt*4):1);camZ+=(wantedZ-camZ)*(dt?Math.min(1,dt*4):1);
    camera.position.set(camX,95,camZ-65);camera.setTarget(v(camX,0,camZ));
    const extent=(playing?(touch?(wide>1.3?30:46):(wide<.8?62:45)):45)*zoom;camera.orthoTop=extent;camera.orthoBottom=-extent;camera.orthoLeft=-extent*wide;camera.orthoRight=extent*wide;
  }
  function worldAt(x,y){const ray=scene.createPickingRay(x,y,B.Matrix.Identity(),camera);const t=-ray.origin.y/ray.direction.y;return {x:ray.origin.x+ray.direction.x*t,z:ray.origin.z+ray.direction.z*t};}
  function project(x,y,z){return B.Vector3.Project(v(x,y,z),B.Matrix.Identity(),scene.getTransformMatrix(),new B.Viewport(0,0,innerWidth,innerHeight));}
  function clearVisuals(){for(const map of [shipViews,shellViews,torpViews,smokeViews,supplyViews]){for(const item of map.values())(item.root||item).dispose();map.clear();}for(const e of effects){e.mesh.dispose();e.material?.dispose();}effects.length=0;}
  function demo(){clearInput();clearVisuals();view='menu';game=N.createGame(selected,912);game.enemies=[];game.player.x=19;game.player.z=5;game.player.yaw=-.58;game.player.aimX=60;game.player.aimZ=60;game.player.turretYaw=.5;camX=4;camZ=5;zoom=1;hide('hud');for(const id of ['pause','upgrade','end','help'])hide(id);show('menu');set('best-label','REKORD '+best.toLocaleString('cs-CZ'));aimRing.setEnabled(false);rangeLine.setEnabled(false);$('target-label').classList.add('hidden');}
  function start(){audioInit();clearInput();clearVisuals();game=N.createGame(selected,Math.floor(Math.random()*1000000));view='battle';camX=0;camZ=-59;zoom=1;autoAim=true;updateAuto();for(const id of ['menu','pause','upgrade','end','help'])hide(id);show('hud');canvas.focus();set('ship-name',N.CLASSES[selected].name);toast(touch?'Joystickem pluj. Tlačítkem SALVA střílej.':'W / S: tah motorů · A / D: kormidlo · myš: míření',6);processEvents();updateHud();}
  function toast(text,time=2.8){set('toast',text);toastTime=time;$('toast').classList.add('visible');}
  function pause(){if(view!=='battle'||game.state!=='playing')return;view='pause';clearInput();show('pause');}
  function resume(){if(view!=='pause')return;view='battle';hide('pause');canvas.focus();clearInput();}
  function clearInput(){keys.clear();firePointers.clear();mouse=null;lookPointer=null;stickPointer=null;stickOrigin=null;stickVector={x:0,y:0};joyAngle=null;$('stick').style.transform='translate(0px,0px)';}
  function updateAuto(){set('touch-toggle','DOTYKOVÉ OVLÁDÁNÍ: '+(touch?'ZAP.':'VYP.'));$('touch-toggle').setAttribute('aria-pressed',String(touch));set('autoaim','AUTO MÍŘENÍ: '+(autoAim?'ZAP.':'VYP.'));$('autoaim').setAttribute('aria-pressed',String(autoAim));$('autoaim').classList.toggle('hidden',!touch);}
  function nearest(){let candidate=null,d=Infinity;for(const e of game.enemies)if(!e.sunk){const de=N.distance(game.player,e);if(de<d&&!N.blocked(game,game.player,e,0)){candidate=e;d=de;}}return candidate;}
  function input(){const p=game.player;let throttle=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')? .35:0),steer=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),heading;
    if(stickPointer!==null){const strength=Math.min(1,Math.hypot(stickVector.x,stickVector.y));throttle=strength>.12?strength:0;if(throttle)heading=joyAngle;}
    let target={x:p.aimX,z:p.aimZ};
    if(touch&&autoAim){const e=nearest();if(e){const flight=N.distance(p,e)/52;target={x:e.x+Math.sin(e.yaw)*e.speed*flight,z:e.z+Math.cos(e.yaw)*e.speed*flight};}else target={x:p.x+Math.sin(p.yaw)*40,z:p.z+Math.cos(p.yaw)*40};}
    else if(mouse)target=worldAt(mouse.x,mouse.y);
    return {throttle,steer,heading,aimX:target.x,aimZ:target.z,fire:firePointers.size>0||keys.has('Space'),torpedo:keys.has('KeyQ')};
  }
  function ring(x,z,hit=false,life=.8,size=3){const mesh=B.MeshBuilder.CreateTorus('ripple',{diameter:size,thickness:hit?.14:.07,tessellation:24},scene);mesh.position.set(x,.15,z);const m=new B.StandardMaterial('ripple-mat',scene);m.diffuseColor=color(hit?'#ffbb66':'#c7eee0');m.emissiveColor=m.diffuseColor.scale(.35);m.alpha=.8;mesh.material=m;effects.push({mesh,material:m,age:0,life,type:'ring'});}
  function explosion(x,z,large=false){ring(x,z,true,1.5,large?5:2);for(let j=0;j<(large?15:5);j++){const mesh=sphere('blast',large?1.5:.65,x,1,z,mat(j%2?'fire':'ember',j%2?'#ffb85b':'#f27d3c',1,.6));effects.push({mesh,age:0,life:.5+Math.random()*.7,type:'blast',vx:(Math.random()-.5)*(large?13:7),vz:(Math.random()-.5)*(large?13:7),vy:3+Math.random()*5});}}
  function processEvents(){for(const e of game.events){
    if(e.type==='salvo'){if(!e.team)sound(170,.32,.12,true);else sound(150,.17,.035,true);const s=e.team?game.enemies.find(s=>s.x===e.x&&s.z===e.z):game.player;if(s)for(let i=0;i<Math.min(s.guns,4);i++){const m=sphere('muzzle',.55,e.x+Math.sin(s.turretYaw)*2,1.7,e.z+Math.cos(s.turretYaw)*2,mat('flash','#fff0bd',1,1));effects.push({mesh:m,age:0,life:.12,type:'flash'});}}
    if(e.type==='splash'){if(e.hit)explosion(e.x,e.z);else{ring(e.x,e.z);const m=sphere('spray',.55,e.x,.5,e.z,mat('spray','#d5f4ed',.7));effects.push({mesh:m,age:0,life:.48,type:'spray'});}}
    if(e.type==='hit'){if(!e.team){hurt=.45;sound(90,.2,.06,true);}else sound(580,.08,.025);}
    if(e.type==='sink'){explosion(e.x,e.z,true);sound(90,.65,.13,true);if(e.team)toast(e.boss?'MONARCH POTOPEN. MOŘE JE TVOJE.':'NEPŘÁTELSKÁ LOĎ POTOPENA +'+(game.enemies.find(s=>s.sunk&&s.x===e.x)?.kind==='cruiser'?800:400));}
    if(e.type==='mission'){bannerTime=4.5;set('banner-sub','OPERACE 0'+(e.index+1)+' / 03');set('banner-title',N.MISSIONS[e.index].name);$('banner').classList.add('visible');set('mission-name',N.MISSIONS[e.index].name);set('objective',N.MISSIONS[e.index].subtitle);set('sector','OPERACE 0'+(e.index+1)+' / 03');}
    if(e.type==='repair')toast('OPRAVÁŘSKÝ TÝM NA PALUBĚ');if(e.type==='smoke')toast('KOUŘOVÁ CLONA · NEPŘÍTEL ZTRATIL KONTAKT');if(e.type==='boost')toast('PLNOU PAROU VPŘED');if(e.type==='supply'){toast('ZÁSOBY VYZVEDNUTY · +45 PANCÍŘE');sound(780,.2,.04);}
    if(e.type==='torpedo'&&!e.team)sound(280,.25,.045);if(e.type==='grounding'&&e.player)toast('MĚLČINA! ZMĚŇ KURZ.');
  }game.events.length=0;}
  function updateShips(dt){const ships=[game.player,...game.enemies],ids=new Set(ships.map(s=>s.id));for(const [id,obj]of shipViews)if(!ids.has(id)){obj.root.dispose();shipViews.delete(id);}
    for(const s of ships){let obj=shipViews.get(s.id);if(!obj){obj=makeShip(s);shipViews.set(s.id,obj);}obj.root.scaling.setAll(view==='menu'?2.2:1);if(s.sunk){obj.sinkTime+=dt;obj.root.position.y=-obj.sinkTime*.75;obj.root.rotation.z=Math.min(.65,obj.sinkTime*.16);if(obj.sinkTime>5)obj.root.setEnabled(false);}else{obj.root.position.set(s.x,.15+Math.sin(visualTime*1.5+s.id)*.05,s.z);obj.root.rotation.set(Math.sin(visualTime+s.id)*.012,s.yaw,Math.sin(visualTime*1.3+s.id)*.018);obj.turrets.forEach(t=>t.rotation.y=N.wrap(s.turretYaw-s.yaw));obj.flag.rotation.z=Math.sin(visualTime*5)*.1;
        if(s.hp<s.maxHp*.4){obj.smokeTick-=dt;if(obj.smokeTick<=0){obj.smokeTick=.4;const m=sphere('damage-smoke',1.2,s.x,2.6,s.z,mat('damage-smoke','#445960',.45));effects.push({mesh:m,age:0,life:2.5,type:'smoke',vx:.5,vz:.2,vy:1.8});}}}}
    wakeTime-=dt;if(wakeTime<=0){wakeTime=.16;for(const s of ships)if(!s.sunk&&(Math.abs(s.speed)>1||view==='menu')){const x=s.x-Math.sin(s.yaw)*s.length*.48,z=s.z-Math.cos(s.yaw)*s.length*.48;ring(x,z,false,2.1,s.width*.7);}}
  }
  function syncProjectiles(){function sync(map,list,create,update){const ids=new Set(list.map(o=>o.id));for(const[id,m]of map)if(!ids.has(id)){m.dispose();map.delete(id);}for(const obj of list){let m=map.get(obj.id);if(!m){m=create(obj);map.set(obj.id,m);}update(m,obj);}}
    sync(shellViews,game.shells,s=>sphere('shell',s.team?.4:.48,0,0,0,mat(s.team?'enemy-shell':'shell',s.team?'#ffc38b':'#fff2c0',1,1)),(m,s)=>{const t=N.clamp(s.age/s.flight,0,1);m.setEnabled(s.age>=0);m.position.set(s.x,1.4+Math.sin(t*Math.PI)*(4+s.flight*4),s.z);});
    sync(torpViews,game.torpedoes,t=>box('torpedo',.23,.15,1.5,0,.15,0,mat(t.team?'enemy-torp':'torp',t.team?'#ffab7c':'#e9f3cb',1,.7)),(m,t)=>{m.position.set(t.x,.18,t.z);m.rotation.y=t.yaw;if(Math.floor(t.age*8)!==m._wake){m._wake=Math.floor(t.age*8);ring(t.x-Math.sin(t.yaw),t.z-Math.cos(t.yaw),false,.9,.65);}});
  }
  function updateSupplies(){const keys=new Set();game.pickups.forEach((p,i)=>{const key=p;keys.add(key);let m=supplyViews.get(key);if(!m){m=box('supplies',1.6,1.1,1.6,p.x,.8,p.z,mat('supply','#bceabc',1,.2));supplyViews.set(key,m);}m.position.y=.65+Math.sin(visualTime*2)*.2;m.rotation.y=visualTime*.3;});for(const[k,m]of supplyViews)if(!keys.has(k)){m.dispose();supplyViews.delete(k);}
    const smokeKeys=new Set(game.smokes);for(const s of game.smokes){let root=smokeViews.get(s);if(!root){root=new B.TransformNode('smokescreen',scene);for(let j=0;j<12;j++){const a=j/12*N.TAU;const m=sphere('smoke-cloud',7,s.x+Math.sin(a)*7,2,s.z+Math.cos(a)*7,mat('smokescreen','#d1d8d2',.2),root);m.scaling.y=.5;}smokeViews.set(s,root);}const scale=Math.min(1,s.age*.8)*Math.min(1,(s.life-s.age));root.scaling.setAll(scale);}for(const[k,m]of smokeViews)if(!smokeKeys.has(k)){m.dispose();smokeViews.delete(k);}}
  function updateEffects(dt){for(let j=effects.length-1;j>=0;j--){const e=effects[j];e.age+=dt;const t=e.age/e.life;if(t>=1||effects.length>190){e.mesh.dispose();e.material?.dispose();effects.splice(j,1);continue;}
    if(e.type==='ring'){e.mesh.scaling.setAll(1+t*3.5);e.material.alpha=(1-t)*.45;}
    if(e.type==='blast'||e.type==='smoke'){e.mesh.position.x+=(e.vx||0)*dt;e.mesh.position.z+=(e.vz||0)*dt;e.mesh.position.y+=(e.vy||0)*dt;if(e.type==='blast')e.vy-=10*dt;e.mesh.scaling.setAll(e.type==='smoke'?1+t*2:1-t*.8);}
    if(e.type==='spray'){e.mesh.position.y=.5+Math.sin(t*Math.PI)*2;e.mesh.scaling.set(.5+t,1+2*(1-t),.5+t);}
  }}
  function updateHud(){const p=game.player;set('score',game.score.toLocaleString('cs-CZ'));set('remaining',game.enemies.filter(e=>!e.sunk).length);set('health',Math.ceil(p.hp)+' / '+p.maxHp);$('health-bar').style.width=(p.hp/p.maxHp*100)+'%';$('health-bar').style.background=p.hp<p.maxHp*.3?'#f28b66':'#99e3cf';set('speed',Math.round(Math.abs(p.speed)*2.1)+' UZLŮ'+(p.speed<-.5?' · VZAD':''));set('heading','KURZ '+String(Math.round((p.yaw*180/Math.PI+360)%360)).padStart(3,'0')+'°');
    set('gun-state',p.cooldown>0?'NABÍJÍM '+p.cooldown.toFixed(1)+' s':'SALVA PŘIPRAVENA');set('torp-state',p.torpCooldown>0?'NABÍJÍM '+p.torpCooldown.toFixed(1)+' s':'VYPUSTIT TORPÉDA');$('gun-bar').style.width=(1-p.cooldown/p.reload)*100+'%';$('torp-bar').style.width=(1-p.torpCooldown/p.torpReload)*100+'%';
    set('repair-state',p.repairCooldown>0?Math.ceil(p.repairCooldown)+'s':p.repairs+'×');set('smoke-state',p.smokeCooldown>0?Math.ceil(p.smokeCooldown)+'s':'✓');set('boost-state',p.boostCooldown>0?Math.ceil(p.boostCooldown)+'s':'✓');$('repair-button').disabled=p.repairs<=0||p.repairCooldown>0||p.hp>=p.maxHp;$('smoke-button').disabled=p.smokeCooldown>0;$('boost-button').disabled=p.boostCooldown>0;
    drawRadar();
  }
  function drawRadar(){const c=$('radar').getContext('2d'),size=240,scale=1;c.clearRect(0,0,size,size);c.strokeStyle='#abcfc820';c.lineWidth=1;for(let i=20;i<240;i+=40){c.beginPath();c.moveTo(i,0);c.lineTo(i,240);c.moveTo(0,i);c.lineTo(240,i);c.stroke();}c.save();c.translate(120,120);c.fillStyle='#8aa899';for(const i of N.ISLANDS){c.beginPath();c.arc(i.x,-i.z,i.r,0,N.TAU);c.fill();}for(const e of game.enemies)if(!e.sunk){c.fillStyle=e.kind==='boss'?'#ffd09b':'#ef936e';c.beginPath();c.arc(e.x,-e.z,e.kind==='boss'?5:3,0,N.TAU);c.fill();}c.fillStyle='#c0f2a7';for(const p of game.pickups)c.fillRect(p.x-2,-p.z-2,4,4);const p=game.player;c.translate(p.x,-p.z);c.rotate(p.yaw);c.fillStyle='#f7e6bf';c.beginPath();c.moveTo(0,-6);c.lineTo(4,5);c.lineTo(0,2);c.lineTo(-4,5);c.closePath();c.fill();c.restore();}
  function drawMarkers(){const c=markerContext,dpr=devicePixelRatio;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,innerWidth,innerHeight);if(view==='menu')return;
    c.textAlign='center';c.font='9px monospace';for(const s of game.enemies){if(s.sunk)continue;const p=project(s.x,3,s.z);if(p.z<0||p.z>1)continue;const w=s.kind==='boss'?78:46;const name=s.kind==='boss'?'MONARCH':s.kind==='cruiser'?'KŘIŽNÍK':'HLÍDKA';c.fillStyle='#0b2a32b0';c.fillRect(p.x-w/2-5,p.y-25,w+10,24);c.fillStyle='#f9c4a0';c.fillText(name,p.x,p.y-13);c.fillStyle='#ffffff30';c.fillRect(p.x-w/2,p.y-7,w,3);c.fillStyle=s.flash?'#fff0c5':'#ef9879';c.fillRect(p.x-w/2,p.y-7,w*s.hp/s.maxHp,3);}
    // The screen-edge direction cue keeps distant remaining ships discoverable.
    const e=nearest();if(e){const p=project(e.x,0,e.z);if(p.x<30||p.x>innerWidth-30||p.y<40||p.y>innerHeight-130){const center={x:innerWidth/2,y:innerHeight/2},a=Math.atan2(p.y-center.y,p.x-center.x),r=Math.min(innerWidth,innerHeight)*.38;c.save();c.translate(center.x+Math.cos(a)*r,center.y+Math.sin(a)*r);c.rotate(a);c.fillStyle='#efbd84';c.beginPath();c.moveTo(8,0);c.lineTo(-5,-5);c.lineTo(-5,5);c.fill();c.restore();}}
    const p=game.player,aim=project(displayAim.x,.2,displayAim.z);c.strokeStyle='#fbe0a8a0';c.lineWidth=1;for(const [dx,dy]of[[-11,0],[11,0],[0,-8],[0,8]]){c.beginPath();c.moveTo(aim.x+dx*.6,aim.y+dy*.6);c.lineTo(aim.x+dx,aim.y+dy);c.stroke();}
  }
  function transitions(){if(view!=='battle')return;if(game.state==='upgrade'){view='upgrade';clearInput();$('upgrade-cards').replaceChildren();for(const item of game.options){const btn=document.createElement('button');const icon=document.createElement('span');icon.className='upgrade-icon';icon.textContent=item.icon;const title=document.createElement('strong');title.textContent=item.name;const desc=document.createElement('p');desc.textContent=item.text;btn.append(icon,title,desc);btn.onclick=()=>{if(N.selectUpgrade(game,item.id)){clearVisuals();hide('upgrade');view='battle';clearInput();camX=0;camZ=-59;processEvents();}};$('upgrade-cards').append(btn);}show('upgrade');}
    if(game.state==='won'||game.state==='lost'){view='end';clearInput();set('end-tag',game.state==='won'?'SOUOSTROVÍ JE OSVOBOZENO':'SPOJENÍ S LODÍ ZTRACENO');set('end-title',game.state==='won'?'Příliv patří tobě.':'Čest kapitánovi.');set('end-text',game.state==='won'?'Monarch klesá ke dnu. Tři operace, jedna vítězná posádka.':'Zkus držet odstup, mířit před cíl a včas využít opravy i kouř.');set('end-score',game.score.toLocaleString('cs-CZ'));set('end-kills',game.kills);set('end-time',Math.floor(game.time/60)+':'+String(Math.floor(game.time%60)).padStart(2,'0'));if(game.score>best){best=game.score;save('iron-tide-best',String(best));}show('end');}}
  function bindInput(){
    $('launch').onclick=start;$('retry').onclick=start;$('end-menu').onclick=demo;$('quit').onclick=demo;$('resume').onclick=resume;$('pause-button').onclick=pause;
    $('help-open').onclick=()=>{pausedFromHelp=false;show('help');};$('pause-help').onclick=()=>{pausedFromHelp=true;hide('pause');show('help');};$('help-close').onclick=()=>{hide('help');if(pausedFromHelp)show('pause');};
    document.querySelectorAll('[data-class]').forEach(b=>b.onclick=()=>{selected=b.dataset.class;document.querySelectorAll('[data-class]').forEach(c=>{c.classList.toggle('selected',c===b);c.setAttribute('aria-pressed',String(c===b));const label=c.querySelector('.ship-index i');if(label)label.remove();});const label=document.createElement('i');label.textContent='VYBRÁNO';b.querySelector('.ship-index').append(label);demo();});
    document.querySelectorAll('.sound-toggle').forEach(b=>b.onclick=()=>{sounds.enabled=!sounds.enabled;audioInit();save('iron-tide-sound',sounds.enabled?'1':'0');updateSound();if(sounds.enabled)sound(440,.18,.04);});updateSound();
    $('touch-toggle').onclick=()=>{touch=!touch;document.body.classList.toggle('touch',touch);clearInput();updateAuto();resize();};updateAuto();
    $('autoaim').onclick=()=>{autoAim=!autoAim;updateAuto();};
    const activateTouch=()=>{if(!touch){touch=true;document.body.classList.add('touch');updateAuto();resize();}};
    canvas.addEventListener('pointerdown',e=>{if(view!=='battle')return;e.preventDefault();audioInit();canvas.focus();if(e.pointerType==='touch'){activateTouch();lookPointer=e.pointerId;autoAim=false;updateAuto();}else if(e.button===0){firePointers.add(e.pointerId);const target=worldAt(e.clientX,e.clientY);game.player.aimX=target.x;game.player.aimZ=target.z;N.fire(game);}else if(e.button===2){const aim=worldAt(e.clientX,e.clientY);game.player.aimX=aim.x;game.player.aimZ=aim.z;N.launchTorpedoes(game);}mouse={x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(view!=='battle')return;if(e.pointerType!=='touch'||lookPointer===e.pointerId)mouse={x:e.clientX,y:e.clientY};});
    const release=e=>{firePointers.delete(e.pointerId);if(lookPointer===e.pointerId)lookPointer=null;if(stickPointer===e.pointerId){stickPointer=null;joyAngle=null;stickVector={x:0,y:0};$('stick').style.transform='translate(0,0)';}};
    document.addEventListener('pointerup',release);document.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=N.clamp(zoom+Math.sign(e.deltaY)*.08,.7,1.45);},{passive:false});
    const joystick=$('joystick');joystick.addEventListener('pointerdown',e=>{if(view!=='battle'||stickPointer!==null)return;activateTouch();e.preventDefault();stickPointer=e.pointerId;const r=joystick.getBoundingClientRect();stickOrigin={x:r.left+r.width/2,y:r.top+r.height/2};joystick.setPointerCapture(e.pointerId);moveStick(e);});
    function moveStick(e){if(e.pointerId!==stickPointer)return;const dx=e.clientX-stickOrigin.x,dy=e.clientY-stickOrigin.y,len=Math.hypot(dx,dy),r=36,scale=len>r?r/len:1;stickVector={x:dx*scale/r,y:dy*scale/r};joyAngle=Math.atan2(stickVector.x,-stickVector.y);$('stick').style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
    joystick.addEventListener('pointermove',moveStick);joystick.addEventListener('lostpointercapture',release);
    const fireButton=$('fire-button');fireButton.addEventListener('pointerdown',e=>{if(view!=='battle')return;e.preventDefault();audioInit();firePointers.add(e.pointerId);fireButton.setPointerCapture(e.pointerId);const now=input();game.player.aimX=now.aimX;game.player.aimZ=now.aimZ;N.fire(game);});fireButton.addEventListener('lostpointercapture',release);
    $('torpedo-button').onclick=()=>{if(view==='battle'){const now=input();game.player.aimX=now.aimX;game.player.aimZ=now.aimZ;N.launchTorpedoes(game);}};
    for(const key of ['repair','smoke','boost'])$(key+'-button').onclick=()=>{if(view==='battle')N.ability(game,key);};
    document.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&view==='battle')e.preventDefault();if(e.repeat)return;if(e.code==='Escape'||e.code==='KeyP'){if(view==='battle')pause();else if(view==='pause')resume();return;}if(view!=='battle')return;keys.add(e.code);if(e.code==='Space')N.fire(game);if(e.code==='KeyQ')N.launchTorpedoes(game);if(e.code==='KeyR')N.ability(game,'repair');if(e.code==='KeyE')N.ability(game,'smoke');if(e.code==='ShiftLeft'||e.code==='ShiftRight')N.ability(game,'boost');});
    document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{clearInput();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}});window.addEventListener('resize',()=>{clearInput();resize();});
  }
  function frame(){const dt=Math.min(.05,engine.getDeltaTime()/1000||.016);visualTime+=dt;
    if(view==='battle'){N.update(game,dt,input());processEvents();transitions();}else if(view==='menu'){menuTime+=dt;game.player.yaw=-.58+Math.sin(menuTime*.15)*.07;game.player.turretYaw=.55+Math.sin(menuTime*.2)*.25;}
    updateCamera(dt);updateShips(dt);syncProjectiles();updateSupplies();updateEffects(dt);waterTexture.uOffset+=dt*.0015;waterTexture.vOffset+=dt*.0005;
    const p=game.player,d=Math.hypot(p.aimX-p.x,p.aimZ-p.z),a=Math.atan2(p.aimX-p.x,p.aimZ-p.z);displayAim={x:p.x+Math.sin(a)*Math.min(d,p.range),z:p.z+Math.cos(a)*Math.min(d,p.range)};aimRing.position.set(displayAim.x,.18,displayAim.z);aimRing.setEnabled(view!=='menu');rangeLine.position.set(p.x,0,p.z);rangeLine.scaling.set(p.range,1,p.range);rangeLine.setEnabled(view==='battle');
    if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');}if(bannerTime>0){bannerTime-=dt;if(bannerTime<=0)$('banner').classList.remove('visible');}hurt=Math.max(0,hurt-dt);$('damage-vignette').style.opacity=String(hurt);
    hudTime+=dt;if(hudTime>.09&&view!=='menu'){updateHud();hudTime=0;}scene.render();drawMarkers();
  }
  try{if(!B||!N)throw new Error('Nepodařilo se načíst herní soubory. Obnov stránku.');setupScene();bindInput();demo();hide('loading');engine.runRenderLoop(()=>{try{frame();}catch(e){showError(e);engine.stopRenderLoop();}});}
  catch(e){showError(e);}
  function showError(e){hide('loading');set('error','Hru se nepodařilo spustit. Zkus obnovit stránku nebo prohlížeč s podporou WebGL.\n\n'+e.message);show('error');console.error(e);}
  // Read-only diagnostics for local QA. No gameplay state can be changed here.
  window.ironTide={snapshot:()=>({view,state:game?.state,mission:game?.mission,score:game?.score,kills:game?.kills,time:game?.time,touch,autoAim,input:{keys:[...keys],stickPointer,firePointers:firePointers.size,stick:{...stickVector}},player:game?{...game.player}:null,enemies:game?.enemies.map(e=>({id:e.id,kind:e.kind,x:e.x,z:e.z,hp:e.hp,sunk:e.sunk})),shells:game?.shells.length,torpedoes:game?.torpedoes.length,meshes:scene?.meshes.length,fps:engine?.getFps()})};
})();

