import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Scene & Camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 20);
camera.lookAt(0, 0, 0);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(10, 20, 10);
directional.castShadow = true;
scene.add(directional);

// Physics world
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });

// Ground
const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Box(new CANNON.Vec3(10, 0.5, 10)),
});
groundBody.position.set(0, -0.5, 0);
world.addBody(groundBody);

const groundMesh = new THREE.Mesh(
  new THREE.BoxGeometry(20, 1, 20),
  new THREE.MeshStandardMaterial({ color: 0x555555 })
);
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// Test sphere
const sphereBody = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Sphere(0.5),
  position: new CANNON.Vec3(0, 5, 0),
});
world.addBody(sphereBody);

const sphereMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.5),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
sphereMesh.castShadow = true;
scene.add(sphereMesh);

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Game loop
const timeStep = 1 / 60;
function animate() {
  requestAnimationFrame(animate);
  world.step(timeStep);

  sphereMesh.position.copy(sphereBody.position);
  sphereMesh.quaternion.copy(sphereBody.quaternion);
  groundMesh.position.copy(groundBody.position);

  renderer.render(scene, camera);
}
animate();
