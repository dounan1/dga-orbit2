import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- Configuration ---
const BASE_ORBIT_RADIUS = 5;
const ORBIT_INCREMENT = 3.0;
const SUN_RADIUS = 1.5;
const BASE_PLANET_RADIUS = 0.2;
const BASE_ORBIT_SPEED = 0.25;
const BASE_ROTATION_SPEED = 0.1;

// --- Shockwave Configuration ---
const SHOCKWAVE_COLOR = 0xffffff; // White color
const SHOCKWAVE_START_RADIUS = SUN_RADIUS + 0.1;
const SHOCKWAVE_SPEED = 25.0;
const SHOCKWAVE_DURATION = 2.0; // Slightly shorter duration might look better
const SHOCKWAVE_NUM_LINES = 150; // Number of radial lines
const SHOCKWAVE_THICKNESS = 1.0; // Initial length/thickness of the shockwave band
const SHOCKWAVE_INITIAL_OPACITY = 0.7; // Starting opacity

// --- !!! IMPORTANT: Replace with YOUR audio ring timestamps !!! ---
const ringTimestamps = [
    0, 5.2, 15.8, 30.1, 45.0, 60.5, 78.2, 92.5, 110.3,
    // Add all the times (in seconds) where a ring starts
];
// --- -------------------------------------------------------- ---

const textureLoader = new THREE.TextureLoader();
// --- Texture Paths (Replace!) ---
const sunTexturePath = 'sun_texture.jpg';
const planetTexturePaths = [
    'mercury_texture.jpg', 'venus_texture.jpg', 'earth_texture.jpg', 'mars_texture.jpg',
    'jupiter_texture.jpg', 'saturn_texture.jpg', 'uranus_texture.jpg', 'neptune_texture.jpg'
];
// --- ----------------------- ---

const planetsData = [
    { size: 0.38, rotationFactor: 0.05 }, { size: 0.95, rotationFactor: -0.02 },
    { size: 1.00, rotationFactor: 1.0 },  { size: 0.53, rotationFactor: 0.95 },
    { size: 11.2, rotationFactor: 2.4 },  { size: 9.45, rotationFactor: 2.2 },
    { size: 4.00, rotationFactor: -1.4 }, { size: 3.88, rotationFactor: 1.5 }
];
const NUM_PLANETS = planetsData.length;
const largestOrbit = BASE_ORBIT_RADIUS + (NUM_PLANETS - 1) * ORBIT_INCREMENT;

// --- DOM Elements ---
const videoElement = document.getElementById('bg-audio');
const startButton = document.getElementById('startButton');
const body = document.body;

// --- Core Three.js Variables ---
let scene, camera, renderer, composer, clock;
let sunMesh;
const planets = [];
let animationId = null;
const activeShockwaves = [];
let previousTime = 0;
const triggeredTimestamps = new Set();

// --- Initialization Function ---
function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x333333, 1);
    scene.add(ambientLight);

    // Sun
    const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS, 64, 64);
    const sunTexture = textureLoader.load(sunTexturePath);
    const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
    sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sunMesh);
    const pointLight = new THREE.PointLight(0xffffff, 40, 500, 1.5);
    sunMesh.add(pointLight);

    // Planets (same setup as before)
    const planetGeometryCache = {};
    for (let i = 0; i < NUM_PLANETS; i++) {
        const data = planetsData[i];
        const orbitRadius = BASE_ORBIT_RADIUS + i * ORBIT_INCREMENT;
        const planetRadius = BASE_PLANET_RADIUS * data.size;
        let geometry = planetGeometryCache[data.size];
        if (!geometry) {
            geometry = new THREE.SphereGeometry(Math.max(planetRadius, 0.1), 32, 32);
            planetGeometryCache[data.size] = geometry;
        }
        const planetTexture = textureLoader.load(planetTexturePaths[i]);
        const material = new THREE.MeshStandardMaterial({ map: planetTexture, roughness: 0.9, metalness: 0.1 });
        const planet = new THREE.Mesh(geometry, material);
        const orbitSpeed = BASE_ORBIT_SPEED / Math.sqrt(orbitRadius / BASE_ORBIT_RADIUS);
        const rotationSpeed = BASE_ROTATION_SPEED * data.rotationFactor;
        const initialAngle = Math.random() * Math.PI * 2;
        planet.userData = { angle: initialAngle, orbitSpeed: orbitSpeed, rotationSpeed: rotationSpeed, orbitRadius: orbitRadius };
        planet.position.x = orbitRadius * Math.cos(initialAngle);
        planet.position.z = orbitRadius * Math.sin(initialAngle);
        scene.add(planet);
        planets.push(planet);
    }

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.5; // May need adjustment based on shockwave brightness
    body.appendChild(renderer.domElement);

    // Camera
    setupCamera();

    // Post Processing
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.0, 0.3, 0.8 // strength, radius, threshold
    );
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    startButton.addEventListener('click', startExperience);
}

// --- Camera Setup ---
function setupCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    if (!camera) {
        camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        camera.position.set(largestOrbit * 1.0, largestOrbit * 0.8, largestOrbit * 1.5);
    } else {
        camera.aspect = aspect;
    }
    camera.lookAt(scene.position);
    camera.updateProjectionMatrix();
}

// --- Shockwave Creation (Revised) ---
function createShockwave() {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(SHOCKWAVE_NUM_LINES * 2 * 3); // numLines * 2 vertices/line * 3 coordinates/vertex
    const startRadius = SHOCKWAVE_START_RADIUS;
    const endRadius = SHOCKWAVE_START_RADIUS + SHOCKWAVE_THICKNESS;

    for (let i = 0; i < SHOCKWAVE_NUM_LINES; i++) {
        const angle = (i / SHOCKWAVE_NUM_LINES) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const idx = i * 6; // 6 floats per line (x1,y1,z1, x2,y2,z2)

        // Start vertex
        vertices[idx] = startRadius * cosA;
        vertices[idx + 1] = 0; // Y coordinate
        vertices[idx + 2] = startRadius * sinA;

        // End vertex
        vertices[idx + 3] = endRadius * cosA;
        vertices[idx + 4] = 0; // Y coordinate
        vertices[idx + 5] = endRadius * sinA;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    const material = new THREE.LineBasicMaterial({
        color: SHOCKWAVE_COLOR,
        transparent: true,
        opacity: SHOCKWAVE_INITIAL_OPACITY,
        blending: THREE.AdditiveBlending, // Glow with bloom
        // linewidth: 1 // Note: linewidth > 1 often ignored on Windows/ANGLE
    });

    const shockwaveLines = new THREE.LineSegments(geometry, material);
    shockwaveLines.userData = {
        startTime: clock.getElapsedTime(),
        duration: SHOCKWAVE_DURATION,
        speed: SHOCKWAVE_SPEED,
        startRadius: SHOCKWAVE_START_RADIUS,
        thickness: SHOCKWAVE_THICKNESS,
        numLines: SHOCKWAVE_NUM_LINES
    };

    scene.add(shockwaveLines);
    activeShockwaves.push(shockwaveLines);
    console.log("Created shockwave lines, count:", SHOCKWAVE_NUM_LINES);
}

// --- Animation Loop (Revised Shockwave Update) ---
function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    const currentTime = videoElement.currentTime;

    // --- Audio Trigger Logic ---
    if (currentTime < previousTime && previousTime > 1.0) {
        triggeredTimestamps.clear();
    }
    for (const timestamp of ringTimestamps) {
        if (previousTime < timestamp && currentTime >= timestamp && !triggeredTimestamps.has(timestamp)) {
            createShockwave();
            triggeredTimestamps.add(timestamp);
            setTimeout(() => triggeredTimestamps.delete(timestamp), 5000);
        }
    }
    previousTime = currentTime;

    // --- Update Sun & Planets (Same as before) ---
    if (sunMesh) sunMesh.rotation.y += 0.01 * delta;
    planets.forEach(planet => {
        planet.userData.angle = (planet.userData.angle + planet.userData.orbitSpeed * delta) % (Math.PI * 2);
        const angle = planet.userData.angle;
        const radius = planet.userData.orbitRadius;
        planet.position.x = radius * Math.cos(angle);
        planet.position.z = radius * Math.sin(angle);
        planet.rotation.y += planet.userData.rotationSpeed * delta;
    });

    // --- Update Active Shockwaves (Revised) ---
    let needsUpdate = false; // Flag to update geometry attribute only once if needed
    for (let i = activeShockwaves.length - 1; i >= 0; i--) {
        const shockwave = activeShockwaves[i];
        const data = shockwave.userData;
        const geometry = shockwave.geometry;
        const positionAttribute = geometry.attributes.position;
        const vertices = positionAttribute.array;
        const age = elapsed - data.startTime;

        if (age > data.duration) {
            scene.remove(shockwave);
            geometry.dispose(); // Important cleanup
            shockwave.material.dispose(); // Important cleanup
            activeShockwaves.splice(i, 1);
        } else {
            needsUpdate = true; // Mark that we are updating vertices
            const progress = age / data.duration;
            const currentOuterRadius = data.startRadius + age * data.speed;
            // Keep thickness constant or make it expand slightly? Let's keep constant for now.
            const currentInnerRadius = Math.max(data.startRadius, currentOuterRadius - data.thickness);

            // Update vertices
            for (let j = 0; j < data.numLines; j++) {
                const angle = (j / data.numLines) * Math.PI * 2;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                const idx = j * 6;

                // Update Start vertex
                vertices[idx] = currentInnerRadius * cosA;
                // vertices[idx + 1] = 0; // Y is always 0
                vertices[idx + 2] = currentInnerRadius * sinA;

                // Update End vertex
                vertices[idx + 3] = currentOuterRadius * cosA;
                // vertices[idx + 4] = 0; // Y is always 0
                vertices[idx + 5] = currentOuterRadius * sinA;
            }

            // Fade out opacity
            shockwave.material.opacity = SHOCKWAVE_INITIAL_OPACITY * (1.0 - progress);
        }
    }
    // IMPORTANT: Tell Three.js to update the geometry buffer on the GPU if we changed it
    if (needsUpdate) {
       activeShockwaves.forEach(sw => sw.geometry.attributes.position.needsUpdate = true);
       // It might be slightly more efficient to just update the ones that changed,
       // but this ensures all active ones are updated if modified. Reset flag after.
       // Reset the needsUpdate flag on each attribute after render maybe?
       // For simplicity, just mark all active ones if any were updated.
    }


    // --- Render ---
    if (composer) composer.render(delta);
}


// --- Resize Handling ---
function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    setupCamera();
    if (renderer) renderer.setSize(width, height);
    if (composer) composer.setSize(width, height);
}

// --- Start Button Logic ---
function startExperience() {
    console.log("Starting experience...");
    if (!scene) init();
    if (!camera) setupCamera();

    videoElement.muted = false;
    videoElement.play().then(() => {
        console.log("Audio playback started.");
        previousTime = videoElement.currentTime;
        if (!animationId) animate();
    }).catch(error => {
        console.error("Audio playback failed:", error);
        alert("Audio could not start automatically. Browser restrictions likely apply.");
        if (!animationId) animate();
    });
    startButton.style.display = 'none';
}

// --- Run Initial Setup ---
init();
