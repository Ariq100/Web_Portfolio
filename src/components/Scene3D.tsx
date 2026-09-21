import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { motion } from '../motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { assets, type AssetName } from '../three/assets';
import { createPhotoMaterial } from '../three/photoPoints';

const CAMERA_Z = 8;
const FOV = 50;

const GREEN = '#32d74b';
const MAGENTA = '#bf5af2';
const WHITE = '#e5e5e5';

type Motion = 'portrait' | 'relief' | 'spin' | 'turntable' | 'sway';

interface Placement {
  asset: AssetName;
  /** `photo` renders a coloured particle portrait instead of wireframe lines. */
  kind?: 'lines' | 'photo';
  section: string;
  color: string;
  /** Horizontal position as a fraction of the half-viewport width (-1 left, 1 right). */
  x: number;
  /** Vertical offset as a fraction of the section height from its centre. */
  y?: number;
  z?: number;
  /** Size of the model's largest dimension as a fraction of viewport height. */
  size: number;
  opacity?: number;
  motion: Motion;
  /** Base rotation. */
  rotation?: [number, number, number];
}

const PLACEMENTS: Placement[] = [
  { asset: 'me', kind: 'photo', section: 'home', color: WHITE, x: 0.64, y: 0.02, size: 0.7, opacity: 1, motion: 'portrait' },
  { asset: 'lelouch', section: 'about', color: MAGENTA, x: 0.64, y: 0, size: 0.66, opacity: 0.8, motion: 'relief' },
  { asset: 'ball', section: 'about', color: WHITE, x: -0.78, y: 0.3, z: -1, size: 0.22, opacity: 0.8, motion: 'spin' },
  { asset: 'cat', section: 'projects', color: WHITE, x: 0.76, y: 0.1, z: -1, size: 0.4, opacity: 0.8, motion: 'sway', rotation: [0.08, -0.3, 0] },
  // y is downward: the Porsche sits above the Aston in the right-hand column.
  { asset: 'porsche', section: 'contact', color: WHITE, x: 0.56, y: -0.2, z: -1, size: 0.44, opacity: 0.7, motion: 'turntable', rotation: [0.2, 0.6, 0] },
  { asset: 'aston', section: 'contact', color: WHITE, x: 0.56, y: 0.22, z: -1, size: 0.46, opacity: 0.6, motion: 'turntable', rotation: [0.2, 2.2, 0] },
];

const halfHeightAt = (z: number) => Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (CAMERA_Z - z);

const ASSEMBLE_SECONDS = 2.4;

/** A model that tracks its section's on-screen position. */
function Anchored({ p }: { p: Placement }) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const lineMaterial = useRef<THREE.LineBasicMaterial>(null);
  const opacity = useRef(0);
  const assembled = useRef(0);
  const { size, camera, gl } = useThree();
  const reduced = useReducedMotion();
  const geometry = assets[p.asset];
  const baseColor = useMemo(() => new THREE.Color(p.color), [p.color]);
  const photoMaterial = useMemo(
    () => (p.kind === 'photo' && geometry ? createPhotoMaterial(geometry) : null),
    [p.kind, geometry],
  );
  const pointer = useMemo(
    () => ({ ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), plane: new THREE.Plane(), hit: new THREE.Vector3(), normal: new THREE.Vector3() }),
    [],
  );

  useFrame((state, delta) => {
    const g = group.current;
    const el = document.getElementById(p.section);
    if (!g || !inner.current || !el) return;

    const z = p.z ?? 0;
    const hh = halfHeightAt(z);
    const worldPerPx = (2 * hh) / size.height;
    const narrow = size.width < size.height * 0.9;
    const rect = el.getBoundingClientRect();
    // Sticky: hold the model in view while its section is on screen, then scroll away with it.
    const desired = size.height * (0.5 + (p.y ?? 0));
    const lo = rect.top + size.height * 0.35;
    const hi = rect.bottom - size.height * 0.35;
    const anchorY = lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, desired));

    g.position.set(
      (narrow ? p.x * 0.45 : p.x) * hh * (size.width / size.height),
      -(anchorY - size.height / 2) * worldPerPx,
      z,
    );
    g.scale.setScalar(p.size * 2 * hh * (narrow ? 0.75 : 1));

    const t = state.clock.elapsedTime;
    const [rx, ry, rz] = p.rotation ?? [0, 0, 0];
    const r = inner.current.rotation;
    switch (p.motion) {
      case 'portrait':
        r.set(rx + motion.my * 0.1, ry + Math.sin(t * 0.3) * 0.12 + motion.mx * 0.3, rz);
        break;
      case 'relief':
        r.set(rx + motion.my * 0.18, ry + Math.sin(t * 0.35) * 0.3 + motion.mx * 0.45, rz);
        break;
      case 'spin':
        r.set(rx + t * 0.4 + motion.my * 0.4, ry + t * 0.7 + motion.mx * 0.6, rz);
        break;
      case 'turntable':
        r.set(rx + motion.my * 0.1, ry + t * 0.25 + motion.mx * 0.4, rz);
        break;
      case 'sway':
        r.set(rx + motion.my * 0.12, ry + Math.sin(t * 0.5) * 0.45 + motion.mx * 0.5, rz);
        break;
    }

    // Fade by how much of the viewport the section fills, so neighbours cross-fade.
    const coverage = Math.max(0, Math.min(rect.bottom, size.height) - Math.max(rect.top, 0)) / size.height;
    const presence = THREE.MathUtils.smoothstep(coverage, 0.2, 0.6);
    // On narrow screens models sit behind the text, so keep them faint.
    const narrowDim = p.kind === 'photo' ? 0.2 : 0.3;
    const target = presence * (p.opacity ?? 0.6) * (narrow ? narrowDim : 1);
    opacity.current += (target - opacity.current) * 0.08;
    g.visible = opacity.current > 0.01;
    if (lineMaterial.current) lineMaterial.current.opacity = opacity.current;

    if (photoMaterial) {
      const u = photoMaterial.uniforms;
      // Fly together on load; blow apart into dust as the section scrolls away.
      assembled.current = reduced ? 1 : Math.min(1, assembled.current + delta / ASSEMBLE_SECONDS);
      u.uProgress.value = Math.min(assembled.current, 0.25 + 0.75 * presence);
      u.uTime.value = t;
      u.uOpacity.value = opacity.current;
      u.uResY.value = size.height * gl.getPixelRatio();

      // Project the cursor onto the portrait's plane, in its local space.
      if (motion.x >= 0) {
        pointer.ndc.set((motion.x / size.width) * 2 - 1, -(motion.y / size.height) * 2 + 1);
        pointer.ray.setFromCamera(pointer.ndc, camera);
        inner.current.getWorldDirection(pointer.normal);
        pointer.plane.setFromNormalAndCoplanarPoint(pointer.normal, g.getWorldPosition(pointer.hit));
        if (pointer.ray.ray.intersectPlane(pointer.plane, pointer.hit)) {
          inner.current.worldToLocal(pointer.hit);
          (u.uMouse.value as THREE.Vector3).lerp(pointer.hit, 0.35);
        }
      }
    }
  });

  if (!geometry) return null;
  return (
    <group ref={group}>
      <group ref={inner}>
        {photoMaterial ? (
          <points geometry={geometry} material={photoMaterial} />
        ) : (
          <lineSegments geometry={geometry}>
            <lineBasicMaterial ref={lineMaterial} color={baseColor} vertexColors transparent opacity={0} depthWrite={false} />
          </lineSegments>
        )}
      </group>
    </group>
  );
}

/** Star-like bits tiled vertically so they parallax with the page forever. */
function BitField({ count = 900 }: { count?: number }) {
  const ref = useRef<THREE.Group>(null);
  const PERIOD = 12;
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color('#e5e5e5'), new THREE.Color(GREEN), new THREE.Color('#8e8e93')];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = Math.random() * PERIOD;
      positions[i * 3 + 2] = -Math.random() * 16 + 1;
      const c = palette[Math.random() < 0.7 ? 2 : Math.random() < 0.5 ? 1 : 0];
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [count]);

  useFrame(() => {
    if (!ref.current) return;
    const offset = (window.scrollY * 0.004) % PERIOD;
    ref.current.position.set(motion.mx * -0.4, offset - PERIOD * 1.5, 0);
  });

  return (
    <group ref={ref}>
      {[0, 1, 2].map((k) => (
        <points key={k} geometry={geometry} position={[0, k * PERIOD, 0]}>
          <pointsMaterial size={0.035} vertexColors transparent opacity={0.75} sizeAttenuation depthWrite={false} />
        </points>
      ))}
    </group>
  );
}

function CameraRig() {
  const { camera } = useThree();
  useFrame(() => {
    camera.position.x += (motion.mx * 0.5 - camera.position.x) * 0.05;
    camera.position.y += (-motion.my * 0.3 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export function Scene3D() {
  const reduced = useReducedMotion();
  return (
    <div className="scene" aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, CAMERA_Z], fov: FOV }}
        frameloop={reduced ? 'demand' : 'always'}
      >
        <CameraRig />
        <BitField />
        {PLACEMENTS.map((p) => (
          <Anchored key={p.asset} p={p} />
        ))}
      </Canvas>
    </div>
  );
}
