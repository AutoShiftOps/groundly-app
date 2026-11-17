import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Grid,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { STAGE_DEFINITIONS, stageStatusForIndex } from "../../lib/reportStats";
import {
  computeBoxFromProjectedCorners,
  DEFAULT_TRAIN_ADJUSTMENTS,
  evaluateVisualConstraints,
  type TrainAdjustments,
  type TrainGeometrySnapshot,
} from "../../lib/trainGeometryDebug";
import TrainDebugOverlay from "./TrainDebugOverlay";
import {
  createCarAuraTexture,
  createGlowSpriteTexture,
  createNebulaBackdropTexture,
  createPulseRingTexture,
  createRimStarFlareTexture,
  createSmokeVariantTextures,
  createSparkStreakTexture,
} from "./canvasTextures";
import {
  buildEnvironmentTerrain,
  buildTrackCurve,
  buildTrainCar,
  buildTrainTrack,
  createSharedCarAssets,
  positionTrainOnCurve,
  setSceneWireframeMode,
  STAGE_COLORS,
  updateCarStatusVisuals,
  updateTrackRailColors,
  type SmokeParticle,
  type StageCarRefs,
} from "./trainBuilder";

export type CameraPreset = "overview" | "active" | "lowTrack";

interface TrainScene3DProps {
  activeStageIndex: number; // -1 = showcase (Car 4 Testing active matching mockup), 0..4 = running stage
  progress?: number; // 0..100 live progress when running
  isRunning?: boolean;
  selectedStageIndex?: number | null;
  onSelectStage?: (index: number) => void;
  heightClass?: string;
  debugMode?: boolean;
  onToggleDebugMode?: () => void;
  wireframeMode?: boolean;
  onToggleWireframeMode?: () => void;
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number]; label: string }
> = {
  overview: {
    pos: [-1.62, 2.04, 10.2],
    target: [-1.62, 0.76, 0.14],
    label: "Overview",
  },
  active: {
    pos: [1.8, 2.15, 7.8],
    target: [1.5, 0.85, 0.18],
    label: "Active Car",
  },
  lowTrack: {
    pos: [-7.4, 1.85, 9.8],
    target: [0.6, 0.78, 0.25],
    label: "Trackside",
  },
};

const _vec3A = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _tanVec = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement("canvas");
    const gl =
      probeCanvas.getContext("webgl2") || probeCanvas.getContext("webgl");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export default function TrainScene3D({
  activeStageIndex,
  progress = 0,
  isRunning = false,
  selectedStageIndex = null,
  onSelectStage,
  heightClass = "h-[360px] md:h-[440px]",
  debugMode: controlledDebugMode,
  onToggleDebugMode,
  wireframeMode: controlledWireframeMode,
  onToggleWireframeMode: _onToggleWireframeMode,
}: TrainScene3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("overview");
  const [paused, setPaused] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(isRunning);
  const [contextLost, setContextLost] = useState(false);
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);
  const [internalDebugMode, setInternalDebugMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.has("debug") || params.has("debugGeometry");
  });
  const [internalWireframeMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.has("wireframe");
  });
  const debugMode = controlledDebugMode ?? internalDebugMode;
  const wireframeMode = controlledWireframeMode ?? internalWireframeMode;
  const toggleDebugMode = () => {
    if (onToggleDebugMode) {
      onToggleDebugMode();
    } else {
      setInternalDebugMode((d) => !d);
    }
  };
  const [adjustments, setAdjustments] = useState<TrainAdjustments>(
    DEFAULT_TRAIN_ADJUSTMENTS,
  );
  const [debugSnapshot, setDebugSnapshot] =
    useState<TrainGeometrySnapshot | null>(null);

  const stateRef = useRef({
    activeStageIndex,
    progress,
    isRunning,
    selectedStageIndex,
    cameraPreset: "overview" as CameraPreset,
    paused,
    userTransitioning: false,
    onSelectStage,
    debugMode,
    wireframeMode,
    adjustments,
    heightClass,
  });

  const syncRenderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setCameraPreset("overview");
    setDockCollapsed(isRunning);
    stateRef.current.cameraPreset = "overview";
    stateRef.current.userTransitioning = true;
  }, [isRunning]);

  stateRef.current.activeStageIndex = activeStageIndex;
  stateRef.current.progress = progress;
  stateRef.current.isRunning = isRunning;
  stateRef.current.selectedStageIndex = selectedStageIndex;
  stateRef.current.paused = paused;
  stateRef.current.onSelectStage = onSelectStage;
  stateRef.current.debugMode = debugMode;
  stateRef.current.wireframeMode = wireframeMode;
  stateRef.current.adjustments = adjustments;
  stateRef.current.heightClass = heightClass;

  useEffect(() => {
    if (stateRef.current.cameraPreset === "overview") {
      stateRef.current.userTransitioning = true;
    }
    syncRenderRef.current?.();
  }, [activeStageIndex, selectedStageIndex, debugMode, wireframeMode, adjustments]);

  const setPresetWithTransition = (preset: CameraPreset) => {
    setCameraPreset(preset);
    stateRef.current.cameraPreset = preset;
    stateRef.current.userTransitioning = true;
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 260);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: "high-performance",
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.26;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    renderer.setSize(width, height);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener(
      "webglcontextrestored",
      onContextRestored,
    );

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020614);
    scene.fog = new THREE.FogExp2(0x020614, 0.015);

    let envRT: THREE.WebGLRenderTarget | null = null;
    if (!isSoftwareGl) {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.03);
      scene.environment = envRT.texture;
      pmremGenerator.dispose();
    }

    const aspect = width / height;
    const overviewHalfW = aspect > 2.3 ? 10.6 : 10.1;
    const overviewZ =
      Math.max(8.4, overviewHalfW / (0.315 * Math.max(1.25, aspect))) /
      Math.max(0.5, stateRef.current.adjustments.cameraZoomFactor);
    const initialPreset = CAMERA_PRESETS.overview;
    const initCamX =
      initialPreset.pos[0] + stateRef.current.adjustments.cameraXOffset;
    const camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 140);
    camera.position.set(
      initCamX,
      initialPreset.pos[1] * (0.94 + 0.06 * (overviewZ / 10.4)),
      overviewZ,
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(
      initialPreset.target[0] + stateRef.current.adjustments.cameraXOffset,
      initialPreset.target[1],
      initialPreset.target[2],
    );
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 5.5;
    controls.maxDistance = 28;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI * 0.49;

    const onControlsStart = () => {
      stateRef.current.userTransitioning = false;
    };
    controls.addEventListener("start", onControlsStart);

    const hemiLight = new THREE.HemisphereLight(0x3a64a8, 0x020614, 0.5);
    scene.add(hemiLight);

    const crownKey = new THREE.DirectionalLight(0xf6f9ff, 1.2);
    crownKey.position.set(-4, 14, 10);
    scene.add(crownKey);

    const indigoRim = new THREE.DirectionalLight(0x6366f1, 0.92);
    indigoRim.position.set(12, 8, -10);
    scene.add(indigoRim);

    const activeAuraLight = new THREE.PointLight(0xffbf3b, 4.4, 8.0, 1.7);
    activeAuraLight.position.set(1.5, 1.8, 1.4);
    scene.add(activeAuraLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const pulseRingTex = createPulseRingTexture();
    const glowSpriteTex = createGlowSpriteTexture();
    const carAuraTex = createCarAuraTexture();
    const sparkStreakTex = createSparkStreakTexture();
    const smokeTextures = createSmokeVariantTextures();
    const nebulaTex = createNebulaBackdropTexture();
    const starFlareTex = createRimStarFlareTexture();

    // Upper-right twilight cosmic violet nebula wash
    const nebulaMat = new THREE.SpriteMaterial({
      map: nebulaTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const nebulaSprite = new THREE.Sprite(nebulaMat);
    nebulaSprite.position.set(10.0, 5.4, -10.5);
    nebulaSprite.scale.set(22, 14, 1);
    scene.add(nebulaSprite);

    // Sweeping Sapphire Glass Highway Viaduct + Deep Space Grid
    const curve = buildTrackCurve();
    const curveLen = curve.getLength();
    const trackRefs = buildTrainTrack(curve, maxAniso, starFlareTex);
    scene.add(trackRefs.group);

    const envRefs = buildEnvironmentTerrain(maxAniso);
    scene.add(envRefs.group);

    // Connected 5-Car Hero Crystal Express (sharing middle-coach geometries)
    const sharedCarAssets = createSharedCarAssets();
    const cars: StageCarRefs[] = STAGE_DEFINITIONS.map((st, i) => {
      const car = buildTrainCar(
        i,
        st.label,
        maxAniso,
        pulseRingTex,
        glowSpriteTex,
        carAuraTex,
        sharedCarAssets,
      );
      scene.add(car.group);
      return car;
    });

    // Bright White-Gold Coupler Flare Core bridging the gap ahead of the active car
    const couplerFlareMat = new THREE.SpriteMaterial({
      map: glowSpriteTex,
      color: 0xffebb0,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const couplerFlare = new THREE.Sprite(couplerFlareMat);
    couplerFlare.scale.set(1.9, 1.0, 1);
    couplerFlare.renderOrder = 9;
    scene.add(couplerFlare);

    // Instanced Spark Needles (1 draw call for all 26 streaks)
    const sparkCount = 26;
    const sparkGeo = new THREE.PlaneGeometry(0.42, 0.085);
    const sparkMat = new THREE.MeshBasicMaterial({
      map: sparkStreakTex,
      color: 0xffd67a,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const sparkInstanced = new THREE.InstancedMesh(sparkGeo, sparkMat, sparkCount);
    sparkInstanced.frustumCulled = false;
    sparkInstanced.renderOrder = 9;
    scene.add(sparkInstanced);

    const sparkSeeds = Array.from({ length: sparkCount }, (_, i) => ({
      age: (i / sparkCount) * 0.42,
      life: 0.32 + (i % 5) * 0.05,
      offsetX: (((i * 29) % 100) / 100) * 0.14,
      offsetY: (((i * 53) % 100) / 100 - 0.5) * 0.22,
      offsetZ: (((i * 71) % 100) / 100 - 0.5) * 0.12,
      velX: 1.55 + (i % 4) * 0.38,
      velY: (((i * 41) % 100) / 100 - 0.5) * 0.36,
      baseLength: 0.58 + (i % 4) * 0.22,
    }));

    // Single Points Buffer for 22 Ember Dots (1 draw call)
    const emberCount = 22;
    const emberPositions = new Float32Array(emberCount * 3);
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPositions, 3));
    const emberPointsMat = new THREE.PointsMaterial({
      map: glowSpriteTex,
      color: 0xffe49e,
      size: 0.16,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const emberPoints = new THREE.Points(emberGeo, emberPointsMat);
    emberPoints.frustumCulled = false;
    emberPoints.renderOrder = 9;
    scene.add(emberPoints);

    const emberSeeds = Array.from({ length: emberCount }, (_, i) => ({
      age: (i / emberCount) * 0.44,
      life: 0.36 + (i % 4) * 0.06,
      offsetY: (((i * 47) % 100) / 100 - 0.5) * 0.26,
      velX: 1.35 + (i % 3) * 0.38,
      velY: (((i * 67) % 100) / 100 - 0.5) * 0.44,
    }));

    // 28 Airy Translucent Vapor Plume Sprites (12 active amber + 16 done emerald)
    const smokePool: SmokeParticle[] = [];
    const totalSmoke = 28;
    for (let i = 0; i < totalSmoke; i++) {
      const carIndex = i < 12 ? 3 : i % 5;
      const tex = smokeTextures[i % smokeTextures.length];
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color: 0xffd27d,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 8;
      scene.add(sprite);

      const life = 1.9 + ((i * 19) % 7) * 0.11;
      smokePool.push({
        sprite,
        active: false,
        age: (i / totalSmoke) * life,
        life,
        worldPos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        startScale: 0.28,
        endScale: 1.72,
        maxOpacity: 0.56,
        spinRate: (i % 2 === 0 ? 1 : -1) * (0.36 + (i % 5) * 0.08),
        curlPhase: (i * 1.37) % (Math.PI * 2),
        curlAmp: 0.08 + (i % 4) * 0.03,
        carIndex,
      });
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    const proxies = cars.map((c) => c.hitProxy);
    let lastRaycastMs = 0;

    const updatePointer = (ev: PointerEvent | MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      if (now - lastRaycastMs < 50) return;
      lastRaycastMs = now;
      updatePointer(ev);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(proxies, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.carIndex as number;
        renderer.domElement.style.cursor = "pointer";
        setHoveredStage(idx);
      } else {
        renderer.domElement.style.cursor = "grab";
        setHoveredStage(null);
      }
    };

    const onPointerClick = (ev: MouseEvent) => {
      updatePointer(ev);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(proxies, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.carIndex as number;
        stateRef.current.onSelectStage?.(idx);
      }
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onPointerClick);

    const onResize = () => {
      if (!container || disposed) return;
      const w = Math.max(container.clientWidth, 320);
      const h = Math.max(container.clientHeight, 260);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;
    let lastAppliedStage = -999;
    let lastSelected: number | null = -999;
    let lastSmokeStage = -999;
    let lastDebugPublishMs = 0;
    const _projTmp = new THREE.Vector3();
    const _railUp = new THREE.Vector3(0, 1, 0);
    const _railTan = new THREE.Vector3();
    const _railBin = new THREE.Vector3();

    function projectWorld(pt: THREE.Vector3, w: number, h: number) {
      _projTmp.copy(pt).project(camera);
      return {
        x: (_projTmp.x * 0.5 + 0.5) * w,
        y: (-_projTmp.y * 0.5 + 0.5) * h,
      };
    }

    function publishDebugSnapshot(force = false) {
      if (!stateRef.current.debugMode || disposed) return;
      const nowMs = performance.now();
      if (!force && nowMs - lastDebugPublishMs < 110) return;
      lastDebugPublishMs = nowMs;

      const w = container?.clientWidth || width;
      const h = container?.clientHeight || height;
      camera.updateMatrixWorld();

      const bridgePoints = [];
      for (let i = 0; i <= 24; i++) {
        const t = 0.04 + (i / 24) * 0.92;
        const p = curve.getPointAt(t);
        curve.getTangentAt(t, _railTan).normalize();
        _railBin.crossVectors(_railTan, _railUp).normalize();
        const railCenterPt = projectWorld(p, w, h);
        const frontRimWorld = p
          .clone()
          .addScaledVector(_railBin, 0.94)
          .add(new THREE.Vector3(0, -0.082, 0));
        const frontRimPt = projectWorld(frontRimWorld, w, h);
        bridgePoints.push({
          t: Number(t.toFixed(2)),
          x: railCenterPt.x,
          y: railCenterPt.y,
          deckFrontY: frontRimPt.y,
        });
      }

      const compartments = cars.map((car) => {
        car.group.updateMatrixWorld();
        const minX = car.isLead ? -car.leftSpan : -1.39;
        const maxX = car.isTail ? car.rightSpan : 1.39;
        const corners: THREE.Vector3[] = [];
        for (const lx of [minX, maxX]) {
          for (const ly of [0, 1.58]) {
            corners.push(
              new THREE.Vector3(lx, ly, 0.08).applyMatrix4(car.group.matrixWorld),
            );
          }
        }
        const projected = corners.map((c) => projectWorld(c, w, h));
        const box = computeBoxFromProjectedCorners(projected);

        const wheelWorld = new THREE.Vector3(0, 0, 0).applyMatrix4(
          car.group.matrixWorld,
        );
        const wheelScreen = projectWorld(wheelWorld, w, h);

        const railWorld = curve.getPointAt(car.currentT);
        const railScreen = projectWorld(railWorld, w, h);

        curve.getTangentAt(car.currentT, _railTan).normalize();
        const pitchDeg = Number(
          ((Math.atan2(_railTan.y, _railTan.x) * 180) / Math.PI).toFixed(1),
        );

        return {
          index: car.index,
          label: car.label,
          status: car.status,
          box,
          xPct: Number(((box.x / w) * 100).toFixed(1)),
          yPct: Number(((box.y / h) * 100).toFixed(1)),
          widthPct: Number(((box.width / w) * 100).toFixed(1)),
          heightPct: Number(((box.height / h) * 100).toFixed(1)),
          centerX: wheelScreen.x,
          wheelBottomY: wheelScreen.y,
          railY: railScreen.y,
          clearancePx: Number((railScreen.y - wheelScreen.y).toFixed(1)),
          pitchDeg,
          currentT: car.currentT,
        };
      });

      setDebugSnapshot(
        evaluateVisualConstraints({
          containerWidth: w,
          containerHeight: h,
          heightClass: stateRef.current.heightClass,
          isRunning: stateRef.current.isRunning,
          activeStageIndex: resolveActiveIndex(),
          compartments,
          bridgePoints,
        }),
      );
    }

    const initialCenterT = stateRef.current.isRunning
      ? 0.435 + (Math.max(0, Math.min(100, stateRef.current.progress)) / 100) * 0.024
      : 0.445;
    let currentCenterT = initialCenterT;
    let lastRailCenterT = -1;

    function resolveActiveIndex(): number {
      const idx = stateRef.current.activeStageIndex;
      if (idx >= 0) return Math.max(0, Math.min(4, idx));
      if (stateRef.current.selectedStageIndex !== null) {
        return Math.max(0, Math.min(4, stateRef.current.selectedStageIndex));
      }
      return 3;
    }

    function assignSmokeRole(slotIndex: number): number {
      const activeIdx = resolveActiveIndex();
      if (slotIndex < 12) {
        return activeIdx;
      }
      const doneCount = Math.max(1, activeIdx);
      return (slotIndex - 12) % doneCount;
    }

    function spawnSmokePuff(sp: SmokeParticle, slotIndex: number, initialAge = 0) {
      sp.carIndex = assignSmokeRole(slotIndex);
      const car = cars[sp.carIndex];
      if (!car) return;

      const isActiveCar = car.status === "active";
      curve.getTangentAt(car.currentT, _tanVec).normalize();
      _vec3A
        .copy(car.smokeAnchorLocal)
        .applyQuaternion(car.group.quaternion)
        .add(car.group.position);

      const jitterX = (((slotIndex * 37 + Math.round(elapsed * 19)) % 13) - 6) * 0.008;
      const jitterZ = (((slotIndex * 19 + Math.round(elapsed * 23)) % 9) - 4) * 0.006;

      const riseSpeed = isActiveCar ? 0.86 : 0.64;
      const driftX = (isActiveCar ? 0.54 : 0.5) * _tanVec.x + jitterX;
      const driftZ = (isActiveCar ? 0.08 : 0.06) * _tanVec.z + jitterZ;

      sp.life = isActiveCar
        ? 1.75 + ((slotIndex * 13) % 6) * 0.1
        : 1.55 + ((slotIndex * 11) % 5) * 0.09;
      sp.startScale = isActiveCar ? 0.25 : 0.2;
      sp.endScale = isActiveCar ? 1.52 : 1.08;
      sp.maxOpacity = isActiveCar ? 0.72 : car.status === "done" ? 0.5 : 0;

      const curlX =
        Math.sin(initialAge * 2.2 + sp.curlPhase) * sp.curlAmp * initialAge;

      sp.worldPos.set(
        _vec3A.x + driftX * initialAge + curlX,
        _vec3A.y + riseSpeed * initialAge,
        _vec3A.z + driftZ * initialAge,
      );
      sp.vel.set(driftX, riseSpeed, driftZ);
      sp.age = initialAge;
      sp.active = true;

      const mat = sp.sprite.material as THREE.SpriteMaterial;
      mat.color.setHex(isActiveCar ? 0xffcb70 : 0x3ef7b8);
    }

    function applySmokeSpritesToScene(rotationStep = 0) {
      for (let idx = 0; idx < smokePool.length; idx++) {
        const sp = smokePool[idx];
        const car = cars[sp.carIndex];
        const shouldEmit = car && car.status !== "pending";
        const p = Math.min(1, sp.age / Math.max(0.1, sp.life));
        sp.sprite.position.copy(sp.worldPos);
        const s = THREE.MathUtils.lerp(
          sp.startScale,
          sp.endScale,
          Math.pow(p, 0.72),
        );
        sp.sprite.scale.set(s * 1.25, s * 0.92, 1);
        const mat = sp.sprite.material as THREE.SpriteMaterial;
        if (rotationStep !== 0) {
          mat.rotation += sp.spinRate * rotationStep;
        } else {
          mat.rotation = sp.curlPhase + sp.age * sp.spinRate;
        }
        if (shouldEmit) {
          sp.sprite.visible = true;
          const fade =
            p < 0.12 ? p / 0.12 : Math.pow(1 - (p - 0.12) / 0.88, 1.35);
          mat.opacity = Math.max(0, fade * sp.maxOpacity);
        } else {
          sp.sprite.visible = false;
        }
      }
    }

    function syncSmokeOnStageSwitch(activeIdx: number): boolean {
      if (activeIdx === lastSmokeStage) return false;
      lastSmokeStage = activeIdx;
      smokePool.forEach((sp, idx) => {
        const prewarmAge = ((idx % 12) / 12) * 1.45;
        spawnSmokePuff(sp, idx, prewarmAge);
      });
      applySmokeSpritesToScene(0);
      return true;
    }

    let lastAppliedWireframe = false;

    function syncStatuses() {
      const activeIdx = resolveActiveIndex();
      const selIdx = stateRef.current.selectedStageIndex;
      const isComplete =
        stateRef.current.isRunning && stateRef.current.progress >= 99;
      const wf = stateRef.current.wireframeMode;
      const statusDirty =
        activeIdx !== lastAppliedStage ||
        selIdx !== lastSelected ||
        isComplete;
      if (!statusDirty && wf === lastAppliedWireframe) {
        return;
      }
      if (statusDirty) {
        lastAppliedStage = activeIdx;
        lastSelected = selIdx;
        cars.forEach((car, i) => {
          const status = isComplete
            ? "done"
            : stageStatusForIndex(i, activeIdx);
          updateCarStatusVisuals(car, status, selIdx === i);
        });
      }
      lastAppliedWireframe = wf;
      setSceneWireframeMode(cars, trackRefs, wf);
    }

    const initActiveIdx = resolveActiveIndex();
    lastSmokeStage = initActiveIdx;
    syncStatuses();
    positionTrainOnCurve(
      cars,
      curve,
      currentCenterT,
      initActiveIdx,
      0,
      curveLen,
      stateRef.current.adjustments.carGapScale,
      stateRef.current.adjustments.trackYOffset,
    );
    const activeCarInit = cars[initActiveIdx] ?? cars[3];
    updateTrackRailColors(trackRefs, activeCarInit.currentT);

    smokePool.forEach((sp, idx) => {
      const prewarmAge = ((idx % 10) / 10) * 1.65;
      spawnSmokePuff(sp, idx, prewarmAge);
      const car = cars[sp.carIndex];
      const shouldShow = car && car.status !== "pending";
      const p = Math.min(1, sp.age / Math.max(0.1, sp.life));
      const s = THREE.MathUtils.lerp(
        sp.startScale,
        sp.endScale,
        Math.pow(p, 0.72),
      );
      sp.sprite.position.copy(sp.worldPos);
      sp.sprite.scale.set(s * 1.15, s * 0.88, 1);
      sp.sprite.visible = Boolean(shouldShow);
      const mat = sp.sprite.material as THREE.SpriteMaterial;
      mat.rotation = sp.curlPhase + prewarmAge * sp.spinRate;
      const fade = p < 0.12 ? p / 0.12 : Math.pow(1 - (p - 0.12) / 0.88, 1.4);
      mat.opacity = shouldShow ? Math.max(0, fade * sp.maxOpacity) : 0;
    });

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync
        ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        : null;
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync && gl.deleteSync) gl.deleteSync(sync);
          return;
        }
        if (sync && gl.getSyncParameter) {
          const st = gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (st === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
            return;
          }
          gl.deleteSync(sync);
        }
        frameId = window.setTimeout(cb, 16);
      };
      frameId = window.setTimeout(poll, 4);
    }

    const _sparkDummy = new THREE.Object3D();

    function syncActiveSparksAndGlow(
      dtStep: number,
      activeCarObj: StageCarRefs | undefined,
      activeStageIdx: number,
    ) {
      if (activeCarObj) {
        activeAuraLight.position.set(
          activeCarObj.group.position.x,
          activeCarObj.group.position.y + 0.9,
          activeCarObj.group.position.z + 1.1,
        );
        activeAuraLight.color.setHex(STAGE_COLORS[activeCarObj.status].primary);
        activeAuraLight.intensity = 4.4 + Math.sin(elapsed * 3.0) * 0.6;
      }

      const showSparks = activeCarObj && activeStageIdx < 4;
      if (showSparks && activeCarObj) {
        _vec3A
          .copy(activeCarObj.sparkAnchorLocal)
          .applyQuaternion(activeCarObj.group.quaternion)
          .add(activeCarObj.group.position);
        couplerFlare.visible = true;
        couplerFlare.position.copy(_vec3A);
        couplerFlareMat.opacity = 0.88 + Math.sin(elapsed * 8.0) * 0.12;
      } else {
        couplerFlare.visible = false;
      }

      sparkInstanced.visible = Boolean(showSparks && activeCarObj);
      emberPoints.visible = Boolean(showSparks && activeCarObj);
      if (showSparks && activeCarObj) {
        for (let i = 0; i < sparkSeeds.length; i++) {
          const sp = sparkSeeds[i];
          if (!stateRef.current.paused && dtStep > 0) {
            sp.age = (sp.age + dtStep) % sp.life;
          }
          const p = sp.age / sp.life;
          const fadeScale = Math.sin(p * Math.PI);
          _vec3A
            .set(
              activeCarObj.sparkAnchorLocal.x + sp.offsetX + sp.velX * sp.age,
              activeCarObj.sparkAnchorLocal.y + sp.offsetY + sp.velY * sp.age,
              activeCarObj.sparkAnchorLocal.z + sp.offsetZ,
            )
            .applyQuaternion(activeCarObj.group.quaternion)
            .add(activeCarObj.group.position);
          _sparkDummy.position.copy(_vec3A);
          _sparkDummy.quaternion.copy(activeCarObj.group.quaternion);
          _sparkDummy.scale.set(
            sp.baseLength * (0.7 + fadeScale * 0.6),
            0.6 + fadeScale * 0.5,
            1,
          );
          _sparkDummy.updateMatrix();
          sparkInstanced.setMatrixAt(i, _sparkDummy.matrix);
        }
        sparkInstanced.instanceMatrix.needsUpdate = true;

        const posAttr = emberGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < emberSeeds.length; i++) {
          const em = emberSeeds[i];
          if (!stateRef.current.paused && dtStep > 0) {
            em.age = (em.age + dtStep) % em.life;
          }
          _vec3A
            .set(
              activeCarObj.sparkAnchorLocal.x + em.velX * em.age,
              activeCarObj.sparkAnchorLocal.y + em.offsetY + em.velY * em.age,
              activeCarObj.sparkAnchorLocal.z + 0.04,
            )
            .applyQuaternion(activeCarObj.group.quaternion)
            .add(activeCarObj.group.position);
          posAttr.setXYZ(i, _vec3A.x, _vec3A.y, _vec3A.z);
        }
        posAttr.needsUpdate = true;
      }
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      // Allow up to 0.25s per frame so slower CPU-WebGL frames stay synced with live progress
      const dt = Math.min(0.25, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      syncStatuses();

      if (!stateRef.current.paused) {
        elapsed += dt;
      }

      const prevCenterT = currentCenterT;
      let targetCenterT = 0.445;
      if (stateRef.current.isRunning) {
        const clampedPct = Math.max(0, Math.min(100, stateRef.current.progress));
        targetCenterT = 0.435 + (clampedPct / 100) * 0.024;
        currentCenterT = THREE.MathUtils.damp(currentCenterT, targetCenterT, 3.6, dt);
      } else if (stateRef.current.selectedStageIndex !== null) {
        const idx = Math.max(0, Math.min(4, stateRef.current.selectedStageIndex));
        targetCenterT = 0.445 + (2 - idx) * 0.008;
        currentCenterT = THREE.MathUtils.damp(currentCenterT, targetCenterT, 3.0, dt);
      } else {
        targetCenterT = 0.445 + Math.sin(elapsed * 0.22) * 0.006;
        currentCenterT = THREE.MathUtils.damp(currentCenterT, targetCenterT, 2.8, dt);
      }

      const activeIdx = resolveActiveIndex();
      positionTrainOnCurve(
        cars,
        curve,
        currentCenterT,
        activeIdx,
        stateRef.current.paused ? 0 : elapsed,
        curveLen,
        stateRef.current.adjustments.carGapScale,
        stateRef.current.adjustments.trackYOffset,
      );

      const stageSwitched = syncSmokeOnStageSwitch(activeIdx);

      const activeCar = cars[activeIdx] ?? cars[3];
      if (
        activeCar &&
        (stageSwitched || Math.abs(activeCar.currentT - lastRailCenterT) > 0.002)
      ) {
        lastRailCenterT = activeCar.currentT;
        updateTrackRailColors(trackRefs, activeCar.currentT);
      }

      const deltaT = Math.abs(currentCenterT - prevCenterT);
      const wheelRotDelta =
        (deltaT * 38) / 0.18 + (stateRef.current.paused ? 0 : dt * 0.35);

      const showBackFaces = camera.position.z < 0;
      for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        car.faceBack.visible = showBackFaces;
        for (const w of car.wheels) {
          w.rotation.z -= wheelRotDelta;
        }
        if (car.status === "active") {
          const pulseScale = 1 + Math.sin(elapsed * 2.4) * 0.045;
          car.pulseRingMesh.scale.setScalar(pulseScale);
          car.pulseRingMat.opacity = 0.88 + Math.sin(elapsed * 3.0) * 0.1;
        }
      }

      if (!stateRef.current.paused) {
        for (let idx = 0; idx < smokePool.length; idx++) {
          const sp = smokePool[idx];
          sp.age += dt;
          if (!sp.active || sp.age >= sp.life) {
            spawnSmokePuff(sp, idx, 0);
          }

          const p = sp.age / sp.life;
          const curlVelX = Math.cos(sp.age * 2.4 + sp.curlPhase) * sp.curlAmp;
          sp.worldPos.x += (sp.vel.x + curlVelX) * dt;
          sp.worldPos.y += sp.vel.y * (1 - p * 0.25) * dt;
          sp.worldPos.z += sp.vel.z * dt;
        }
        applySmokeSpritesToScene(dt);
      }

      syncActiveSparksAndGlow(dt, activeCar, activeIdx);

      if (stateRef.current.cameraPreset === "active" && activeCar) {
        _targetPos.set(activeCar.group.position.x + 0.4, 2.2, 7.4);
        _targetLook.set(
          activeCar.group.position.x + 0.3,
          1.05,
          activeCar.group.position.z,
        );
        const dampAlpha = 1 - Math.exp(-3.4 * dt);
        camera.position.lerp(_targetPos, dampAlpha);
        controls.target.lerp(_targetLook, dampAlpha);
      } else if (stateRef.current.userTransitioning) {
        const preset = CAMERA_PRESETS[stateRef.current.cameraPreset];
        const curAspect = camera.aspect || 1.77;
        const adj = stateRef.current.adjustments;
        if (stateRef.current.cameraPreset === "overview") {
          const halfW = curAspect > 2.3 ? 10.6 : 10.1;
          const ovZ =
            Math.max(8.4, halfW / (0.315 * Math.max(1.25, curAspect))) /
            Math.max(0.5, adj.cameraZoomFactor);
          _targetPos.set(
            preset.pos[0] + adj.cameraXOffset,
            preset.pos[1] * (0.94 + 0.06 * (ovZ / 10.0)),
            ovZ,
          );
          _targetLook.set(
            preset.target[0] + adj.cameraXOffset,
            preset.target[1],
            preset.target[2],
          );
        } else {
          _targetPos.set(preset.pos[0], preset.pos[1], preset.pos[2]);
          _targetLook.set(...preset.target);
        }
        const dampAlpha = 1 - Math.exp(-4.6 * dt);
        camera.position.lerp(_targetPos, dampAlpha);
        controls.target.lerp(_targetLook, dampAlpha);
        if (camera.position.distanceTo(_targetPos) < 0.05) {
          stateRef.current.userTransitioning = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      if (stateRef.current.debugMode) {
        publishDebugSnapshot(false);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    // Position couplerFlare, sparks, embers, and activeAuraLight before Frame 0!
    {
      const activeInit = cars[initActiveIdx] ?? cars[3];
      activeAuraLight.position.set(
        activeInit.group.position.x,
        activeInit.group.position.y + 0.9,
        activeInit.group.position.z + 1.1,
      );
      activeAuraLight.color.setHex(STAGE_COLORS[activeInit.status].primary);
      const showInitSparks = initActiveIdx < 4;
      sparkInstanced.visible = showInitSparks;
      emberPoints.visible = showInitSparks;
      if (showInitSparks) {
        _vec3A
          .copy(activeInit.sparkAnchorLocal)
          .applyQuaternion(activeInit.group.quaternion)
          .add(activeInit.group.position);
        couplerFlare.visible = true;
        couplerFlare.position.copy(_vec3A);
        for (let i = 0; i < sparkSeeds.length; i++) {
          const sp = sparkSeeds[i];
          const p = sp.age / sp.life;
          const fadeScale = Math.sin(p * Math.PI);
          _vec3A
            .set(
              activeInit.sparkAnchorLocal.x + sp.offsetX + sp.velX * sp.age,
              activeInit.sparkAnchorLocal.y + sp.offsetY + sp.velY * sp.age,
              activeInit.sparkAnchorLocal.z + sp.offsetZ,
            )
            .applyQuaternion(activeInit.group.quaternion)
            .add(activeInit.group.position);
          _sparkDummy.position.copy(_vec3A);
          _sparkDummy.quaternion.copy(activeInit.group.quaternion);
          _sparkDummy.scale.set(
            sp.baseLength * (0.7 + fadeScale * 0.6),
            0.6 + fadeScale * 0.5,
            1,
          );
          _sparkDummy.updateMatrix();
          sparkInstanced.setMatrixAt(i, _sparkDummy.matrix);
        }
        sparkInstanced.instanceMatrix.needsUpdate = true;

        const posAttr = emberGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < emberSeeds.length; i++) {
          const em = emberSeeds[i];
          _vec3A
            .set(
              activeInit.sparkAnchorLocal.x + em.velX * em.age,
              activeInit.sparkAnchorLocal.y + em.offsetY + em.velY * em.age,
              activeInit.sparkAnchorLocal.z + 0.04,
            )
            .applyQuaternion(activeInit.group.quaternion)
            .add(activeInit.group.position);
          posAttr.setXYZ(i, _vec3A.x, _vec3A.y, _vec3A.z);
        }
        posAttr.needsUpdate = true;
      } else {
        couplerFlare.visible = false;
      }
    }

    if (isSoftwareGl) {
      syncRenderRef.current = () => {
        if (disposed) return;
        syncStatuses();
        const aIdx = resolveActiveIndex();
        const adj = stateRef.current.adjustments;
        positionTrainOnCurve(
          cars,
          curve,
          currentCenterT,
          aIdx,
          elapsed,
          curveLen,
          adj.carGapScale,
          adj.trackYOffset,
        );
        if (stateRef.current.cameraPreset === "overview") {
          const preset = CAMERA_PRESETS.overview;
          const curAspect = camera.aspect || 1.77;
          const halfW = curAspect > 2.3 ? 10.6 : 10.1;
          const ovZ =
            Math.max(8.4, halfW / (0.315 * Math.max(1.25, curAspect))) /
            Math.max(0.5, adj.cameraZoomFactor);
          camera.position.set(
            preset.pos[0] + adj.cameraXOffset,
            preset.pos[1] * (0.94 + 0.06 * (ovZ / 10.0)),
            ovZ,
          );
          controls.target.set(
            preset.target[0] + adj.cameraXOffset,
            preset.target[1],
            preset.target[2],
          );
          controls.update();
        }
        const aCar = cars[aIdx] ?? cars[3];
        if (aCar) {
          updateTrackRailColors(trackRefs, aCar.currentT);
        }
        syncSmokeOnStageSwitch(aIdx);
        syncActiveSparksAndGlow(0, aCar, aIdx);
        renderer.render(scene, camera);
        if (stateRef.current.debugMode) {
          publishDebugSnapshot(true);
        }
      };
      renderer.render(scene, camera);
      if (stateRef.current.debugMode) {
        publishDebugSnapshot(true);
      }
      afterDraw(tick);
    } else {
      syncRenderRef.current = () => {
        if (disposed) return;
        syncStatuses();
        if (stateRef.current.debugMode) {
          publishDebugSnapshot(true);
        }
      };
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener("start", onControlsStart);
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onPointerClick);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener(
        "webglcontextrestored",
        onContextRestored,
      );

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          mats.forEach((m) => m.dispose());
        } else if (obj instanceof THREE.Sprite) {
          obj.material.dispose();
        }
      });
      syncRenderRef.current = null;
      cars.forEach((c) => c.faceTex.dispose());
      trackRefs.deckTex.dispose();
      trackRefs.pillarTex.dispose();
      trackRefs.starFlareTex.dispose();
      envRefs.gridTex.dispose();
      envRT?.dispose();
      pulseRingTex.dispose();
      glowSpriteTex.dispose();
      carAuraTex.dispose();
      sparkStreakTex.dispose();
      smokeTextures.forEach((t) => t.dispose());
      nebulaTex.dispose();
      renderer.dispose();
    };
  }, []);

  const resolvedStageIdx =
    hoveredStage ??
    selectedStageIndex ??
    (activeStageIndex >= 0 ? activeStageIndex : 3);
  const displayStage = STAGE_DEFINITIONS[resolvedStageIdx];
  const showcaseActiveIdx = activeStageIndex < 0 ? 3 : activeStageIndex;
  const displayStatus = stageStatusForIndex(resolvedStageIdx, showcaseActiveIdx);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl ${
        isRunning
          ? "border border-transparent bg-[#020614]"
          : "border border-[#4a8fff]/25 bg-[#020614]"
      } ${heightClass}`}
      data-testid="train-scene-3d"
      data-active-stage={activeStageIndex}
      data-progress={Math.round(progress)}
      data-wireframe={wireframeMode ? "true" : "false"}
    >
      <div ref={mountRef} className="h-full w-full" />

      {contextLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020614] p-6 text-center">
          <p className="font-display text-sm font-semibold text-slate-200">
            3D WebGL viewport paused
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Pipeline stage: {displayStage?.label}
          </p>
        </div>
      )}

      {wireframeMode && !debugMode && (
        <div
          className="pointer-events-none absolute inset-x-[8%] top-[18%] bottom-[28%] rounded-xl border border-dashed border-cyan-400/45"
          data-testid="train-wireframe-guide"
        >
          <span className="absolute -top-5 left-2 rounded bg-[#030a1b]/90 px-2 py-0.5 font-mono text-[10px] tracking-wide text-cyan-300">
            WIREFRAME ALIGNMENT · MOCK SPAN (8% – 92%)
          </span>
        </div>
      )}

      {debugMode && (
        <TrainDebugOverlay
          snapshot={debugSnapshot}
          adjustments={adjustments}
          onChangeAdjustments={setAdjustments}
          onClose={toggleDebugMode}
        />
      )}

      {(!isRunning || hoveredStage !== null) && !debugMode && (
        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2.5 rounded-xl border border-slate-700/50 bg-[#040a18]/90 px-3 py-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: STAGE_COLORS[displayStatus].hex }}
          />
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-100">
              0{resolvedStageIdx + 1} · {displayStage?.label}
            </p>
            <p className="truncate text-[11px] text-slate-400">
              {displayStage?.subtitle}
            </p>
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-1/2 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          aria-expanded={!dockCollapsed}
          aria-label={dockCollapsed ? "Show 3D controls" : "Hide 3D controls"}
          className="mb-1 inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-700/60 bg-[#040a18]/90 px-2.5 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:text-white whitespace-nowrap"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Show 3D Controls
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Hide Controls
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-700/60 bg-[#040a18]/90 px-2.5 py-1.5 shadow-lg">
            <div className="flex flex-nowrap items-center gap-1 border-r border-slate-700/60 pr-1.5">
              <Camera className="mr-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPresetWithTransition(preset)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    cameraPreset === preset
                      ? "bg-[#4a8fff] text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {CAMERA_PRESETS[preset].label}
                </button>
              ))}
            </div>

            <div className="flex flex-nowrap items-center gap-1">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={
                  paused
                    ? "Resume 3D train traversal"
                    : "Pause 3D train traversal"
                }
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white whitespace-nowrap shrink-0"
              >
                {paused ? (
                  <Play className="h-3 w-3" />
                ) : (
                  <Pause className="h-3 w-3" />
                )}
                {paused ? "Play" : "Pause"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustments(DEFAULT_TRAIN_ADJUSTMENTS);
                  setPresetWithTransition("overview");
                }}
                aria-label="Reset camera view"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={toggleDebugMode}
                aria-pressed={debugMode}
                aria-label="Toggle geometry debug overlay"
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  debugMode
                    ? "bg-cyan-500/25 text-cyan-200 ring-1 ring-cyan-400/60"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Grid className="h-3 w-3" />
                Debug Bounds
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
