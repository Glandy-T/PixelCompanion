import * as THREE from '../../node_modules/three/build/three.module.js';

export function createThreePlaceholder({ canvas, onFailure = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 20);
  camera.position.set(0, 0.4, 6);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x526078, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(-3, 4, 5);
  scene.add(light);
  const body = new THREE.Group();
  scene.add(body);
  const material = new THREE.MeshStandardMaterial({ color: 0x9caebe, roughness: 0.78 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x263446 });
  const meshes = [];
  function box(w, h, d, x, y, z, parent = body, mat = material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    meshes.push(mesh);
    return mesh;
  }
  box(0.8, 0.85, 0.55, 0, -0.1, 0);
  const head = new THREE.Group();
  head.position.y = 0.65;
  body.add(head);
  box(0.95, 0.65, 0.65, 0, 0, 0, head);
  box(0.12, 0.14, 0.06, -0.21, 0.02, 0.34, head, dark);
  box(0.12, 0.14, 0.06, 0.21, 0.02, 0.34, head, dark);
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.55, 0.2, 0);
    body.add(pivot);
    box(0.22, 0.65, 0.3, 0, -0.25, 0, pivot);
    return pivot;
  });
  box(0.3, 0.38, 0.45, -0.24, -0.72, 0.06);
  box(0.3, 0.38, 0.45, 0.24, -0.72, 0.06);
  const driver = new window.PixelCompanionMotionDriver.MotionDriver();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let disposed = false;
  let lastRender = -Infinity;
  let lastSnapshot = driver.snapshot();
  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const contextLost = event => {
    event.preventDefault();
    dispose();
    onFailure('webgl-context-lost');
  };
  canvas.addEventListener('webglcontextlost', contextLost);
  function dispose() {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    canvas.removeEventListener('webglcontextlost', contextLost);
    for (const mesh of meshes) mesh.geometry.dispose();
    material.dispose();
    dark.dispose();
    renderer.dispose();
  }
  resize();
  return {
    setState(state, options) { driver.setState(state, options); },
    tick(now) {
      if (disposed || document.hidden || now - lastRender < 1000 / 30) return lastSnapshot;
      lastRender = now;
      lastSnapshot = driver.tick(now);
      const p = lastSnapshot.pose;
      body.position.set(p.x, p.y, 0);
      body.rotation.set(0, p.turn + 0.12, p.lean);
      body.scale.setScalar(p.scale);
      head.rotation.x = p.head;
      arms[0].rotation.z = p.arm;
      arms[1].rotation.z = -p.arm;
      renderer.render(scene, camera);
      return lastSnapshot;
    },
    hitTest(x, y) {
      if (disposed) return false;
      const r = canvas.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      pointer.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(meshes, false).length > 0;
    },
    dispose
  };
}
