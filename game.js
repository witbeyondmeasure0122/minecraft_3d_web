import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const WORLD_SIZE = 32;
const SAVE_KEY = 'simple-voxel-world-v1';
const blockColors = {
  grass: 0x58a942,
  dirt: 0x8b5a2b,
  stone: 0x858b91,
  wood: 0x9b642e
};
const blockNames = { grass: '草地', dirt: '泥土', stone: '石頭', wood: '木頭' };

const gameRoot = document.querySelector('#game');
const overlay = document.querySelector('#overlay');
const startBtn = document.querySelector('#startBtn');
const saveBtn = document.querySelector('#saveBtn');
const resetBtn = document.querySelector('#resetBtn');
const statusEl = document.querySelector('#status');
const errorEl = document.querySelector('#error');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec9ef);
scene.fog = new THREE.Fog(0x8ec9ef, 24, 58);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 100);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
gameRoot.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x65704c, 2.0));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(12, 24, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const materials = {};
for (const [type, color] of Object.entries(blockColors)) {
  materials[type] = new THREE.MeshStandardMaterial({ color, roughness: 1 });
}
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const blocks = new Map();
const blockMeshes = [];
const raycaster = new THREE.Raycaster();
raycaster.far = 6;
const center = new THREE.Vector2(0, 0);
const keys = new Set();

let selectedBlock = 'grass';
let yaw = 0;
let pitch = 0;
let isLocked = false;
let velocityY = 0;
let grounded = false;
let lastTime = performance.now();

const player = {
  position: new THREE.Vector3(WORLD_SIZE / 2, 3, WORLD_SIZE / 2),
  height: 1.7,
  radius: 0.28
};

function keyOf(x, y, z) {
  return `${x},${y},${z}`;
}
function parseKey(key) {
  return key.split(',').map(Number);
}
function inWorld(x, z) {
  return x >= 0 && z >= 0 && x < WORLD_SIZE && z < WORLD_SIZE;
}
function addBlock(x, y, z, type, persist = true) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (!inWorld(x, z) || y < 0 || y > 20) return false;
  const key = keyOf(x, y, z);
  if (blocks.has(key)) return false;
  const mesh = new THREE.Mesh(blockGeometry, materials[type] || materials.grass);
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { key, type, x, y, z };
  scene.add(mesh);
  blocks.set(key, mesh);
  blockMeshes.push(mesh);
  if (persist) updateStatus();
  return true;
}
function removeBlock(mesh) {
  if (!mesh || mesh.userData.y === 0) return false;
  scene.remove(mesh);
  blocks.delete(mesh.userData.key);
  const index = blockMeshes.indexOf(mesh);
  if (index >= 0) blockMeshes.splice(index, 1);
  updateStatus();
  return true;
}
function clearWorld() {
  for (const mesh of blocks.values()) scene.remove(mesh);
  blocks.clear();
  blockMeshes.length = 0;
}
function generateWorld() {
  clearWorld();
  // 第一版採用平坦地形，保留簡單可預測的操作體驗。
  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      addBlock(x, 0, z, 'dirt', false);
      addBlock(x, 1, z, 'grass', false);
    }
  }
  // 放幾個簡單的石頭與木頭方塊當作測試目標。
  for (let i = 0; i < 10; i++) {
    const x = 4 + Math.floor(Math.random() * (WORLD_SIZE - 8));
    const z = 4 + Math.floor(Math.random() * (WORLD_SIZE - 8));
    addBlock(x, 2, z, i % 2 ? 'stone' : 'wood', false);
  }
  player.position.set(WORLD_SIZE / 2, 2.01, WORLD_SIZE / 2);
  velocityY = 0;
  updateStatus();
}
function saveWorld(showMessage = true) {
  const data = {
    version: 1,
    player: { x: player.position.x, y: player.position.y, z: player.position.z, yaw, pitch },
    blocks: [...blocks.values()].map(m => ({
      x: m.userData.x, y: m.userData.y, z: m.userData.z, type: m.userData.type
    }))
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (showMessage) statusEl.textContent = `已儲存 ${blocks.size} 個方塊`;
  } catch (error) {
    statusEl.textContent = '儲存失敗：瀏覽器儲存空間可能不足';
    console.error(error);
  }
}
function loadWorld() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.blocks)) return false;
    clearWorld();
    for (const b of data.blocks) {
      if (Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z)) {
        addBlock(b.x, b.y, b.z, blockColors[b.type] ? b.type : 'grass', false);
      }
    }
    if (data.player) {
      player.position.set(data.player.x, data.player.y, data.player.z);
      yaw = data.player.yaw || 0;
      pitch = data.player.pitch || 0;
    }
    updateStatus();
    return true;
  } catch (error) {
    console.warn('讀取存檔失敗', error);
    return false;
  }
}
function updateStatus() {
  statusEl.textContent = `世界：${WORLD_SIZE} × ${WORLD_SIZE}｜方塊：${blocks.size}｜選取：${blockNames[selectedBlock]}`;
}
function selectBlock(type) {
  selectedBlock = type;
  document.querySelectorAll('[data-block]').forEach(button => {
    button.classList.toggle('selected', button.dataset.block === type);
  });
  updateStatus();
}
function syncCamera() {
  camera.position.set(player.position.x, player.position.y + player.height * 0.35, player.position.z);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
}
function collidesAt(pos) {
  const minX = pos.x - player.radius, maxX = pos.x + player.radius;
  const minY = pos.y, maxY = pos.y + player.height;
  const minZ = pos.z - player.radius, maxZ = pos.z + player.radius;
  for (let x = Math.floor(minX); x <= Math.floor(maxX); x++) {
    for (let y = Math.floor(minY); y <= Math.floor(maxY); y++) {
      for (let z = Math.floor(minZ); z <= Math.floor(maxZ); z++) {
        const mesh = blocks.get(keyOf(x, y, z));
        if (!mesh) continue;
        if (maxX > x && minX < x + 1 && maxY > y && minY < y + 1 && maxZ > z && minZ < z + 1) return true;
      }
    }
  }
  return false;
}
function tryMove(dx, dz) {
  const nextX = player.position.clone();
  nextX.x += dx;
  if (!collidesAt(nextX)) player.position.x = nextX.x;
  const nextZ = player.position.clone();
  nextZ.z += dz;
  if (!collidesAt(nextZ)) player.position.z = nextZ.z;
  player.position.x = THREE.MathUtils.clamp(player.position.x, player.radius, WORLD_SIZE - player.radius);
  player.position.z = THREE.MathUtils.clamp(player.position.z, player.radius, WORLD_SIZE - player.radius);
}
function handleBlockAction(place) {
  if (!isLocked) return;
  raycaster.setFromCamera(center, camera);
  const hits = raycaster.intersectObjects(blockMeshes, false);
  if (!hits.length) return;
  const hit = hits[0];
  const target = hit.object;
  if (!place) {
    removeBlock(target);
    return;
  }
  const normal = hit.face.normal.clone().transformDirection(target.matrixWorld);
  const x = target.userData.x + Math.round(normal.x);
  const y = target.userData.y + Math.round(normal.y);
  const z = target.userData.z + Math.round(normal.z);
  const newPos = new THREE.Vector3(x + 0.5, y, z + 0.5);
  const playerBox = {
    minX: player.position.x - player.radius, maxX: player.position.x + player.radius,
    minY: player.position.y, maxY: player.position.y + player.height,
    minZ: player.position.z - player.radius, maxZ: player.position.z + player.radius
  };
  if (newPos.x + 0.5 > playerBox.minX && newPos.x - 0.5 < playerBox.maxX &&
      y + 1 > playerBox.minY && y < playerBox.maxY &&
      newPos.z + 0.5 > playerBox.minZ && newPos.z - 0.5 < playerBox.maxZ) return;
  addBlock(x, y, z, selectedBlock);
}
function startGame() {
  renderer.domElement.requestPointerLock();
}
startBtn.addEventListener('click', startGame);
document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === renderer.domElement;
  overlay.classList.toggle('hidden', isLocked);
});
document.addEventListener('pointerlockerror', () => {
  errorEl.textContent = '瀏覽器無法啟用滑鼠鎖定，請改用桌面版 Chrome 或 Edge 測試。';
});
document.addEventListener('mousemove', event => {
  if (!isLocked) return;
  yaw -= event.movementX * 0.0022;
  pitch -= event.movementY * 0.0022;
  pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
});
document.addEventListener('keydown', event => {
  keys.add(event.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  const numberMap = { Digit1: 'grass', Digit2: 'dirt', Digit3: 'stone', Digit4: 'wood' };
  if (numberMap[event.code]) selectBlock(numberMap[event.code]);
  if (event.code === 'Space' && grounded) {
    velocityY = 7.2;
    grounded = false;
  }
});
document.addEventListener('keyup', event => keys.delete(event.code));
document.addEventListener('mousedown', event => {
  if (event.button === 0) handleBlockAction(false);
  if (event.button === 2) handleBlockAction(true);
});
document.addEventListener('contextmenu', event => event.preventDefault());
document.querySelectorAll('[data-block]').forEach(button => {
  button.addEventListener('click', () => selectBlock(button.dataset.block));
});
saveBtn.addEventListener('click', () => saveWorld(true));
resetBtn.addEventListener('click', () => {
  if (confirm('確定重設世界？目前的世界會被新世界取代。')) {
    localStorage.removeItem(SAVE_KEY);
    generateWorld();
    saveWorld(false);
  }
});
window.addEventListener('beforeunload', () => saveWorld(false));
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

if (!loadWorld()) {
  generateWorld();
  saveWorld(false);
}

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  if (isLocked) {
    const speed = (keys.has('ShiftLeft') ? 7 : 4.5) * delta;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    let dx = 0, dz = 0;
    if (keys.has('KeyW')) { dx += forward.x * speed; dz += forward.z * speed; }
    if (keys.has('KeyS')) { dx -= forward.x * speed; dz -= forward.z * speed; }
    if (keys.has('KeyD')) { dx += right.x * speed; dz += right.z * speed; }
    if (keys.has('KeyA')) { dx -= right.x * speed; dz -= right.z * speed; }
    const length = Math.hypot(dx, dz);
    if (length > speed) { dx = dx / length * speed; dz = dz / length * speed; }
    tryMove(dx, dz);

    velocityY -= 18 * delta;
    const nextY = player.position.clone();
    nextY.y += velocityY * delta;
    if (!collidesAt(nextY)) {
      player.position.y = nextY.y;
      grounded = false;
    } else {
      if (velocityY < 0) grounded = true;
      velocityY = 0;
    }
    if (player.position.y < -5) {
      player.position.set(WORLD_SIZE / 2, 3, WORLD_SIZE / 2);
      velocityY = 0;
    }
  }
  syncCamera();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
