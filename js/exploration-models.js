import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createPillow } from './models.js';

export function wornMaterial(kind,color) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#eee9e0';ctx.fillRect(0,0,128,128);
  for(let i=0;i<500;i++) {
    ctx.strokeStyle=i%3?'rgba(40,30,22,.07)':'rgba(255,255,255,.2)';
    const x=i*47%128,y=i*71%128;ctx.beginPath();ctx.moveTo(x,y);
    ctx.lineTo(x+(kind==='metal'?5:2),y+(kind==='cloth'?0:kind==='wood'?20:2));ctx.stroke();
  }
  if(kind==='cloth')for(let i=0;i<128;i+=3) {
    ctx.fillStyle='rgba(53,45,37,.1)';ctx.fillRect(i,0,1,128);ctx.fillRect(0,i,128,1);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(kind==='cloth'?3:1,kind==='cloth'?3:1);
  return new THREE.MeshPhysicalMaterial({color,map:texture,bumpMap:texture,bumpScale:kind==='cloth'?.008:.012,
    roughness:kind==='metal'?.38:kind==='leather'?.65:.9,metalness:kind==='metal'?.7:0,
    clearcoat:kind==='leather'?.3:0,sheen:kind==='cloth'?.7:0});
}
export function part(root,geometry,material,position=[0,0,0]) {
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);
  mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
}
export function roundBox(root,material,size,position) {
  return part(root,new RoundedBoxGeometry(...size,4,Math.min(.055,...size.map(n=>n/4))),material,position);
}
export function tube(root,material,points,radius=.025) {
  return part(root,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,radius,8,false),material);
}
export function drapedCover(width,depth,height,color) {
  const group=new THREE.Group(),geometry=new THREE.PlaneGeometry(width,depth,24,24),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),z=positions.getY(i),edge=Math.max(Math.abs(x)/(width/2),Math.abs(z)/(depth/2));
    positions.setXYZ(i,x,.025+(height-.025)*(1-Math.pow(edge,6))+.009*Math.sin(x*42+z*13),z);
  }
  geometry.computeVertexNormals();
  const fabric=wornMaterial('cloth',color);fabric.side=THREE.DoubleSide;
  part(group,geometry,fabric);
  return group;
}
export function cushionCover() {
  const group=drapedCover(.82,.82,.43,0x85685b);
  const pillow=createPillow(.73,.19,.69,wornMaterial('cloth',0xb99265));
  pillow.position.y=.49;group.add(pillow);return group;
}
export function toolCover() {
  const group=new THREE.Group(),paint=wornMaterial('metal',0x436e77),steel=wornMaterial('metal',0xb2b7b0);
  roundBox(group,paint,[.78,.065,.62],[0,.47,0]);
  for(const side of [-1,1]) {
    roundBox(group,paint,[.055,.46,.62],[side*.365,.24,0]);
    roundBox(group,paint,[.78,.46,.04],[0,.24,side*.29]);
    for(const x of [-.30,.30])part(group,new THREE.SphereGeometry(.022,10,8),steel,[x,.37,side*.315]);
  }
  tube(group,steel,[[-.15,.52,0],[-.15,.61,0],[.15,.61,0],[.15,.52,0]],.024);
  roundBox(group,steel,[.23,.07,.018],[0,.32,.325]);return group;
}
export function suitcase(width,color) {
  const root=new THREE.Group(),body=new THREE.Group(),lid=new THREE.Group();root.add(body,lid);
  const leather=wornMaterial('leather',color),brass=wornMaterial('metal',0xb09862),lining=wornMaterial('cloth',0x59493e);
  roundBox(body,lining,[width,.07,.68],[0,.06,0]);
  for(const side of [-1,1]) {
    roundBox(body,leather,[.07,.33,.68],[side*(width/2-.035),.2,0]);
    roundBox(body,leather,[width,.33,.07],[0,.2,side*.305]);
    for(const x of [-width*.28,width*.28])roundBox(body,brass,[.075,.12,.027],[x,.27,side*.345]);
  }
  const folded=createPillow(width*.5,.09,.38,lining);folded.position.set(0,.13,0);body.add(folded);
  lid.position.set(0,.365,-.34);
  roundBox(lid,leather,[width,.22,.68],[0,.11,.34]);
  for(const x of [-width*.28,width*.28])roundBox(lid,brass,[.055,.24,.7],[x,.11,.34]);
  tube(body,brass,[[-.15,.28,.36],[-.15,.4,.4],[.15,.4,.4],[.15,.28,.36]],.021);
  for(let i=0;i<12;i++)part(body,new THREE.SphereGeometry(.012,8,6),brass,[(i-5.5)*width/14,.33,.344]);
  return {root,body,lid};
}
export function leafCurtain() {
  const root=new THREE.Group(),fronds=[];
  for(let i=0;i<6;i++) {
    const a=i/6*Math.PI*2,frond=new THREE.Group();root.add(frond);
    const leafMaterial=new THREE.MeshPhysicalMaterial({color:[0x315f35,0x417747,0x527d39][i%3],roughness:.56,clearcoat:.3,side:THREE.DoubleSide});
    tube(frond,wornMaterial('wood',0x355932),[[0,.015,0],[Math.cos(a)*.17,.38,Math.sin(a)*.17],[Math.cos(a)*.3,.52,Math.sin(a)*.3]],.012);
    for(let j=0;j<5;j++) {
      const leaf=part(frond,new THREE.SphereGeometry(1,18,12),leafMaterial,[Math.cos(a)*(.06+j*.055),.2+j*.065,Math.sin(a)*(.06+j*.055)]);
      leaf.scale.set(.27-j*.015,.022,.115);leaf.rotation.y=-a;leaf.rotation.z=(i%2?1:-1)*.23;
    }
    fronds.push({object:frond,x:Math.cos(a),z:Math.sin(a)});
  }
  return {root,fronds};
}
export function lantern() {
  const root=new THREE.Group(),metal=wornMaterial('metal',0x765d3c);
  part(root,new THREE.CylinderGeometry(.22,.25,.07,28),metal,[0,.035,0]);
  tube(root,metal,[[0,.06,0],[0,1.3,0],[.14,1.76,0],[.32,1.62,0]],.028);
  const cage=new THREE.Group();cage.position.set(.32,1.35,0);root.add(cage);
  for(const y of [-.2,.2])part(cage,new THREE.CylinderGeometry(.17,.18,.055,24),metal,[0,y,0]);
  for(let i=0;i<6;i++) {
    const a=i/6*Math.PI*2;tube(cage,metal,[[Math.cos(a)*.15,-.2,Math.sin(a)*.15],[Math.cos(a)*.15,.2,Math.sin(a)*.15]],.012);
  }
  const bulbMaterial=new THREE.MeshStandardMaterial({color:0xffd99b,emissive:0xffb45c,emissiveIntensity:2.2,roughness:.2});
  const bulb=part(cage,new THREE.SphereGeometry(.08,20,16),bulbMaterial);bulb.scale.y=1.5;bulb.castShadow=false;
  const glass=part(cage,new THREE.CylinderGeometry(.145,.145,.38,24,1,true),new THREE.MeshPhysicalMaterial({color:0xe2e8d7,transparent:true,opacity:.15,roughness:.12,clearcoat:1,depthWrite:false,side:THREE.DoubleSide}));
  glass.userData.ignoreAim=true;glass.castShadow=false;
  const light=new THREE.PointLight(0xffbe77,15,7,2);light.position.set(.32,1.35,0);
  light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.normalBias=.03;root.add(light);
  return {root,bulbMaterial,light};
}
