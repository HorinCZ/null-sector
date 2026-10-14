/* IRON TIDE. Deterministic naval combat; renderer and input are separate. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Naval = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2, LIMIT = 112;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const CLASSES = {
    destroyer: { name: 'JESTŘÁB', role: 'TORPÉDOBOREC', hp: 240, speed: 17, turn: .9, reload: 2.1, damage: 19, guns: 3, range: 77, torpReload: 10, length: 8.5, width: 1.65, color: '#adc6ce' },
    cruiser: { name: 'VLTAVA', role: 'KŘIŽNÍK', hp: 360, speed: 13, turn: .65, reload: 3.1, damage: 23, guns: 5, range: 86, torpReload: 15, length: 11, width: 2.15, color: '#c6ccc5' },
    battleship: { name: 'LEVIATAN', role: 'BITEVNÍ LOĎ', hp: 540, speed: 9.5, turn: .46, reload: 4.2, damage: 29, guns: 8, range: 96, torpReload: 20, length: 14, width: 2.85, color: '#aabcc0' }
  };
  const ISLANDS = [
    {x:-54,z:-48,r:13,seed:2},{x:49,z:-40,r:11,seed:8},{x:-28,z:9,r:11,seed:4},
    {x:35,z:31,r:15,seed:7},{x:-71,z:53,r:15,seed:3},{x:77,z:66,r:12,seed:6},
    {x:2,z:82,r:10,seed:9},{x:-92,z:-5,r:8,seed:5},{x:88,z:-73,r:12,seed:11}
  ];
  const MISSIONS = [
    { name: 'PRVNÍ KONTAKT', subtitle: 'Prolom nepřátelskou hlídku', fleet: ['scout','scout','scout'], time: 0 },
    { name: 'ŽELEZNÝ PRŮLIV', subtitle: 'Zastav úderný svaz', fleet: ['scout','cruiser','cruiser','scout'], time: 0 },
    { name: 'POSLEDNÍ VLNA', subtitle: 'Potop vlajkovou loď Monarch', fleet: ['cruiser','boss','scout','scout'], time: 0 }
  ];
  const UPGRADES = [
    {id:'guns',name:'RYCHLÉ ZÁVĚRY',icon:'◎',text:'Děla se nabíjejí o 22 % rychleji.'},
    {id:'armor',name:'DVOJITÝ PLÁŠŤ',icon:'⬡',text:'+100 maximálního pancíře a okamžitá oprava.'},
    {id:'engine',name:'PŘETLAKOVÉ TURBÍNY',icon:'↗',text:'+20 % rychlosti a obratnější kormidlo.'},
    {id:'torpedo',name:'HLUBINNÝ ÚDER',icon:'⋙',text:'+35 % síly torpéd. Nabíjení kratší o 25 %.'},
    {id:'repair',name:'ZÁCHRANNÝ TÝM',icon:'✚',text:'+2 opravy. Každá oprava obnoví více pancíře.'},
    {id:'shells',name:'TĚŽKÉ GRANÁTY',icon:'✦',text:'+25 % poškození hlavní baterie.'}
  ];
  const ENEMIES = {
    scout: {hp:85,speed:10,turn:.66,reload:5.3,damage:8,guns:2,range:65,length:7.5,width:1.6},
    cruiser: {hp:180,speed:8,turn:.44,reload:5.8,damage:11,guns:4,range:80,length:11,width:2.2},
    boss: {hp:650,speed:6,turn:.26,reload:6.3,damage:14,guns:8,range:95,length:19,width:3.7}
  };
  function rng(seed) { return () => {seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}; }
  function ship(spec, x, z, team, id) {
    return {...spec,x,z,yaw:team?Math.PI:0,speed:0,throttle:0,team,id,hp:spec.hp,maxHp:spec.hp,
      cooldown:0,torpCooldown:0,repairCooldown:0,smokeCooldown:0,boostCooldown:0,boostTime:0,
      repairs:3,repairPower:1,radius:spec.width+ .6,aimX:x,aimZ:z+30,turretYaw:0,
      sunk:false,flash:0,age:0,aiClock:0,shotCount:0,obstacleHits:0,torpDamage:100,repairTime:0};
  }
  function createGame(classId='cruiser',seed=42) {
    if(!CLASSES[classId]) classId='cruiser';
    const g={classId,random:rng(seed),time:0,mission:0,state:'playing',score:0,kills:0,shots:0,hits:0,
      player:ship(CLASSES[classId],0,-68,0,0),enemies:[],shells:[],torpedoes:[],smokes:[],pickups:[],events:[],
      nextId:1,missionDelay:0,options:[],islands:ISLANDS,damageTaken:0};
    startMission(g,0); return g;
  }
  function emit(g,type,data={}) {g.events.push({type,...data});if(g.events.length>160)g.events.shift();}
  function startMission(g,index) {
    g.mission=index;g.missionDelay=0;g.state='playing';g.shells=[];g.torpedoes=[];g.smokes=[];
    const p=g.player;p.x=0;p.z=-68;p.yaw=0;p.speed=0;p.throttle=0;p.cooldown=0;p.torpCooldown=0;
    p.aimX=0;p.aimZ=-25;p.hp=Math.min(p.maxHp,p.hp+(index? p.maxHp*.35:0));
    const positions=[[-42,68],[4,44],[73,7],[-75,-15]];
    g.enemies=MISSIONS[index].fleet.map((kind,i)=>{const pos=positions[i];const e=ship(ENEMIES[kind],pos[0],pos[1],1,g.nextId++);e.kind=kind;e.cooldown=2+i;e.aiClock=i;e.torpCooldown=8+i*2;return e;});
    emit(g,'mission',{index});
  }
  function blocked(g,a,b,margin=0) {
    const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;
    return g.islands.some(i=>{const t=l?clamp(((i.x-a.x)*dx+(i.z-a.z)*dz)/l,0,1):0;return Math.hypot(a.x+t*dx-i.x,a.z+t*dz-i.z)<i.r+margin;});
  }
  function moveShip(g,s,dt,steer,targetThrottle) {
    s.throttle=clamp(targetThrottle,-.35,1);
    const max=s.speedMax||s.baseSpeed||0;
    const target=s.throttle*max*(s.boostTime>0?1.6:1);
    s.speed+=(target-s.speed)*Math.min(1,dt*.85);
    s.yaw=wrap(s.yaw+clamp(steer,-1,1)*s.turn*dt*(.35+.65*clamp(Math.abs(s.speed)/Math.max(max,1),0,1)));
    s.x+=Math.sin(s.yaw)*s.speed*dt;s.z+=Math.cos(s.yaw)*s.speed*dt;
    for(const i of g.islands){const dx=s.x-i.x,dz=s.z-i.z,d=Math.hypot(dx,dz),r=i.r+s.radius;
      if(d<r){const a=d>.001?dx/d:1,b=d>.001?dz/d:0;s.x=i.x+a*r;s.z=i.z+b*r;
        s.speed*=.55;if(s.obstacleHits<=0){s.hp-=s.team?0:5;s.obstacleHits=1.5;emit(g,'grounding',{x:s.x,z:s.z,player:!s.team});}}}
    s.x=clamp(s.x,-LIMIT+s.radius,LIMIT-s.radius);s.z=clamp(s.z,-LIMIT+s.radius,LIMIT-s.radius);
  }
  function setSpeeds(g){for(const s of [g.player,...g.enemies])if(!s.speedMax){s.speedMax=s.team?ENEMIES[s.kind].speed:CLASSES[g.classId].speed;}}
  function fire(g,s=g.player,aim) {
    if(g.state!=='playing'||s.sunk||s.cooldown>0)return false;
    const raw=aim||{x:s.aimX,z:s.aimZ},d=distance(s,raw),range=Math.min(d,s.range),a=Math.atan2(raw.x-s.x,raw.z-s.z);
    const tx=s.x+Math.sin(a)*range,tz=s.z+Math.cos(a)*range;
    s.cooldown=s.reload;s.shotCount++;
    for(let j=0;j<s.guns;j++) {
      const mount=(j/(s.guns-1||1)-.5)*s.length*.55;
      const x=s.x+Math.sin(s.yaw)*mount,z=s.z+Math.cos(s.yaw)*mount;
      const spread=(s.team?2.6:1.35)*(range/s.range+.15);
      const endX=tx+(g.random()-.5)*spread,endZ=tz+(g.random()-.5)*spread;
      const flight=Math.max(.24,Math.hypot(endX-x,endZ-z)/52);
      g.shells.push({id:g.nextId++,x,z,startX:x,startZ:z,endX,endZ,age:-j*.055,flight,team:s.team,damage:s.damage});
    }
    if(!s.team)g.shots+=s.guns;
    emit(g,'salvo',{x:s.x,z:s.z,team:s.team,guns:s.guns});return true;
  }
  function launchTorpedoes(g,s=g.player,aim) {
    if(g.state!=='playing'||s.sunk||s.torpCooldown>0)return false;
    const target=aim||{x:s.aimX,z:s.aimZ};const angle=Math.atan2(target.x-s.x,target.z-s.z);
    for(let j=-1;j<=1;j++)g.torpedoes.push({id:g.nextId++,x:s.x+Math.sin(angle)*(s.radius+2),z:s.z+Math.cos(angle)*(s.radius+2),yaw:angle+j*.095,age:0,team:s.team,damage:s.team?42:s.torpDamage,speed:s.team?15:22});
    s.torpCooldown=s.torpReload||17;emit(g,'torpedo',{team:s.team});return true;
  }
  function ability(g,key) {
    const p=g.player;if(g.state!=='playing'||p.sunk)return false;
    if(key==='repair'&&p.repairs>0&&p.repairCooldown<=0&&p.hp<p.maxHp){p.repairs--;p.repairTime=5;p.repairCooldown=12;emit(g,'repair');return true;}
    if(key==='smoke'&&p.smokeCooldown<=0){g.smokes.push({x:p.x,z:p.z,age:0,life:10,r:14});p.smokeCooldown=24;emit(g,'smoke');return true;}
    if(key==='boost'&&p.boostCooldown<=0){p.boostTime=4;p.boostCooldown=15;emit(g,'boost');return true;}
    return false;
  }
  function damage(g,s,amount,angle,torpedo=false) {
    if(s.sunk)return;
    const bow=Math.abs(Math.cos(angle-s.yaw));
    const armor=torpedo?1:(bow>.72?.65:1);
    const dealt=amount*armor;s.hp=Math.max(0,s.hp-dealt);s.flash=.16;
    if(!s.team)g.damageTaken+=dealt;else{g.hits++;g.score+=Math.round(dealt*2);}
    emit(g,'hit',{x:s.x,z:s.z,amount:Math.round(dealt),team:s.team,torpedo});
    if(s.hp<=0)sink(g,s);
  }
  function sink(g,s) {
    if(s.sunk)return;s.hp=0;s.sunk=true;s.speed=0;emit(g,'sink',{x:s.x,z:s.z,team:s.team,boss:s.kind==='boss'});
    if(s.team){g.kills++;g.score+=s.kind==='boss'?2500:s.kind==='cruiser'?800:400;g.pickups.push({x:s.x,z:s.z,age:0});}
    else{g.state='lost';g.shells=[];g.torpedoes=[];}
  }
  function enemyAI(g,e,dt) {
    const p=g.player,d=distance(e,p);e.aiClock+=dt;
    const hidden=g.smokes.some(sm=>distance(p,sm)<sm.r&&sm.age<sm.life);
    const chase=Math.atan2(p.x-e.x,p.z-e.z);
    let desired=chase+(d<22?Math.PI*.65:d<49?Math.PI*.4:0)*(e.id%2?1:-1);
    let vx=Math.sin(desired),vz=Math.cos(desired);
    for(const i of g.islands){const dx=e.x-i.x,dz=e.z-i.z,di=Math.hypot(dx,dz),look={x:e.x+Math.sin(e.yaw)*14,z:e.z+Math.cos(e.yaw)*14};
      if(di<i.r+22){const weight=(i.r+22-di)/11;vx+=dx/(di||1)*weight;vz+=dz/(di||1)*weight;}
      if(distance(look,i)<i.r+e.radius+3){vx+=(e.z-i.z)/(di||1)*1.5;vz-=(e.x-i.x)/(di||1)*1.5;}}
    if(Math.abs(e.x)>94)vx-=Math.sign(e.x)*2;if(Math.abs(e.z)>94)vz-=Math.sign(e.z)*2;
    desired=Math.atan2(vx,vz);const steer=clamp(wrap(desired-e.yaw)*2,-1,1);
    moveShip(g,e,dt,steer,d<26?.55:.85);
    const lead=d/52;const target={x:p.x+Math.sin(p.yaw)*p.speed*lead*.85,z:p.z+Math.cos(p.yaw)*p.speed*lead*.85};
    e.aimX=target.x;e.aimZ=target.z;e.turretYaw=Math.atan2(target.x-e.x,target.z-e.z);
    if(!hidden&&d<e.range&&!blocked(g,e,p,1))fire(g,e,target);
    if(e.kind==='boss'&&!hidden&&d<82&&e.torpCooldown<=0&&!blocked(g,e,p,2))launchTorpedoes(g,e,target);
  }
  function segmentDistance(a,b,p) {const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz,t=den?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/den,0,1):0;return Math.hypot(a.x+t*dx-p.x,a.z+t*dz-p.z);}
  function update(g,dt,input={}) {
    if(g.state!=='playing')return;
    dt=clamp(dt,0,.05);g.time+=dt;setSpeeds(g);const p=g.player;
    for(const s of [p,...g.enemies]){s.age+=dt;for(const key of ['cooldown','torpCooldown','repairCooldown','smokeCooldown','boostCooldown','boostTime','flash','obstacleHits'])s[key]=Math.max(0,s[key]-dt);}
    if(p.repairTime>0){p.repairTime=Math.max(0,p.repairTime-dt);p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.075*p.repairPower*dt);}
    if(Number.isFinite(input.aimX)&&Number.isFinite(input.aimZ)){p.aimX=input.aimX;p.aimZ=input.aimZ;}
    p.turretYaw=Math.atan2(p.aimX-p.x,p.aimZ-p.z);
    let steer=input.steer||0;
    if(Number.isFinite(input.heading))steer=clamp(wrap(input.heading-p.yaw)*2.5,-1,1);
    moveShip(g,p,dt,steer,input.throttle||0);
    if(input.fire)fire(g);if(input.torpedo)launchTorpedoes(g);
    for(const e of g.enemies)if(!e.sunk)enemyAI(g,e,dt);
    const living=[p,...g.enemies.filter(e=>!e.sunk)];
    for(let i=0;i<living.length;i++)for(let j=i+1;j<living.length;j++){const a=living[i],b=living[j],d=distance(a,b),r=a.radius+b.radius;if(d<r){const nx=d>.001?(a.x-b.x)/d:1,nz=d>.001?(a.z-b.z)/d:0,push=(r-d)/2;a.x+=nx*push;a.z+=nz*push;b.x-=nx*push;b.z-=nz*push;a.speed*=.97;b.speed*=.97;}}
    const shells=[];
    for(const sh of g.shells){sh.age+=dt;if(sh.age<0){shells.push(sh);continue;}const t=clamp(sh.age/sh.flight,0,1);sh.x=sh.startX+(sh.endX-sh.startX)*t;sh.z=sh.startZ+(sh.endZ-sh.startZ)*t;
      if(t>=1){let hit=false;const onLand=g.islands.some(i=>distance(i,sh)<i.r);
        if(!onLand)for(const s of living){if(s.team===sh.team||s.sunk)continue;const a=sh.x-s.x,b=sh.z-s.z,side=a*Math.cos(s.yaw)-b*Math.sin(s.yaw),along=a*Math.sin(s.yaw)+b*Math.cos(s.yaw);
          if(Math.abs(side)<s.width+2&&Math.abs(along)<s.length*.5+1.5){damage(g,s,sh.damage,Math.atan2(sh.endX-sh.startX,sh.endZ-sh.startZ));hit=true;break;}}
        emit(g,'splash',{x:sh.x,z:sh.z,hit,land:onLand});
      }else shells.push(sh);
    }g.shells=shells;
    const torps=[];
    for(const t of g.torpedoes){const prev={x:t.x,z:t.z};t.age+=dt;t.x+=Math.sin(t.yaw)*t.speed*dt;t.z+=Math.cos(t.yaw)*t.speed*dt;
      let dead=t.age>6.2||Math.abs(t.x)>LIMIT||Math.abs(t.z)>LIMIT;
      if(!dead&&blocked(g,prev,t,.6)){dead=true;emit(g,'splash',{x:t.x,z:t.z,hit:true});}
      if(!dead)for(const s of living)if(s.team!==t.team&&!s.sunk&&segmentDistance(prev,t,s)<s.radius+1.2){damage(g,s,t.damage,t.yaw,true);dead=true;emit(g,'splash',{x:t.x,z:t.z,hit:true});break;}
      if(!dead)torps.push(t);
    }g.torpedoes=torps;
    for(const sm of g.smokes)sm.age+=dt;g.smokes=g.smokes.filter(sm=>sm.age<sm.life);
    g.pickups=g.pickups.filter(pk=>{pk.age+=dt;if(distance(pk,p)<8){p.hp=Math.min(p.maxHp,p.hp+45);g.score+=100;emit(g,'supply');return false;}return pk.age<70;});
    if(p.hp<=0){sink(g,p);return;}
    if(g.enemies.every(e=>e.sunk)){g.missionDelay+=dt;if(g.missionDelay>2.5){if(g.mission===2){g.state='won';g.score+=Math.round(p.hp*5+Math.max(0,1200-g.time*2));emit(g,'victory');}else{g.state='upgrade';g.options=UPGRADES.slice().sort(()=>g.random()-.5).slice(0,3);emit(g,'upgrade');}}}
  }
  function selectUpgrade(g,id){if(g.state!=='upgrade'||!g.options.some(o=>o.id===id))return false;const p=g.player;
    if(id==='guns')p.reload*=.78;if(id==='armor'){p.maxHp+=100;p.hp=Math.min(p.maxHp,p.hp+140);}
    if(id==='engine'){setSpeeds(g);p.speedMax*=1.2;p.turn*=1.15;}if(id==='torpedo'){p.torpDamage*=1.35;p.torpReload*=.75;}
    if(id==='repair'){p.repairs+=2;p.repairPower+=.35;}if(id==='shells')p.damage*=1.25;
    startMission(g,g.mission+1);return true;
  }
  return {CLASSES,ISLANDS,MISSIONS,UPGRADES,LIMIT,TAU,clamp,wrap,distance,rng,createGame,update,fire,launchTorpedoes,ability,selectUpgrade,blocked,segmentDistance};
});
