import * as THREE from 'three';
import { cushionCover, drapedCover, toolCover, leafCurtain, lantern, wornMaterial, roundBox, part, tube } from './exploration-models.js';

function placed(root,object,position) { object.position.set(...position);root.add(object);return object; }

function addDuckCover(ctx,index,mobile,label,actions,animate) {
  const duck=ctx.ducks[index],position=duck.getWorldPosition(new THREE.Vector3());
  const root=placed(ctx.root,new THREE.Group(),[position.x,position.y-duck.scale.y*.355,position.z]);
  root.add(mobile);
  const item=ctx.interactions.addObject({root,mobile,label,actions,role:'mechanic',collidable:true,pose:progress=>animate(mobile,progress)});
  ctx.interactions.coverDuck(item,duck);return item;
}

function addSecretPassage(ctx) {
  const shelf=ctx.root.userData.secretShelf;
  if(!shelf)throw new Error('Étagère du passage secret manquante.');
  const oldCollider=ctx.colliders.indexOf(shelf.userData.collider);
  if(oldCollider!==-1)ctx.colliders.splice(oldCollider,1);
  const root=placed(ctx.root,new THREE.Group(),[-9.25,0,0]);
  root.updateWorldMatrix(true,true);root.attach(shelf);
  const material=wornMaterial('wood',0x4d5042),brass=wornMaterial('metal',0xb9a16b);
  // Un véritable renfoncement fermé, accessible uniquement après rotation.
  for(const [position,size] of [
    [[-9.65,1.4,-1.85],[.16,2.8,2.3]], [[-4.35,1.4,-1.85],[.16,2.8,2.3]],
    [[-7,1.4,-3.05],[5.3,2.8,.16]], [[-8.9,1.4,-.75],[1.65,2.8,.12]],
    [[-5.1,1.4,-.75],[1.65,2.8,.12]], [[-7,2.8,-1.85],[5.3,.1,2.5]]
  ]) {
    const wall=roundBox(ctx.root,material,size,position);ctx.colliders.push(new THREE.Box3().setFromObject(wall));
  }
  const arch=part(ctx.root,new THREE.TorusGeometry(1,.055,10,40,Math.PI),brass,[-7,1.7,-.65]);
  roundBox(ctx.root,brass,[.06,1.72,.06],[-8, .86,-.65]);roundBox(ctx.root,brass,[.06,1.72,.06],[-6,.86,-.65]);
  arch.scale.y=1;
  const light=new THREE.PointLight(0xf8d495,0,5,2);light.position.set(-7,2.35,-2);ctx.root.add(light);
  const item=ctx.interactions.addObject({root,mobile:shelf,label:'l’étagère secrète',actions:['Faire pivoter','Refermer'],role:'mechanic',collidable:true,pose:progress=>{
    root.rotation.y=-progress*Math.PI*.54;light.intensity=progress*9;
  }});
  ctx.interactions.coverDuck(item,ctx.ducks[3]);return item;
}

function addStoneLever(ctx) {
  const cell=ctx.root.userData.maze.duckCells[3],root=placed(ctx.root,new THREE.Group(),[cell.world.x,0,cell.world.z]);
  root.rotation.y=Math.atan2(cell.inward.x,cell.inward.z);
  const stone=wornMaterial('stone',0x64736a),brass=wornMaterial('metal',0x8d7853),slab=new THREE.Group();root.add(slab);
  roundBox(slab,stone,[1.12,1.12,.13],[0,.74,.3]);
  for(const x of [-.32,0,.32])part(slab,new THREE.TorusGeometry(.07,.013,8,18),brass,[x,.79,.378]);
  const handle=new THREE.Group();handle.position.set(.57,.85,.48);root.add(handle);
  part(handle,new THREE.SphereGeometry(.08,16,12),brass,[0,.24,0]);
  tube(handle,brass,[[0,0,0],[0,.24,0]],.028);
  roundBox(root,stone,[.22,.85,.3],[.58,.425,.32]);
  const item=ctx.interactions.addObject({root,mobile:slab,label:'le levier de l’alcôve',actions:['Abaisser','Relever'],role:'mechanic',collidable:true,pose:progress=>{
    slab.position.y=progress*1.75;handle.rotation.x=progress*.9;
  }});
  ctx.interactions.coverDuck(item,ctx.ducks[3]);return item;
}

export function buildExploration(data,ctx) {
  let mechanic;
  if(data.id==='living') {
    mechanic=addDuckCover(ctx,3,cushionCover(),'le coussin au sol',['Soulever','Reposer'],(mobile,p)=>{
      mobile.position.set(p*.25,p*.9,-p*.18);mobile.rotation.z=p*.18;
    });
  } else if(data.id==='workshop') {
    const cover=toolCover();
    mechanic=addDuckCover(ctx,3,cover,'la manivelle du bac',['Tourner','Ramener'],(mobile,p)=>{mobile.position.x=-p*.95;});
    const crank=new THREE.Group();crank.position.set(-.52,.62,.1);mechanic.root.add(crank);
    const metal=wornMaterial('metal',0xc29b59);
    roundBox(mechanic.root,metal,[.09,.65,.1],[-.52,.325,.1]);
    part(crank,new THREE.TorusGeometry(.17,.028,10,32),metal);
    tube(crank,metal,[[0,0,0],[.15,0,0],[.15,0,.12]],.022);
    const original=mechanic.pose;mechanic.pose=p=>{original(p);crank.rotation.z=-p*Math.PI*3;};
  } else if(data.pattern==='garden') {
    const leaves=leafCurtain();
    mechanic=addDuckCover(ctx,0,leaves.root,'le feuillage dense',['Écarter','Rapprocher'],(mobile,p)=>{
      leaves.fronds.forEach(({object,x,z})=>{object.position.set(x*p*.65,p*.13,z*p*.65);object.rotation.z=-x*p*.55;});
    });
  } else if(data.id==='attic') {
    mechanic=addDuckCover(ctx,4,drapedCover(.84,.78,.45,0xc7bba6),'le vieux drap',['Retirer','Remettre'],(mobile,p)=>{
      mobile.position.set(-p*.6,p*.86,-p*.12);mobile.rotation.z=p*.35;
    });
  } else if(data.id==='library')mechanic=addSecretPassage(ctx);
  else if(data.id==='maze')mechanic=addStoneLever(ctx);

  // Dans le labyrinthe, poser la lanterne derrière le départ, hors des murs.
  const offset=data.id==='maze'?[-.48,.68]:[.95,-.8];
  const lamp=lantern();placed(ctx.root,lamp.root,[data.spawn[0]+offset[0],0,data.spawn[2]+offset[1]]);
  ctx.root.updateWorldMatrix(true,true);
  const base=lamp.root.getWorldPosition(new THREE.Vector3());
  ctx.colliders.push(new THREE.Box3(new THREE.Vector3(base.x-.24,0,base.z-.24),new THREE.Vector3(base.x+.46,1.9,base.z+.24)));
  ctx.interactions.addObject({root:lamp.root,label:'la lanterne',actions:['Éteindre','Allumer'],role:'light',pose:p=>{
    lamp.light.intensity=15*(1-p);lamp.bulbMaterial.emissiveIntensity=2.2*(1-p);
  }});
  ctx.root.userData.mechanic=mechanic;
}
