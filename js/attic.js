import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const surface=(color,roughness=.85,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function mesh(root,geometry,material,position) {
  const object=new THREE.Mesh(geometry,material);
  object.position.set(...position);object.castShadow=object.receiveShadow=true;
  root.add(object);return object;
}
function box(root,material,position,size) {
  return mesh(root,new RoundedBoxGeometry(...size,3,Math.min(.055,...size.map(s=>s/4))),material,position);
}
function tube(root,material,points,radius=.035) {
  return mesh(root,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),30,radius,8,false),material,[0,0,0]);
}

function planksTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d');
  for(let col=0;col<8;col++) {
    const x=col*64,shade=(col*17)%25;
    ctx.fillStyle=`rgb(${124+shade},${83+shade},${49+shade})`;ctx.fillRect(x,0,64,512);
    for(let line=0;line<40;line++) {
      const offset=(line*37+col*11)%61;
      ctx.strokeStyle=line%3?'rgba(39,23,13,.12)':'rgba(229,190,128,.15)';
      ctx.lineWidth=line%4?1:2;ctx.beginPath();ctx.moveTo(x+offset,0);
      ctx.bezierCurveTo(x+offset+Math.sin(line)*5,150,x+offset-3,360,x+offset,512);ctx.stroke();
    }
    ctx.fillStyle='rgba(24,16,12,.55)';ctx.fillRect(x,0,2,512);
    for(const y of [(col%2)*160,320+(col%2)*160]) {
      ctx.fillRect(x,y,64,2);
      for(const nailX of [8,55]){ctx.beginPath();ctx.arc(x+nailX,y+6,1.3,0,Math.PI*2);ctx.fill();}
    }
    ctx.strokeStyle='rgba(51,29,17,.28)';
    for(let ring=0;ring<4;ring++) {
      ctx.beginPath();ctx.ellipse(x+29,75+col*41,2+ring*1.5,4+ring*3,.1,0,Math.PI*2);ctx.stroke();
    }
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,3);
  return texture;
}

function sunsetTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'),sky=ctx.createLinearGradient(0,0,0,512);
  sky.addColorStop(0,'#718097');sky.addColorStop(.55,'#efad79');sky.addColorStop(1,'#d97d54');
  ctx.fillStyle=sky;ctx.fillRect(0,0,512,512);
  ctx.fillStyle='#ffe0a0';ctx.beginPath();ctx.arc(330,275,36,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#695967';ctx.beginPath();ctx.moveTo(0,420);
  ctx.bezierCurveTo(140,290,240,475,512,365);ctx.lineTo(512,512);ctx.lineTo(0,512);ctx.fill();
  ctx.fillStyle='#413e4b';
  for(let i=0;i<8;i++) {
    const x=i*78-25,y=410+(i%3)*15;
    ctx.fillRect(x,y,65,100);ctx.beginPath();ctx.moveTo(x-8,y);ctx.lineTo(x+32,y-34);ctx.lineTo(x+73,y);ctx.fill();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function patternedRug(root) {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#6c3b36';ctx.fillRect(0,0,256,512);
  for(const [inset,color] of [[9,'#b49363'],[15,'#453b32'],[21,'#a46f55'],[28,'#b49a71']]) {
    ctx.strokeStyle=color;ctx.lineWidth=4;ctx.strokeRect(inset,inset,256-inset*2,512-inset*2);
  }
  for(let z=0;z<6;z++)for(let x=0;x<3;x++) {
    const cx=56+x*72,cy=70+z*73;ctx.fillStyle=(x+z)%2?'#b2946b':'#8e715d';
    ctx.beginPath();ctx.moveTo(cx,cy-25);ctx.lineTo(cx+21,cy);ctx.lineTo(cx,cy+25);ctx.lineTo(cx-21,cy);ctx.fill();
    ctx.fillStyle='#58473b';ctx.fillRect(cx-5,cy-5,10,10);
  }
  for(let i=0;i<3000;i++) {
    ctx.fillStyle=i%2?'rgba(214,198,174,.07)':'rgba(36,26,23,.06)';ctx.fillRect(i*73%256,i*127%512,2,1);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const rug=mesh(root,new THREE.PlaneGeometry(3.6,7),new THREE.MeshStandardMaterial({map:texture,roughness:1}),[0,.017,2.2]);
  rug.rotation.x=-Math.PI/2;rug.castShadow=false;
}

export function createAtticRoom(root,colliders,data) {
  const [width,depth]=data.bounds,half=width/2,eave=2.55,ridge=6.4;
  const slope=(ridge-eave)/half,angle=Math.atan(slope),roofY=x=>ridge-Math.abs(x)*slope;
  const planks=planksTexture(),floorMaterial=new THREE.MeshStandardMaterial({map:planks,bumpMap:planks,bumpScale:.025,roughness:.9});
  const floor=mesh(root,new THREE.PlaneGeometry(width,depth),floorMaterial,[0,0,0]);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
  const roofMaterial=new THREE.MeshStandardMaterial({color:0xc2a17d,map:planks,roughness:.94});
  const wallMaterial=surface(0x84644d),beamMaterial=surface(0x422a1e),brass=surface(0xb29159,.4,.55);
  const solid=object=>{colliders.push(new THREE.Box3().setFromObject(object));return object;};
  for(const side of [-1,1])solid(box(root,wallMaterial,[side*half,eave/2,0],[.2,eave,depth]));
  for(const z of [-depth/2,depth/2]) {
    const shape=new THREE.Shape();shape.moveTo(-half,0);shape.lineTo(half,0);shape.lineTo(half,eave);
    shape.lineTo(0,ridge);shape.lineTo(-half,eave);shape.closePath();
    if(z<0) {
      const hole=new THREE.Path();hole.absarc(0,4.5,1.15,0,Math.PI*2,true);shape.holes.push(hole);
    }
    const wall=solid(mesh(root,new THREE.ExtrudeGeometry(shape,{depth:.2,bevelEnabled:false,curveSegments:48}),wallMaterial,[0,0,z-.1]));
    wall.name='attic-gable';
  }
  const roofPart=(x1,x2,z1,z2)=>{
    const x=(x1+x2)/2;
    const part=box(root,roofMaterial,[x,roofY(x),(z1+z2)/2],[(x2-x1)*Math.sqrt(1+slope*slope),.16,z2-z1]);
    part.rotation.z=x<0?angle:-angle;part.name='attic-sloping-roof';return part;
  };
  // La lucarne remplace vraiment une partie du toit, pas une plaque sur un plafond.
  roofPart(-half,-6,-depth/2,depth/2);roofPart(-3.6,0,-depth/2,depth/2);
  roofPart(-6,-3.6,-depth/2,-4.5);roofPart(-6,-3.6,-1.5,depth/2);
  roofPart(0,half,-depth/2,depth/2);
  const vista=new THREE.MeshBasicMaterial({map:sunsetTexture(),side:THREE.DoubleSide});
  const roundWindow=mesh(root,new THREE.CircleGeometry(1.15,64),vista,[0,4.5,-depth/2-.015]);roundWindow.castShadow=false;
  mesh(root,new THREE.TorusGeometry(1.19,.075,12,64),beamMaterial,[0,4.5,-depth/2+.035]);
  box(root,beamMaterial,[0,4.5,-depth/2+.09],[.055,2.24,.08]);
  box(root,beamMaterial,[0,4.5,-depth/2+.09],[2.24,.055,.08]);
  const skylight=new THREE.Group();skylight.position.set(-4.8,roofY(-4.8)-.025,-3);skylight.rotation.z=angle;root.add(skylight);
  const glass=box(skylight,vista,[0,0,0],[2.4*Math.sqrt(1+slope*slope),.025,3]);glass.castShadow=false;
  for(const x of [-1.28,1.28])box(skylight,beamMaterial,[x,-.06,0],[.09,.14,3.12]);
  for(const z of [-1.5,1.5])box(skylight,beamMaterial,[0,-.06,z],[2.65,.14,.09]);
  box(skylight,beamMaterial,[0,-.06,0],[.06,.14,3]);
  for(const z of [-8,-4,0,4,8]) {
    for(const side of [-1,1]) {
      const x=side*half/2,rafter=box(root,beamMaterial,[x,roofY(x)-.18,z],[half*Math.sqrt(1+slope*slope),.22,.24]);
      rafter.rotation.z=-side*angle;rafter.name='attic-rafter';
      solid(box(root,beamMaterial,[side*(half-.18),1.23,z],[.22,2.46,.26]));
    }
    const collarHalf=(ridge-4.12)/slope;
    box(root,beamMaterial,[0,4.12,z],[collarHalf*2,.18,.2]);
    box(root,beamMaterial,[0,5.13,z],[.18,2.05,.18]);
  }
  box(root,beamMaterial,[0,ridge-.16,0],[.26,.3,depth]);
  // Lampe ancienne à filament, loin de l'éclairage bleu de la serre.
  const lamp=new THREE.Group();lamp.position.set(0,3.4,4);root.add(lamp);
  tube(lamp,beamMaterial,[[0,0,0],[0,.8,0],[0,1.8,0]],.016);
  const bulb=mesh(lamp,new THREE.SphereGeometry(.13,20,16),new THREE.MeshBasicMaterial({color:0xffc784}),[0,0,0]);bulb.scale.y=1.35;bulb.castShadow=false;
  for(const y of [-.21,.22]) {
    const ring=mesh(lamp,new THREE.TorusGeometry(.23,.014,8,28),brass,[0,y,0]);ring.rotation.x=Math.PI/2;
  }
  for(let i=0;i<6;i++) {
    const a=i/6*Math.PI*2,x=Math.cos(a)*.23,z=Math.sin(a)*.23;
    tube(lamp,brass,[[x,-.21,z],[x,.03,z],[x*.75,.3,z*.75]],.012);
  }
  const light=new THREE.PointLight(0xffb568,13,10,2);light.position.set(0,3.35,4);root.add(light);
  patternedRug(root);
  root.userData.architecture={kind:'attic',ridgeHeight:ridge,eaveHeight:eave,dormers:2,rafterFrames:5};
}

export function addAtticAntiques(root,colliders) {
  const wood=surface(0x785233,.72),metal=surface(0x463a30,.38,.6);
  const chair=new THREE.Group();chair.position.set(5,0,-.4);chair.rotation.y=-.4;root.add(chair);
  for(const x of [-.43,.43]) {
    tube(chair,wood,[[x,.16,-.78],[x,.05,-.4],[x,.025,0],[x,.06,.45],[x,.2,.82]],.055);
    for(const z of [-.34,.36])tube(chair,wood,[[x,.06,z],[x*.8,.43,z],[x*.8,.79,z]],.037);
    tube(chair,wood,[[x,.6,-.42],[x,.82,-.2],[x,.82,.43]],.043);
  }
  for(let i=0;i<7;i++)box(chair,wood,[(i-3)*.113,.49,0],[.095,.08,.84]);
  for(let i=0;i<7;i++)tube(chair,wood,[[(i-3)*.11,.53,.35],[(i-3)*.11,1.02,.5],[(i-3)*.11,1.42,.58]],.021);
  tube(chair,wood,[[-.43,1.37,.58],[-.2,1.46,.59],[.2,1.46,.59],[.43,1.37,.58]],.057);
  colliders.push(new THREE.Box3().setFromObject(chair));
  const ladder=new THREE.Group();ladder.position.set(-9.3,0,-.6);ladder.rotation.x=-.16;root.add(ladder);
  for(const x of [-.4,.4])box(ladder,wood,[x,1.45,0],[.08,2.9,.09]);
  for(let i=0;i<8;i++)box(ladder,wood,[0,.25+i*.33,0],[.8,.07,.1]);
  colliders.push(new THREE.Box3().setFromObject(ladder));
  const wheel=new THREE.Group();wheel.position.set(8.85,.88,-9.45);wheel.rotation.y=-.18;root.add(wheel);
  mesh(wheel,new THREE.TorusGeometry(.84,.065,12,56),wood,[0,0,0]);
  mesh(wheel,new THREE.TorusGeometry(.91,.022,8,56),metal,[0,0,0]);
  const hub=mesh(wheel,new THREE.CylinderGeometry(.11,.11,.18,16),wood,[0,0,0]);hub.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++) {
    const a=i/12*Math.PI*2;tube(wheel,wood,[[0,0,0],[Math.cos(a)*.8,Math.sin(a)*.8,0]],.023);
  }
  colliders.push(new THREE.Box3().setFromObject(wheel));
  const covered=new THREE.Group();covered.position.set(-4.3,0,1.3);root.add(covered);
  box(covered,wood,[0,.39,0],[1.3,.78,.88]);
  const clothGeometry=new THREE.PlaneGeometry(1.85,1.5,20,18),p=clothGeometry.attributes.position;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getY(i),edge=Math.max(Math.abs(x)/.925,Math.abs(z)/.75);
    const y=.86-.74*Math.pow(edge,5)+.025*Math.sin(x*28+z*7);
    p.setXYZ(i,x,y,z);
  }
  clothGeometry.computeVertexNormals();
  mesh(covered,clothGeometry,new THREE.MeshStandardMaterial({color:0xc4b69e,roughness:1,side:THREE.DoubleSide}),[0,0,0]);
  colliders.push(new THREE.Box3().setFromObject(covered));
}
