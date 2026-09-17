import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBook, createDetailedSofa, createBotanicalPlant, loadDecorModel } from './models.js';
import { MAZE_LAYOUT } from './maze.js';
import { addAtticAntiques } from './attic.js';
import { suitcase } from './exploration-models.js';

const floorDuck=(x,z,rotation=0,scale=.64)=>[x,.355*scale,z,rotation,scale];
export const additionalLevels=[
  {
    id:'attic',name:'Le grenier des souvenirs',sky:0x282031,fog:0x4d3532,
    mechanic:'Retirer les draps et ouvrir les valises',
    floor:0xb98753,wall:0x84644d,accent:0xd9a663,pattern:'wood',lighting:'attic',architecture:'attic',
    bounds:[22,20],spawn:[0,1.68,7.8],look:0,
    ducks:[floorDuck(-6.4,-3.5),floorDuck(5.8,5.5),floorDuck(6.8,-4.8,.4,.66),floorDuck(-6.8,5.05,-.8,.66),floorDuck(.25,-6.75,2.1,.66)],
    tip:'Les valises et les vieux draps se manipulent avec ta touche d’interaction.'
  },
  {
    id:'library',name:'La bibliothèque des secrets',sky:0x14282c,fog:0x283c37,
    mechanic:'Trouver l’étagère qui ouvre un passage secret',
    floor:0x926345,wall:0x829487,accent:0xcaa45e,pattern:'wood',lighting:'library',
    bounds:[24,22],spawn:[0,1.68,8.5],look:0,
    ducks:[floorDuck(-8,5.9),floorDuck(0,-6),floorDuck(7.2,-7.76,1.1),floorDuck(-7.1,-2.12,-.3),floorDuck(4.9,4.37,2.4)],
    tip:'Une étagère peut pivoter. Inspecte les meubles avec ta touche d’interaction.'
  },
  {
    id:'maze',name:'Le labyrinthe des canards perdus',sky:0x08131d,fog:0x182631,
    mechanic:'Actionner le levier d’une alcôve de pierre',
    floor:0x5c655d,wall:0x61716c,accent:0xffbb65,pattern:'concrete',lighting:'maze',nightEnvironment:true,
    bounds:[30.4,30.4],spawn:[MAZE_LAYOUT.spawn.x,1.68,MAZE_LAYOUT.spawn.z],look:0,
    ducks:MAZE_LAYOUT.duckCells.map((cell,index)=>floorDuck(cell.world.x-cell.inward.x*(index<2?.25:.66),cell.world.z-cell.inward.z*(index<2?.25:.66),index*.7)),
    tip:'Explore les impasses : un levier peut dégager une alcôve.'
  }
];

const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function part(root,geometry,material,x,y,z) {
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);
  mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
}
function addBooks(root,x,y,z,count,rotation=0) {
  const row=new THREE.Group();
  for(let i=0;i<count;i++) {
    const height=.36+(i%4)*.065;
    const book=createBook(.15,height,.25,[0x875349,0x476b66,0xba9458,0x485a77,0x867a5b][i%5]);
    book.position.set((i-(count-1)/2)*.22,y+height/2,z);
    if(i%5===0)book.rotation.z=.07;
    row.add(book);
  }
  row.position.x=x;row.rotation.y=rotation;root.add(row);
  return row;
}
function addSuitcase(ctx,x,z,width,color,rotation=0) {
  const model=suitcase(width,color);
  model.root.position.set(x,0,z);model.root.rotation.y=rotation;ctx.root.add(model.root);
  model.root.updateWorldMatrix(true,true);
  ctx.colliders.push(new THREE.Box3().setFromObject(model.body));
  return ctx.interactions.addObject({root:model.root,mobile:model.lid,label:'la valise ancienne',actions:['Ouvrir','Fermer'],role:'suitcase',collidable:true,pose:p=>{model.lid.rotation.x=-p*1.75;}});
}

function buildAttic(ctx) {
  const {root,colliders,interactions,addBox,addCylinder,addBarrel,addVase}=ctx;
  const wood=mat(0x684835,.84),brass=mat(0xb69759,.32,.7);
  addAtticAntiques(root,colliders);
  const trunk=interactions.addStorage({x:-6.4,z:-3.5,width:1.5,height:1.1,depth:.9,label:'le coffre ancien',color:0x795439});
  const drawer=interactions.addStorage({x:5.8,z:5.5,width:1.2,height:1.0,depth:.85,kind:'drawer',label:'le tiroir aux souvenirs',color:0x887258});
  root.userData.hiddenDucks[0]=trunk;root.userData.hiddenDucks[1]=drawer;
  addSuitcase(ctx,-6.1,5.7,1.6,0x886b44,.16);
  addSuitcase(ctx,-7.8,3.7,1.3,0x42656b,-.2);
  addSuitcase(ctx,4.4,-6.2,1.8,0x936756,.1);
  addSuitcase(ctx,.25,-6.0,1.3,0x405d59,-.12);
  addBarrel(6.8,-4.05,.95,0x84653d);addBarrel(8.1,-5.4,.63,0x997e52);
  addBox(0,1.12,-5.5,3.6,.19,1.3,wood);
  [-1.4,1.4].forEach(x=>addCylinder(x,.52,-5.5,.065,1.04,brass));
  addBooks(root,-.7,1.225,-5.4,7);
  const globe=part(root,new THREE.SphereGeometry(.39,32,24),mat(0x527f81,.58),.8,1.9,-5.55);
  const ring=part(root,new THREE.TorusGeometry(.46,.018,8,40),brass,.8,1.9,-5.55);ring.rotation.z=.35;
  globe.userData.sway={amplitude:.02,phase:1};
  addCylinder(.8,1.44,-5.55,.05,.43,brass,false);addCylinder(.8,1.25,-5.55,.23,.05,wood,false);
  addVase(-8.5,0,-7.3,0x946e52,.7);addVase(5.8,1.21,5.5,0x9b704e,.46);
  // Bobines, rouleaux et vieux cadres plutôt qu'une pile de cubes.
  for(let i=0;i<5;i++) {
    const roll=part(root,new THREE.CylinderGeometry(.14,.14,1.4,20),mat(i%2?0xae9a75:0x758d88),8.4,.18,1.2+i*.4);
    roll.rotation.z=Math.PI/2;roll.rotation.y=.12*i;
    colliders.push(new THREE.Box3().setFromObject(roll));
  }
  addBox(-8,1.55,-9.72,2.3,1.6,.09,wood,false);
  addBox(-8,1.55,-9.64,2.05,1.37,.03,mat(0xa38f72),false);
}

function buildLibrary(ctx) {
  const {root,colliders,interactions,addBox,addCylinder,addRug,addArchedShelf,addVase,addPlant}=ctx;
  const wood=mat(0x5f4132,.7),shelf=mat(0x364640,.75),brass=mat(0xc4aa6b,.3,.78);
  addRug(0,.4,3.5,17.5,0x75484c);
  for(const [x,z] of [[-7,-7],[-7,0],[7,-7],[7,0]]) {
    const bookcase=addArchedShelf(x,z,4.5,wood,shelf);
    for(const y of [.48,1.18,1.88]) {
      const row=addBooks(root,x,y,z,13);
      if(x===-7 && z===0){bookcase.updateWorldMatrix(true,true);bookcase.attach(row);}
    }
    if(x===-7 && z===0)root.userData.secretShelf=bookcase;
  }
  // Socle arrière opaque : pas de silhouette jaune visible sous cette étagère
  // depuis l'entrée, tout en laissant le canard accessible par l'arrière.
  addBox(7,.22,-7.29,4.5,.44,.08,wood);
  const cabinet=interactions.addStorage({x:-8,z:5.9,width:1.35,height:1.4,depth:.95,label:'le cabinet de lecture',color:0x4b6559});
  const drawer=interactions.addStorage({x:0,z:-6,width:1.35,height:.75,depth:.9,kind:'drawer',label:'le tiroir du bibliothécaire',color:0x6e4b34});
  root.userData.hiddenDucks[0]=cabinet;root.userData.hiddenDucks[1]=drawer;
  addBox(0,1.06,-6,3.8,.2,1.5,wood);
  [-1.5,1.5].forEach(x=>addCylinder(x,.48,-6,.07,.96,brass));
  addBooks(root,-.85,1.17,-6,5);addVase(.82,1.17,-6.15,0x52776d,.56);
  const fabric=new THREE.MeshPhysicalMaterial({color:0x4b776b,roughness:.86,sheen:1,sheenColor:new THREE.Color(0x91ac89)});
  const couch=createDetailedSofa(3.3,1.5,fabric);couch.position.set(4,0,5.5);couch.rotation.y=Math.PI;
  root.add(couch);colliders.push(new THREE.Box3().setFromObject(couch));
  root.userData.pendingModels.push(loadDecorModel(root,'./assets/sheen-chair.glb',{position:[-4,0,3.1],width:1.45,rotation:.45},colliders));
  addPlant(9.7,8.1,1.05);addPlant(-10,-8.7,1.1);
  // Globes lumineux et arcades murales donnent une atmosphère de salle de lecture.
  for(const z of [-7,0,7]) {
    addCylinder(0,4.45,z,.025,1.2,brass,false);
    const globe=part(root,new THREE.SphereGeometry(.24,24,16),new THREE.MeshBasicMaterial({color:0xffe3aa}),0,3.77,z);
    globe.castShadow=false;
    const light=new THREE.PointLight(0xffd29a,12,9,2);light.position.set(0,3.55,z);root.add(light);
    const arch=part(root,new THREE.TorusGeometry(2.4,.085,10,40,Math.PI),brass,0,2.4,z);
    arch.scale.x=1.7;
  }
  for(const x of [-4,4]) {
    const window=addBox(x,2.85,-10.78,2.35,2.55,.055,mat(0x31545d,.3,0),false);
    window.material.emissive.set(0x355663);window.material.emissiveIntensity=.28;
    addBox(x,2.85,-10.7,.07,2.55,.08,brass,false);
    addBox(x,2.85,-10.7,2.35,.07,.08,brass,false);
  }
}

function masonryMaterial() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#4f5c59';ctx.fillRect(0,0,256,256);
  for(let row=0;row<8;row++)for(let col=-1;col<4;col++) {
    const x=col*85+(row%2)*42,y=row*32;
    const shade=95+(row*7+col*13+40)%30;
    ctx.fillStyle=`rgb(${shade-7},${shade+2},${shade})`;ctx.fillRect(x+2,y+2,81,28);
    ctx.strokeStyle='rgba(219,220,194,.14)';ctx.strokeRect(x+3,y+3,79,25);
  }
  for(let i=0;i<1900;i++) {
    ctx.fillStyle=i%2?'rgba(10,22,15,.08)':'rgba(220,223,203,.06)';ctx.fillRect(i*73%256,i*137%256,1+i%3,1);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1,1.5);
  return new THREE.MeshStandardMaterial({color:0xc4cfc9,map:texture,bumpMap:texture,bumpScale:.028,roughness:.92,envMapIntensity:.35});
}

function addTorch(root,x,z,phase=0) {
  const metal=mat(0x544635,.42,.65);
  part(root,new THREE.CylinderGeometry(.055,.08,.8,12),metal,x,1.55,z);
  part(root,new THREE.CylinderGeometry(.14,.08,.12,16),metal,x,1.99,z);
  const flame=part(root,new THREE.SphereGeometry(.1,16,12),new THREE.MeshBasicMaterial({color:0xffba62}),x,2.15,z);
  flame.scale.set(.78,1.75,.78);flame.userData.sway={amplitude:.075,phase};flame.castShadow=false;
  const light=new THREE.PointLight(0xffbd74,13,6,2);light.position.set(x,2.2,z);
  light.userData.flicker={phase};root.add(light);
}

function buildMaze(ctx) {
  const {root,colliders,interactions,addVase,addBarrel}=ctx;
  const layout=MAZE_LAYOUT,geometries=[],stone=masonryMaterial();
  root.userData.maze={grid:layout.grid,spacing:layout.spacing,start:layout.start,duckCells:layout.duckCells,reachable:layout.reachable,deadEnds:layout.deadEnds};
  for(let z=0;z<layout.size;z++)for(let x=0;x<layout.size;x++)if(layout.grid[z][x]===1) {
    const world=layout.toWorld({x,z});
    const geometry=new RoundedBoxGeometry(layout.spacing+.025,3.45,layout.spacing+.025,2,.06);
    geometry.translate(world.x,1.725,world.z);geometries.push(geometry);
    colliders.push(new THREE.Box3(new THREE.Vector3(world.x-layout.spacing/2-.013,0,world.z-layout.spacing/2-.013),new THREE.Vector3(world.x+layout.spacing/2+.013,3.45,world.z+layout.spacing/2+.013)));
  }
  const walls=new THREE.Mesh(mergeGeometries(geometries),stone);walls.castShadow=walls.receiveShadow=true;root.add(walls);
  geometries.forEach(g=>g.dispose());
  layout.duckCells.forEach((cell,index)=>{
    const {world,inward}=cell;
    if(index<2) {
      const item=interactions.addStorage({x:world.x-inward.x*.25,z:world.z-inward.z*.25,width:.82,height:.72,depth:.62,kind:index===0?'door':'drawer',rotation:Math.atan2(inward.x,inward.z),label:index===0?'le coffre de l’impasse':'le tiroir oublié',color:0x6d5c43});
      root.userData.hiddenDucks[index]=item;
    } else {
      const urn=addVase(world.x-inward.x*.1,0,world.z-inward.z*.1,index%2?0x786f55:0x54756b,.95);
      colliders.push(new THREE.Box3().setFromObject(urn));
      // Les urnes ne ferment pas le couloir : on peut regarder de chaque côté.
      if(index===3)addBarrel(world.x+inward.z*.5,world.z-inward.x*.5,.4,0x70604a);
    }
    addTorch(root,world.x+inward.z*.7,world.z-inward.x*.7,index*1.7);
  });
  addTorch(root,layout.spawn.x-.64,layout.spawn.z,5.8);
  let lightCount=0;
  for(let z=1;z<layout.size-1;z+=2)for(let x=1;x<layout.size-1;x+=2) {
    if((x+z)%6!==0 || lightCount>=6)continue;
    const world=layout.toWorld({x,z});
    addTorch(root,world.x+.67,world.z+.67,9+lightCount++);
  }
  // Aucun emblème au-dessus des cachettes : les urnes doivent être inspectées.
  // Végétation en bordure, sans volume de collision qui condamnerait une branche.
  [layout.duckCells[2],layout.duckCells[4]].forEach((cell,index)=>{
    const plant=createBotanicalPlant(.32,index+5,{pot:false,fern:true});
    plant.position.set(cell.world.x+cell.inward.z*.71,0,cell.world.z-cell.inward.x*.71);root.add(plant);
  });
}

export function buildAdditionalLevel(data,context) {
  if(data.id==='attic')buildAttic(context);
  else if(data.id==='library')buildLibrary(context);
  else if(data.id==='maze')buildMaze(context);
  else throw new Error(`Niveau inconnu : ${data.id}`);
}
