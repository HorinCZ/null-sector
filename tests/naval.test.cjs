const assert = require('node:assert/strict');
const N = require('../naval-core.js');
let passed = 0;
function test(name, fn) {fn();passed++;console.log('PASS', name);}
function step(g,seconds,input={}) {for(let t=0;t<seconds;t+=1/60)N.update(g,1/60,input);}
function isolated() {const g=N.createGame('cruiser',91);g.islands=[];g.enemies=g.enemies.slice(0,1);const e=g.enemies[0];e.x=0;e.z=20;e.speedMax=.001;e.turn=0;e.cooldown=999;e.torpCooldown=999;g.player.x=0;g.player.z=-20;g.player.yaw=0;return g;}
test('inertia, rudder, reverse and bounded timestep',()=>{const g=isolated(),p=g.player;step(g,2,{throttle:1,steer:1});assert(p.speed>8);assert(p.yaw>.5);assert(p.x>1);const speed=p.speed;N.update(g,10,{});assert(p.speed>speed*.8);step(g,6,{throttle:-.35});assert(p.speed<0);assert(Number.isFinite(p.z));});
test('salvos take time to arrive, damage a hull and enforce reload',()=>{const g=isolated(),e=g.enemies[0];e.maxHp=e.hp=500;g.player.aimX=e.x;g.player.aimZ=e.z;assert(N.fire(g));assert.equal(g.shells.length,5);assert(!N.fire(g));assert.equal(e.hp,500);step(g,.5);assert.equal(e.hp,500);step(g,1);assert(e.hp<500);assert(g.hits>0);assert.equal(g.shots,5);step(g,2);assert(N.fire(g));});
test('bow armor reduces shell damage compared with broadside',()=>{const a=isolated(),b=isolated();for(const g of [a,b]){g.enemies[0].hp=500;g.enemies[0].maxHp=500;g.player.aimX=0;g.player.aimZ=20;}b.enemies[0].yaw=Math.PI/2;N.fire(a);N.fire(b);step(a,2);step(b,2);assert(a.enemies[0].hp>b.enemies[0].hp);});
test('three torpedoes travel, hit and cannot shoot through islands',()=>{const g=isolated();g.player.aimX=0;g.player.aimZ=20;assert(N.launchTorpedoes(g));assert.equal(g.torpedoes.length,3);assert(!N.launchTorpedoes(g));step(g,2.5);assert(g.enemies[0].hp<85);const blocked=isolated();blocked.islands=[{x:0,z:0,r:8}];blocked.player.aimX=0;blocked.player.aimZ=20;N.launchTorpedoes(blocked);step(blocked,3);assert.equal(blocked.enemies[0].hp,85);assert.equal(blocked.torpedoes.length,0);});
test('repair charges, full-hull rejection, smoke protection and boost',()=>{const g=isolated(),p=g.player;assert(!N.ability(g,'repair'));p.hp=100;assert(N.ability(g,'repair'));assert(!N.ability(g,'repair'));assert.equal(p.repairs,2);assert(N.ability(g,'smoke'));assert(!N.ability(g,'smoke'));g.enemies[0].cooldown=0;step(g,2);assert.equal(g.enemies[0].shotCount,0);assert(p.hp>100);assert(N.ability(g,'boost'));step(g,2,{throttle:1});assert(p.speed>13);});
test('grounding pushes the hull outside land and does bounded damage',()=>{const g=isolated();g.islands=[{x:0,z:-15,r:6}];const before=g.player.hp;step(g,.1,{throttle:1});assert(N.distance(g.player,g.islands[0])>=g.islands[0].r+g.player.radius-.001);assert(g.player.hp>=before-5);});
test('win / loss states freeze combat; restart creates clean state',()=>{const g=isolated();g.player.hp=0;N.update(g,.016,{});assert.equal(g.state,'lost');const t=g.time;step(g,5,{fire:true});assert.equal(g.time,t);assert(!N.fire(g));assert(!N.ability(g,'repair'));assert.equal(N.createGame('cruiser',91).player.hp,360);});
// An autopilot uses the same public inputs and weapons as a person, including
// predictive aiming, avoidance and consumables. It never changes combat stats.
function campaign(classId,seed){const g=N.createGame(classId,seed);let upgrades=0;
  for(let frame=0;frame<60*600;frame++){
    if(g.state==='won'||g.state==='lost')break;
    if(g.state==='upgrade'){assert(g.options.length===3);const pick=g.options.find(o=>o.id==='shells')||g.options.find(o=>o.id==='guns')||g.options[0];assert(N.selectUpgrade(g,pick.id));upgrades++;continue;}
    const p=g.player,targets=g.enemies.filter(e=>!e.sunk).sort((a,b)=>N.distance(a,p)-N.distance(b,p)),e=targets[0];
    if(!e){N.update(g,1/60,{});continue;}const dist=N.distance(e,p),lead=dist/52,aim={x:e.x+Math.sin(e.yaw)*e.speed*lead,z:e.z+Math.cos(e.yaw)*e.speed*lead};
    let angle=Math.atan2(e.x-p.x,e.z-p.z)+(dist<45?1.15:0),vx=Math.sin(angle),vz=Math.cos(angle);
    for(const i of g.islands){const d=N.distance(p,i);if(d<i.r+22){vx+=(p.x-i.x)/d*(i.r+22-d)/8;vz+=(p.z-i.z)/d*(i.r+22-d)/8;}}
    if(Math.abs(p.x)>92)vx-=Math.sign(p.x)*2;if(Math.abs(p.z)>92)vz-=Math.sign(p.z)*2;
    if(p.hp<p.maxHp*.7)N.ability(g,'repair');if(p.hp<p.maxHp*.5)N.ability(g,'smoke');
    const clear=!N.blocked(g,p,e,1);N.update(g,1/60,{throttle:dist<38?.65:1,heading:Math.atan2(vx,vz),aimX:aim.x,aimZ:aim.z,fire:dist<p.range&&clear,torpedo:dist<70&&clear});
    assert(Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isFinite(p.hp));
    assert(g.shells.length<120&&g.torpedoes.length<50);g.events.length=0;
  }
  return {classId,seed,state:g.state,kills:g.kills,time:Math.round(g.time),hp:Math.round(g.player.hp),upgrades};
}
test('all three classes can finish all three operations with normal rules',()=>{for(const classId of Object.keys(N.CLASSES)){const result=campaign(classId,72);console.log('  campaign',result);assert.equal(result.state,'won');assert.equal(result.kills,11);assert.equal(result.upgrades,2);}});
console.log(`${passed} naval checks passed.`);
