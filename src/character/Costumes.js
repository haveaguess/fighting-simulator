import * as THREE from 'three';

export const COSTUMES = {
  wrestler: {
    name: 'Wrestler',
    head: { color: 0xffccaa },
    torso: { color: 0xff0000, scaleX: 1.2, scaleZ: 1.2 },
    arms: { color: 0xffccaa },
    legs: { color: 0x0000ff },
  },
  chicken: {
    name: 'Chicken Suit',
    head: { color: 0xffffff, hat: 'comb' },
    torso: { color: 0xffffff, scaleX: 1.3, scaleZ: 1.3 },
    arms: { color: 0xffff44 },
    legs: { color: 0xff8800 },
  },
  dinosaur: {
    name: 'Dinosaur',
    head: { color: 0x44aa44, hat: 'horns' },
    torso: { color: 0x44aa44, scaleX: 1.2, scaleZ: 1.1 },
    arms: { color: 0x338833 },
    legs: { color: 0x338833 },
  },
  astronaut: {
    name: 'Astronaut',
    head: { color: 0xcccccc, hat: 'helmet' },
    torso: { color: 0xffffff, scaleX: 1.3, scaleZ: 1.3 },
    arms: { color: 0xdddddd },
    legs: { color: 0xdddddd },
  },
  pirate: {
    name: 'Pirate',
    head: { color: 0xffccaa, hat: 'pirateHat' },
    torso: { color: 0x663300 },
    arms: { color: 0xffccaa },
    legs: { color: 0x222222 },
  },
  robot: {
    name: 'Robot',
    head: { color: 0x888888, metalness: 0.9, hat: 'antenna' },
    torso: { color: 0x666666, metalness: 0.9 },
    arms: { color: 0x777777, metalness: 0.9 },
    legs: { color: 0x555555, metalness: 0.9 },
  },
  ninja: {
    name: 'Ninja',
    head: { color: 0x222222 },
    torso: { color: 0x111111 },
    arms: { color: 0x111111 },
    legs: { color: 0x111111 },
  },
  luchador: {
    name: 'Luchador',
    head: { color: 0xff00ff, hat: 'mask' },
    torso: { color: 0xff00ff },
    arms: { color: 0xffccaa },
    legs: { color: 0xffff00 },
  },
  redChicken: {
    name: 'Red Chicken',
    head: { color: 0xcc0000, hat: 'comb' },
    torso: { color: 0xcc0000, scaleX: 1.3, scaleZ: 1.3 },
    arms: { color: 0xff3333 },
    legs: { color: 0xff6600 },
  },
};

export const COSTUME_KEYS = Object.keys(COSTUMES);

export function applyCostume(ragdoll, costumeKey) {
  const costume = COSTUMES[costumeKey];
  if (!costume) return;

  const applyPart = (meshName, config) => {
    const mesh = ragdoll.meshes[meshName];
    if (!mesh || !config) return;
    mesh.material.color.setHex(config.color);
    if (config.metalness !== undefined) mesh.material.metalness = config.metalness;
    if (config.scaleX) mesh.scale.x = config.scaleX;
    if (config.scaleZ) mesh.scale.z = config.scaleZ;
  };

  applyPart('torso', costume.torso);
  applyPart('head', costume.head);
  applyPart('leftUpperArm', costume.arms);
  applyPart('rightUpperArm', costume.arms);
  applyPart('leftLowerArm', costume.arms);
  applyPart('rightLowerArm', costume.arms);
  applyPart('leftUpperLeg', costume.legs);
  applyPart('rightUpperLeg', costume.legs);
  applyPart('leftLowerLeg', costume.legs);
  applyPart('rightLowerLeg', costume.legs);

  if (costume.head?.hat) {
    addHatAccessory(ragdoll, costume.head.hat, costume.head.color);
  }
}

function addHatAccessory(ragdoll, type, color) {
  const head = ragdoll.meshes.head;
  if (!head) return;

  let hat;
  switch (type) {
    case 'comb':
      hat = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.3, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );
      hat.position.y = 0.35;
      break;
    case 'horns':
      hat = new THREE.Group();
      const horn1 = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.25, 6),
        new THREE.MeshStandardMaterial({ color: 0x886633 })
      );
      horn1.position.set(-0.15, 0.3, 0);
      const horn2 = horn1.clone();
      horn2.position.x = 0.15;
      hat.add(horn1, horn2);
      break;
    case 'helmet':
      hat = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
      );
      break;
    case 'pirateHat':
      hat = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.2, 0.35),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
      );
      hat.position.y = 0.3;
      break;
    case 'antenna':
      hat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );
      hat.position.y = 0.4;
      break;
    case 'mask':
      hat = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xff00ff })
      );
      break;
    default:
      return;
  }

  head.add(hat);
}
