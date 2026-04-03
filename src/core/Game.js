import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Game {
  constructor() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 12, 25);
    this.camera.lookAt(0, 2, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(10, 20, 10);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    this.scene.add(directional);

    // Physics
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // Tracked objects for physics sync
    this.syncPairs = []; // { body, mesh }

    // Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Timing
    this.clock = new THREE.Clock();
    this.fixedTimeStep = 1 / 60;
    this.maxSubSteps = 3;
    this.timeScale = 1;

    // Update callbacks
    this.updateCallbacks = [];
  }

  addSyncPair(body, mesh) {
    this.syncPairs.push({ body, mesh });
  }

  removeSyncPair(body) {
    this.syncPairs = this.syncPairs.filter(p => p.body !== body);
  }

  onUpdate(callback) {
    this.updateCallbacks.push(callback);
  }

  start() {
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = this.clock.getDelta();

      // Step physics
      this.world.step(this.fixedTimeStep, dt * this.timeScale, this.maxSubSteps);

      // Sync meshes to physics bodies
      for (const { body, mesh } of this.syncPairs) {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
      }

      // Custom updates
      for (const cb of this.updateCallbacks) {
        cb(dt);
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
