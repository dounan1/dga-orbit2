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

// --- Texture Loading ---
const textureLoader = new THREE.TextureLoader();

// --- IMPORTANT: REPLACE THESE PATHS ---
const sunTexturePath = 'sun_texture.jpg';
const planetTexturePaths = [
    'mercury_texture.jpg', 'venus_texture.jpg', 'earth_texture.jpg', 'mars_texture.jpg',
    'jupiter_texture.jpg', 'saturn_texture.jpg', 'uranus_texture.jpg', 'neptune_texture.jpg'
];
// --- ------------------------- ---

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

// --- Initialization Function ---
function init() {
    // Scene
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

    // Planets
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
        const material = new THREE.MeshStandardMaterial({
            map: planetTexture,
            roughness: 0.9,
            metalness: 0.1
        });

        const planet = new THREE.Mesh(geometry, material);

        const orbitSpeed = BASE_ORBIT_SPEED / Math.sqrt(orbitRadius / BASE_ORBIT_RADIUS);
        const rotationSpeed = BASE_ROTATION_SPEED * data.rotationFactor;
        const initialAngle = Math.random() * Math.PI * 2;

        planet.userData = {
            angle: initialAngle, orbitSpeed: orbitSpeed, rotationSpeed: rotationSpeed,
            orbitRadius: orbitRadius
        };

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
    renderer.toneMappingExposure = 1.5;
    body.appendChild(renderer.domElement);

    // Camera (Crucially defined before composer)
    setupCamera(); // Now we ensure camera exists

    // Post Processing
    const renderScene = new RenderPass(scene, camera); // camera is now defined
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.0, 0.3, 0.8
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
    // If camera doesn't exist, create it. Otherwise, update it.
    if (!camera) {
        camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        // Set initial position only once
        camera.position.set(largestOrbit * 1.0, largestOrbit * 0.8, largestOrbit * 1.5);
    } else {
        camera.aspect = aspect;
    }
    camera.lookAt(scene.position); // Always look at the center
    camera.updateProjectionMatrix(); // Apply aspect changes
}


// --- Animation Loop ---
function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Sun Rotation
    if (sunMesh) sunMesh.rotation.y += 0.01 * delta;

    // Planet Orbit and Rotation
    planets.forEach(planet => {
        planet.userData.angle += planet.userData.orbitSpeed * delta;
        if (planet.userData.angle > Math.PI * 2) {
            planet.userData.angle -= Math.PI * 2;
        }
        const angle = planet.userData.angle;
        const radius = planet.userData.orbitRadius;
        planet.position.x = radius * Math.cos(angle);
        planet.position.z = radius * Math.sin(angle);
        planet.rotation.y += planet.userData.rotationSpeed * delta;
    });

    // Render using the composer
    if (composer) composer.render(delta);
}

// --- Resize Handling ---
function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update camera first
    setupCamera(); // This updates aspect and projection matrix

    // Then update renderer and composer
    if (renderer) renderer.setSize(width, height);
    if (composer) composer.setSize(width, height);
}

// --- Start Button Logic ---
function startExperience() {
    console.log("Starting experience...");

    // Ensure Three.js components are initialized if they weren't already
    if (!scene) {
        init(); // Should have been called already, but safe fallback
    }
     if (!camera) { // Double check camera setup
        setupCamera();
        // If composer relies on camera, might need re-init here if init failed
        // but the structure above should prevent this state.
        if (composer && composer.passes[0] instanceof RenderPass) {
             composer.passes[0].camera = camera; // Update camera in existing pass
        }
    }


    videoElement.muted = false;
    videoElement.play().then(() => {
        console.log("Audio playback started.");
        if (!animationId) {
            animate(); // Start animation loop
        }
    }).catch(error => {
        console.error("Audio playback failed:", error);
        alert("Audio could not start automatically. Browser restrictions likely apply.");
        if (!animationId) {
            animate(); // Start animation loop even if audio fails
        }
    });
    startButton.style.display = 'none';
}

// --- Run Initial Setup ---
init();
