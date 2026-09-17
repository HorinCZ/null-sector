/* Pure simulation primitives shared by the browser and the Node test suite. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const WEAPONS=[
    {name:'VX-9 / PULZNÍ PUŠKA',short:'PULZ',cap:28,damage:19,interval:.105,reload:1.45,pellets:1,spread:.008,range:85,color:'#a5ffcf'},
    {name:'BR-8 / ROZPTYLOVAČ',short:'BROKY',cap:8,damage:12,interval:.66,reload:1.85,pellets:9,spread:.065,range:32,color:'#ffae62'},
    {name:'R-01 / RAILGUN',short:'RAIL',cap:5,damage:95,interval:.88,reload:2.05,pellets:1,spread:.001,range:100,color:'#91cfff'}
  ];
  const TYPES={
    runner:{name:'LOVEC',hp:48,speed:5.3,radius:.65,score:100,color:'#ff633c'},
    shooter:{name:'STŘELEC',hp:78,speed:3.1,radius:.75,score:160,color:'#ffbc5b'},
    heavy:{name:'BAŠTA',hp:250,speed:2,radius:1.1,score:400,color:'#dd80ff'},
    boss:{name:'STRÁŽCE',hp:1700,speed:2.5,radius:1.65,score:3000,color:'#ff6135'}
  };
  const UPGRADES=[
    {id:'damage',icon:'↗',tag:'BALISTIKA',title:'Přetlak',desc:'+20 % poškození všech zbraní.'},
    {id:'fire',icon:'≋',tag:'MECHANIKA',title:'Rychlý cyklus',desc:'+18 % rychlost střelby a přebíjení.'},
    {id:'health',icon:'✚',tag:'BIOSYSTÉM',title:'Druhá kůže',desc:'+30 maximální integrity a úplné vyléčení.'},
    {id:'shield',icon:'◇',tag:'OBRANA',title:'Kapacitní štít',desc:'+30 maximálního štítu. Rychlejší regenerace.'},
    {id:'dash',icon:'»',tag:'MOBILITA',title:'Fázový pohon',desc:'Úskok se obnovuje o 30 % rychleji. +8 % rychlost pohybu.'},
    {id:'leech',icon:'◈',tag:'RECYKLACE',title:'Sběrač života',desc:'Každá eliminace obnoví 5 bodů integrity.'},
    {id:'pulse',icon:'⊙',tag:'ENERGIE',title:'Rázová vlna',desc:'+40 % síla impulzu a +35 % jeho nabíjení.'},
    {id:'mag',icon:'▥',tag:'ZÁSOBOVÁNÍ',title:'Velký zásobník',desc:'+35 % kapacity všech zásobníků. Okamžité doplnění.'}
  ];
  const DIFFICULTIES={easy:{damage:.65,hp:.8,speed:.85,score:.75},normal:{damage:1,hp:1,speed:1,score:1},hard:{damage:1.35,hp:1.2,speed:1.12,score:1.4}};
  function createPlayer(){return {x:0,z:-21,y:0,vy:0,yaw:0,pitch:0,hp:100,maxHp:100,shield:60,maxShield:60,weapon:0,ammo:WEAPONS.map(w=>w.cap),reload:0,shot:0,dash:2,dashTime:0,dashX:0,dashZ:0,dashCooldown:2.6,pulse:100,pulsePower:1,pulseRate:1,damage:1,fireRate:1,mag:1,speed:1,leech:0,shieldRegen:1,hurtAgo:99,invulnerable:0};}
  function capacity(p,i){return Math.ceil(WEAPONS[i].cap*p.mag);}
  function applyUpgrade(p,id){switch(id){case'damage':p.damage+=.2;break;case'fire':p.fireRate+=.18;break;case'health':p.maxHp+=30;p.hp=p.maxHp;break;case'shield':p.maxShield+=30;p.shield=p.maxShield;p.shieldRegen+=.25;break;case'dash':p.dashCooldown=Math.max(.7,p.dashCooldown*.7);p.speed+=.08;break;case'leech':p.leech+=5;break;case'pulse':p.pulsePower+=.4;p.pulseRate+=.35;break;case'mag':p.mag+=.35;p.ammo=WEAPONS.map((_,i)=>capacity(p,i));break;default:throw Error('Unknown upgrade: '+id);}}
  function hurt(p,amount){if(p.invulnerable>0||p.dashTime>0||amount<=0)return 0;const absorbed=Math.min(p.shield,amount);p.shield-=absorbed;p.hp=Math.max(0,p.hp-(amount-absorbed));p.hurtAgo=0;return amount;}
  function circleBox(x,z,r,b){const cx=clamp(x,b.x-b.w/2,b.x+b.w/2),cz=clamp(z,b.z-b.d/2,b.z+b.d/2);return (x-cx)**2+(z-cz)**2<r*r;}
  function canStand(x,z,r,boxes,y=0){return Math.abs(x)<30-r&&Math.abs(z)<30-r&&!boxes.some(b=>b.h>y+.2&&circleBox(x,z,r,b));}
  function move(body,dx,dz,r,boxes){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));for(let i=0;i<steps;i++){if(canStand(body.x+dx/steps,body.z,r,boxes,body.y||0))body.x+=dx/steps;if(canStand(body.x,body.z+dz/steps,r,boxes,body.y||0))body.z+=dz/steps;}}
  // Slab ray/AABB intersection. Returns distance, or Infinity for a miss.
  function rayBox(o,d,b,max=Infinity){let lo=0,hi=max;for(const [key,min,maxVal] of [['x',b.x-b.w/2,b.x+b.w/2],['y',0,b.h],['z',b.z-b.d/2,b.z+b.d/2]]){if(Math.abs(d[key])<1e-8){if(o[key]<min||o[key]>maxVal)return Infinity;}else{let a=(min-o[key])/d[key],c=(maxVal-o[key])/d[key];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return Infinity;}}return hi<0?Infinity:lo;}
  function raySphere(o,d,c,r){const x=o.x-c.x,y=o.y-c.y,z=o.z-c.z,b=x*d.x+y*d.y+z*d.z,h=b*b-(x*x+y*y+z*z-r*r);if(h<0)return Infinity;const near=-b-Math.sqrt(h),far=-b+Math.sqrt(h);return near>=0?near:far>=0?0:Infinity;}
  function wavePlan(wave,endless=false){let out=[];if(wave===6&&!endless)out.push('boss');let n=wave===6&&!endless?12:7+wave*3;for(let i=0;i<n;i++){if(wave>=3&&i%7===6)out.push('heavy');else if(wave>=2&&i%3===1)out.push('shooter');else out.push('runner');}return out;}
  class FlowField{
    constructor(boxes){this.size=31;this.cell=2;this.boxes=boxes;this.dist=new Int16Array(31*31);this.blocked=new Uint8Array(31*31);for(let z=0;z<31;z++)for(let x=0;x<31;x++)this.blocked[z*31+x]=canStand(x*2-30,z*2-30,.85,boxes)?0:1;}
    index(x,z){return clamp(Math.round((z+30)/2),0,30)*31+clamp(Math.round((x+30)/2),0,30);}
    update(x,z){this.dist.fill(-1);const start=this.index(x,z),q=[start];this.dist[start]=0;for(let p=0;p<q.length;p++){const i=q[p],ix=i%31,iz=Math.floor(i/31);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=ix+dx,nz=iz+dz;if(nx<0||nx>30||nz<0||nz>30)continue;const ni=nz*31+nx;if(!this.blocked[ni]&&this.dist[ni]<0){this.dist[ni]=this.dist[i]+1;q.push(ni);}}}}
    direction(x,z,tx,tz){const idx=this.index(x,z),ix=idx%31,iz=Math.floor(idx/31);let best=this.dist[idx]<0?32767:this.dist[idx],bx=tx,bz=tz;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=ix+dx,nz=iz+dz;if(nx<0||nx>30||nz<0||nz>30)continue;if(dx&&dz&&(this.blocked[iz*31+nx]||this.blocked[nz*31+ix]))continue;const ni=nz*31+nx;if(this.dist[ni]>=0&&this.dist[ni]<best){best=this.dist[ni];bx=nx*2-30;bz=nz*2-30;}}const d=Math.hypot(bx-x,bz-z)||1;return {x:(bx-x)/d,z:(bz-z)/d};}
  }
  const api={clamp,WEAPONS,TYPES,UPGRADES,DIFFICULTIES,createPlayer,capacity,applyUpgrade,hurt,circleBox,canStand,move,rayBox,raySphere,wavePlan,FlowField};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NS=api;
})(typeof globalThis!=='undefined'?globalThis:this);
