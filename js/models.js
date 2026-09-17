import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const surface=(color,roughness=.65,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function mesh(parent,geometry,material,position=V(0,0,0)) {
  const object=new THREE.Mesh(geometry,material);
  object.position.copy(position);
  object.castShadow=object.receiveShadow=true;
  parent.add(object);
  return object;
}
function tube(points,radius=.012,closed=false) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,closed),Math.max(16,points.length*5),radius,6,closed);
}

// Maillage rembourré : ventre, creux et petites rides plutôt qu'un simple pavé.
function upholstery(width,height,depth,seed=0) {
  const geometry=new RoundedBoxGeometry(width,height,depth,10,Math.min(width*.44,height*.44,depth*.26,.2));
  const p=geometry.attributes.position;
  for (let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const nx=x/(width/2),nz=z/(depth/2);
    const belly=(1-nx*nx)*(1-nz*nz)*height*.14;
    const edge=Math.pow(Math.min(1,Math.abs(nx)),5)+Math.pow(Math.min(1,Math.abs(nz)),5);
    const crease=Math.sin(x*32+seed)*Math.sin(z*21-seed)*.006*edge;
    p.setY(i,y+Math.sign(y)*belly+crease);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function piping(parent,width,depth,y,mat,offsetZ=0) {
  const r=Math.min(.14,depth*.16),w=width/2-r,d=depth/2-r;
  const points=[];
  [[w,d],[-w,d],[-w,-d],[w,-d]].forEach(([cx,cz],corner)=>{
    for(let i=0;i<6;i++) {
      const a=corner*Math.PI/2+i/5*Math.PI/2;
      points.push(V(cx+Math.cos(a)*r,y,cz+Math.sin(a)*r+offsetZ));
    }
  });
  mesh(parent,tube(points,.005,true),mat);
}

export function createDetailedSofa(width,depth,fabric) {
  const group=new THREE.Group();
  const seam=surface(fabric.map?0x9b5849:new THREE.Color(fabric.color).multiplyScalar(.74),.95);
  mesh(group,upholstery(width,.42,depth),fabric,V(0,.4,0));
  // Accoudoirs sculptés et trois dossiers indépendants légèrement inclinés.
  [-1,1].forEach(side=>{
    const arm=mesh(group,upholstery(.38,.74,depth,side),fabric,V(side*(width/2-.18),.91,0));
    arm.rotation.z=-side*.04;
  });
  const cw=(width-.68)/3;
  for(let i=0;i<3;i++) {
    const x=-width/2+.34+cw*(i+.5);
    mesh(group,upholstery(cw-.035,.24,depth-.51,i),fabric,V(x,.76,-.08));
    const back=new THREE.Group();
    back.position.set(x,1.2,depth/2-.24);
    back.rotation.x=-.12;
    const cushion=mesh(back,upholstery(cw-.03,.29,.99,i+4),fabric);
    cushion.rotation.x=Math.PI/2;
    // Les coutures suivent le contour du coussin, dans son propre repère.
    const outline=new THREE.Group();
    outline.rotation.x=Math.PI/2;
    piping(outline,cw-.035,.97,-.153,seam);
    back.add(outline);
    group.add(back);
    const seatSeam=new THREE.Group();
    seatSeam.position.x=x;
    piping(seatSeam,cw-.055,depth-.53,.85,seam,-.08);
    group.add(seatSeam);
  }
  const feet=surface(0x352926,.42,.2);
  [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx,sz])=>{
    const foot=mesh(group,new THREE.CylinderGeometry(.045,.068,.25,16),feet,V(sx*(width/2-.3),.14,sz*(depth/2-.26)));
    foot.rotation.z=sx*.1;
  });
  return group;
}

export function createPillow(width,height,depth,fabric) {
  const group=new THREE.Group();
  mesh(group,upholstery(width,height,depth,3),fabric);
  const seam=surface(new THREE.Color(fabric.color).multiplyScalar(.72),.96);
  // Couture dans le plan le plus large, même lorsque le coussin est posé de côté.
  const outline=new THREE.Group();
  if(width<depth) {outline.rotation.z=Math.PI/2;piping(outline,height,depth,width*.25,seam);}
  else {outline.rotation.x=Math.PI/2;piping(outline,width,height,-depth*.25,seam);}
  group.add(outline);
  return group;
}

export function createMug(color=0xe7b463) {
  const group=new THREE.Group();
  const ceramic=new THREE.MeshPhysicalMaterial({color,roughness:.23,clearcoat:1});
  const profile=[[.1,0],[.125,.025],[.125,.23],[.11,.24],[.103,.23],[.103,.04],[0,.04]].map(([x,y])=>new THREE.Vector2(x,y));
  mesh(group,new THREE.LatheGeometry(profile,32),ceramic);
  const handle=mesh(group,new THREE.TorusGeometry(.067,.018,10,22),ceramic,V(.16,.13,0));
  handle.scale.x=.84;
  const tea=mesh(group,new THREE.CircleGeometry(.103,24),surface(0x43261a,.24),V(0,.2,0));
  tea.rotation.x=-Math.PI/2;
  return group;
}

export function createBook(width,height,depth,color) {
  const group=new THREE.Group(),cover=surface(color,.73),paper=surface(0xe4d8ba,.94);
  mesh(group,new RoundedBoxGeometry(width-.035,height-.045,depth-.025,3,.008),paper);
  [-1,1].forEach(side=>mesh(group,new RoundedBoxGeometry(.018,height,depth,3,.007),cover,V(side*width/2,0,0)));
  mesh(group,new RoundedBoxGeometry(width+.015,height,.032,3,.012),cover,V(0,0,depth/2));
  const stamp=surface(0xcbba86,.5,.22);
  [-.3,.3].forEach(offset=>mesh(group,new THREE.BoxGeometry(width*.68,.012,.002),stamp,V(0,height*offset,depth/2+.018)));
  return group;
}

// Feuille en ruban courbe, avec nervure centrale et silhouette effilée.
function leafGeometry(length,width,seed) {
  const vertices=[],uvs=[],indices=[];
  const rows=14,columns=6;
  for(let i=0;i<=rows;i++) {
    const t=i/rows,span=Math.pow(Math.sin(Math.PI*t),.74)*width;
    for(let j=0;j<=columns;j++) {
      const u=j/columns*2-1;
      vertices.push(u*span,t*length,.24*length*t*t+Math.abs(u)*span*.22+Math.sin(t*9+seed)*.018);
      uvs.push(j/columns,t);
      if(i<rows && j<columns) {
        const a=i*(columns+1)+j,b=a+columns+1;
        indices.push(a,b,a+1,b,b+1,a+1);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createBotanicalPlant(scale=1,seed=0,{pot=true,fern=false}={}) {
  const group=new THREE.Group();
  const leaves=[],stems=[],veins=[];
  const soilY=pot?.56:0;
  if(pot) {
    const profile=[[.23,0],[.28,.025],[.29,.07],[.32,.48],[.38,.54],[.38,.6],[.33,.61],[.31,.55],[.27,.09],[0,.09]].map(([x,y])=>new THREE.Vector2(x,y));
    mesh(group,new THREE.LatheGeometry(profile,40),new THREE.MeshPhysicalMaterial({color:0x9c6448,roughness:.47,clearcoat:.3}));
    const earth=mesh(group,new THREE.CircleGeometry(.32,32),surface(0x32271e,1),V(0,.559,0));
    earth.rotation.x=-Math.PI/2;
  }
  const count=fern?18:11;
  for(let i=0;i<count;i++) {
    const a=i*2.399+seed,reach=.25+(i%4)*.085;
    const height=soilY+.45+(i%5)*.16;
    const end=V(Math.cos(a)*reach,height,Math.sin(a)*reach);
    const stemCurve=new THREE.QuadraticBezierCurve3(V(0,soilY,0),V(end.x*.4,height*.88,end.z*.4),end);
    stems.push(new THREE.TubeGeometry(stemCurve,10,.011,5));
    const length=fern?.42+(i%3)*.09:.46+(i%3)*.12;
    const geometry=leafGeometry(length,fern?.09:.16,i);
    const transform=new THREE.Matrix4().compose(end,new THREE.Quaternion().setFromEuler(new THREE.Euler(.75+(i%3)*.18,a,.2)),V(1,1,1));
    geometry.applyMatrix4(transform);
    leaves.push(geometry);
    const center=[];
    for(let j=0;j<8;j++){const t=j/7;center.push(V(0,t*length,.24*length*t*t-.004).applyMatrix4(transform));}
    veins.push(tube(center,.004));
  }
  const leafMat=new THREE.MeshPhysicalMaterial({color:fern?0x367e5d:0x427f43,roughness:.72,sheen:.35,sheenColor:new THREE.Color(0x92bd70),side:THREE.DoubleSide});
  const foliage=mesh(group,mergeGeometries(leaves),leafMat);
  foliage.userData.breeze={amplitude:.045,phase:seed};
  mesh(group,mergeGeometries(stems),surface(0x41683b,.8));
  mesh(group,mergeGeometries(veins),surface(0x9cba6f,.85));
  [...leaves,...stems,...veins].forEach(g=>g.dispose());
  group.scale.setScalar(scale);
  return group;
}

export function createTool(kind=0,color=0xda9754) {
  const group=new THREE.Group();
  const steel=surface(0xadb8b8,.25,.86),grip=surface(color,.62);
  if(kind%3===0) {
    mesh(group,new THREE.CylinderGeometry(.045,.065,.48,16),grip,V(0,-.12,0));
    const head=mesh(group,new RoundedBoxGeometry(.36,.13,.13,4,.035),steel,V(.045,.2,0));
    head.rotation.z=-.06;
    mesh(group,new THREE.CylinderGeometry(.045,.045,.15,16),steel,V(-.16,.2,0)).rotation.z=Math.PI/2;
  } else if(kind%3===1) {
    mesh(group,new THREE.CapsuleGeometry(.038,.39,6,12),steel);
    const shape=new THREE.Shape();
    shape.moveTo(-.105,0);shape.lineTo(-.12,.15);shape.lineTo(-.065,.2);shape.lineTo(-.055,.08);
    shape.lineTo(.055,.08);shape.lineTo(.065,.2);shape.lineTo(.12,.15);shape.lineTo(.105,0);shape.closePath();
    const jaw=mesh(group,new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2,steps:1}),steel,V(0,.2,-.025));
    jaw.rotation.z=.12;
    mesh(group,new THREE.TorusGeometry(.072,.026,8,20),steel,V(0,-.28,0));
  } else {
    mesh(group,new THREE.CapsuleGeometry(.06,.2,8,18),grip,V(0,-.15,0));
    mesh(group,new THREE.CylinderGeometry(.016,.016,.4,10),steel,V(0,.15,0));
    mesh(group,new THREE.BoxGeometry(.033,.07,.012),steel,V(0,.36,0));
    for(let i=0;i<4;i++) mesh(group,new THREE.TorusGeometry(.061,.005,6,16),steel,V(0,-.24+i*.052,0)).rotation.x=Math.PI/2;
  }
  return group;
}

export function createWateringCan(color=0x739f95) {
  const group=new THREE.Group();
  const enamel=new THREE.MeshPhysicalMaterial({color,roughness:.36,metalness:.18,clearcoat:.6});
  const profile=[[.15,0],[.23,.04],[.24,.22],[.19,.4],[.13,.43],[.115,.42],[.16,.37],[.2,.2],[.18,.06],[0,.06]].map(([x,y])=>new THREE.Vector2(x,y));
  mesh(group,new THREE.LatheGeometry(profile,32),enamel);
  mesh(group,tube([V(-.17,.32,0),V(-.37,.42,0),V(-.45,.22,0),V(-.31,.08,0),V(-.2,.12,0)],.025),enamel);
  const spout=new THREE.CubicBezierCurve3(V(.16,.14,0),V(.31,.12,0),V(.4,.3,0),V(.52,.4,0));
  mesh(group,new THREE.TubeGeometry(spout,20,.031,10,false),enamel);
  const nozzle=mesh(group,new THREE.CylinderGeometry(.074,.038,.06,24),enamel,V(.54,.42,0));
  nozzle.rotation.z=-Math.PI/4;
  for(let i=0;i<7;i++) {
    const a=i/7*Math.PI*2;
    const hole=mesh(group,new THREE.SphereGeometry(.007,6,4),surface(0x1a3030),V(.561+Math.cos(a)*.034,.448+Math.sin(a)*.027,.015));
    hole.castShadow=false;
  }
  return group;
}

export async function loadDecorModel(root,url,{position,width,rotation=0},colliders=null) {
  // Réservation du volume avant le chargement : aucune collision n'apparaît sous le joueur.
  const reserved=new THREE.Box3(V(position[0]-width/2,position[1],position[2]-width/2),V(position[0]+width/2,position[1]+width*1.3,position[2]+width/2));
  if(colliders) colliders.push(reserved);
  try {
    const gltf=await new GLTFLoader().loadAsync(url);
    const object=gltf.scene;
    if(!root.parent) { disposeObject(object); return null; }
    const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const scale=width/Math.max(size.x,size.z);
    object.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    object.scale.setScalar(scale);
    const holder=new THREE.Group();
    holder.add(object);
    holder.position.set(...position);
    holder.rotation.y=rotation;
    holder.name=url.includes('chair')?'Fauteuil 3D CC0':'Voiture miniature 3D CC0';
    object.traverse(part=>{if(part.isMesh){part.castShadow=part.receiveShadow=true;if(part.material)part.material.envMapIntensity=.65;}});
    root.add(holder);
    root.updateWorldMatrix(true,true);
    if(colliders) reserved.setFromObject(holder);
    root.userData.loadedModels=(root.userData.loadedModels||0)+1;
    return holder;
  } catch(error) {
    if(colliders){const i=colliders.indexOf(reserved);if(i!==-1)colliders.splice(i,1);}
    console.warn(`Modèle non chargé : ${url}`,error);
    return null;
  }
}

export function disposeObject(root) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(object=>{
    if(object.geometry) geometries.add(object.geometry);
    if(object.material) (Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));
  });
  for(const m of materials) for(const value of Object.values(m)) if(value?.isTexture) textures.add(value);
  textures.forEach(t=>t.dispose());
  materials.forEach(m=>m.dispose());
  geometries.forEach(g=>g.dispose());
}
