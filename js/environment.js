import * as THREE from 'three';

const profiles={
  wood:{sky:0xffdfb0,ground:0x564035,ambient:.42,key:0xffbc81,strength:2.9,position:[-3.5,4.9,-5.5],exposure:.86,fog:0x967963},
  concrete:{sky:0x9bbfda,ground:0x263641,ambient:.32,key:0xd7eaff,strength:1.25,position:[-2,5,2],exposure:.88,fog:0x283f52},
  garden:{sky:0x7196c5,ground:0x172923,ambient:.24,key:0xa5caff,strength:2.2,position:[-5,7,-6],exposure:.88,fog:0x0b1c2b},
  attic:{sky:0xffd69a,ground:0x35231e,ambient:.3,key:0xffb36c,strength:2.8,position:[-4.8,4.82,-3],exposure:.92},
  library:{sky:0xd5ddd1,ground:0x383d30,ambient:.38,key:0xffd8a7,strength:1.9,position:[-3,5,-7],exposure:.84},
  maze:{sky:0x91adc5,ground:0x28312c,ambient:.38,key:0x9fb5c7,strength:1.3,position:[0,6,0],exposure:1.0}
};

export function lightEnvironment(root,data,renderer,bloomPass) {
  const style=data.lighting||data.pattern;
  const p=profiles[style]||profiles[data.pattern];
  renderer.toneMappingExposure=p.exposure;
  bloomPass.strength=style==='garden'||style==='maze'?.28:.16;
  root.add(new THREE.HemisphereLight(p.sky,p.ground,p.ambient));
  const key=new THREE.DirectionalLight(p.key,p.strength);
  key.position.set(...p.position);
  key.target.position.set(1,0,2);
  key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);
  const extent=Math.max(13,...data.bounds.map(size=>size*.6));
  Object.assign(key.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.1,far:42});
  key.shadow.normalBias=.035;
  key.shadow.bias=-.00015;
  key.shadow.radius=3;
  root.add(key,key.target);

  if(style==='wood' || style==='attic') {
    const sun=new THREE.SpotLight(0xffc280,36,18,.4,.58,2);
    if(style==='attic')sun.position.set(-4.8,4.58,-3);
    else sun.position.set(-2.2,3.15,-7.5);
    sun.target.position.set(2,.4,4);
    root.add(sun,sun.target);
    addBeam(root,sun.position,sun.target.position,2.0,0xffca91,.014);
    const fill=new THREE.PointLight(0x82b7cf,7,8,2);
    fill.position.set(-5,2.4,-6.4);
    root.add(fill);
  } else if(style==='concrete') {
    [[-6,5.7],[0,-.3],[6,-5.8]].forEach(([x,z],i)=>{
      const light=new THREE.SpotLight(i===1?0xffca89:0xb2e8ff,30,11,.72,.65,2);
      light.position.set(x,4.05,z);
      light.target.position.set(x+.4,.1,z-.3);
      root.add(light,light.target);
      addBeam(root,light.position,light.target.position,1.3,i===1?0xffd5a1:0x92d8f4,.024);
    });
  } else if(style==='garden') {
    [[-7.8,-7.5],[7.8,7.4]].forEach(([x,z])=>{
      const light=new THREE.PointLight(0xffb960,16,7,2);
      light.position.set(x,1.8,z);
      root.add(light);
    });
    addBeam(root,new THREE.Vector3(-4,6,-5),new THREE.Vector3(0,.15,3),1.9,0x9acaff,.025);
    addGlassRain(root,data.bounds);
  }
  return p;
}

function addGlassRain(root,[width,depth]) {
  const drops=[];
  for(let i=0;i<96;i++) {
    const pane=Math.floor(i/24),offset=(i*37%101)/101;
    drops.push({x:pane<2?(pane===0?-1:1)*(width/2-.145):(offset-.5)*(width-1),
      z:pane<2?(offset-.5)*(depth-1):(pane===2?-1:1)*(depth/2-.145),phase:i*.137%4.3,side:pane<2?'x':'z'});
  }
  const material=new THREE.MeshPhysicalMaterial({color:0xacc6c7,roughness:.06,metalness:.1,clearcoat:1,envMapIntensity:1.4,transparent:true,opacity:.4,depthWrite:false});
  const mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(.024,10,8),material,drops.length);
  mesh.userData.ignoreAim=true;mesh.frustumCulled=false;root.add(mesh);
  root.userData.glassRain={mesh,drops};
}

function addBeam(root,start,end,radius,color,opacity) {
  const distance=start.distanceTo(end);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.16,radius,distance,32,1,true),new THREE.ShaderMaterial({
    uniforms:{tint:{value:new THREE.Color(color)},strength:{value:opacity}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv;uniform vec3 tint;uniform float strength;void main(){float fade=sin(vUv.y*3.14159);float edge=pow(abs(sin(vUv.x*6.28318)),3.0);gl_FragColor=vec4(tint,strength*fade*edge);}',
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide
  }));
  beam.position.copy(start).add(end).multiplyScalar(.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),start.clone().sub(end).normalize());
  beam.userData.ignoreAim=true;
  root.add(beam);
}

export class EnvironmentMotion {
  constructor(root,pattern) {
    this.root=root;
    this.pattern=pattern;
    this.wind=[];
    this.moving=[];
    this.fireflies=null;
    this.flickering=[];
    this.rainDummy=new THREE.Object3D();
    root.traverse(object=>{
      if(object.userData.breeze) this.addWind(object,object.userData.breeze);
      if(object.userData.sway) this.moving.push({object,rotation:object.rotation.clone(),...object.userData.sway});
      if(object.isLight && object.userData.flicker) this.flickering.push({object,intensity:object.intensity,phase:object.userData.flicker.phase});
    });
    if(pattern==='garden') this.addFireflies();
  }

  addWind(object,{amplitude=.025,phase=0,anchorHeight=0}) {
    const uniform={value:0};
    const material=object.material;
    material.onBeforeCompile=shader=>{
      shader.uniforms.breezeTime=uniform;
      shader.vertexShader='uniform float breezeTime;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float lift=${anchorHeight?`clamp((${(anchorHeight/2).toFixed(3)}-position.y)/${anchorHeight.toFixed(3)},0.0,1.0)`:'max(position.y,0.0)'};
        transformed.x+=sin(breezeTime*1.15+position.y*2.4+${Number(phase).toFixed(3)})*lift*${Number(amplitude).toFixed(4)};
        transformed.z+=cos(breezeTime*.8+position.y*1.7)*lift*${Number(amplitude*.4).toFixed(4)};`);
    };
    material.customProgramCacheKey=()=>`breeze-${amplitude}-${phase}-${anchorHeight}`;
    material.needsUpdate=true;
    this.wind.push(uniform);
  }

  addFireflies() {
    const positions=[],seeds=[];
    for(let i=0;i<45;i++) {
      const x=Math.sin(i*12.3)*8,y=.65+(i%7)*.24,z=Math.cos(i*8.8)*8;
      positions.push(x,y,z);
      seeds.push(i*1.93);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,1));
    const material=new THREE.ShaderMaterial({
      uniforms:{time:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'uniform float time;attribute float seed;varying float brightness;void main(){vec3 p=position;p.x+=sin(time*.6+seed)*.28;p.y+=sin(time*.9+seed)*.15;p.z+=cos(time*.5+seed)*.28;vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(35.0/-mv.z,2.0,9.0);brightness=.25+.75*pow(.5+.5*sin(time*1.6+seed),3.0);}',
      fragmentShader:'varying float brightness;void main(){float d=length(gl_PointCoord-.5)*2.0;float a=pow(max(0.0,1.0-d),2.0)*brightness;gl_FragColor=vec4(.72,1.0,.36,a);}'
    });
    this.fireflies=new THREE.Points(geometry,material);
    this.root.add(this.fireflies);
  }

  update(time) {
    this.wind.forEach(u=>{u.value=time;});
    this.moving.forEach(({object,rotation,amplitude=.04,phase=0})=>{
      object.rotation.z=rotation.z+Math.sin(time*.75+phase)*amplitude;
      object.rotation.x=rotation.x+Math.cos(time*.6+phase)*amplitude*.3;
    });
    if(this.fireflies) this.fireflies.material.uniforms.time.value=time;
    this.flickering.forEach(({object,intensity,phase})=>{object.intensity=intensity*(.94+.035*Math.sin(time*4.3+phase)+.025*Math.sin(time*7.1+phase));});
    const dust=this.root.userData.atmosphere;
    if(dust) {
      dust.rotation.y=Math.sin(time*.08)*.08;
      dust.position.y=Math.sin(time*.3)*.045;
    }
    const water=this.root.userData.water;
    if(water?.userData.waveTime) water.userData.waveTime.value=time;
    const rain=this.root.userData.glassRain;
    if(rain) {
      rain.drops.forEach((drop,index)=>{
        this.rainDummy.position.set(drop.x,4.8-(time*.1+drop.phase)%4.3,drop.z);
        this.rainDummy.scale.set(drop.side==='x'?.4:.7,2.4,drop.side==='z'?.4:.7);
        this.rainDummy.updateMatrix();rain.mesh.setMatrixAt(index,this.rainDummy.matrix);
      });
      rain.mesh.instanceMatrix.needsUpdate=true;
    }
  }
}
