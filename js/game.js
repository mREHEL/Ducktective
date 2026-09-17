import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { InteractionSystem } from './interactions.js';
import { EnvironmentMotion, lightEnvironment } from './environment.js';
import { createDetailedSofa, createPillow, createBook, createMug, createBotanicalPlant, createTool, createWateringCan, loadDecorModel, disposeObject } from './models.js';
import { additionalLevels, buildAdditionalLevel } from './extra-levels.js';
import { createAtticRoom } from './attic.js';
import { buildExploration } from './exploration.js';
import { createMainMenu } from './main-menu.js';

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const hud = $('hud');
  const startOverlay = $('startOverlay');
  const pauseOverlay = $('pauseOverlay');
  const settingsOverlay = $('settingsOverlay');
  const completeOverlay = $('completeOverlay');
  const toast = $('toast');

  const DEFAULT_SETTINGS = Object.freeze({
    sensitivity:1,
    bindings:Object.freeze({forward:'z',backward:'s',left:'q',right:'d',crouch:'Control',interact:'e'})
  });
  // Conserver la clé historique pour ne pas perdre les réglages lors du renommage.
  const SETTINGS_STORAGE_KEY='find-the-ducks-settings-v1';
  const DUCK_SIZE_MULTIPLIER=.765;
  let settings=loadSettings();
  let settingsReturnOverlay=startOverlay;
  let rebindingAction=null;

  let scene, camera, renderer, composer, bloomPass, occlusionPass, clock;
  let mainMenu;
  let interactionSystem, environmentMotion;
  let indoorEnvironment, gardenEnvironment;
  let isCrouching=false, blockedToastAt=0;
  let levelRoot, levelIndex = 0, found = 0, levelStartedAt = 0;
  let sessionStartLevel = 0;
  let yaw = 0, pitch = 0, isPlaying = false, transitioning = false;
  let walkCycle = 0, cameraBob = 0;
  let toastTimer, audioContext;
  const keys = Object.create(null);
  const ducks = [];
  const colliders = [];
  const player = { position: new THREE.Vector3(), radius: .38, height: 1.68, speed: 4.3 };
  const movement = new THREE.Vector3();
  let aimCheckDelay = 0;

  const levels = [
    {
      id:'living',mechanic:'Soulever les coussins pour révéler une cachette',
      name: 'Le salon douillet',
      sky: 0x18213b,
      fog: 0x18213b,
      floor: 0xc99061,
      wall: 0xf0d8b9,
      accent: 0xef7156,
      pattern: 'wood',
      bounds: [18, 16],
      spawn: [0, 1.68, 5.8],
      look: 0,
      ducks: [[0,.2272,.1,2.7,.64], [-6.9,.2485,-6.55,.2,.7], [-7.9,.2627,5.4,-1.4,.74], [5.5,.2485,1.1,-1.7,.7], [-5.8,.2485,-3.65,1.2,.7]],
      tip:'Les coussins se soulèvent avec ta touche d’interaction. Fouille aussi sous la table.',
      build: buildLivingRoom
    },
    {
      id:'workshop',mechanic:'Tourner la manivelle pour déplacer un bac',
      name: "L'atelier à jouets",
      sky: 0x101b29,
      fog: 0x101b29,
      floor: 0x526173,
      wall: 0xbac8cf,
      accent: 0x4dbbc7,
      pattern: 'concrete',
      bounds: [22, 18],
      spawn: [-8, 1.68, 6.4],
      look: -.15,
      ducks: [[7.95,.2343,-7.12,3.05,.66], [-9.38,.2272,-2.55,-1.5,.64], [3.38,.2414,-3.05,.1,.68], [3.1,.2343,.16,3.1,.66], [5.65,1.45,4.88,-.5,.68]],
      tip:'Une manivelle déplace un bac derrière le convoyeur. Vise-la puis interagis.',
      build: buildWorkshop
    },
    {
      id:'greenhouse',mechanic:'Écarter le feuillage pour fouiller les plantes',
      name: 'La serre au clair de lune',
      sky: 0x071b22,
      fog: 0x071b22,
      floor: 0x54765c,
      wall: 0x9fc5ba,
      accent: 0x8ee6ae,
      pattern: 'garden',
      bounds: [20, 20],
      spawn: [0, 1.68, 7.4],
      look: 0,
      ducks: [[-8.6,.2485,-6.25,.4,.7], [6.95,.2485,-6.18,-2.6,.7], [-7.52,.98,4.72,1.5,.68], [6.7,1,5.7,-1.6,.68], [2.14,.2343,-1.12,1.9,.66]],
      tip:'Certaines plantes s’écartent avec ta touche d’interaction.',
      build: buildGreenhouse
    },
    ...additionalLevels.map(data=>({...data,build:()=>buildAdditionalLevel(data,{
      root:levelRoot,colliders,interactions:interactionSystem,
      addBox,addCylinder,addRug,addArchedShelf,addBarrel,addPlant,addVase
    })}))
  ];

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 100);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .74;
    document.body.prepend(renderer.domElement);
    scene.add(camera);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const studio=new RoomEnvironment(renderer);
    indoorEnvironment=pmrem.fromScene(studio,.04);
    studio.dispose();
    scene.environment=indoorEnvironment.texture;
    pmrem.dispose();

    const flashlight = new THREE.SpotLight(0xfff0d4, 12, 9, Math.PI / 5.8, .72, 1.7);
    flashlight.position.set(0, 0, 0);
    flashlight.target.position.set(0, -.08, -1);
    camera.add(flashlight, flashlight.target);

    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(devicePixelRatio, 2));
    composer.addPass(new RenderPass(scene, camera));
    occlusionPass=new SSAOPass(scene,camera,innerWidth,innerHeight,16);
    occlusionPass.kernelRadius=.42;
    occlusionPass.minDistance=.0003;
    occlusionPass.maxDistance=.025;
    composer.addPass(occlusionPass);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .18, .48, 1.08);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    clock = new THREE.Clock();

    const query = new URLSearchParams(location.search);
    levels.forEach((level,index)=>$('levelSelect').add(new Option(`${String(index+1).padStart(2,'0')} — ${level.name}`,String(index))));
    mainMenu=createMainMenu(levels,index=>{
      $('levelSelect').value=String(index);
      $('levelSelect').dispatchEvent(new Event('change'));
    });
    const previewLevel = Math.max(0,Math.min(levels.length-1,Number(query.get('level'))||0));
    buildLevel(previewLevel);
    if (query.has('preview')) {
      startOverlay.classList.remove('active');
      startOverlay.style.display='none';
      $('loading').style.display='none';
      hud.classList.add('visible');
      camera.rotation.order='YXZ';
      camera.rotation.y=yaw;
      camera.rotation.x=pitch;
    }
    if (query.has('settings')) {
      startOverlay.classList.remove('active');
      settingsOverlay.classList.add('active');
    }
    bindEvents();
    if(query.has('test')) installTestHooks();
    animate();
    prepareStartButton();
  }

  function prepareStartButton() {
    const preparedRoot=levelRoot;
    $('startButton').disabled=true;
    Promise.all(preparedRoot.userData.pendingModels).finally(()=>{
      if(preparedRoot!==levelRoot)return;
      $('startButton').disabled=false;
      $('loading').classList.add('hidden');
    });
  }

  function bindEvents() {
    addEventListener('resize', onResize);
    addEventListener('keydown', (e) => {
      if (rebindingAction) {
        captureBinding(e);
        return;
      }
      if (settingsOverlay.classList.contains('active') && e.key === 'Escape') {
        e.preventDefault();
        closeSettings();
        return;
      }
      if(e.target instanceof HTMLSelectElement)return;
      if(e.target instanceof HTMLElement && e.target.closest('#startOverlay') && startOverlay.classList.contains('active'))return;
      if(e.key==='Escape' && isPlaying && document.pointerLockElement===renderer.domElement) {
        document.exitPointerLock();
        return;
      }
      const token=getKeyToken(e);
      keys[token]=true;
      if (isPlaying && !e.repeat && token===settings.bindings.interact && document.pointerLockElement===renderer.domElement) {
        const target=interactionSystem.aimed(camera);
        if(target && ['storage','object'].includes(target.type)) interactionSystem.toggle(target.object);
      }
      if (Object.values(settings.bindings).includes(token) || ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(token)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { keys[getKeyToken(e)] = false; });
    addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    addEventListener('blur', () => Object.keys(keys).forEach((key) => { keys[key] = false; }));
    renderer.domElement.addEventListener('click', () => {
      if (!isPlaying) return;
      if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock();
      else tryCollectAimedDuck();
    });
    $('startButton').addEventListener('click', () => startGame());
    $('levelSelect').addEventListener('change',event=>{
      buildLevel(Number(event.target.value));
      prepareStartButton();
    });
    $('resumeButton').addEventListener('click', () => renderer.domElement.requestPointerLock());
    $('nextButton').addEventListener('click', nextLevel);
    document.querySelectorAll('.settings-open').forEach((button) => {
      button.addEventListener('click', () => openSettings($(button.dataset.return)));
    });
    document.querySelectorAll('.key-bind').forEach((button) => {
      button.addEventListener('click', () => beginBinding(button.dataset.action));
    });
    $('sensitivitySlider').addEventListener('input', (e) => {
      settings.sensitivity=Number(e.target.value);
      saveSettings();
      updateSettingsUI();
    });
    $('resetSettings').addEventListener('click', resetSettings);
    $('closeSettings').addEventListener('click', closeSettings);
    updateSettingsUI();
  }

  function loadSettings() {
    const fallback={sensitivity:DEFAULT_SETTINGS.sensitivity,bindings:{...DEFAULT_SETTINGS.bindings}};
    try {
      const saved=JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY));
      if (!saved || typeof saved !== 'object') return fallback;
      const sensitivity=Number(saved.sensitivity);
      if (Number.isFinite(sensitivity)) fallback.sensitivity=Math.max(.35,Math.min(2.5,sensitivity));
      for (const action of Object.keys(fallback.bindings)) {
        if (typeof saved.bindings?.[action] === 'string') fallback.bindings[action]=saved.bindings[action];
      }
      // Une sauvegarde ancienne peut déjà utiliser E/Ctrl pour se déplacer.
      const used=new Set();
      for(const action of Object.keys(fallback.bindings)) {
        if(used.has(fallback.bindings[action])) fallback.bindings[action]=['Control','e','c','f','v','b'].find(key=>!used.has(key));
        used.add(fallback.bindings[action]);
      }
    } catch (error) {
      console.warn('Impossible de charger les paramètres sauvegardés.',error);
    }
    return fallback;
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY,JSON.stringify(settings));
    } catch (error) {
      console.warn('Impossible de sauvegarder les paramètres.',error);
    }
  }

  function getKeyToken(event) {
    if (event.code === 'Space') return 'Space';
    return event.key.length === 1 ? event.key.toLocaleLowerCase('fr') : event.key;
  }

  function keyLabel(token) {
    const labels={ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Space:'ESPACE',Shift:'MAJ',Control:'CTRL',Alt:'ALT',Enter:'ENTRÉE'};
    return labels[token] || (token.length === 1 ? token.toLocaleUpperCase('fr') : token.toLocaleUpperCase('fr'));
  }

  function updateSettingsUI() {
    document.querySelectorAll('.key-bind').forEach((button) => {
      if (button.dataset.action !== rebindingAction) button.textContent=keyLabel(settings.bindings[button.dataset.action]);
    });
    const movementOrder=['forward','left','backward','right'];
    const labels=movementOrder.map((action) => keyLabel(settings.bindings[action]));
    $('movementKeysLabel').textContent=labels.join(' ');
    ['Forward','Left','Backward','Right'].forEach((name,index) => { $(`hud${name}Key`).textContent=labels[index]; });
    ['Crouch','Interact'].forEach(name=>{
      const label=keyLabel(settings.bindings[name.toLowerCase()]);
      $(`hud${name}Key`).textContent=label;
      $(`menu${name}Key`).textContent=label;
    });
    $('sensitivitySlider').value=String(settings.sensitivity);
    $('sensitivityValue').textContent=`${settings.sensitivity.toFixed(2).replace('.',',')}×`;
  }

  function openSettings(returnOverlay) {
    settingsReturnOverlay=returnOverlay || startOverlay;
    Object.keys(keys).forEach((key) => { keys[key]=false; });
    settingsReturnOverlay.classList.remove('active');
    settingsOverlay.classList.add('active');
    updateSettingsUI();
  }

  function closeSettings() {
    cancelBinding();
    Object.keys(keys).forEach((key) => { keys[key]=false; });
    settingsOverlay.classList.remove('active');
    settingsReturnOverlay.classList.add('active');
  }

  function beginBinding(action) {
    cancelBinding();
    rebindingAction=action;
    const button=document.querySelector(`.key-bind[data-action="${action}"]`);
    button.classList.add('listening');
    button.textContent='…';
  }

  function cancelBinding() {
    rebindingAction=null;
    document.querySelectorAll('.key-bind').forEach((button) => button.classList.remove('listening'));
    updateSettingsUI();
  }

  function captureBinding(event) {
    event.preventDefault();
    if (event.key === 'Escape') {
      cancelBinding();
      return;
    }
    const token=getKeyToken(event);
    const action=rebindingAction;
    const previousAction=Object.keys(settings.bindings).find((name) => name !== action && settings.bindings[name] === token);
    if (previousAction) settings.bindings[previousAction]=settings.bindings[action];
    settings.bindings[action]=token;
    Object.keys(keys).forEach((key) => { keys[key]=false; });
    saveSettings();
    cancelBinding();
  }

  function resetSettings() {
    settings={sensitivity:DEFAULT_SETTINGS.sensitivity,bindings:{...DEFAULT_SETTINGS.bindings}};
    saveSettings();
    cancelBinding();
  }

  function startGame() {
    ensureAudio();
    sessionStartLevel=levelIndex;
    startOverlay.classList.remove('active');
    hud.classList.add('visible');
    isPlaying = true;
    levelStartedAt = performance.now();
    renderer.domElement.requestPointerLock();
    if(levels[levelIndex].tip)showToast(levels[levelIndex].tip);
  }

  function onPointerLockChange() {
    const locked = document.pointerLockElement === renderer.domElement;
    if (locked) {
      pauseOverlay.classList.remove('active');
      isPlaying = true;
      clock.getDelta();
    } else if (isPlaying && !transitioning && !startOverlay.classList.contains('active')) {
      isPlaying = false;
      $('crosshair').classList.remove('target');
      $('crosshair').classList.remove('storage-target');
      $('interactionPrompt').classList.remove('visible');
      Object.keys(keys).forEach(key=>{keys[key]=false;});
      pauseOverlay.classList.add('active');
    }
  }

  function onMouseMove(e) {
    if (document.pointerLockElement !== renderer.domElement || !isPlaying) return;
    yaw -= e.movementX * .00215 * settings.sensitivity;
    pitch -= e.movementY * .00185 * settings.sensitivity;
    pitch = Math.max(-1.35, Math.min(1.35, pitch));
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    composer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(Math.min(devicePixelRatio, 2));
  }

  function buildLevel(index) {
    if (levelRoot) {
      scene.remove(levelRoot);
      disposeObject(levelRoot);
    }

    levelIndex = index;
    $('levelSelect').value=String(index);
    found = 0;
    $('crosshair').classList.remove('target');
    ducks.length = 0;
    colliders.length = 0;
    isCrouching=false;
    player.height=1.68;
    cameraBob=0;
    $('interactionPrompt').classList.remove('visible');
    $('crouchIndicator').classList.remove('visible');
    levelRoot = new THREE.Group();
    levelRoot.userData.hiddenDucks={};
    levelRoot.userData.pendingModels=[];
    scene.add(levelRoot);
    interactionSystem=new InteractionSystem(levelRoot,colliders);

    const data = levels[index];
    if(data.pattern==='garden' || data.nightEnvironment) {
      if(!gardenEnvironment) {
        const night=new THREE.Scene();
        night.add(new THREE.Mesh(new THREE.SphereGeometry(25,24,12),new THREE.MeshBasicMaterial({color:0x243b5d,side:THREE.BackSide})));
        const moon=new THREE.Mesh(new THREE.SphereGeometry(1.5,16,12),new THREE.MeshBasicMaterial({color:0xc3ddff}));
        moon.position.set(-6,8,-5);night.add(moon);
        const pmrem=new THREE.PMREMGenerator(renderer);
        gardenEnvironment=pmrem.fromScene(night,.06);
        pmrem.dispose();disposeObject(night);
      }
      scene.environment=gardenEnvironment.texture;
    } else scene.environment=indoorEnvironment.texture;
    scene.background = new THREE.Color(data.sky);
    scene.fog = new THREE.Fog(data.pattern==='garden'?0x0b1c2b:data.fog, 18, 45);
    player.position.set(...data.spawn);
    yaw = data.look;
    pitch = 0;

    addSkyDome(data);
    addRoom(data);
    data.build(data);
    data.ducks.forEach((position, i) => {
      const duck=createDuck(position,i);
      if(levelRoot.userData.hiddenDucks[i]) interactionSystem.placeDuck(levelRoot.userData.hiddenDucks[i],duck);
    });
    buildExploration(data,{root:levelRoot,colliders,interactions:interactionSystem,ducks});
    environmentMotion=new EnvironmentMotion(levelRoot,data.pattern);

    $('levelNumber').textContent = String(index + 1).padStart(2, '0');
    $('levelName').textContent = data.name;
    $('levelMechanic').textContent=data.mechanic;
    $('levelSelectionHint').textContent=data.mechanic+'. Tous les niveaux sont accessibles.';
    mainMenu?.selectLevel(index);
    updateCounter();
    camera.position.copy(player.position);
  }

  function addRoom(data) {
    const [width, depth] = data.bounds;
    if(data.architecture==='attic') {
      createAtticRoom(levelRoot,colliders,data);
      lightEnvironment(levelRoot,data,renderer,bloomPass);
      addAtmosphere(width,depth,0xffd6a0);
      return;
    }
    const floorMat = material(0xffffff, .88, 0);
    floorMat.map = createFloorTexture(data.pattern, data.floor);
    floorMat.bumpMap = floorMat.map;
    floorMat.bumpScale = data.pattern === 'wood' ? .028 : .014;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    levelRoot.add(floor);

    const wallMat = data.pattern === 'garden'
      ? new THREE.MeshPhysicalMaterial({ color: data.wall, roughness: .12, metalness: 0, transparent: true, opacity: .24, transmission: .18, depthWrite: false })
      : material(0xffffff, .92, 0);
    if (data.pattern !== 'garden') {
      wallMat.map = createWallTexture(data.wall);
      wallMat.bumpMap = wallMat.map;
      wallMat.bumpScale = .009;
    }
    const walls = [
      addBox(0, 2.6, -depth / 2, width, 5.2, .22, wallMat),
      addBox(-width / 2, 2.6, 0, .22, 5.2, depth, wallMat),
      addBox(width / 2, 2.6, 0, .22, 5.2, depth, wallMat),
      addBox(0, 2.6, depth / 2, width, 5.2, .22, wallMat)
    ];
    if (data.pattern === 'garden') walls.forEach((wall) => { wall.castShadow = false; });
    else {
      const ceiling = addBox(0,5.15,0,width-.15,.1,depth-.15,wallMat,false);
      ceiling.castShadow = false;
    }

    // Plinthes et moulures : elles donnent de la profondeur aux murs sans gêner le joueur.
    const trimMat = material(new THREE.Color(data.wall).multiplyScalar(.7), .76);
    addBox(0, .16, -depth / 2 + .14, width - .25, .28, .1, trimMat, false);
    addBox(0, .16, depth / 2 - .14, width - .25, .28, .1, trimMat, false);
    addBox(-width / 2 + .14, .16, 0, .1, .28, depth - .25, trimMat, false);
    addBox(width / 2 - .14, .16, 0, .1, .28, depth - .25, trimMat, false);

    lightEnvironment(levelRoot,data,renderer,bloomPass);

    addAtmosphere(width, depth, data.pattern === 'garden' ? 0x9fe5bb : 0xffe0a8);
  }

  function createFloorTexture(type, baseColor) {
    if (type === 'wood') {
      const texture = new THREE.TextureLoader().load('./assets/walnut-parquet.png');
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(3.2, 3.2);
      texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
      return texture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const base = `#${new THREE.Color(baseColor).getHexString()}`;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);

    if (type === 'concrete') {
      for (let i = 0; i < 900; i++) {
        const shade = i % 2 ? 255 : 15;
        ctx.fillStyle = `rgba(${shade},${shade},${shade},${.015 + (i%5)*.004})`;
        const size = 1 + i % 3;
        ctx.fillRect((i*83)%512, (i*137)%512, size, size);
      }
      ctx.strokeStyle = 'rgba(15,23,31,.16)';
      ctx.lineWidth = 2;
      for (let p = 0; p <= 512; p += 128) {
        ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(512,p); ctx.stroke();
      }
    } else {
      for (let i = 0; i < 1100; i++) {
        const light = i % 3 === 0;
        ctx.strokeStyle = light ? 'rgba(160,210,143,.13)' : 'rgba(22,61,37,.12)';
        const x = (i*97)%512, y = (i*61)%512;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+(i%7)-3,y-3-(i%8)); ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(type === 'wood' ? 2.3 : 3.2, type === 'wood' ? 2.3 : 3.2);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function createWallTexture(baseColor) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `#${new THREE.Color(baseColor).getHexString()}`;
    ctx.fillRect(0,0,512,512);
    for (let i=0;i<1500;i++) {
      const light=i%2===0;
      ctx.fillStyle=light ? `rgba(255,255,255,${.012+(i%5)*.003})` : `rgba(45,35,31,${.008+(i%4)*.003})`;
      const x=(i*71)%512, y=(i*131)%512;
      ctx.fillRect(x,y,1+(i%3),1+(i%2));
    }
    for (let i=0;i<18;i++) {
      ctx.strokeStyle='rgba(255,255,255,.018)';
      ctx.lineWidth=5+(i%4)*3;
      ctx.beginPath();
      const y=(i*89)%512;
      ctx.moveTo(0,y); ctx.bezierCurveTo(160,y+18,350,y-14,512,y+5); ctx.stroke();
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(3,2);
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function addSkyDome(data) {
    const palettes = {
      wood: [0x111a32, 0x745040],
      concrete: [0x07111e, 0x2e5260],
      garden: [0x020a16, 0x17483f]
    };
    const colors = palettes[data.pattern];
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(42, 32, 18),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color(colors[0]) },
          bottomColor: { value: new THREE.Color(colors[1]) },
          offset: { value: 1.8 },
          exponent: { value: .8 }
        },
        vertexShader: 'varying vec3 vWorld; void main(){ vec4 worldPosition = modelMatrix * vec4(position,1.0); vWorld = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorld; void main(){ float h=normalize(vWorld+vec3(0.0,offset,0.0)).y; gl_FragColor=vec4(mix(bottomColor,topColor,max(pow(max(h,0.0),exponent),0.0)),1.0); }'
      })
    );
    dome.userData.sky = true;
    dome.userData.ignoreAim=true;
    levelRoot.add(dome);

    if (data.pattern === 'garden') {
      const starGeo = new THREE.BufferGeometry();
      const vertices = [];
      for (let i=0;i<180;i++) {
        const angle=i*2.399, radius=20+(i%17);
        vertices.push(Math.cos(angle)*radius, 5+(i%23)*1.15, Math.sin(angle)*radius);
      }
      starGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      levelRoot.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xcfe8ff,size:.075,transparent:true,opacity:.72,depthWrite:false})));
    }
  }

  function addAtmosphere(width, depth, color) {
    const count = 95;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i*3] = ((i*73)%101/100-.5) * (width-.8);
      positions[i*3+1] = .4 + ((i*47)%97/96) * 4.25;
      positions[i*3+2] = ((i*89)%103/102-.5) * (depth-.8);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({
      color, size: .025, transparent: true, opacity: .32, depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    points.userData.atmosphere = true;
    levelRoot.add(points);
    levelRoot.userData.atmosphere = points;
  }

  function material(color, roughness = .72, metalness = .02, emissive = 0x000000) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: .35, envMapIntensity: .58 });
  }

  function addBox(x, y, z, w, h, d, mat, solid = true, bevel = true) {
    const geometry = bevel && Math.min(w,h,d) >= .055
      ? new RoundedBoxGeometry(w, h, d, 5, Math.min(.18, w*.22, h*.22, d*.22))
      : new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    levelRoot.add(mesh);
    if (solid) colliders.push(new THREE.Box3().setFromObject(mesh));
    return mesh;
  }

  function addCylinder(x, y, z, radius, height, mat, solid = true, sides = 24) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    levelRoot.add(mesh);
    if (solid) colliders.push(new THREE.Box3().setFromObject(mesh));
    return mesh;
  }

  function addRug(x, z, w, d, color) {
    const radius=Math.min(.42,w*.12,d*.12);
    const shape=new THREE.Shape();
    shape.moveTo(-w/2+radius,-d/2);
    shape.lineTo(w/2-radius,-d/2);
    shape.quadraticCurveTo(w/2,-d/2,w/2,-d/2+radius);
    shape.lineTo(w/2,d/2-radius);
    shape.quadraticCurveTo(w/2,d/2,w/2-radius,d/2);
    shape.lineTo(-w/2+radius,d/2);
    shape.quadraticCurveTo(-w/2,d/2,-w/2,d/2-radius);
    shape.lineTo(-w/2,-d/2+radius);
    shape.quadraticCurveTo(-w/2,-d/2,-w/2+radius,-d/2);
    const rug = new THREE.Mesh(new THREE.ShapeGeometry(shape,16), material(color, 1));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(x, .012, z);
    rug.receiveShadow = true;
    levelRoot.add(rug);
  }

  function createFabricMaterial(color, texturePath = null) {
    const fabric = new THREE.MeshPhysicalMaterial({
      color, roughness:.92, metalness:0, sheen:1,
      sheenColor:new THREE.Color(color).lerp(new THREE.Color(0xffffff),.3),
      sheenRoughness:.82, envMapIntensity:.32
    });
    if (texturePath) {
      const texture=new THREE.TextureLoader().load(texturePath);
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.repeat.set(5,5);
      texture.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
      fabric.color.set(0xffffff);
      fabric.map=texture;
      fabric.bumpMap=texture;
      fabric.bumpScale=.022;
    } else {
      const canvas=document.createElement('canvas');
      canvas.width=canvas.height=128;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#888';ctx.fillRect(0,0,128,128);
      for(let i=0;i<128;i+=3) {
        ctx.fillStyle=i%2?'#aaa':'#666';ctx.fillRect(i,0,1,128);
        ctx.fillStyle=i%2?'#999':'#777';ctx.fillRect(0,i,128,1);
      }
      fabric.bumpMap=new THREE.CanvasTexture(canvas);
      fabric.bumpMap.wrapS=fabric.bumpMap.wrapT=THREE.RepeatWrapping;
      fabric.bumpMap.repeat.set(5,5);
      fabric.bumpScale=.008;
    }
    return fabric;
  }

  function addSofa(x,z,width,depth,rotation,fabric) {
    const group=createDetailedSofa(width,depth,fabric);
    group.position.set(x,0,z);
    group.rotation.y=rotation;
    levelRoot.add(group);
    colliders.push(new THREE.Box3().setFromObject(group));
    return group;
  }

  function addCushion(x,y,z,sx,sy,sz,color,rotationY=0) {
    const cushion=createPillow(sx,sy,sz,createFabricMaterial(color));
    cushion.position.set(x,y,z);
    cushion.rotation.y=rotationY;
    cushion.rotation.z=Math.sin(x+z)*.08;
    cushion.castShadow=true;
    levelRoot.add(cushion);
    return cushion;
  }

  function addOvalTable(x,z,wood) {
    const top=new THREE.Mesh(new THREE.CylinderGeometry(1.36,1.31,.22,48),wood);
    top.scale.z=.55;
    top.position.set(x,.46,z);
    top.castShadow=top.receiveShadow=true;
    levelRoot.add(top);
    colliders.push(new THREE.Box3().setFromObject(top));

    const legMat=material(0x3b3030,.36,.38);
    [-.78,.78].forEach(lx => {
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.07,.12,.68,16),legMat);
      leg.position.set(x+lx,.34,z);
      leg.rotation.z=lx*.09;
      leg.castShadow=true;
      levelRoot.add(leg);
    });
  }

  function addSteppingStone(x,z,index,stone) {
    const geometry=new THREE.CylinderGeometry(.72+(index%3)*.035,.76,.1,9);
    const mesh=new THREE.Mesh(geometry,stone);
    mesh.scale.x=1.35;
    mesh.position.set(x+Math.sin(index*2.1)*.08,.05,z);
    mesh.rotation.y=index*.63;
    mesh.castShadow=mesh.receiveShadow=true;
    levelRoot.add(mesh);
  }

  function addVase(x,y,z,color,scale=1) {
    const points=[
      new THREE.Vector2(.13,0),new THREE.Vector2(.24,.04),new THREE.Vector2(.3,.22),
      new THREE.Vector2(.27,.48),new THREE.Vector2(.17,.66),new THREE.Vector2(.14,.78),
      new THREE.Vector2(.21,.82)
    ].map(point => new THREE.Vector2(point.x*scale,point.y*scale));
    const vase=new THREE.Mesh(new THREE.LatheGeometry(points,40),new THREE.MeshPhysicalMaterial({
      color,roughness:.22,metalness:.03,clearcoat:1,clearcoatRoughness:.12
    }));
    vase.position.set(x,y,z);
    vase.castShadow=true;
    levelRoot.add(vase);
    return vase;
  }

  function addCurtain(x,y,z,width,height,color) {
    const geometry=new THREE.PlaneGeometry(width,height,14,18);
    const positions=geometry.attributes.position;
    for (let i=0;i<positions.count;i++) {
      const px=positions.getX(i);
      const py=positions.getY(i);
      const fold=Math.sin((px/width+.5)*Math.PI*7)*.075;
      positions.setZ(i,fold+(py/height)*.025);
    }
    geometry.computeVertexNormals();
    const curtain=new THREE.Mesh(geometry,createFabricMaterial(color));
    curtain.position.set(x,y,z);
    curtain.castShadow=curtain.receiveShadow=true;
    curtain.userData.sway={phase:x,amplitude:.008};
    curtain.userData.breeze={phase:x,amplitude:.035,anchorHeight:height};
    levelRoot.add(curtain);
    return curtain;
  }

  function addArchedShelf(x,z,width,wood,dark) {
    const group=new THREE.Group();
    const part=(geometry,mat,px,py,pz) => {
      const mesh=new THREE.Mesh(geometry,mat);
      mesh.position.set(px,py,pz);
      mesh.castShadow=mesh.receiveShadow=true;
      group.add(mesh);
      return mesh;
    };
    part(new THREE.CylinderGeometry(.14,.21,2.18,24),wood,-width/2+.18,1.09,0);
    part(new THREE.CylinderGeometry(.14,.21,2.18,24),wood,width/2-.18,1.09,0);
    [.42,1.12,1.82].forEach(y => part(new RoundedBoxGeometry(width,.11,.52,5,.05),dark,0,y,0));

    const arch=part(new THREE.TorusGeometry(1,.15,12,42,Math.PI),wood,0,1.78,0);
    arch.scale.set((width-.34)/2,.68,1);
    part(new THREE.SphereGeometry(.22,20,12),wood,-width/2+.18,2.18,0);
    part(new THREE.SphereGeometry(.22,20,12),wood,width/2-.18,2.18,0);

    group.position.set(x,0,z);
    levelRoot.add(group);
    group.userData.collider=new THREE.Box3(
      new THREE.Vector3(x-width/2,0,z-.32),
      new THREE.Vector3(x+width/2,2.52,z+.32)
    );
    colliders.push(group.userData.collider);
    return group;
  }

  function addPillConsole(x,z,width,consoleMat,dark) {
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.42,width-.84,10,28),consoleMat);
    body.rotation.z=Math.PI/2;
    body.scale.z=.7;
    body.position.set(x,.48,z);
    body.castShadow=body.receiveShadow=true;
    levelRoot.add(body);
    colliders.push(new THREE.Box3().setFromObject(body));

    [-.58,.58].forEach(offset => {
      const door=new THREE.Mesh(new THREE.CircleGeometry(.25,28),dark);
      door.scale.set(1.55,1,1);
      door.position.set(x+offset,.48,z+.305);
      levelRoot.add(door);
      const knob=new THREE.Mesh(new THREE.SphereGeometry(.035,12,8),material(0xd5b466,.25,.7));
      knob.position.set(x+offset,.48,z+.33);
      levelRoot.add(knob);
    });
    return body;
  }

  function createBlobShape(width,depth,seed=0,segments=34) {
    const points=[];
    for (let i=0;i<segments;i++) {
      const angle=i/segments*Math.PI*2;
      const variation=1+Math.sin(angle*3+seed)*.055+Math.sin(angle*5-seed*.7)*.025;
      points.push(new THREE.Vector2(Math.cos(angle)*width*.5*variation,Math.sin(angle)*depth*.5*variation));
    }
    const shape=new THREE.Shape();
    shape.moveTo(points[0].x,points[0].y);
    shape.splineThru(points.slice(1));
    shape.lineTo(points[0].x,points[0].y);
    return shape;
  }

  function addBlobPlanter(x,z,width,depth,seed,outerMat,soilMat) {
    const outerGeometry=new THREE.ExtrudeGeometry(createBlobShape(width,depth,seed),{
      depth:.55,steps:1,curveSegments:24,bevelEnabled:true,bevelSegments:4,bevelSize:.1,bevelThickness:.08
    });
    outerGeometry.rotateX(-Math.PI/2);
    const outer=new THREE.Mesh(outerGeometry,outerMat);
    outer.position.set(x,.04,z);
    outer.castShadow=outer.receiveShadow=true;
    levelRoot.add(outer);
    colliders.push(new THREE.Box3().setFromObject(outer));

    const soilGeometry=new THREE.ExtrudeGeometry(createBlobShape(width-.34,depth-.34,seed+.3),{
      depth:.09,steps:1,curveSegments:20,bevelEnabled:true,bevelSegments:2,bevelSize:.035,bevelThickness:.025
    });
    soilGeometry.rotateX(-Math.PI/2);
    const soil=new THREE.Mesh(soilGeometry,soilMat);
    soil.position.set(x,.64,z);
    soil.receiveShadow=true;
    levelRoot.add(soil);
  }

  function addBarrel(x,z,scale,color) {
    const profile=[
      new THREE.Vector2(.38,0),new THREE.Vector2(.47,.12),new THREE.Vector2(.52,.45),
      new THREE.Vector2(.5,.82),new THREE.Vector2(.42,1),new THREE.Vector2(.34,1.04),new THREE.Vector2(0,1.04)
    ].map(point => new THREE.Vector2(point.x*scale,point.y*scale));
    const body=new THREE.Mesh(new THREE.LatheGeometry(profile,32),material(color,.58,.08));
    body.position.set(x,0,z);
    body.castShadow=body.receiveShadow=true;
    levelRoot.add(body);
    const bandMat=material(0x293742,.25,.72);
    [.16,.84].forEach(y => {
      const band=new THREE.Mesh(new THREE.TorusGeometry(.47*scale,.045*scale,10,28),bandMat);
      band.rotation.x=Math.PI/2;
      band.position.set(x,y*scale,z);
      levelRoot.add(band);
    });
    colliders.push(new THREE.Box3().setFromObject(body));
  }

  function addToyBin(x,z,scale,color) {
    const group=new THREE.Group();
    const bin=new THREE.Mesh(new THREE.CylinderGeometry(.62*scale,.48*scale,.7*scale,28,1,true),new THREE.MeshPhysicalMaterial({
      color,roughness:.42,clearcoat:.45,clearcoatRoughness:.3,side:THREE.DoubleSide
    }));
    bin.position.y=.35*scale;
    bin.castShadow=bin.receiveShadow=true;
    group.add(bin);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.62*scale,.045*scale,10,30),material(0xe2e7e6,.35,.18));
    rim.rotation.x=Math.PI/2;
    rim.position.y=.7*scale;
    group.add(rim);
    for (let i=0;i<4;i++) {
      const toy=new THREE.Mesh(i%2 ? new THREE.SphereGeometry(.15*scale,14,10) : new THREE.CapsuleGeometry(.09*scale,.2*scale,5,10),material([0xf1b53f,0x5cbac3,0xe4685b,0x7c91c4][i],.55));
      toy.position.set((- .3+i*.2)*scale,(.75+(i%2)*.08)*scale,Math.sin(i*2.2)*.18*scale);
      toy.rotation.z=i*.5;
      toy.castShadow=true;
      group.add(toy);
    }
    group.position.set(x,0,z);
    group.rotation.y=x*.13;
    levelRoot.add(group);
    colliders.push(new THREE.Box3().setFromObject(group));
  }

  function addSackPile(x,z,scale,color) {
    [[0,0,1],[-.38,.08,.72],[.38,.03,.68]].forEach(([ox,oz,s],i) => {
      const sack=new THREE.Mesh(new THREE.SphereGeometry(.48*scale*s,22,14),createFabricMaterial(color));
      sack.scale.set(1,.66,.72);
      sack.position.set(x+ox*scale,.3*scale*s,z+oz*scale);
      sack.rotation.y=i*.8;
      sack.castShadow=sack.receiveShadow=true;
      levelRoot.add(sack);
      colliders.push(new THREE.Box3().setFromObject(sack));
    });
  }

  function addPlant(x, z, scale = 1) {
    const plant=createBotanicalPlant(scale,x+z);
    plant.position.set(x,0,z);
    levelRoot.add(plant);
    colliders.push(new THREE.Box3(new THREE.Vector3(x-.37*scale,0,z-.37*scale),new THREE.Vector3(x+.37*scale,.61*scale,z+.37*scale)));
  }

  function addLamp(x, z, color = 0xffd990) {
    const metal=material(0x363946,.25,.78);
    const curve=new THREE.CubicBezierCurve3(
      new THREE.Vector3(x,.08,z),
      new THREE.Vector3(x,1.15,z),
      new THREE.Vector3(x+.2,2.05,z),
      new THREE.Vector3(x+.62,2.02,z)
    );
    const stem=new THREE.Mesh(new THREE.TubeGeometry(curve,20,.045,10,false),metal);
    stem.castShadow=true;
    levelRoot.add(stem);
    addCylinder(x,.06,z,.34,.12,metal,false,28);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.52, .7, 20, 1, true), material(0xe8c57a, .8));
    shade.position.set(x+.62, 1.78, z);
    shade.castShadow = true;
    levelRoot.add(shade);
    const light = new THREE.PointLight(color, 9, 7, 2);
    light.position.set(x+.62, 1.64, z);
    levelRoot.add(light);
  }

  function buildLivingRoom(data) {
    addRug(0, 0, 7.2, 5.3, 0x376b72);
    const wood = material(0x7a4834, .72);
    const coral = createFabricMaterial(0xffffff,'./assets/coral-boucle-fabric.png');
    const cream = createFabricMaterial(0xeee1cf);
    const dark = material(0x273044, .78);

    // Motif géométrique tissé dans le tapis.
    for (let size = .75; size < 2.75; size += .42) {
      const stripe = new THREE.Mesh(new THREE.RingGeometry(size, size + .045, 4), material(size % 2 > 1 ? 0xe7c477 : 0x77a2a1, 1));
      stripe.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
      stripe.scale.set(1.18, .82, 1);
      stripe.position.y = .018;
      levelRoot.add(stripe);
    }

    addOvalTable(0,.1,wood);
    // Livres glissés sous la table : ils masquent le canard depuis l'entrée,
    // mais laissent une vue de côté en s'accroupissant.
    const floorBooks=new THREE.Group();
    for(let i=0;i<3;i++) {
      const book=createBook(.085,.68,.42,[0x426167,0x776650,0x53697e][i]);
      book.rotation.z=Math.PI/2;
      book.rotation.y=(i-1)*.04;
      book.position.set(-.12,.057+i*.09,.46);
      floorBooks.add(book);
    }
    levelRoot.add(floorBooks);
    colliders.push(new THREE.Box3().setFromObject(floorBooks));

    // Petits objets sur la table pour casser les grandes surfaces plates.
    addCylinder(-.62,.69,.02,.22,.18,material(0xd9ecdf,.42),false,24);
    const mug=createMug();mug.position.set(.58,.585,.18);levelRoot.add(mug);
    const bookOnTable = addBox(.05,.65,-.18,.72,.08,.48,material(0x314f6c,.78),false);
    bookOnTable.rotation.y = -.12;

    addSofa(-5.8,-.8,5.2,2.45,-Math.PI/2,coral);
    // Coussins ronds, assez grands pour créer de vraies cachettes visuelles.
    addCushion(-6.52,1.18,-1.75,.18,.7,.74,0x315d68,.1);
    addCushion(-6.5,1.15,.28,.18,.68,.7,0xf2bf66,-.08);

    addArchedShelf(5.95,-5.9,3.7,wood,dark);
    for (let i = 0; i < 12; i++) {
      const x = 4.4 + (i % 6) * .57;
      const y = i < 6 ? .77 : 1.47;
      const book=createBook(.32,.52+(i%3)*.1,.3,[0xc56a5f,0x5a829b,0xe3b650,0x738d69][i%4]);
      book.position.set(x,y,-5.66);
      levelRoot.add(book);
      book.rotation.z = (i%4===0 ? .08 : 0);
    }

    addSofa(5.1,2.2,3.5,1.45,Math.PI,cream);
    addCushion(4.35,1.18,1.72,.72,.62,.18,0xe2b96f,-.15);
    addCushion(5.58,1.15,1.72,.68,.58,.18,0x8aa4a0,.12);
    levelRoot.userData.pendingModels.push(loadDecorModel(levelRoot,'./assets/sheen-chair.glb',{position:[1.8,0,-5.9],width:1.45,rotation:.2},colliders));
    const sideDrawer=interactionSystem.addStorage({x:2.65,z:2.2,width:1.35,height:1.05,depth:.9,kind:'drawer',label:'le tiroir du salon'});
    const sideCabinet=interactionSystem.addStorage({x:-7.2,z:-4.7,width:1.3,height:1.4,depth:.95,label:'le placard du salon'});
    levelRoot.userData.hiddenDucks[1]=sideDrawer;
    levelRoot.userData.hiddenDucks[4]=sideCabinet;
    addVase(2.65,1.27,2.2,0x6e9b98,.48);

    addPlant(-7.2, 5.5, 1.05);
    addPlant(7.1, -1.1, .92);
    addLamp(2.55, -4.75);

    // Meuble TV et écran avec une légère lueur bleutée.
    addPillConsole(-5.25,-6.75,2.7,wood,dark);
    addBox(-5.25,1.62,-7.22,2.65,1.45,.12,dark,false);
    addBox(-5.25,1.62,-7.14,2.32,1.15,.035,material(0x142f42,.22,.05,0x173b55),false);
    addCylinder(-6.1,.98,-6.84,.05,.45,dark,false,10);
    addCylinder(-4.4,.98,-6.84,.05,.45,dark,false,10);

    // Suspension centrale.
    addCylinder(0,4.65,-.25,.035,1.05,dark,false,10);
    const pendant = new THREE.Mesh(new THREE.ConeGeometry(.62,.62,28,1,true),material(0xe9b95f,.75));
    pendant.position.set(0,4.02,-.25);
    levelRoot.add(pendant);
    const pendantLight = new THREE.PointLight(0xffd9a0,12,9,2);
    pendantLight.position.set(0,3.83,-.25);
    levelRoot.add(pendantLight);

    // Fenêtre décorative
    const windowMat=material(0xffffff,.6,0,0xe99d69);
    const vista=document.createElement('canvas');vista.width=512;vista.height=256;
    const vistaCtx=vista.getContext('2d'),gradient=vistaCtx.createLinearGradient(0,0,0,256);
    gradient.addColorStop(0,'#67899c');gradient.addColorStop(.55,'#f4b787');gradient.addColorStop(1,'#db9365');
    vistaCtx.fillStyle=gradient;vistaCtx.fillRect(0,0,512,256);
    vistaCtx.fillStyle='#ffd2a0';vistaCtx.beginPath();vistaCtx.arc(355,118,25,0,Math.PI*2);vistaCtx.fill();
    vistaCtx.fillStyle='#596a5a';vistaCtx.beginPath();vistaCtx.moveTo(0,212);vistaCtx.bezierCurveTo(130,160,240,230,512,177);vistaCtx.lineTo(512,256);vistaCtx.lineTo(0,256);vistaCtx.fill();
    windowMat.map=new THREE.CanvasTexture(vista);windowMat.map.colorSpace=THREE.SRGBColorSpace;
    addBox(-2.2, 2.85, -7.82, 4.7, 2.2, .08, windowMat, false);
    addBox(-2.2, 2.85, -7.72, .09, 2.2, .08, dark, false);
    addBox(-2.2, 2.85, -7.7, 4.7, .09, .08, dark, false);
    addCurtain(-4.46,2.78,-7.57,.78,2.75,0xd4a06f);
    addCurtain(.06,2.78,-7.57,.78,2.75,0xd4a06f);
    addVase(-5.95,.91,-6.68,0x4a7781,.72);

    // Cadres au mur
    addBox(7.82, 2.8, 1.1, .08, 1.65, 1.35, wood, false);
    addBox(7.76, 2.8, 1.1, .05, 1.32, 1.03, material(0xf2ab52), false);
    addBox(7.78,2.75,-2.1,.06,1.1,1.55,wood,false);
    addBox(7.73,2.75,-2.1,.04,.88,1.3,material(0x6f93a8),false);
  }

  function buildWorkshop(data) {
    const steel = material(0x344758, .46, .55);
    const teal = material(data.accent, .62, .08);
    const orange = material(0xf29b38, .75);
    const crate = material(0xa77342, .92);

    addRug(0, 0, 18, 1.8, 0x3e4d5d);

    // Bandes de sécurité peintes au sol.
    for (let i = 0; i <= 20; i++) {
      const x = -8 + i * .8;
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(.38,1.25),material(i%2===0 ? 0xf0b431 : 0x252d34,.9));
      stripe.rotation.x = -Math.PI/2;
      stripe.rotation.z = -.38;
      stripe.position.set(x,.019,3.05);
      levelRoot.add(stripe);
    }

    // Deux établis
    [[-4.2,-5.7], [5.9,4.9]].forEach(([x,z], bench) => {
      addBox(x, 1.05, z, 4.3, .27, 1.45, material(0x805733, .82));
      addBox(x-1.7, .52, z, .25, 1.05, 1.1, steel);
      addBox(x+1.7, .52, z, .25, 1.05, 1.1, steel);

      // Panneau perforé et outils au-dessus de chaque établi.
      addBox(x,2.28,z-.66,4.1,1.65,.1,material(bench ? 0x36535b : 0x4a565d,.78),false);
      for (let i = 0; i < 18; i++) {
        addCylinder(x-1.7+(i%6)*.68,1.82+Math.floor(i/6)*.42,z-.58,.025,.025,material(0x9eabb0,.3,.65),false,8).rotation.x=Math.PI/2;
      }
      for (let i = 0; i < 4; i++) {
        const tool=createTool(i, i%2?0xf29b38:0x4dbbc7);
        tool.position.set(x-1.25+i*.78,2.15+(i%2)*.22,z-.48);
        levelRoot.add(tool);
        tool.rotation.z = i%2 ? .16 : -.12;
      }

      // Jouets et pièces sur la table : l'un des canards se fond parmi eux.
      levelRoot.userData.pendingModels.push(loadDecorModel(levelRoot,'./assets/toy-car.glb',{position:[x+.5,1.19,z],width:.68,rotation:bench?-.3:.4}));
      addToyBlock(x+1.18,1.34,z+.16,.24,bench ? 0xf0bd3f : 0xda6a55);
      addCylinder(x-.8,1.35,z+.1,.19,.34,bench ? teal : orange,false,16);
    });

    const toolDrawer=interactionSystem.addStorage({x:5.9,z:4.9,width:1.32,height:.68,depth:.95,kind:'drawer',label:'le tiroir de l’établi',color:0x397f8b});
    const toolCabinet=interactionSystem.addStorage({x:-.45,z:-6.7,width:1.65,height:1.35,depth:.95,label:'l’armoire à outils',color:0x37586a});
    levelRoot.userData.hiddenDucks[4]=toolDrawer;
    levelRoot.userData.hiddenDucks[1]=toolCabinet;

    // Étagères métalliques et boîtes colorées
    [-8.8, 8.8].forEach((x, side) => {
      for (const y of [.55, 1.55, 2.55]) addBox(x, y, -2, .75, .12, 6.7, steel);
      addBox(x, 1.55, -5.25, .18, 3.1, .18, steel);
      addBox(x, 1.55, 1.25, .18, 3.1, .18, steel);
      for (let i = 0; i < 4; i++) {
        addBox(x, .92 + (i%2), -4.35 + i*1.65, .98, .55, 1.05, i % 2 ? teal : orange, false);
      }
      // Étiquettes claires et petits contenants qui camouflent les silhouettes.
      for (let i = 0; i < 5; i++) {
        addBox(x-(side ? .41 : -.41),.9+(i%2)*1.02,-4.65+i*1.27,.02,.18,.46,material(0xdce9e8,.9),false);
      }
    });

    // Îlots de rangement aux silhouettes variées : tonneaux bombés, bac ouvert,
    // sacs mous et étagère arquée remplacent l'ancien labyrinthe de caisses.
    addBarrel(-2.5,1.9,1.08,0xa8733f);
    addToyBin(-.72,1.92,1.08,0x42aeba);
    addSackPile(1.42,-2.08,1.06,0xb98859);
    addBarrel(3.28,-2.08,1.15,0x9b633d);
    addSackPile(4.15,-3.2,.62,0x9d8061);
    addArchedShelf(-1.72,-3.92,2.25,crate,steel);

    // Convoyeur
    addBox(3.4,.65,1.1,5.2,.28,1.2,steel);
    for (let x = 1.15; x < 5.8; x += .55) addCylinder(x,.86,1.1,.13,1.08,material(0x9da9ad,.35,.7),false,12).rotation.z = Math.PI/2;
    addBox(3.4,.3,1.1,4.8,.18,.82,teal);
    addBox(.9,.62,1.1,.13,.9,1.42,steel,false);
    addBox(5.9,.62,1.1,.13,.9,1.42,steel,false);
    [0.82,5.98].forEach(x => {
      const wheel=new THREE.Mesh(new THREE.TorusGeometry(.36,.075,12,30),material(0x202b35,.3,.72));
      wheel.rotation.y=Math.PI/2;
      wheel.position.set(x,.65,1.1);
      wheel.castShadow=true;
      levelRoot.add(wheel);
    });

    // Machines aux volumes tournés, plus organiques que de simples armoires.
    addMachinePod(-9.55,3.25,0x49aeba,.18,.72);
    addMachinePod(7.25,-6.45,0xe58f37,-.35,.78);

    // Conduites en hauteur
    addCylinder(-4.5,3.8,-8.75,.16,9.5,orange,false,12).rotation.z = Math.PI/2;
    addCylinder(6.2,3.55,-8.75,.1,7.5,teal,false,12).rotation.z = Math.PI/2;

    const lampPositions = [[-6,5.7],[0,-.3],[6,-5.8]];
    lampPositions.forEach(([x,z]) => {
      const lamp = new THREE.PointLight(0xbceeff, 3, 8, 2);
      lamp.position.set(x,3.6,z);
      levelRoot.add(lamp);
      addCylinder(x,4.25,z,.42,.1,material(0xd9f7ff,.35,.2,0x7acbe8),false,20);
    });

    // Horloge industrielle et affichage lumineux au fond.
    addCylinder(6.8,2.95,-8.76,.68,.08,material(0xd6e4e6,.6),false,32).rotation.x = Math.PI/2;
    addCylinder(6.8,2.95,-8.69,.52,.04,material(0x273742,.45),false,32).rotation.x = Math.PI/2;
    addBox(0,3.02,-8.76,3.2,.72,.06,material(0x14292e,.34,.08,0x216a70),false);
    for (let i=0;i<3;i++) addBox(-.9+i*.9,3.02,-8.7,.48,.09,.03,material(0x7ee7db,.3,.1,0x5ac7c0),false);
  }

  function addToyBlock(x,y,z,size,color) {
    const block = addBox(x,y,z,size,size,size,material(color,.64),false);
    block.rotation.y = (x+z)*.16;
    const peg = addCylinder(x,y+size*.59,z,size*.17,size*.18,material(color,.58),false,12);
    peg.rotation.y = block.rotation.y;
  }

  function addMachinePod(x,z,color,rotation=0,scale=1) {
    const group=new THREE.Group();
    const profile=[
      new THREE.Vector2(.22,0),new THREE.Vector2(.48,.08),new THREE.Vector2(.58,.28),
      new THREE.Vector2(.6,1.12),new THREE.Vector2(.5,1.38),new THREE.Vector2(.28,1.5),new THREE.Vector2(0,1.54)
    ];
    const body=new THREE.Mesh(new THREE.LatheGeometry(profile,36),new THREE.MeshPhysicalMaterial({
      color,roughness:.38,metalness:.28,clearcoat:.55,clearcoatRoughness:.22
    }));
    body.castShadow=body.receiveShadow=true;
    group.add(body);

    const ringMat=material(0x263540,.24,.82);
    [.2,1.18].forEach(y => {
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.57,.055,10,32),ringMat);
      ring.rotation.x=Math.PI/2;
      ring.position.y=y;
      group.add(ring);
    });

    const panel=new THREE.Mesh(new RoundedBoxGeometry(.58,.5,.09,5,.06),material(0x17282f,.3,.22,0x164c54));
    panel.position.set(0,.82,-.56);
    panel.castShadow=true;
    group.add(panel);
    [0x7ce6dc,0xffbd4e,0xef6c5c].forEach((lampColor,i) => {
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(.04,12,8),new THREE.MeshBasicMaterial({color:lampColor}));
      lamp.position.set(-.17+i*.17,.88,-.615);
      group.add(lamp);
    });

    const cableCurve=new THREE.CubicBezierCurve3(
      new THREE.Vector3(0,1.45,0),new THREE.Vector3(.35,2.25,.15),
      new THREE.Vector3(-.3,3.5,.1),new THREE.Vector3(.2,4.35,0)
    );
    const cable=new THREE.Mesh(new THREE.TubeGeometry(cableCurve,22,.035,8,false),ringMat);
    group.add(cable);

    group.position.set(x,0,z);
    group.rotation.y=rotation;
    group.scale.setScalar(scale);
    levelRoot.add(group);
    colliders.push(new THREE.Box3().setFromObject(group));
  }

  function buildGreenhouse(data) {
    const frame = material(0x294c48, .45, .45);
    const stone = material(0x6c766a, .95);
    const soil = material(0x49372d, 1);
    const leafColors = [0x3f9a68, 0x67b76e, 0x287256, 0x87c772];
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xb6e3de, roughness: .08, metalness: 0, transparent: true,
      opacity: .12, transmission: .32, depthWrite: false, side: THREE.DoubleSide
    });

    // Dalles irrégulières du chemin central.
    let stoneIndex=0;
    for (let z = -8; z <= 8; z += 1.35) addSteppingStone(0,z,stoneIndex++,stone);
    // Jardinières sculptées aux contours irréguliers, comme des îlots de terre.
    const planterShell=material(0x8b6750,.95);
    [[-5.5,-4.8,5.4,2.5], [5.2,-4.4,4.8,3], [-5.6,4.5,4.6,2.8], [5.6,5.2,4.4,2.4]].forEach(([x,z,w,d], bed) => {
      addBlobPlanter(x,z,w,d,bed*.91,planterShell,soil);
      for (let i = 0; i < 8; i++) {
        const px = x + (Math.sin(i * 12.7 + bed) * (w-.9)/2);
        const pz = z + (Math.cos(i * 8.3 + bed) * (d-.9)/2);
        addFlower(px,pz,leafColors[(i+bed)%leafColors.length], i % 3 === 0 ? 0xe49bc1 : 0xf2c95e);
      }
      for(let i=0;i<4;i++) {
        const angle=i*2.399+bed;
        const shrub=createBotanicalPlant(.48+(i%2)*.14,bed+i,{pot:false,fern:true});
        shrub.position.set(x+Math.cos(angle)*w*.23,.74,z+Math.sin(angle)*d*.23);
        levelRoot.add(shrub);
      }
    });

    // Une rangée de plantes hautes masque le premier canard sans le bloquer.
    for (let i = 0; i < 6; i++) addTallPlant(-8.15 + (i%2)*.55,-7.3+i*.42,.7+(i%3)*.12,leafColors[i%leafColors.length]);
    const hiddenFern=createBotanicalPlant(.7,17,{pot:false,fern:true});
    hiddenFern.position.set(6.08,1.1,5.86);levelRoot.add(hiddenFern);
    const fernPot=addVase(6.08,.74,5.86,0x7f6b4f,.85);
    colliders.push(new THREE.Box3().setFromObject(fernPot));

    // Armature vitrée de la serre
    [-9.2,9.2].forEach(x => {
      for (let z = -8; z <= 8; z += 4) addBox(x,2.55,z,.1,5.1,.1,frame,false);
    });
    for (let z = -9.2; z <= 9.2; z += 4.6) {
      addBox(0,4.8,z,18.5,.1,.1,frame,false);
      const left = addBox(-4.6,5.95,z,10.3,.1,.1,frame,false);
      left.rotation.z = .23;
      const right = addBox(4.6,5.95,z,10.3,.1,.1,frame,false);
      right.rotation.z = -.23;
    }
    const roofLeft = addBox(-4.55,5.48,0,9.6,.035,18.4,glass,false);
    roofLeft.rotation.z = .23;
    roofLeft.castShadow = false;
    const roofRight = addBox(4.55,5.48,0,9.6,.035,18.4,glass,false);
    roofRight.rotation.z = -.23;
    roofRight.castShadow = false;

    // Lianes qui descendent de la structure.
    for (let i = 0; i < 9; i++) addVine(-8.75 + i*2.18, -9.05 + (i%3)*9, 1.35 + (i%4)*.34);

    // Bassin rond
    const pondProfile=[[1.72,.02],[2,.02],[2.07,.1],[2.04,.5],[1.97,.64],[1.78,.64],[1.72,.56],[1.72,.12],[0,.12]].map(([r,y])=>new THREE.Vector2(r,y));
    const pond=new THREE.Mesh(new THREE.LatheGeometry(pondProfile,64),stone);
    pond.position.set(4.8,0,.1);pond.castShadow=pond.receiveShadow=true;
    levelRoot.add(pond);colliders.push(new THREE.Box3().setFromObject(pond));
    const waveTime={value:0};
    const waterMaterial=new THREE.MeshPhysicalMaterial({color:0x245466,roughness:.15,metalness:.25,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:1.5,transparent:true,opacity:.88});
    waterMaterial.onBeforeCompile=shader=>{
      shader.uniforms.waveTime=waveTime;
      shader.vertexShader='uniform float waveTime;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        transformed.z+=sin(position.x*5.0+waveTime*.9)*.012+cos(position.y*6.0-waveTime*.7)*.009;`);
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        objectNormal=normalize(vec3(-cos(position.x*5.0+waveTime*.9)*.06,sin(position.y*6.0-waveTime*.7)*.054,1.0));`);
    };
    const water=new THREE.Mesh(new THREE.RingGeometry(0,1.72,64,24),waterMaterial);
    water.userData.waveTime=waveTime;
    water.userData.ignoreAim=true;
    water.rotation.x=-Math.PI/2;
    water.position.set(4.8,.56,.1);
    levelRoot.add(water);
    levelRoot.userData.water=water;
    for (let i = 0; i < 7; i++) {
      const a = i * 2.31;
      const radius = .35 + (i%3)*.48;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(.18+(i%2)*.08,18),material(0x4c9b64,.76));
      pad.rotation.x = -Math.PI/2;
      pad.position.set(4.8+Math.cos(a)*radius,.565,.1+Math.sin(a)*radius);
      pad.userData.sway={phase:i,amplitude:.012};
      levelRoot.add(pad);
    }
    addRockCluster(2.72,-.95,.72,stone);
    addRockCluster(2.75,-.4,.38,stone);
    const pondPot=addVase(1.99,0,-.54,0x9b704e,.85);
    colliders.push(new THREE.Box3().setFromObject(pondPot));
    const pondFern=createBotanicalPlant(.4,23,{pot:false,fern:true});
    pondFern.position.set(1.99,.35,-.54);levelRoot.add(pondFern);
    addRockCluster(6.78,1.35,.58,stone);
    for (let i = 0; i < 6; i++) {
      addCylinder(-8.65,.45+i%2*.18,-1.5 + i*.55,.28,.9+i%2*.35,material(0xb8784b,.85),true,16);
    }

    // Table de rempotage et arrosoirs.
    addBox(-3.9,1.1,-7.72,3.1,.2,1.05,material(0x75533f,.88));
    addBox(-5.1,.5,-7.72,.15,1,.78,frame);
    addBox(-2.7,.5,-7.72,.15,1,.78,frame);
    const wateringCan=createWateringCan();
    wateringCan.position.set(-4.55,1.21,-7.7);
    levelRoot.add(wateringCan);
    addCylinder(-3.42,1.36,-7.72,.19,.31,material(0xc98b61,.84),false,18);
    const pottingDrawer=interactionSystem.addStorage({x:-3.9,z:-7.72,width:1.35,height:.78,depth:.9,kind:'drawer',label:'le tiroir de rempotage',color:0x785b45});
    const gardenCabinet=interactionSystem.addStorage({x:-6.7,z:1.2,width:1.3,height:1.45,depth:.95,label:'le placard de jardin',color:0x406e61});
    levelRoot.userData.hiddenDucks[1]=pottingDrawer;
    levelRoot.userData.hiddenDucks[2]=gardenCabinet;

    // Lune et lumière froide
    const moon = new THREE.Mesh(new THREE.SphereGeometry(.85,24,16), material(0xf0f4d4,.35,.05,0xdde9b6));
    moon.position.set(-6.5,5,-8.8);
    levelRoot.add(moon);
    const moonLight = new THREE.PointLight(0xa9d8ff,6,22,1.6);
    moonLight.position.set(-4.5,6,-4);
    levelRoot.add(moonLight);

    addLamp(7.8,7.4,0xffd580);
    addLamp(-7.8,-7.5,0xffd580);
  }

  function addTallPlant(x,z,scale,color) {
    const plant=createBotanicalPlant(scale,x-z);
    plant.position.set(x,0,z);
    levelRoot.add(plant);
  }

  function addRockCluster(x,z,scale,stone) {
    [[0,0,1],[-.34,.12,.65],[.3,-.15,.52]].forEach(([ox,oz,s],i) => {
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.42*scale*s,1),stone);
      rock.scale.set(1.25,.62,.9);
      rock.position.set(x+ox*scale,.19*scale*s,z+oz*scale);
      rock.rotation.set(i*.17,i*.68,-i*.11);
      rock.castShadow=rock.receiveShadow=true;
      levelRoot.add(rock);
    });
  }

  function addVine(x,z,length) {
    const vineMat = material(0x347555,.9);
    for (let i=0;i<6;i++) {
      const y=4.75-i*(length/6);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(.09+(i%2)*.025,8,6),vineMat);
      leaf.scale.set(1.6,.65,.7);
      leaf.position.set(x+Math.sin(i*1.8)*.11,y,z);
      leaf.rotation.z=i%2 ? .45 : -.45;
      leaf.userData.sway={phase:i+x,amplitude:.06};
      levelRoot.add(leaf);
    }
  }

  function addFlower(x, z, leafColor, flowerColor) {
    const stem = addCylinder(x,1.07,z,.035,.72,material(0x3b7c4f,.8),false,7);
    stem.castShadow = false;
    for (let j = 0; j < 5; j++) {
      const a = j/5*Math.PI*2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(.11,8,6), material(flowerColor,.65));
      petal.position.set(x+Math.cos(a)*.13,1.46,z+Math.sin(a)*.13);
      petal.scale.set(1.45,.5,1);
      levelRoot.add(petal);
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(.09,8,6), material(0xffcf36,.6));
    center.position.set(x,1.48,z);
    levelRoot.add(center);
    // Feuillage bas
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.16,8,6), material(leafColor,.85));
    leaf.position.set(x+.11,.94,z);
    leaf.scale.set(1.6,.45,.65);
    leaf.rotation.z = -.35;
    levelRoot.add(leaf);
  }

  function createDuck(position, index) {
    const group = new THREE.Group();
    const originalScale = position[4] || .8;
    const referenceScale = originalScale * .68;
    const duckScale = referenceScale * DUCK_SIZE_MULTIPLIER;
    const groundedY = position[1] - .355 * (originalScale-duckScale);
    group.position.set(position[0], groundedY, position[2]);
    group.userData.baseY = groundedY;
    group.userData.storageGroundingAdjustment=.355*(referenceScale-duckScale);
    group.userData.offset = index * 1.37;
    group.userData.baseRotation = position[3] || index * .8;
    group.userData.duck = true;
    group.rotation.y = group.userData.baseRotation;
    group.scale.setScalar(duckScale);

    const yellow = new THREE.MeshPhysicalMaterial({
      color: 0xffd52e, roughness: .24, metalness: 0, clearcoat: 1,
      clearcoatRoughness: .16, emissive: 0x2d2100, emissiveIntensity: .018, envMapIntensity:.68
    });
    const orange = new THREE.MeshPhysicalMaterial({ color:0xff8624,roughness:.3,clearcoat:.8,clearcoatRoughness:.2 });
    const black = new THREE.MeshPhysicalMaterial({ color:0x08090b,roughness:.08,clearcoat:1 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(.38, 32, 24), yellow);
    body.scale.set(1.18,.78,.94);
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 32, 24), yellow);
    head.position.set(0,.31,-.27);
    head.castShadow = true;
    group.add(head);

    // Ailes latérales et petite queue pour une silhouette plus travaillée.
    [-1,1].forEach(side => {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(.24,16,10),yellow);
      wing.scale.set(.52,.58,1.12);
      wing.position.set(side*.34,.02,.03);
      wing.rotation.z = side*.18;
      wing.castShadow = true;
      group.add(wing);
    });

    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(.085,.15,6,18),yellow);
    tail.rotation.x = Math.PI/2+.35;
    tail.position.set(0,.12,.38);
    tail.castShadow = true;
    group.add(tail);

    const beak = new THREE.Mesh(new THREE.SphereGeometry(.14,24,16), orange);
    beak.scale.set(1,.38,1.35);
    beak.position.set(0,.28,-.53);
    group.add(beak);

    [-1,1].forEach(side => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.035,10,8), black);
      eye.position.set(side*.105,.39,-.49);
      group.add(eye);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(.009,6,5),new THREE.MeshBasicMaterial({color:0xffffff}));
      glint.position.set(side*.115,.402,-.522);
      group.add(glint);
    });

    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(.42,24),
      new THREE.MeshBasicMaterial({color:0x080b12,transparent:true,opacity:.18,depthWrite:false})
    );
    contactShadow.rotation.x = -Math.PI/2;
    contactShadow.position.y = -.355;
    contactShadow.userData.ignoreAim=true;
    group.add(contactShadow);

    levelRoot.add(group);
    ducks.push(group);
    group.userData.index=index;
    return group;
  }

  function updatePlayer(delta) {
    const wantsCrouch=Boolean(keys[settings.bindings.crouch]);
    const standingSpace=new THREE.Box3(
      new THREE.Vector3(player.position.x-player.radius,player.position.y+.1,player.position.z-player.radius),
      new THREE.Vector3(player.position.x+player.radius,1.8,player.position.z+player.radius)
    );
    const overhead=player.position.y<1.5 && colliders.some(box=>box.intersectsBox(standingSpace));
    isCrouching=wantsCrouch || overhead;
    const eyeHeight=isCrouching?.72:1.68;
    player.position.y=THREE.MathUtils.damp(player.position.y,eyeHeight,13,delta);
    player.height=player.position.y+.12;
    $('crouchIndicator').classList.toggle('visible',isCrouching);
    movement.set(0,0,0);
    const forward = keys[settings.bindings.forward];
    const backward = keys[settings.bindings.backward];
    const left = keys[settings.bindings.left];
    const right = keys[settings.bindings.right];
    if (forward) movement.z -= 1;
    if (backward) movement.z += 1;
    if (left) movement.x -= 1;
    if (right) movement.x += 1;

    const isWalking = movement.lengthSq() > 0;
    if (isWalking) {
      movement.normalize().applyAxisAngle(new THREE.Vector3(0,1,0), yaw).multiplyScalar(player.speed * (isCrouching?.55:1) * delta);
      tryMove(movement.x, 0);
      tryMove(0, movement.z);
      walkCycle += delta * 10.5;
    }

    camera.position.copy(player.position);
    const targetBob = isWalking ? Math.sin(walkCycle) * (isCrouching?.009:.022) : 0;
    cameraBob += (targetBob-cameraBob) * Math.min(1,delta*12);
    camera.position.y += cameraBob;
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = isWalking ? Math.cos(walkCycle*.5)*.0035 : 0;
  }

  function tryMove(dx, dz) {
    const next = player.position.clone();
    next.x += dx;
    next.z += dz;
    const [width, depth] = levels[levelIndex].bounds;
    next.x = Math.max(-width/2 + .55, Math.min(width/2 - .55, next.x));
    next.z = Math.max(-depth/2 + .55, Math.min(depth/2 - .55, next.z));

    const playerBox = new THREE.Box3(
      new THREE.Vector3(next.x-player.radius,.05,next.z-player.radius),
      new THREE.Vector3(next.x+player.radius,player.height,next.z+player.radius)
    );
    if (!colliders.some(box => box.intersectsBox(playerBox))) player.position.copy(next);
  }

  function updateDucks(time, delta) {
    for (let i = ducks.length - 1; i >= 0; i--) {
      const duck = ducks[i];
      duck.position.y = duck.userData.baseY + Math.sin(time * 1.55 + duck.userData.offset) * .004;
      duck.rotation.y = duck.userData.baseRotation + Math.sin(time * .72 + duck.userData.offset) * .015;
    }
  }

  function findAimedDuck() {
    const target=interactionSystem.aimed(camera);
    return target?.type==='duck' && ducks.includes(target.object)?target.object:null;
  }

  function tryCollectAimedDuck() {
    const duck=findAimedDuck();
    if (!duck) return;
    const index=ducks.indexOf(duck);
    if (index !== -1) collectDuck(index);
  }

  function updateAimIndicator(delta) {
    aimCheckDelay-=delta;
    if (aimCheckDelay > 0) return;
    aimCheckDelay=.07;
    const target=interactionSystem.aimed(camera);
    const isDuck=target?.type==='duck' && ducks.includes(target.object);
    const isStorage=target?.type==='storage' || target?.type==='object';
    $('crosshair').classList.toggle('target',isDuck);
    $('crosshair').classList.toggle('storage-target',isStorage);
    const prompt=$('interactionPrompt');
    prompt.classList.toggle('visible',isDuck || isStorage);
    if(isStorage) {
      $('interactionKey').textContent=keyLabel(settings.bindings.interact);
      $('interactionText').textContent=interactionSystem.prompt(target.object);
    } else if(isDuck) {
      $('interactionKey').textContent='CLIC';
      $('interactionText').textContent='Ramasser le canard';
    }
  }

  function collectDuck(index) {
    const duck = ducks[index];
    ducks.splice(index, 1);
    found++;
    updateCounter();
    playQuack(found === 5);
    showToast(found === 5 ? 'Le dernier ! Niveau terminé ✨' : `Coin coin ! Plus que ${5-found} à trouver`);

    const startScale = duck.scale.clone();
    const start = performance.now();
    function vanish(now) {
      const t = Math.min(1, (now-start)/260);
      duck.scale.copy(startScale).multiplyScalar(1 + t * .8).multiplyScalar(1-t);
      duck.rotation.y += .18;
      if (t < 1) requestAnimationFrame(vanish);
      else {duck.removeFromParent();disposeObject(duck);}
    }
    requestAnimationFrame(vanish);

    if (found === 5) setTimeout(showLevelComplete, 650);
  }

  function updateCounter() { $('duckCount').textContent = `${found} / 5`; }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1900);
  }

  function showLevelComplete() {
    transitioning = true;
    isPlaying = false;
    $('interactionPrompt').classList.remove('visible');
    if (document.pointerLockElement) document.exitPointerLock();
    const seconds = Math.max(1, Math.round((performance.now() - levelStartedAt) / 1000));
    const last = levelIndex === levels.length - 1;
    $('completeIcon').textContent = last ? '🏆' : '✨';
    $('completeEyebrow').textContent = last ? 'Aventure terminée' : `Niveau ${levelIndex+1} terminé`;
    $('completeTitle').textContent = last ? 'Maître des canards !' : 'Tous retrouvés !';
    $('completeStats').textContent = last
      ? `Tu as retrouvé les ${levels.slice(sessionStartLevel).reduce((total,level)=>total+level.ducks.length,0)} canards de cette partie. Dernier niveau en ${formatTime(seconds)}.`
      : `5 canards retrouvés en ${formatTime(seconds)}.`;
    $('nextButton').textContent = last ? 'Rejouer depuis le début' : `Découvrir le niveau ${levelIndex+2}`;
    completeOverlay.classList.add('active');
  }

  function nextLevel() {
    const next = (levelIndex + 1) % levels.length;
    if(next===0)sessionStartLevel=0;
    completeOverlay.classList.remove('active');
    buildLevel(next);
    transitioning = false;
    isPlaying = true;
    levelStartedAt = performance.now();
    renderer.domElement.requestPointerLock();
    if(levels[levelIndex].tip)showToast(levels[levelIndex].tip);
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return minutes ? `${minutes} min ${String(rest).padStart(2,'0')} s` : `${rest} s`;
  }

  function ensureAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
  }

  function playQuack(isFinal) {
    ensureAudio();
    const now = audioContext.currentTime;
    [0, .085].forEach((delay, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = i ? 'triangle' : 'square';
      osc.frequency.setValueAtTime((isFinal ? 420 : 310) + i*70, now+delay);
      osc.frequency.exponentialRampToValueAtTime((isFinal ? 690 : 220) + i*55, now+delay+.12);
      gain.gain.setValueAtTime(.0001, now+delay);
      gain.gain.exponentialRampToValueAtTime(.055, now+delay+.012);
      gain.gain.exponentialRampToValueAtTime(.0001, now+delay+.14);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(now+delay);
      osc.stop(now+delay+.15);
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), .05);
    const time = performance.now() / 1000;
    if (isPlaying) {
      updatePlayer(delta);
      updateDucks(time, delta);
      updateAimIndicator(delta);
    }
    environmentMotion?.update(time);
    const playerBox=new THREE.Box3(
      new THREE.Vector3(player.position.x-player.radius,.05,player.position.z-player.radius),
      new THREE.Vector3(player.position.x+player.radius,player.height,player.position.z+player.radius)
    );
    interactionSystem?.update(delta,playerBox,()=>{
      if(performance.now()-blockedToastAt>1500) {
        blockedToastAt=performance.now();
        showToast('Recule un peu pour laisser bouger l’objet.');
      }
    });
    composer.render();
  }

  // Disponible uniquement avec ?test=1, pour les vérifications navigateur.
  function installTestHooks() {
    window.__findDuckTest={
      state:()=>({level:levelIndex,found,ducks:ducks.map(d=>({index:d.userData.index,position:d.getWorldPosition(new THREE.Vector3()).toArray()})),models:levelRoot.userData.loadedModels||0,storages:interactionSystem.items.map(i=>({kind:i.kind,progress:i.progress,label:i.label})),height:player.position.y,crouching:isCrouching,bindings:{...settings.bindings},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),
      loadLevel:buildLevel,
      ready:()=>Promise.all(levelRoot.userData.pendingModels),
      mazeInfo:()=>levelRoot.userData.maze||null,
      architectureInfo:()=>levelRoot.userData.architecture||{kind:'room'},
      levelCount:()=>levels.length,
      playerPosition:()=>player.position.toArray(),
      duckSizes:()=>ducks.map(duck=>({index:duck.userData.index,scale:duck.scale.x})),
      navigationInfo:()=>({bounds:levels[levelIndex].bounds,spawn:levels[levelIndex].spawn,colliders:colliders.map(box=>({min:box.min.toArray(),max:box.max.toArray()}))}),
      spawnSightlines:()=>{
        const position=camera.position.clone(),rotation=camera.quaternion.clone();
        levelRoot.updateWorldMatrix(true,true);
        camera.position.set(...levels[levelIndex].spawn);
        const results=ducks.map(duck=>{
          const targets=[duck.getWorldPosition(new THREE.Vector3()),duck.children[1].getWorldPosition(new THREE.Vector3())];
          targets.push(targets[1].clone().add(new THREE.Vector3(0,duck.scale.y*.22,0)));
          const visible=targets.some(target=>{
            camera.lookAt(target);camera.updateMatrixWorld(true);
            const hit=interactionSystem.aimed(camera,40);
            return hit?.type==='duck' && hit.object===duck;
          });
          return {index:duck.userData.index,visible};
        });
        camera.position.copy(position);camera.quaternion.copy(rotation);camera.updateMatrixWorld(true);
        return results;
      },
      view:(position,target)=>{camera.position.set(...position);camera.lookAt(new THREE.Vector3(...target));camera.updateMatrixWorld(true);},
      viewPlayer:(position,target)=>{
        player.position.set(...position);camera.position.copy(player.position);
        camera.rotation.order='YXZ';camera.lookAt(new THREE.Vector3(...target));
        yaw=camera.rotation.y;pitch=camera.rotation.x;camera.updateMatrixWorld(true);
      },
      storageView:(index,offset=null)=>{
        const item=interactionSystem.items[index];
        offset=offset||[0,item.kind==='drawer' && (item.height>=.85 || item.progress>.5)?1.68:.72,2];
        const target=item.root.localToWorld(item.slot.clone().add(new THREE.Vector3(0,0,item.kind==='drawer'?item.progress*item.depth*.88:0)));
        if(item.progress>.5 && ducks.includes(item.duck)) {
          item.duck.updateWorldMatrix(true,true);
          item.duck.children[1].getWorldPosition(target);
          target.y+=item.duck.scale.y*.22;
        } else if(item.progress>.5) {
          target.copy(item.mobile.localToWorld(new THREE.Vector3(
            item.kind==='drawer'?0:item.width/2-.04,
            item.kind==='drawer'?item.mobile.userData.handleY:0,
            item.kind==='drawer'?item.depth/2+.015:0
          )));
        }
        const position=item.root.localToWorld(new THREE.Vector3(...offset));
        camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld(true);
        return {position:position.toArray(),target:target.toArray()};
      },
      aimed:()=>{const t=interactionSystem.aimed(camera);return t?{type:t.type,index:t.type==='duck'?t.object.userData.index:(t.type==='object'?interactionSystem.objects:interactionSystem.items).indexOf(t.object)}:null;},
      objects:()=>interactionSystem.objects.map((item,index)=>({index,role:item.role,label:item.label,progress:item.progress,target:item.target,duckIndex:item.duck?.userData.index,lightIntensity:item.role==='light'?item.root.children.find(c=>c.isLight)?.intensity:undefined})),
      toggleObject:index=>interactionSystem.toggle(interactionSystem.objects[index]),
      interact:()=>{const target=interactionSystem.aimed(camera);if(target && ['storage','object'].includes(target.type))interactionSystem.toggle(target.object);},
      objectView:index=>{
        const item=interactionSystem.objects[index];levelRoot.updateWorldMatrix(true,true);
        const target=new THREE.Box3().setFromObject(item.mobile).getCenter(new THREE.Vector3());
        const targets=[target,new THREE.Box3().setFromObject(item.root).getCenter(new THREE.Vector3())];
        const light=item.root.children.find(child=>child.isLight);
        if(light)targets.unshift(light.getWorldPosition(new THREE.Vector3()));
        // Les positions de test doivent laisser toute l'animation se dérouler.
        const sweep=[];
        if(item.movingBox) {
          const progress=item.progress;
          for(let i=0;i<=10;i++) {
            item.progress=i/10;interactionSystem.applyPose(item);
            sweep.push(new THREE.Box3().setFromObject(item.mobile));
          }
          item.progress=progress;interactionSystem.applyPose(item);
        }
        const [w,d]=levels[levelIndex].bounds;
        // Ne pas proposer un point derrière une porte encore fermée.
        const step=.25,minX=-w/2+.55,minZ=-d/2+.55,nx=Math.floor((w-1.1)/step)+1,nz=Math.floor((d-1.1)/step)+1;
        const key=(x,z)=>z*nx+x,spawn=levels[levelIndex].spawn;
        const start=key(Math.round((spawn[0]-minX)/step),Math.round((spawn[2]-minZ)/step));
        const queue=[start],visited=new Set(queue);
        const free=(x,z)=>!colliders.some(box=>x+.38>=box.min.x && x-.38<=box.max.x && z+.38>=box.min.z && z-.38<=box.max.z && box.max.y>=.05 && box.min.y<=.84);
        for(let i=0;i<queue.length;i++) {
          const x=queue[i]%nx,z=Math.floor(queue[i]/nx);
          for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const xx=x+dx,zz=z+dz,k=key(xx,zz);
            if(xx>=0 && zz>=0 && xx<nx && zz<nz && !visited.has(k) && free(minX+xx*step,minZ+zz*step)) {visited.add(k);queue.push(k);}
          }
        }
        for(const height of [1.68,.72])for(const radius of [1.25,2,2.8])for(let i=0;i<48;i++) {
          const angle=i/48*Math.PI*2,position=new THREE.Vector3(target.x+Math.cos(angle)*radius,height,target.z+Math.sin(angle)*radius);
          if(Math.abs(position.x)>w/2-.55 || Math.abs(position.z)>d/2-.55)continue;
          const gx=Math.round((position.x-minX)/step),gz=Math.round((position.z-minZ)/step);
          if(!visited.has(key(gx,gz)))continue;
          const body=new THREE.Box3(new THREE.Vector3(position.x-player.radius,.05,position.z-player.radius),new THREE.Vector3(position.x+player.radius,height+.12,position.z+player.radius));
          if(colliders.some(box=>box.intersectsBox(body)))continue;
          if(sweep.some(box=>box.intersectsBox(body)))continue;
          for(const lookAt of targets) {
            camera.position.copy(position);camera.lookAt(lookAt);camera.updateMatrixWorld(true);
            const hit=interactionSystem.aimed(camera);
            if(hit?.type==='object' && hit.object===item)return {position:position.toArray(),target:lookAt.toArray()};
          }
        }
        return null;
      },
      toggle:index=>interactionSystem.toggle(interactionSystem.items[index]),
      settle:()=>{for(let i=0;i<120;i++)interactionSystem.update(1/60,null);},
      collect:tryCollectAimedDuck,
      crouch:(active)=>{keys[settings.bindings.crouch]=active;for(let i=0;i<60;i++)updatePlayer(1/60);},
      moveTo:position=>{player.position.set(...position);},
      move:(dx,dz)=>tryMove(dx,dz),
      animateAt:time=>environmentMotion.update(time),
      graphicsInfo:()=>{
        const rain=levelRoot.userData.glassRain,curtains=[];
        levelRoot.traverse(object=>{if(object.userData.breeze?.anchorHeight)curtains.push(object);});
        return {rainDrops:rain?.drops.length||0,rainMatrix:rain?Array.from(rain.mesh.instanceMatrix.array.slice(0,16)):null,animatedCurtains:curtains.length,windTime:environmentMotion.wind.map(uniform=>uniform.value)};
      },
      render:()=>composer.render(),
      storageCollision:index=>({fixed:colliders.includes(interactionSystem.items[index].movingBox),box:interactionSystem.items[index].movingBox.min.toArray()}),
      toggleBlocked:index=>{
        const item=interactionSystem.items[index],point=item.root.localToWorld(new THREE.Vector3(item.width*.35,.5,item.depth/2+.1));
        const box=new THREE.Box3(point.clone().add(new THREE.Vector3(-.38,-.5,-.38)),point.clone().add(new THREE.Vector3(.38,1,.38)));
        item.target=1;for(let i=0;i<120;i++)interactionSystem.update(1/60,box);
        return item.progress;
      },
      reachable:()=>{
        levelRoot.updateWorldMatrix(true,true);
        const results=[];
        const [w,d]=levels[levelIndex].bounds;
        for(const duck of ducks) {
          const center=duck.getWorldPosition(new THREE.Vector3());
          const targets=[center,duck.children[1].getWorldPosition(new THREE.Vector3())];
          let approach=null;
          search:for(const height of [1.68,.72]) for(const radius of [1.25,2,2.8]) for(let i=0;i<32;i++) {
            const angle=i/32*Math.PI*2;
            const position=new THREE.Vector3(center.x+Math.cos(angle)*radius,height,center.z+Math.sin(angle)*radius);
            if(Math.abs(position.x)>w/2-.55 || Math.abs(position.z)>d/2-.55)continue;
            const body=new THREE.Box3(new THREE.Vector3(position.x-player.radius,.05,position.z-player.radius),new THREE.Vector3(position.x+player.radius,height+.12,position.z+player.radius));
            if(colliders.some(box=>box.intersectsBox(body)))continue;
            for(const target of targets) {
              camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld(true);
              const hit=interactionSystem.aimed(camera);
              if(hit?.type==='duck' && hit.object===duck) {approach={position:position.toArray(),target:target.toArray()};break search;}
            }
          }
          results.push({index:duck.userData.index,approach});
        }
        return results;
      }
    };
  }

  init();
})();
