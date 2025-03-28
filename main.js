import * as THREE from 'three';

// --- Configuration ---
const BASE_ORBIT_RADIUS = 3;
const ORBIT_INCREMENT = 1.5; // Increase radius for each subsequent planet
const SUN_RADIUS = 1;
const BASE_PLANET_RADIUS = 0.2;
const BASE_SPEED = 0.4; // Radians per second for the innermost planet

// Simple Planet Data (Colors, Relative Size Multiplier)
const planetsData = [
    { color: "#AAAAAA", size: 0.8 },  // Mercury (Grey)
    { color: "#E6C397", size: 1.1 },  // Venus (Yellowish) // <-- NOW A STRING
    { color: "#6fa0ff", size: 1.15 }, // Earth (Blue)
    { color: "#FF7F50", size: 0.9 },  // Mars (Reddish-Orange)
    { color: "#F4A460", size: 2.5 }, // Jupiter (Light Brown/Orange Bands)
    { color: "#FFFACD", size: 2.2 }, // Saturn (Pale Yellow)
    { color: "#ADD8E6", size: 1.8 }, // Uranus (Light Blue)
    { color: "#4169E1", size: 1.7 }  // Neptune (Dark Blue)
];
const NUM_PLANETS = planetsData.length;

// --- DOM Elements ---
const viewSideElement = document.getElementById('view-side');
const videoElement = document.getElementById('bg-audio');
const startButton = document.getElementById('startButton');

// --- Basic Scene Setup ---
const scene = new THREE.Scene();
const clock = new THREE.Clock();

// --- Lighting ---
// Keep ambient light relatively low if sun is emissive
const ambientLight = new THREE.AmbientLight(0x404040, 1);
scene.add(ambientLight);
// The sun itself will act as the primary light source now

// --- Sun ---
const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS, 32, 32);
// Use MeshBasicMaterial with emissive property for a simple glowing sun
const sunMaterial = new THREE.MeshBasicMaterial({
    color: 0xFFFF00, // Yellow
    // wireframe: true // Optional: show wireframe
});
const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sunMesh);

// Add a point light originating from the sun
const pointLight = new THREE.PointLight(0xffffff, 3, 100); // Color, Intensity, Distance
sunMesh.add(pointLight); // Attach light to the sun object

// --- Planets ---
const planets = [];
const planetGeometryCache = {}; // Cache geometries by size
const planetMaterialCache = {}; // Cache materials by color

for (let i = 0; i < NUM_PLANETS; i++) {
    const data = planetsData[i];
    const orbitRadius = BASE_ORBIT_RADIUS + i * ORBIT_INCREMENT;
    const planetRadius = BASE_PLANET_RADIUS * data.size;

    // Use cached geometry/material if available
    let geometry = planetGeometryCache[data.size];
    if (!geometry) {
        geometry = new THREE.SphereGeometry(planetRadius, 16, 16);
        planetGeometryCache[data.size] = geometry;
    }

    let material = planetMaterialCache[data.color];
    if (!material) {
         // Use standard material to receive light from the sun
        material = new THREE.MeshStandardMaterial({
            color: data.color,
            roughness: 0.8,
            metalness: 0.1
        });
        planetMaterialCache[data.color] = material;
    }

    const planet = new THREE.Mesh(geometry, material);

    // Calculate speed based on distance (simplified Kepler's 3rd Law approximation)
    // Speed is inversely proportional to sqrt of radius
    const speed = BASE_SPEED / Math.sqrt(orbitRadius / BASE_ORBIT_RADIUS);

    const initialAngle = Math.random() * Math.PI * 2; // Random starting position

    planet.userData = {
        angle: initialAngle,
        speed: speed,
        orbitRadius: orbitRadius
    };

    // Initial position
    planet.position.x = orbitRadius * Math.cos(initialAngle);
    planet.position.z = orbitRadius * Math.sin(initialAngle);
    planet.position.y = 0; // Orbit in the XZ plane

    scene.add(planet);
    planets.push(planet);
}

// --- Renderer ---
const rendererSide = new THREE.WebGLRenderer({ antialias: true });
rendererSide.setClearColor(0x000000); // Black background
viewSideElement.appendChild(rendererSide.domElement);

// --- Camera ---
let cameraSide;
const largestOrbit = BASE_ORBIT_RADIUS + (NUM_PLANETS - 1) * ORBIT_INCREMENT;

function setupCamerasAndRenderers() {
    const sideAspect = viewSideElement.clientWidth / viewSideElement.clientHeight;

    // Side Camera (Perspective)
    cameraSide = new THREE.PerspectiveCamera(55, sideAspect, 0.1, 200);
    // Position further back and higher up to see all orbits
    cameraSide.position.set(largestOrbit * 1.3, largestOrbit * 0.7, 0);
    cameraSide.lookAt(scene.position); // Look at the sun (center)

    // Set renderer size
    rendererSide.setSize(viewSideElement.clientWidth, viewSideElement.clientHeight);
}

// --- Animation Loop ---
let animationId = null;

function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta();

    planets.forEach(planet => {
        // Update angle
        planet.userData.angle += planet.userData.speed * delta;
        if (planet.userData.angle > Math.PI * 2) {
            planet.userData.angle -= Math.PI * 2; // Keep angle within 0-2PI
        }

        // Calculate new position using the planet's specific orbit radius
        const angle = planet.userData.angle;
        const radius = planet.userData.orbitRadius;
        planet.position.x = radius * Math.cos(angle);
        planet.position.z = radius * Math.sin(angle);
        // planet.position.y remains 0
    });

    // Rotate the sun slowly (optional)
    sunMesh.rotation.y += 0.05 * delta;

    // Render the single view
    rendererSide.render(scene, cameraSide);
}

// --- Resize Handling ---
function onWindowResize() {
    // Only need to update the side view
    setupCamerasAndRenderers();
}
window.addEventListener('resize', onWindowResize);

// --- Start Button Logic ---
function startExperience() {
    console.log("Starting experience...");
    videoElement.muted = false;
    videoElement.play().then(() => {
        console.log("Audio playback started.");
        if (!animationId) {
            setupCamerasAndRenderers(); // Ensure initial setup
            animate();
        }
    }).catch(error => {
        console.error("Audio playback failed:", error);
        alert("Audio could not start automatically. Please ensure permissions are granted.");
         if (!animationId) {
            setupCamerasAndRenderers(); // Ensure initial setup
            animate();
        }
    });
    startButton.style.display = 'none';
}

startButton.addEventListener('click', startExperience);

// Initial setup call
setupCamerasAndRenderers();
