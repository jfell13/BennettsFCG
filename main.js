import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'lil-gui'
import Stats from 'three/addons/libs/stats.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

let scene, renderer, camera, floor, orbitControls;
let group, followGroup, creatures, drones, model, skeleton, mixer, clock;
let mixers = [];
let actions;

const settings = {
    show_skeleton: true,
    fixe_transition: true,
};

const PI = Math.PI;
const PI90 = Math.PI / 2;

const controls = {
    key: [ 0, 0 ],
    ease: new THREE.Vector3(),
    position: new THREE.Vector3(),
    up: new THREE.Vector3( 0, 1, 0 ),
    rotate: new THREE.Quaternion(),
    current: 'Idle',
    fadeDuration: 0.5,
    runVelocity: 5,
    walkVelocity: 1.8,
    rotateSpeed: 0.05,
    floorDecale: 0,
};

init();

function init() {
    const container = document.getElementById( 'container' );
    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
    camera.position.set( 0, 2, - 5 );
    //camera.lookAt( 0, 1, 0 );
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x87CEEB ); //0x5e5d5d grey
    // scene.fog = new THREE.Fog( 0x5e5d5d, 2, 20 );

    group = new THREE.Group();
    scene.add( group );

    followGroup = new THREE.Group();
    scene.add( followGroup );

    creatures = new THREE.Group();
    scene.add( creatures );

    drones = new THREE.Group();
    scene.add( drones );

    const dirLight = new THREE.DirectionalLight( 0xffffff, 5 );
    dirLight.position.set( - 2, 5, - 3 );
    dirLight.castShadow = true;
    const cam = dirLight.shadow.camera;
    cam.top = cam.right = 2;
    cam.bottom = cam.left = - 2;
    cam.near = 3;
    cam.far = 8;
    dirLight.shadow.bias = - 0.005;
    dirLight.shadow.radius = 4;
    followGroup.add( dirLight );
    followGroup.add( dirLight.target );

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setAnimationLoop( animate );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    renderer.shadowMap.enabled = true;
    container.appendChild( renderer.domElement );

    orbitControls = new OrbitControls( camera, renderer.domElement );
    orbitControls.target.set( 0, 1, 0 );
    orbitControls.enableDamping = true;
    orbitControls.enablePan = false;
    orbitControls.maxPolarAngle = PI90 - 0.05;
    orbitControls.update();

    // EVENTS
    window.addEventListener( 'resize', onWindowResize );
    document.addEventListener( 'keydown', onKeyDown );
    document.addEventListener( 'keyup', onKeyUp );

    // DEMO
    new RGBELoader()
        .setPath( 'textures/equirectangular/' )
        .load( 'lobe.hdr', function ( texture ) {

            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.environment = texture;
            scene.environmentIntensity = 1.5;

            addCreatures();
            addDrones();
            loadPlayer();
            addFloor();
        } );
}

function loadPlayer() {
    const loader = new GLTFLoader();
    loader.load( 'models/BP_V01.glb', function ( gltf ) {
    // loader.load( 'scene.glb', function ( gltf ) {
        model = gltf.scene;
        group.add( model );
        // model.rotation.y = PI;
        // group.rotation.y = PI;

        model.traverse( function ( object ) {
        } );
        //
        skeleton = new THREE.SkeletonHelper( model );
        skeleton.visible = false;
        scene.add( skeleton );
        //
        createPanel();
        //
        const animations = gltf.animations;

        mixer = new THREE.AnimationMixer( model );

        actions = {
            Idle: mixer.clipAction( animations[ 0 ] ),
            Walk: mixer.clipAction( animations[ 1 ] ),
            // Run: mixer.clipAction( animations[ 1 ] )
        };
        for ( const m in actions ) {
            actions[ m ].enabled = true;
            actions[ m ].setEffectiveTimeScale( 1 );
            if ( m !== 'Idle' ) actions[ m ].setEffectiveWeight( 0 );
        }
        actions.Idle.play();
        animate();
    } );
}

function addCreatures() {
    for (let i = 0; i < 1; i++) {
        const loader = new GLTFLoader();
        loader.load( 'models/npcs/Mousey_V01.glb', function ( gltf ) {
            const creature = gltf.scene;
            const posX =(Math.random() + i - 1) * 5 ;
            const posZ = (Math.random() + i - 1) * 5;
            creature.position.set(posX, 0, posZ);
            // creature.scale.set(0.5, 0.5, 0.5);
            creature.rotation.y = Math.random() * Math.PI * 2;
            creature.animations = gltf.animations;            

            scene.add( creature );
            creatures.add( creature );
        } );    
    }
}

function animateCreatures( delta ) {
    creatures.children.forEach((creature) => {
        if (!creature.userData.mixer && creature.animations?.length) {
            const mixer = new THREE.AnimationMixer(creature);
            const action = mixer.clipAction(creature.animations[0]);
            action.play();
            creature.userData.mixer = mixer; // store mixer for reuse
            mixers.push(mixer);
        }
    });
    mixers.forEach(m => m.update(delta));
}

function addDrones() {
    for (let i = 0; i < 3; i++) {
        const loader = new GLTFLoader();
        loader.load( 'models/drone.glb', function ( gltf ) {
            const drone = gltf.scene;
            const posX =(Math.random() + i - 1) * 5 ;
            const posY = 1 + Math.random();
            const posZ = (Math.random() + i - 1) * 5;
            drone.position.set(posX, posY, posZ);
            drone.scale.set(0.5, 0.5, 0.5);
            drone.rotation.y = Math.random() * Math.PI * 2;
            scene.add( drone );
            drones.add( drone );
            } );    
    }
}

function animateDrones() {
    drones.children.forEach((c, i) => {
        c.position.y += 0.005 * Math.sin(Date.now() * 0.002 + i);
    });
}

function updateCharacter( delta ) {
    const fade = controls.fadeDuration;
    const key = controls.key;
    const up = controls.up;
    const ease = controls.ease;
    const rotate = controls.rotate;
    const position = controls.position;
    const azimuth = orbitControls.getAzimuthalAngle();

    // const active = key[ 0 ] === 0 && key[ 1 ] === 0 ? false : true;
    // const play = active ? ( key[ 2 ] ? 'Run' : 'Walk' ) : 'Idle';
    const active = key[0] !== 0 || key[1] !== 0;
    const play = active ? 'Walk' : 'Idle';

    // change animation
    if ( controls.current != play ) {
        const current = actions[ play ];
        const old = actions[ controls.current ];
        controls.current = play;

        if ( settings.fixe_transition ) {
            current.reset();
            current.weight = 1.0;
            current.stopFading();
            old.stopFading();
            // synchro if not idle
            if ( play !== 'Idle' ) current.time = old.time * ( current.getClip().duration / old.getClip().duration );
            old._scheduleFading( fade, old.getEffectiveWeight(), 0 );
            current._scheduleFading( fade, current.getEffectiveWeight(), 1 );
            current.play();
        } else {
            setWeight( current, 1.0 );
            old.fadeOut( fade );
            current.reset().fadeIn( fade ).play();
        }
        controls.current = play;
    }
    // move object
    if ( controls.current !== 'Idle' ) {
        // run/walk velocity
        const velocity = controls.current == 'Run' ? controls.runVelocity : controls.walkVelocity;
        // direction with key
        ease.set( key[ 1 ], 0, key[ 0 ] ).multiplyScalar( velocity * delta );
        // calculate camera direction
        const angle = unwrapRad( Math.atan2( ease.x, ease.z ) + azimuth );
        rotate.setFromAxisAngle( up, angle );
        // apply camera angle on ease
        controls.ease.applyAxisAngle( up, azimuth );
        position.add( ease );
        camera.position.add( ease );

        // player.position.copy( position );
        // player.quaternion.rotateTowards( rotate, controls.rotateSpeed );
        group.position.copy( position );
        group.quaternion.rotateTowards( rotate, controls.rotateSpeed );

        orbitControls.target.copy( position ).add( { x: 0, y: 1, z: 0 } );
        followGroup.position.copy( position );
        // Move the floor without any limit
        const dx = ( position.x - floor.position.x );
        const dz = ( position.z - floor.position.z );
        if ( Math.abs( dx ) > controls.floorDecale ) floor.position.x += dx;
        if ( Math.abs( dz ) > controls.floorDecale ) floor.position.z += dz;
    }
    if (mixer) mixer.update(delta);
    orbitControls.update();
}

function unwrapRad(r) {
    return Math.atan2(Math.sin(r), Math.cos(r));
}

function onKeyDown( event ) {
    const key = controls.key;
    switch ( event.code ) {
        case 'ArrowUp': case 'KeyW': case 'KeyZ': key[ 0 ] = - 1; break;
        case 'ArrowDown': case 'KeyS': key[ 0 ] = 1; break;
        case 'ArrowLeft': case 'KeyA': case 'KeyQ': key[ 1 ] = - 1; break;
        case 'ArrowRight': case 'KeyD': key[ 1 ] = 1; break;
        case 'ShiftLeft' : case 'ShiftRight' : key[ 2 ] = 1; break;
    }
}

function onKeyUp( event ) {
    const key = controls.key;
    switch ( event.code ) {
        case 'ArrowUp': case 'KeyW': case 'KeyZ': key[ 0 ] = key[ 0 ] < 0 ? 0 : key[ 0 ]; break;
        case 'ArrowDown': case 'KeyS': key[ 0 ] = key[ 0 ] > 0 ? 0 : key[ 0 ]; break;
        case 'ArrowLeft': case 'KeyA': case 'KeyQ': key[ 1 ] = key[ 1 ] < 0 ? 0 : key[ 1 ]; break;
        case 'ArrowRight': case 'KeyD': key[ 1 ] = key[ 1 ] > 0 ? 0 : key[ 1 ]; break;
        case 'ShiftLeft' : case 'ShiftRight' : key[ 2 ] = 0; break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}

function createPanel() {
    const panel = new GUI({ width: 310});
    // panel.add(settings, 'show_skeleton').onChange(
    //     (b) => {
    //         skeleton.visible = b;
    //     }
    // );
    // panel.add( settings, 'fixe_transition' );
}

function addFloor() {
    const size = 50;
    const repeat = 16;
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const floorT = new THREE.TextureLoader().load( 'textures/floors/FloorsCheckerboard_S_Diffuse.jpg' );
    floorT.colorSpace = THREE.SRGBColorSpace;
    floorT.repeat.set( repeat, repeat );
    floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
    floorT.anisotropy = maxAnisotropy;

    const floorN = new THREE.TextureLoader().load( 'textures/floors/FloorsCheckerboard_S_Normal.jpg' );
    floorN.repeat.set( repeat, repeat );
    floorN.wrapS = floorN.wrapT = THREE.RepeatWrapping;
    floorN.anisotropy = maxAnisotropy;

    const mat = new THREE.MeshStandardMaterial( { map: floorT, normalMap: floorN, normalScale: new THREE.Vector2( 0.5, 0.5 ), color: 0x404040, depthWrite: false, roughness: 0.85 } );

    const g = new THREE.PlaneGeometry( size, size, 50, 50 );
    g.rotateX( - PI90 );

    floor = new THREE.Mesh( g, mat );
    floor.receiveShadow = true;
    scene.add( floor );

    controls.floorDecale = ( size / repeat ) * 4;

    // const bulbGeometry = new THREE.SphereGeometry( 0.05, 16, 8 );
    // const bulbLight = new THREE.PointLight( 0xffee88, 2, 500, 2 );

    // const bulbMat = new THREE.MeshStandardMaterial( { emissive: 0xffffee, emissiveIntensity: 1, color: 0x000000 } );
    // bulbLight.add( new THREE.Mesh( bulbGeometry, bulbMat ) );
    // bulbLight.position.set( 1, 0.1, - 3 );
    // bulbLight.castShadow = true;
    // floor.add( bulbLight );
}

function animate() {
    // Render loop
    const delta = clock.getDelta();
    animateCreatures( delta );
    animateDrones();
    updateCharacter( delta );
    renderer.render( scene, camera );
}