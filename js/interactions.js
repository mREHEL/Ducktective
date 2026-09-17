import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createPillow } from './models.js';

// Les rangements gardent leurs volumes de collision pendant toute l'animation.
export class InteractionSystem {
  constructor(root, colliders) {
    this.root = root;
    this.colliders = colliders;
    this.items = [];
    this.objects = [];
    this.ray = new THREE.Raycaster();
    this.center = new THREE.Vector2();
  }

  addStorage({x, z, width=1.35, height=1.18, depth=.8, color=0x805438, kind='door', label='placard', rotation=0}) {
    const root = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({color, roughness:.62});
    const grain=document.createElement('canvas');grain.width=256;grain.height=256;
    const ctx=grain.getContext('2d');ctx.fillStyle='#e4ddd3';ctx.fillRect(0,0,256,256);
    for(let y=0;y<256;y+=2) {
      ctx.strokeStyle=`rgba(70,48,25,${.04+(y%7)*.009})`;
      ctx.lineWidth=y%3?.6:1.2;ctx.beginPath();ctx.moveTo(0,y);
      ctx.bezierCurveTo(70,y+Math.sin(y*.17)*3,170,y+Math.cos(y*.13)*4,256,y);ctx.stroke();
    }
    wood.map=new THREE.CanvasTexture(grain);wood.map.colorSpace=THREE.SRGBColorSpace;
    wood.bumpMap=wood.map;wood.bumpScale=.006;
    const lining = new THREE.MeshStandardMaterial({color:0x453831, roughness:.86});
    const brass = new THREE.MeshStandardMaterial({color:0xc2a66a, roughness:.28, metalness:.78});
    const part = (parent,w,h,d,px,py,pz,mat=wood) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(.055,w/4,h/4,d/4)), mat);
      mesh.position.set(px,py,pz);
      mesh.castShadow=mesh.receiveShadow=true;
      parent.add(mesh);
      return mesh;
    };
    const base=.16;
    part(root,width,.1,depth,0,base,0);
    part(root,width,.1,depth,0,base+height,0);
    part(root,.09,height,depth,-width/2+.045,base+height/2,0);
    part(root,.09,height,depth,width/2-.045,base+height/2,0);
    part(root,width,height,.075,0,base+height/2,-depth/2+.035,lining);
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx,sz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.04,.06,base,12),brass);
      leg.position.set(sx*(width/2-.12),base/2,sz*(depth/2-.12));
      root.add(leg);
    });

    const mobile = new THREE.Group();
    root.add(mobile);
    let slot;
    if (kind === 'drawer') {
      const floorY=base+Math.max(.2,height-.58);
      const faceTop=floorY+.38;
      part(mobile,width-.14,.075,depth-.1,0,floorY,0,lining);
      part(mobile,.065,.21,depth-.12,-width/2+.105,floorY+.12,0,lining);
      part(mobile,.065,.21,depth-.12,width/2-.105,floorY+.12,0,lining);
      part(mobile,width-.14,.21,.06,0,floorY+.12,-depth/2+.08,lining);
      part(mobile,width-.08,.42,.09,0,floorY+.17,depth/2+.015);
      const lowerHeight=Math.max(.04,floorY-.05-base);
      part(root,width-.08,lowerHeight,.09,0,base+lowerHeight/2,depth/2+.015);
      const upperHeight=Math.max(.035,base+height-faceTop);
      part(root,width-.08,upperHeight,.09,0,faceTop+upperHeight/2,depth/2+.015);
      slot = new THREE.Vector3(0,floorY+.21,0);
      mobile.userData.handleY=floorY+.17;
    } else {
      mobile.position.set(-width/2+.04,base+height/2,depth/2+.015);
      part(mobile,width-.08,height-.04,.09,width/2-.04,0,0);
      // Moulure sur la porte et poignée métallique, sans changer sa silhouette.
      part(mobile,width-.3,.045,.035,width/2-.04,height/2-.14,.057,brass);
      part(mobile,width-.3,.045,.035,width/2-.04,-height/2+.14,.057,brass);
      slot = new THREE.Vector3(0,base+.22,0);
    }
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.075,.014,8,20),brass);
    handle.position.set(kind==='drawer'?0:width-.23,kind==='drawer'?mobile.userData.handleY:0,kind==='drawer'?depth/2+.08:.08);
    mobile.add(handle);

    // Décentrer le canard sans le coincer dans les parois, et masquer son corps
    // avec du linge plié : il faut regarder au-dessus ou de biais dans le rangement.
    slot.x=(this.items.length%2?-1:1)*width*.18;
    slot.z=-depth*.09;
    const contentsParent=kind==='drawer'?mobile:root;
    const contentsFloor=kind==='drawer'?slot.y-.21+.0375:base+.05;
    const fabric=new THREE.MeshPhysicalMaterial({color:kind==='drawer'?0x68797a:0x9a8069,roughness:.95,sheen:.65});
    for(let i=0;i<3;i++) {
      const folded=createPillow(width*.45,.09,depth*.3,fabric);
      folded.position.set(0,contentsFloor+.055+i*.075,depth*.2);
      folded.rotation.y=(i-1)*.025;
      contentsParent.add(folded);
    }

    root.position.set(x,0,z);
    root.rotation.y=rotation;
    this.root.add(root);
    root.updateWorldMatrix(true,true);
    const fixedBox=new THREE.Box3().setFromObject(root);
    const movingBox=new THREE.Box3().setFromObject(mobile);
    this.colliders.push(fixedBox,movingBox);
    const item={root,mobile,kind,label,depth,width,height,slot,progress:0,target:0,movingBox};
    root.userData.interaction=item;
    this.items.push(item);
    return item;
  }

  placeDuck(item,duck) {
    item.duck=duck;
    const parent=item.kind==='drawer'?item.mobile:item.root;
    parent.add(duck);
    duck.position.copy(item.slot);
    duck.position.y-=duck.userData.storageGroundingAdjustment||0;
    duck.userData.baseY=duck.position.y;
    duck.rotation.y=duck.userData.baseRotation=Math.PI;
    // Le canard reste enfant du tiroir : il suit réellement son ouverture.
  }

  addObject({root,mobile=root,label,actions=['Déplacer','Remettre'],pose,collidable=false,role='object'}) {
    const item={root,mobile,label,actions,pose,role,kind:'object',progress:0,target:0,collidable};
    root.userData.interaction=item;
    root.updateWorldMatrix(true,true);
    if(collidable) {
      item.movingBox=new THREE.Box3().setFromObject(mobile);
      this.colliders.push(item.movingBox);
    }
    this.objects.push(item);
    this.applyPose(item);
    return item;
  }

  coverDuck(item,duck) { duck.userData.coveredBy=item;item.duck=duck; }

  prompt(item) {
    return `${item.actions?item.actions[item.target?1:0]:(item.target?'Fermer':'Ouvrir')} ${item.label}`;
  }

  aimed(camera,maxDistance=3.5) {
    this.ray.setFromCamera(this.center,camera);
    this.ray.far=maxDistance;
    const hits=this.ray.intersectObjects(this.root.children,true);
    for (const hit of hits) {
      if (!hit.object.isMesh || hit.object.userData.ignoreAim) continue;
      let current=hit.object,storage=null;
      while (current && current!==this.root) {
        if (current.userData.duck) {
          const cover=current.userData.coveredBy;
          if(cover && cover.progress<.9)return {type:'object',object:cover,distance:hit.distance};
          return {type:'duck',object:current,distance:hit.distance};
        }
        if (current.userData.interaction) storage=current.userData.interaction;
        current=current.parent;
      }
      if (storage) return {type:storage.kind==='object'?'object':'storage',object:storage,distance:hit.distance};
      // Un objet opaque rencontré en premier bloque aussi bien la prise que l'ouverture.
      return null;
    }
    return null;
  }

  toggle(item) { item.target=item.target?0:1; }

  update(delta,playerBox,onBlocked) {
    for (const item of [...this.items,...this.objects]) {
      if (Math.abs(item.target-item.progress)<.0001) continue;
      const previous=item.progress;
      item.progress=THREE.MathUtils.damp(previous,item.target,7,delta);
      if (Math.abs(item.target-item.progress)<.002) item.progress=item.target;
      this.applyPose(item);
      const box=item.movingBox?new THREE.Box3().setFromObject(item.mobile):null;
      if (playerBox && box?.intersectsBox(playerBox)) {
        item.progress=previous;
        item.target=previous>.5?1:0;
        this.applyPose(item);
        onBlocked?.();
      }
      item.movingBox?.setFromObject(item.mobile);
    }
  }

  applyPose(item) {
    if(item.pose)item.pose(item.progress);
    else if (item.kind==='drawer') item.mobile.position.z=item.progress*item.depth*.88;
    else item.mobile.rotation.y=-item.progress*Math.PI*.66;
    item.root.updateWorldMatrix(true,true);
  }
}
