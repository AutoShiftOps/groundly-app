import * as THREE from "three";
import type { StageStatus } from "../../types/groundly";
import {
  createFloorGridTexture,
  createLightPillarTexture,
  createViaductDeckTexture,
  drawCarBadgeCanvas,
  STAGE_COLORS,
} from "./canvasTextures";

export { STAGE_COLORS };

export const STATION_TS = [0.18, 0.31, 0.44, 0.57, 0.72] as const;

export interface StageCarRefs {
  index: number;
  label: string;
  isLead: boolean;
  isTail: boolean;
  variant: "nose" | "body" | "tail";
  leftSpan: number;
  rightSpan: number;
  group: THREE.Group;
  glassShaderMat: THREE.ShaderMaterial;
  neonEdgeMat: THREE.MeshBasicMaterial;
  haloEdgeMat: THREE.MeshBasicMaterial;
  carAuraMat: THREE.SpriteMaterial;
  underglowMat: THREE.SpriteMaterial;
  wheelRingMat: THREE.MeshBasicMaterial;
  faceMat: THREE.MeshBasicMaterial;
  faceBack: THREE.Mesh;
  faceCanvas: HTMLCanvasElement;
  faceTex: THREE.CanvasTexture;
  pulseRingMat: THREE.MeshBasicMaterial;
  pulseRingMesh: THREE.Mesh;
  couplerMesh?: THREE.Mesh;
  couplerMat?: THREE.MeshBasicMaterial;
  wheels: THREE.Mesh[];
  fairingGlassMat?: THREE.ShaderMaterial;
  fairingRimMat?: THREE.MeshBasicMaterial;
  fairingGlintMat?: THREE.SpriteMaterial;
  wireframeGroup: THREE.Group;
  wireframeMat: THREE.MeshBasicMaterial;
  smokeAnchorLocal: THREE.Vector3;
  sparkAnchorLocal: THREE.Vector3;
  hitProxy: THREE.Mesh;
  status: StageStatus;
  renderedBadgeKey: string;
  currentT: number;
}

export interface RailSparkParticle {
  mesh: THREE.Mesh;
  age: number;
  life: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  velX: number;
  velY: number;
  baseLength: number;
}

export interface SmokeParticle {
  sprite: THREE.Sprite;
  active: boolean;
  age: number;
  life: number;
  worldPos: THREE.Vector3;
  vel: THREE.Vector3;
  startScale: number;
  endScale: number;
  maxOpacity: number;
  spinRate: number;
  curlPhase: number;
  curlAmp: number;
  carIndex: number;
}

export interface TrackRefs {
  group: THREE.Group;
  railTubes: THREE.Mesh[];
  ribbonMat: THREE.MeshBasicMaterial;
  fasciaMat: THREE.MeshBasicMaterial;
  wireframeGroup: THREE.Group;
  deckTex: THREE.CanvasTexture;
  pillarTex: THREE.CanvasTexture;
  starFlareTex: THREE.CanvasTexture;
}

export interface EnvironmentRefs {
  group: THREE.Group;
  gridTex: THREE.CanvasTexture;
}

/**
 * Volumetric Fresnel GLSL glass body shader:
 * Upper 55% stays deep dark obsidian smoked glass while the lower 42% glows intensely
 * with stage color + crisp top specular roof streak and edge Fresnel highlights.
 */
function createCarGlassShaderMaterial(
  halfH: number,
  initialStatus: StageStatus,
): THREE.ShaderMaterial {
  const pal = STAGE_COLORS[initialStatus];
  return new THREE.ShaderMaterial({
    uniforms: {
      uGlowColor: { value: new THREE.Color(pal.primary) },
      uCoreColor: { value: new THREE.Color(pal.rim) },
      uMinY: { value: -halfH },
      uMaxY: { value: halfH },
      uFresnelAlpha: { value: 0.72 },
      uFillStrength: { value: 0.52 },
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      varying vec3 vLocalPos;

      void main() {
        vLocalPos = position;
        vNormalView = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uGlowColor;
      uniform vec3 uCoreColor;
      uniform float uMinY;
      uniform float uMaxY;
      uniform float uFresnelAlpha;
      uniform float uFillStrength;

      varying vec3 vNormalView;
      varying vec3 vViewPos;
      varying vec3 vLocalPos;

      void main() {
        vec3 n = normalize(vNormalView);
        vec3 v = normalize(vViewPos);
        float ndotv = clamp(abs(dot(n, v)), 0.0, 1.0);
        float fresnel = pow(1.0 - ndotv, 1.9);

        float hNorm = clamp((vLocalPos.y - uMinY) / max(0.001, uMaxY - uMinY), 0.0, 1.0);
        // Keep top/center deep obsidian smoked glass for razor badge legibility; concentrate vibrant glow in lower sill & bevel edges
        float bottomAura = pow(clamp(1.0 - hNorm * 1.32, 0.0, 1.0), 1.75);
        float topStreak = smoothstep(0.88, 0.99, hNorm) * 0.62;

        vec3 glassBase = vec3(0.003, 0.009, 0.032);
        vec3 col = mix(glassBase, uGlowColor, bottomAura * uFillStrength * 0.96 + pow(fresnel, 1.2) * 0.62);
        col += uCoreColor * (fresnel * 0.74 + topStreak * 0.68);

        float alpha = clamp(0.4 + bottomAura * uFillStrength * 0.46 + fresnel * uFresnelAlpha * 0.62, 0.36, 0.96);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
  });
}

/**
 * Sweeping Sapphire Glass Highway Curve:
 * Enters calmly from lower-left under Car 1, rises across a regal crown under Cars 3-4,
 * then sweeps forward (+Z) and down (-Y) into the bottom-right foreground matching the mock.
 */
export function buildTrackCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(-15.0, -0.62, 0.46),
    new THREE.Vector3(-7.8, 0.04, 0.14),
    new THREE.Vector3(-1.1, 0.52, 0.02),
    new THREE.Vector3(4.2, 0.64, 0.06),
    new THREE.Vector3(9.0, 0.4, 0.36),
    new THREE.Vector3(13.8, -0.96, 1.98),
  ]);
}

function buildViaductRibbonGeometry(
  curve: THREE.CatmullRomCurve3,
  halfWidth: number,
  segs: number,
): THREE.BufferGeometry {
  const up = new THREE.Vector3(0, 1, 0);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    const left = p.clone().addScaledVector(binormal, -halfWidth);
    const right = p.clone().addScaledVector(binormal, halfWidth);
    positions.push(left.x, left.y - 0.08, left.z);
    positions.push(right.x, right.y - 0.08, right.z);

    uvs.push(t, 0);
    uvs.push(t, 1);

    if (i < segs) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Vertical translucent glass slab edge skirt along the front rim of the viaduct bridge,
 * giving the curved highway tangible 3D thickness like the mockup's crystal glass deck.
 */
function buildViaductFasciaWallGeometry(
  curve: THREE.CatmullRomCurve3,
  offsetHalfW: number,
  depth: number,
  segs: number,
): THREE.BufferGeometry {
  const up = new THREE.Vector3(0, 1, 0);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    const topPt = p.clone().addScaledVector(binormal, offsetHalfW);
    positions.push(topPt.x, topPt.y - 0.085, topPt.z);
    positions.push(topPt.x, topPt.y - 0.085 - depth, topPt.z);

    uvs.push(t, 0);
    uvs.push(t, 1);

    if (i < segs) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function initVertexColors(geo: THREE.BufferGeometry): void {
  const posAttr = geo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function colorForTrackRatio(
  u: number,
  activeCenterT: number,
  corePass: boolean,
): THREE.Color {
  const green = new THREE.Color(corePass ? 0xb4ffdf : 0x22f5a0);
  const gold = new THREE.Color(corePass ? 0xfff8dc : 0xffc142);
  const blue = new THREE.Color(corePass ? 0xb4d5ff : 0x3b82f6);

  const doneEnd = activeCenterT - 0.065;
  const goldStart = activeCenterT - 0.036;
  const goldEnd = activeCenterT + 0.04;
  const blueStart = activeCenterT + 0.098;

  if (u <= doneEnd) return green;
  if (u < goldStart) {
    const k = (u - doneEnd) / Math.max(0.01, goldStart - doneEnd);
    return green.clone().lerp(gold, k);
  }
  if (u <= goldEnd) return gold;
  if (u < blueStart) {
    const k = (u - goldEnd) / Math.max(0.01, blueStart - goldEnd);
    return gold.clone().lerp(blue, k);
  }
  return blue;
}

/**
 * Wide curved architectural glass viaduct bridge:
 * - Translucent multi-lane sapphire/indigo highway deck
 * - Solid vertical front glass fascia slab + upper/lower crystal rim rails
 * - Soft vertical light-curtain piers STRICTLY BELOW the bridge deck (no spikes above rails!)
 * - 4-point diamond star rim glints along the sweeping right bridge arc
 */
export function buildTrainTrack(
  curve: THREE.CatmullRomCurve3,
  maxAnisotropy: number,
  starFlareTex: THREE.CanvasTexture,
): TrackRefs {
  const trackGroup = new THREE.Group();

  const samples = 150;
  const leftPts: THREE.Vector3[] = [];
  const rightPts: THREE.Vector3[] = [];
  const frontTopRimPts: THREE.Vector3[] = [];
  const frontLowerRimPts: THREE.Vector3[] = [];
  const backRimPts: THREE.Vector3[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const deckHalfW = 0.96;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    leftPts.push(p.clone().addScaledVector(binormal, -0.32));
    rightPts.push(p.clone().addScaledVector(binormal, 0.32));
    frontTopRimPts.push(
      p.clone().addScaledVector(binormal, deckHalfW - 0.02).add(new THREE.Vector3(0, -0.082, 0)),
    );
    frontLowerRimPts.push(
      p.clone().addScaledVector(binormal, deckHalfW - 0.04).add(new THREE.Vector3(0, -0.3, 0)),
    );
    backRimPts.push(
      p.clone().addScaledVector(binormal, -deckHalfW + 0.03).add(new THREE.Vector3(0, -0.082, 0)),
    );
  }

  const leftCurve = new THREE.CatmullRomCurve3(leftPts);
  const rightCurve = new THREE.CatmullRomCurve3(rightPts);
  const frontTopRimCurve = new THREE.CatmullRomCurve3(frontTopRimPts);
  const frontLowerRimCurve = new THREE.CatmullRomCurve3(frontLowerRimPts);
  const backRimCurve = new THREE.CatmullRomCurve3(backRimPts);

  // 1. Wide Curved Optical Fiber-Optic Glass Deck Ribbon
  const deckTex = createViaductDeckTexture(maxAnisotropy);
  const ribbonGeo = buildViaductRibbonGeometry(curve, deckHalfW, 110);
  const ribbonMat = new THREE.MeshBasicMaterial({
    map: deckTex,
    color: 0xb4d4ff,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonMesh.renderOrder = 1;
  trackGroup.add(ribbonMesh);

  // Solid front glass slab thickness wall + luminous upper/lower crystal edges
  const fasciaGeo = buildViaductFasciaWallGeometry(curve, deckHalfW - 0.025, 0.22, 110);
  const fasciaMat = new THREE.MeshBasicMaterial({
    color: 0x1d42a8,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const fasciaMesh = new THREE.Mesh(fasciaGeo, fasciaMat);
  fasciaMesh.renderOrder = 1;
  trackGroup.add(fasciaMesh);

  const frontRimMesh = new THREE.Mesh(
    new THREE.TubeGeometry(frontTopRimCurve, 108, 0.022, 6, false),
    new THREE.MeshBasicMaterial({
      color: 0xc2e6ff,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const lowerRimMesh = new THREE.Mesh(
    new THREE.TubeGeometry(frontLowerRimCurve, 108, 0.015, 6, false),
    new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const backRimMesh = new THREE.Mesh(
    new THREE.TubeGeometry(backRimCurve, 100, 0.014, 6, false),
    new THREE.MeshBasicMaterial({
      color: 0x8cbaff,
      transparent: true,
      opacity: 0.54,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  trackGroup.add(frontRimMesh, lowerRimMesh, backRimMesh);

  // 2. Soft Translucent Under-Bridge Glass Light Curtains (strictly BELOW the deck slab!)
  const pillarTex = createLightPillarTexture();
  const pillarGeo = new THREE.PlaneGeometry(0.96, 3.15);
  const pillarSpecs: [number, number, number][] = [
    [0.14, 0x2dd4bf, 0.44],
    [0.24, 0x34d399, 0.48],
    [0.34, 0x38bdf8, 0.52],
    [0.44, 0x60a5fa, 0.58],
    [0.54, 0x6366f1, 0.64],
    [0.64, 0x818cf8, 0.72],
    [0.74, 0x6366f1, 0.84],
    [0.83, 0x60a5fa, 0.88],
    [0.91, 0x818cf8, 0.76],
  ];
  pillarSpecs.forEach(([t, hexColor, op]) => {
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const colMat = new THREE.MeshBasicMaterial({
      map: pillarTex,
      color: hexColor,
      transparent: true,
      opacity: op,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const col = new THREE.Mesh(pillarGeo, colMat);
    const rimPos = p.clone().addScaledVector(binormal, 0.46);
    col.position.set(rimPos.x, rimPos.y - 1.66, rimPos.z);
    col.renderOrder = 2;
    trackGroup.add(col);
  });

  // Crisp 4-point diamond star glints along the sweeping right bridge rim
  for (const t of [0.64, 0.74, 0.83, 0.91]) {
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const starMat = new THREE.SpriteMaterial({
      map: starFlareTex,
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const star = new THREE.Sprite(starMat);
    const pt = p.clone().addScaledVector(binormal, deckHalfW - 0.03);
    star.position.set(pt.x, pt.y - 0.08, pt.z + 0.04);
    star.scale.set(0.72, 0.72, 1);
    star.renderOrder = 5;
    trackGroup.add(star);
  }

  // 3. Color-Graded Luminous Top Rails right under the train bogie wheels
  const coreLeftGeo = new THREE.TubeGeometry(leftCurve, 96, 0.014, 6, false);
  const coreRightGeo = new THREE.TubeGeometry(rightCurve, 96, 0.014, 6, false);
  initVertexColors(coreLeftGeo);
  initVertexColors(coreRightGeo);

  const filamentMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });

  const midLeftGeo = new THREE.TubeGeometry(leftCurve, 84, 0.042, 6, false);
  const midRightGeo = new THREE.TubeGeometry(rightCurve, 84, 0.042, 6, false);
  initVertexColors(midLeftGeo);
  initVertexColors(midRightGeo);

  const midGlowMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const haloLeftGeo = new THREE.TubeGeometry(leftCurve, 72, 0.11, 6, false);
  const haloRightGeo = new THREE.TubeGeometry(rightCurve, 72, 0.11, 6, false);
  initVertexColors(haloLeftGeo);
  initVertexColors(haloRightGeo);

  const haloMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const cL = new THREE.Mesh(coreLeftGeo, filamentMat);
  const cR = new THREE.Mesh(coreRightGeo, filamentMat);
  const mL = new THREE.Mesh(midLeftGeo, midGlowMat);
  const mR = new THREE.Mesh(midRightGeo, midGlowMat);
  const hL = new THREE.Mesh(haloLeftGeo, haloMat);
  const hR = new THREE.Mesh(haloRightGeo, haloMat);
  cL.userData.isCore = true;
  cR.userData.isCore = true;

  trackGroup.add(cL, cR, mL, mR, hL, hR);

  // 4. Semi-transparent wireframe outline overlay for segmented viaduct & track rails (Wireframe Mode)
  const trackWireGroup = new THREE.Group();
  trackWireGroup.visible = false;
  const trackWireRibbonMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
    toneMapped: false,
  });
  const trackWireRibbon = new THREE.Mesh(ribbonGeo, trackWireRibbonMat);
  trackWireRibbon.position.y = 0.004;
  trackWireRibbon.renderOrder = 10;

  const trackWireFasciaMat = new THREE.MeshBasicMaterial({
    color: 0x818cf8,
    wireframe: true,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    toneMapped: false,
  });
  const trackWireFascia = new THREE.Mesh(fasciaGeo, trackWireFasciaMat);
  trackWireFascia.renderOrder = 10;

  const trackWireRailMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    wireframe: true,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    toneMapped: false,
  });
  const wireLeftRail = new THREE.Mesh(coreLeftGeo, trackWireRailMat);
  const wireRightRail = new THREE.Mesh(coreRightGeo, trackWireRailMat);
  wireLeftRail.renderOrder = 10;
  wireRightRail.renderOrder = 10;
  trackWireGroup.add(trackWireRibbon, trackWireFascia, wireLeftRail, wireRightRail);
  trackGroup.add(trackWireGroup);

  return {
    group: trackGroup,
    railTubes: [cL, cR, mL, mR, hL, hR],
    ribbonMat,
    fasciaMat,
    wireframeGroup: trackWireGroup,
    deckTex,
    pillarTex,
    starFlareTex,
  };
}

export function updateTrackRailColors(
  track: TrackRefs,
  activeCenterT: number,
): void {
  for (const mesh of track.railTubes) {
    const geo = mesh.geometry as THREE.TubeGeometry;
    const posAttr = geo.attributes.position;
    const colAttr = geo.attributes.color as THREE.BufferAttribute;
    const radialSegments = geo.parameters.radialSegments;
    const tubularSegments = geo.parameters.tubularSegments;
    const ringVerts = radialSegments + 1;
    const isCore = Boolean(mesh.userData.isCore);

    for (let i = 0; i <= tubularSegments; i++) {
      const u = i / tubularSegments;
      const c = colorForTrackRatio(u, activeCenterT, isCore);
      for (let j = 0; j < ringVerts; j++) {
        const idx = i * ringVerts + j;
        if (idx < posAttr.count) {
          colAttr.setXYZ(idx, c.r, c.g, c.b);
        }
      }
    }
    colAttr.needsUpdate = true;
  }
}

export function buildEnvironmentTerrain(maxAnisotropy: number): EnvironmentRefs {
  const envGroup = new THREE.Group();

  const gridTex = createFloorGridTexture(maxAnisotropy);
  const floorMat = new THREE.MeshBasicMaterial({
    map: gridTex,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, -2.55, -1.0);
  envGroup.add(floorMesh);

  const starGeo = new THREE.BufferGeometry();
  const starCount = 135;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const sx = (((i * 97) % 100) / 100 - 0.5) * 48;
    const sy = 1.4 + (((i * 53) % 100) / 100) * 11.5;
    const sz = -4.0 - (((i * 71) % 100) / 100) * 18.0;
    starPos[i * 3] = sx;
    starPos[i * 3 + 1] = sy;
    starPos[i * 3 + 2] = sz;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0x8db6ff,
    size: 0.08,
    transparent: true,
    opacity: 0.42,
  });
  envGroup.add(new THREE.Points(starGeo, starMat));

  return { group: envGroup, gridTex };
}

function buildCarProfileShape(
  halfW: number,
  halfH: number,
): { shape: THREE.Shape; outlinePoints: THREE.Vector3[] } {
  const r = 0.34;
  const shape = new THREE.Shape();
  const pts: THREE.Vector2[] = [];

  shape.moveTo(-halfW + r, -halfH);
  shape.lineTo(halfW - r, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
  shape.lineTo(halfW, halfH - r);
  shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
  shape.lineTo(-halfW + r, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
  shape.lineTo(-halfW, -halfH + r);
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);

  shape.getPoints(48).forEach((p) => pts.push(p));

  const outlinePoints = pts.map((p) => new THREE.Vector3(p.x, p.y, 0));
  return { shape, outlinePoints };
}

/**
 * Unified aerodynamic capsule silhouette for Car 0 (bullet nose, dir = -1)
 * and Car 4 (observation dome tail, dir = +1) so the outer neon rim flows cleanly
 * from roof crown down the curved windshield without an internal vertical divider loop.
 */
function buildUnifiedEndCarProfile(
  dir: -1 | 1,
  halfW: number,
  halfH: number,
): {
  shape: THREE.Shape;
  outlinePoints: THREE.Vector3[];
  domeCurve: THREE.CubicBezierCurve3;
  domeStartX: number;
  tipX: number;
} {
  const r = 0.34;
  const domeStartX = dir * (halfW - 0.12);
  const tipX = dir * (halfW + 0.78);
  const couplerX = -dir * halfW;

  const p0 = new THREE.Vector3(domeStartX, halfH, 0);
  const p1 = new THREE.Vector3(dir * (halfW + 0.36), halfH, 0);
  const p2 = new THREE.Vector3(tipX - dir * 0.06, 0.24, 0);
  const p3 = new THREE.Vector3(tipX, -halfH + 0.16, 0);
  const domeCurve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);

  const shape = new THREE.Shape();
  if (dir === -1) {
    // Lead bullet nose (left): clockwise/CCW consistent outline
    shape.moveTo(tipX + 0.12, -halfH);
    shape.lineTo(halfW - r, -halfH);
    shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
    shape.lineTo(halfW, halfH - r);
    shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
    shape.lineTo(domeStartX, halfH);
    shape.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    shape.quadraticCurveTo(tipX, -halfH, tipX + 0.12, -halfH);
  } else {
    // Tail observation dome (right)
    shape.moveTo(couplerX + r, -halfH);
    shape.lineTo(tipX - 0.12, -halfH);
    shape.quadraticCurveTo(tipX, -halfH, tipX, p3.y);
    shape.bezierCurveTo(p2.x, p2.y, p1.x, p1.y, p0.x, p0.y);
    shape.lineTo(couplerX + r, halfH);
    shape.quadraticCurveTo(couplerX, halfH, couplerX, halfH - r);
    shape.lineTo(couplerX, -halfH + r);
    shape.quadraticCurveTo(couplerX, -halfH, couplerX + r, -halfH);
  }

  const pts = shape.getPoints(64);
  const outlinePoints = pts.map((p) => new THREE.Vector3(p.x, p.y, 0));
  return { shape, outlinePoints, domeCurve, domeStartX, tipX };
}

export interface SharedCarAssets {
  chassisMat: THREE.MeshStandardMaterial;
  tireMat: THREE.MeshStandardMaterial;
  rimMetalMat: THREE.MeshStandardMaterial;
  mullionMat: THREE.MeshBasicMaterial;
  windshieldTintMat: THREE.MeshBasicMaterial;
  wheelGeo: THREE.BufferGeometry;
  wheelRimGeo: THREE.BufferGeometry;
  hubGeo: THREE.BufferGeometry;
  bogieBeamGeo: THREE.BufferGeometry;
  couplerGeo: THREE.BufferGeometry;
  couplerCollarGeo: THREE.BufferGeometry;
  pulseGeo: THREE.PlaneGeometry;
  ventCollarGeo: THREE.CylinderGeometry;
  bodyExtrudeGeo: THREE.ExtrudeGeometry;
  bodyNeonTubeGeo: THREE.TubeGeometry;
  bodyHaloTubeGeo: THREE.TubeGeometry;
  bodyFaceGeo: THREE.PlaneGeometry;
  endFaceGeo: THREE.PlaneGeometry;
}

export function createSharedCarAssets(): SharedCarAssets {
  const halfW = 1.34;
  const halfH = 0.64;
  const bodyDepth = 0.7;
  const { shape, outlinePoints } = buildCarProfileShape(halfW, halfH);

  const bodyExtrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: bodyDepth,
    bevelEnabled: true,
    bevelThickness: 0.095,
    bevelSize: 0.08,
    bevelSegments: 4,
    curveSegments: 22,
  });
  bodyExtrudeGeo.translate(0, 0, -bodyDepth / 2);

  const closedBody = new THREE.CatmullRomCurve3(outlinePoints, true);

  const wheelGeo = new THREE.CylinderGeometry(0.132, 0.132, 0.068, 16);
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.082, 10);
  hubGeo.rotateX(Math.PI / 2);

  return {
    chassisMat: new THREE.MeshStandardMaterial({
      color: 0x091326,
      metalness: 0.9,
      roughness: 0.24,
    }),
    tireMat: new THREE.MeshStandardMaterial({
      color: 0x0c172b,
      metalness: 0.86,
      roughness: 0.26,
    }),
    rimMetalMat: new THREE.MeshStandardMaterial({
      color: 0x9ab8df,
      metalness: 0.95,
      roughness: 0.14,
    }),
    mullionMat: new THREE.MeshBasicMaterial({
      color: 0xa6cbff,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
    windshieldTintMat: new THREE.MeshBasicMaterial({
      color: 0x163c6e,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    wheelGeo,
    wheelRimGeo: new THREE.TorusGeometry(0.095, 0.012, 6, 16),
    hubGeo,
    bogieBeamGeo: new THREE.BoxGeometry(0.68, 0.062, 0.68),
    couplerGeo: new THREE.CylinderGeometry(0.024, 0.024, 0.42, 6),
    couplerCollarGeo: new THREE.CylinderGeometry(0.052, 0.052, 0.078, 8),
    pulseGeo: new THREE.PlaneGeometry(4.6, 4.6),
    ventCollarGeo: new THREE.CylinderGeometry(0.062, 0.09, 0.046, 12),
    bodyExtrudeGeo,
    bodyNeonTubeGeo: new THREE.TubeGeometry(closedBody, 64, 0.014, 6, true),
    bodyHaloTubeGeo: new THREE.TubeGeometry(closedBody, 56, 0.052, 6, true),
    bodyFaceGeo: new THREE.PlaneGeometry(2.58, 1.24),
    endFaceGeo: new THREE.PlaneGeometry(2.52, 1.22),
  };
}

/**
 * Integrated cab windshield panes, A-pillar seam, stepped bumper shelf,
 * and flush cowcatcher/diffuser apron attached cleanly to the unified end-car capsule.
 */
function buildEndCabDetails(
  dir: -1 | 1,
  halfW: number,
  halfH: number,
  bodyCenterY: number,
  domeCurve: THREE.CubicBezierCurve3,
  domeStartX: number,
  tipX: number,
  shared: SharedCarAssets,
  glowSpriteTex: THREE.CanvasTexture,
  initialStatus: StageStatus,
): {
  group: THREE.Group;
  fairingGlintMat: THREE.SpriteMaterial;
  apronGeo: THREE.ExtrudeGeometry;
} {
  const fGroup = new THREE.Group();
  const rootX = domeStartX - dir * 0.08;
  const rimZ = 0.445;
  const domePts = domeCurve.getPoints(36);

  const sampleDomeX = (targetY: number): number => {
    for (let i = 0; i < domePts.length - 1; i++) {
      const a = domePts[i];
      const b = domePts[i + 1];
      if ((a.y >= targetY && b.y <= targetY) || (a.y <= targetY && b.y >= targetY)) {
        const span = b.y - a.y;
        const frac = Math.abs(span) < 1e-5 ? 0 : (targetY - a.y) / span;
        return a.x + (b.x - a.x) * frac;
      }
    }
    return tipX;
  };

  // Subtle dark vertical structural A-pillar between cab windshield and stage badge glass (not a glowing rim)
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0x0b162e,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
  });
  const aPillar = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(rootX, halfH - 0.04, 0),
        new THREE.Vector3(rootX, -halfH + 0.06, 0),
      ]),
      10,
      0.015,
      5,
      false,
    ),
    pillarMat,
  );
  aPillar.position.set(0, bodyCenterY, rimZ + 0.004);
  fGroup.add(aPillar);

  // Wraparound dark-tinted panoramic windshield panes flush inside the unified nose curve
  const wsTopY = 0.34;
  const wsBotY = -0.05;
  const wsMidY = 0.15;
  const wsTopOuterX = sampleDomeX(wsTopY) - dir * 0.03;
  const wsMidOuterX = sampleDomeX(wsMidY) - dir * 0.02;
  const wsBotOuterX = sampleDomeX(wsBotY) - dir * 0.015;
  const wsInnerX = rootX + dir * 0.03;

  const wsShape = new THREE.Shape();
  wsShape.moveTo(wsInnerX, wsBotY);
  wsShape.lineTo(wsBotOuterX, wsBotY);
  wsShape.quadraticCurveTo(wsMidOuterX, wsMidY, wsTopOuterX, wsTopY);
  wsShape.lineTo(wsInnerX, wsTopY);
  wsShape.closePath();
  const wsPane = new THREE.Mesh(
    new THREE.ShapeGeometry(wsShape, 14),
    new THREE.MeshBasicMaterial({
      color: 0x040b1d,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  wsPane.position.set(0, bodyCenterY, rimZ + 0.006);
  wsPane.renderOrder = 5;
  fGroup.add(wsPane);

  // Upper sill, lower windshield sill, outer curve frame, center divider pillar, & lower nose crease
  const upperSill = new THREE.CatmullRomCurve3([
    new THREE.Vector3(wsInnerX - dir * 0.02, wsTopY, 0),
    new THREE.Vector3(wsTopOuterX, wsTopY, 0),
  ]);
  const lowerSill = new THREE.CatmullRomCurve3([
    new THREE.Vector3(wsInnerX - dir * 0.02, wsBotY, 0),
    new THREE.Vector3(wsBotOuterX, wsBotY, 0),
  ]);
  const outerWsRim = new THREE.CatmullRomCurve3([
    new THREE.Vector3(wsTopOuterX, wsTopY, 0),
    new THREE.Vector3(wsMidOuterX, wsMidY, 0),
    new THREE.Vector3(wsBotOuterX, wsBotY, 0),
  ]);
  const centerPillar = new THREE.CatmullRomCurve3([
    new THREE.Vector3(rootX + dir * 0.28, wsTopY, 0),
    new THREE.Vector3(rootX + dir * 0.39, wsBotY, 0),
  ]);
  const noseTrimY = -0.34;
  const noseTrimEndX = sampleDomeX(noseTrimY) - dir * 0.02;
  const noseTrimRib = new THREE.CatmullRomCurve3([
    new THREE.Vector3(wsInnerX - dir * 0.02, noseTrimY, 0),
    new THREE.Vector3(noseTrimEndX, noseTrimY, 0),
  ]);
  for (const c of [upperSill, lowerSill, outerWsRim, centerPillar, noseTrimRib]) {
    const m = new THREE.Mesh(
      new THREE.TubeGeometry(c, 10, 0.0085, 4, false),
      shared.mullionMat,
    );
    m.position.set(0, bodyCenterY, rimZ + 0.01);
    fGroup.add(m);
  }

  // Stepped horizontal bumper shelf + flush lower cowcatcher / diffuser apron
  const shelfTipX = tipX + dir * 0.055;
  const shelfSpan = Math.abs(shelfTipX - rootX);
  const bumperShelf = new THREE.Mesh(
    new THREE.BoxGeometry(shelfSpan, 0.052, 0.64),
    shared.chassisMat,
  );
  bumperShelf.position.set((rootX + shelfTipX) * 0.5, 0.25, 0);
  fGroup.add(bumperShelf);

  const shelfRim = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(rootX, 0.276, 0),
        new THREE.Vector3(shelfTipX - dir * 0.006, 0.276, 0),
      ]),
      6,
      0.007,
      4,
      false,
    ),
    shared.mullionMat,
  );
  shelfRim.position.z = 0.32;
  fGroup.add(shelfRim);

  const apronTopX = shelfTipX - dir * 0.02;
  const apronBotX = dir === -1 ? shelfTipX + dir * 0.015 : shelfTipX - dir * 0.07;
  const apronShape = new THREE.Shape();
  apronShape.moveTo(rootX, 0.14);
  apronShape.lineTo(apronBotX, 0.14);
  apronShape.lineTo(apronTopX, 0.24);
  apronShape.lineTo(rootX, 0.24);
  apronShape.closePath();
  const apronGeo = new THREE.ExtrudeGeometry(apronShape, {
    depth: 0.52,
    bevelEnabled: false,
  });
  apronGeo.translate(0, 0, -0.26);
  const apronMesh = new THREE.Mesh(apronGeo, shared.chassisMat);
  fGroup.add(apronMesh);

  const apronRim = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(rootX, 0.148, 0),
        new THREE.Vector3(apronBotX, 0.148, 0),
        new THREE.Vector3(apronTopX, 0.24, 0),
      ]),
      10,
      0.0065,
      4,
      false,
    ),
    shared.mullionMat,
  );
  apronRim.position.z = 0.265;
  fGroup.add(apronRim);

  // Specular headlight glint on lower curved nose shoulder
  const pal = STAGE_COLORS[initialStatus];
  const fairingGlintMat = new THREE.SpriteMaterial({
    map: glowSpriteTex,
    color: pal.rim,
    transparent: true,
    opacity: 0.86,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glintSprite = new THREE.Sprite(fairingGlintMat);
  glintSprite.position.set(
    tipX - dir * 0.12,
    bodyCenterY - 0.22,
    rimZ + 0.03,
  );
  glintSprite.scale.set(0.58, 0.38, 1);
  glintSprite.renderOrder = 8;
  fGroup.add(glintSprite);

  return {
    group: fGroup,
    fairingGlintMat,
    apronGeo,
  };
}

/**
 * Hero-Proportioned Sculpted Crystal Express Carriage:
 * - Middle cars (1..3) share one symmetrical rounded-bevel glass capsule
 * - Car 0 (Ideating) & Car 4 (Finalizing) use unified bullet-nose / observation-dome capsules
 *   with continuous outer neon rims (no internal vertical divider cutting across the glass)
 * - Compact bogies aligned strictly beneath each carriage + roof vapor vent collars
 */
export function buildTrainCar(
  index: number,
  label: string,
  maxAnisotropy: number,
  pulseRingTex: THREE.CanvasTexture,
  glowSpriteTex: THREE.CanvasTexture,
  carAuraTex: THREE.CanvasTexture,
  shared: SharedCarAssets,
): StageCarRefs {
  const isLead = index === 0;
  const isTail = index === 4;
  const variant: "nose" | "body" | "tail" = isLead
    ? "nose"
    : isTail
      ? "tail"
      : "body";

  const halfW = 1.34;
  const halfH = 0.64;
  const bodyCenterY = 0.88;
  const bodyDepth = 0.7;

  const leftSpan = isLead ? halfW + 0.84 : halfW + 0.09;
  const rightSpan = isTail ? halfW + 0.84 : halfW + 0.09;

  const carGroup = new THREE.Group();
  const initialStatus: StageStatus = "pending";
  const palette = STAGE_COLORS[initialStatus];

  const wheelRingMat = new THREE.MeshBasicMaterial({
    color: palette.primary,
    transparent: true,
    opacity: 0.75,
    toneMapped: false,
  });

  // 1. Sleek Undercarriage Skirt + Symmetrical Compact Bogies
  const skirtWidth = isLead || isTail ? halfW * 2.42 : halfW * 2.02;
  const skirtMesh = new THREE.Mesh(
    new THREE.BoxGeometry(skirtWidth, 0.05, 0.64),
    shared.chassisMat,
  );
  skirtMesh.position.set(isLead ? -0.24 : isTail ? 0.24 : 0, 0.21, 0);
  carGroup.add(skirtMesh);

  const wheels: THREE.Mesh[] = [];
  const xPairs = isLead
    ? [-1.18, -0.76, 0.44, 0.86]
    : isTail
      ? [-0.86, -0.44, 0.76, 1.18]
      : [-0.9, -0.48, 0.48, 0.9];
  for (const wx of xPairs) {
    for (const wz of [-0.31, 0.31]) {
      const wheel = new THREE.Mesh(shared.wheelGeo, shared.tireMat);
      wheel.position.set(wx, 0.132, wz);
      const faceZ = wz > 0 ? 0.036 : -0.036;
      const glowRing = new THREE.Mesh(shared.wheelRimGeo, wheelRingMat);
      glowRing.position.z = faceZ;
      const hub = new THREE.Mesh(shared.hubGeo, shared.rimMetalMat);
      wheel.add(glowRing, hub);
      carGroup.add(wheel);
      wheels.push(wheel);
    }
  }

  const bogieCenters = isLead
    ? [-0.97, 0.65]
    : isTail
      ? [-0.65, 0.97]
      : [-0.69, 0.69];
  for (const bx of bogieCenters) {
    const bogieBeam = new THREE.Mesh(shared.bogieBeamGeo, shared.chassisMat);
    bogieBeam.position.set(bx, 0.18, 0);
    carGroup.add(bogieBeam);
  }

  // Track contact underglow pool below wheels
  const underglowMat = new THREE.SpriteMaterial({
    map: glowSpriteTex,
    color: palette.primary,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const underglowSprite = new THREE.Sprite(underglowMat);
  underglowSprite.position.set(isLead ? -0.22 : isTail ? 0.22 : 0, 0.06, 0.1);
  underglowSprite.scale.set(isLead || isTail ? 3.8 : 3.3, 0.82, 1);
  underglowSprite.renderOrder = 2;
  carGroup.add(underglowSprite);

  // Low outer aura behind the lower car edge (keeps upper/center dark glass crisp!)
  const carAuraMat = new THREE.SpriteMaterial({
    map: carAuraTex,
    color: palette.primary,
    transparent: true,
    opacity: 0.26,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const carAuraSprite = new THREE.Sprite(carAuraMat);
  carAuraSprite.position.set(isLead ? -0.18 : isTail ? 0.18 : 0, bodyCenterY - 0.16, -0.42);
  carAuraSprite.scale.set(isLead || isTail ? 3.9 : 3.5, 1.5, 1);
  carAuraSprite.renderOrder = 2;
  carGroup.add(carAuraSprite);

  // 2. Unified 3D Volumetric Smoked Crystal Glass Capsule (unified nose/tail shape on Cars 0 & 4)
  let hullGeo: THREE.ExtrudeGeometry = shared.bodyExtrudeGeo;
  let neonGeo: THREE.TubeGeometry = shared.bodyNeonTubeGeo;
  let haloGeo: THREE.TubeGeometry = shared.bodyHaloTubeGeo;
  let endProfile: ReturnType<typeof buildUnifiedEndCarProfile> | undefined;

  if (isLead || isTail) {
    endProfile = buildUnifiedEndCarProfile(isLead ? -1 : 1, halfW, halfH);
    hullGeo = new THREE.ExtrudeGeometry(endProfile.shape, {
      depth: bodyDepth,
      bevelEnabled: true,
      bevelThickness: 0.095,
      bevelSize: 0.08,
      bevelSegments: 4,
      curveSegments: 24,
    });
    hullGeo.translate(0, 0, -bodyDepth / 2);
    const closedEndCurve = new THREE.CatmullRomCurve3(endProfile.outlinePoints, true);
    neonGeo = new THREE.TubeGeometry(closedEndCurve, 72, 0.014, 6, true);
    haloGeo = new THREE.TubeGeometry(closedEndCurve, 64, 0.052, 6, true);
  }

  const glassShaderMat = createCarGlassShaderMaterial(halfH, initialStatus);
  const hullMesh = new THREE.Mesh(hullGeo, glassShaderMat);
  hullMesh.position.y = bodyCenterY;
  hullMesh.renderOrder = 4;
  carGroup.add(hullMesh);

  // 3. Single Continuous Razor-Crisp Neon Outer Silhouette + Tight Halo
  const neonEdgeMat = new THREE.MeshBasicMaterial({
    color: palette.rim,
    toneMapped: false,
  });
  const haloEdgeMat = new THREE.MeshBasicMaterial({
    color: palette.primary,
    transparent: true,
    opacity: 0.74,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const rimZ = bodyDepth / 2 + 0.085;
  const frontCoreRim = new THREE.Mesh(neonGeo, neonEdgeMat);
  frontCoreRim.position.set(0, bodyCenterY, rimZ);
  const frontHaloRim = new THREE.Mesh(haloGeo, haloEdgeMat);
  frontHaloRim.position.set(0, bodyCenterY, rimZ);
  carGroup.add(frontCoreRim, frontHaloRim);

  // Integrated cab windshield, mullions, bumper shelf & cowcatcher on Cars 0 & 4
  let fairingGlintMat: THREE.SpriteMaterial | undefined;
  let apronGeoForWire: THREE.ExtrudeGeometry | undefined;
  if (endProfile) {
    const cabDetails = buildEndCabDetails(
      isLead ? -1 : 1,
      halfW,
      halfH,
      bodyCenterY,
      endProfile.domeCurve,
      endProfile.domeStartX,
      endProfile.tipX,
      shared,
      glowSpriteTex,
      initialStatus,
    );
    carGroup.add(cabDetails.group);
    fairingGlintMat = cabDetails.fairingGlintMat;
    apronGeoForWire = cabDetails.apronGeo;
  }

  // Subtle roof vapor vent emitter collar on Cars 0..3 matching mockup plumes
  if (!isTail) {
    const ventRing = new THREE.Mesh(shared.ventCollarGeo, shared.chassisMat);
    ventRing.position.set(isLead ? 0.14 : -0.04, bodyCenterY + halfH + 0.07, 0);
    carGroup.add(ventRing);
  }

  // 4. Hero-Scale HD 1024x512 Glass Stage Badge centered inside main passenger glass window
  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = 1024;
  faceCanvas.height = 512;
  drawCarBadgeCanvas(faceCanvas, label, initialStatus, variant);
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = maxAnisotropy;

  const faceMat = new THREE.MeshBasicMaterial({
    map: faceTex,
    transparent: true,
    depthWrite: false,
  });
  const faceXOffset = isLead ? 0.2 : isTail ? -0.2 : 0;
  const faceGeo = isLead || isTail ? shared.endFaceGeo : shared.bodyFaceGeo;
  const faceFront = new THREE.Mesh(faceGeo, faceMat);
  faceFront.position.set(faceXOffset, bodyCenterY, rimZ + 0.018);
  faceFront.renderOrder = 7;
  const faceBack = new THREE.Mesh(faceGeo, faceMat);
  faceBack.position.set(faceXOffset, bodyCenterY, -rimZ - 0.018);
  faceBack.rotation.y = Math.PI;
  faceBack.renderOrder = 7;
  carGroup.add(faceFront, faceBack);

  // 5. Delicate Concentric Active Radial Pulse Rings behind the active car
  const pulseRingMat = new THREE.MeshBasicMaterial({
    map: pulseRingTex,
    color: 0xffc857,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pulseRingMesh = new THREE.Mesh(shared.pulseGeo, pulseRingMat);
  pulseRingMesh.position.set(0, bodyCenterY + 0.06, -0.35);
  pulseRingMesh.renderOrder = 2;
  carGroup.add(pulseRingMesh);

  // 6. Compact Machined Coupler Linking Adjacent Cars cleanly across the bevel gap
  let couplerMesh: THREE.Mesh | undefined;
  let couplerMat: THREE.MeshBasicMaterial | undefined;
  if (index < 4) {
    couplerMat = new THREE.MeshBasicMaterial({
      color: palette.primary,
      transparent: true,
      opacity: 0.94,
      toneMapped: false,
    });
    couplerMesh = new THREE.Mesh(shared.couplerGeo, couplerMat);
    couplerMesh.rotation.z = Math.PI / 2;
    couplerMesh.position.set(halfW + 0.22, bodyCenterY - 0.08, 0.05);
    const couplerCollar = new THREE.Mesh(
      shared.couplerCollarGeo,
      shared.chassisMat,
    );
    couplerMesh.add(couplerCollar);
    carGroup.add(couplerMesh);
  }

  const wireframeMat = new THREE.MeshBasicMaterial({
    color: palette.rim,
    wireframe: true,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    toneMapped: false,
  });
  const wireframeGroup = new THREE.Group();
  wireframeGroup.visible = false;

  const wireHull = new THREE.Mesh(hullGeo, wireframeMat);
  wireHull.position.y = bodyCenterY;
  wireHull.renderOrder = 10;
  const wireSkirt = new THREE.Mesh(skirtMesh.geometry, wireframeMat);
  wireSkirt.position.copy(skirtMesh.position);
  wireSkirt.renderOrder = 10;
  wireframeGroup.add(wireHull, wireSkirt);

  for (const bx of bogieCenters) {
    const wireBogie = new THREE.Mesh(shared.bogieBeamGeo, wireframeMat);
    wireBogie.position.set(bx, 0.18, 0);
    wireBogie.renderOrder = 10;
    wireframeGroup.add(wireBogie);
  }
  if (apronGeoForWire) {
    const wireApron = new THREE.Mesh(apronGeoForWire, wireframeMat);
    wireApron.renderOrder = 10;
    wireframeGroup.add(wireApron);
  }
  carGroup.add(wireframeGroup);

  const hitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(leftSpan + rightSpan, 1.85, 1.3),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitProxy.position.set(isLead ? -0.35 : isTail ? 0.35 : 0, bodyCenterY, 0);
  hitProxy.userData = { carIndex: index };
  hitProxy.layers.set(1);
  carGroup.add(hitProxy);

  return {
    index,
    label,
    isLead,
    isTail,
    variant,
    leftSpan,
    rightSpan,
    group: carGroup,
    glassShaderMat,
    neonEdgeMat,
    haloEdgeMat,
    carAuraMat,
    underglowMat,
    wheelRingMat,
    faceMat,
    faceBack,
    faceCanvas,
    faceTex,
    pulseRingMat,
    pulseRingMesh,
    couplerMesh,
    couplerMat,
    wheels,
    fairingGlintMat,
    wireframeGroup,
    wireframeMat,
    smokeAnchorLocal: new THREE.Vector3(isLead ? 0.14 : -0.04, bodyCenterY + halfH + 0.08, 0),
    sparkAnchorLocal: new THREE.Vector3(halfW + 0.06, bodyCenterY - 0.06, 0.08),
    hitProxy,
    status: initialStatus,
    renderedBadgeKey: `${initialStatus}:false`,
    currentT: STATION_TS[index],
  };
}

export function updateCarStatusVisuals(
  car: StageCarRefs,
  status: StageStatus,
  isSelected: boolean,
): void {
  const palette = STAGE_COLORS[status];
  car.status = status;

  car.glassShaderMat.uniforms.uGlowColor.value.setHex(palette.primary);
  car.glassShaderMat.uniforms.uCoreColor.value.setHex(palette.rim);
  car.glassShaderMat.uniforms.uFresnelAlpha.value =
    status === "active" ? 0.9 : status === "done" ? 0.84 : 0.5;
  car.glassShaderMat.uniforms.uFillStrength.value =
    status === "active" ? 0.88 : status === "done" ? 0.72 : 0.24;

  car.neonEdgeMat.color.setHex(
    status === "pending" ? 0x7ba2f0 : palette.rim,
  );
  car.haloEdgeMat.color.setHex(
    status === "pending" ? 0x4567b3 : palette.primary,
  );
  car.haloEdgeMat.opacity =
    status === "active"
      ? 0.98
      : status === "done"
        ? 0.9
        : isSelected
          ? 0.58
          : 0.34;

  if (car.fairingGlassMat) {
    car.fairingGlassMat.uniforms.uGlowColor.value.setHex(palette.primary);
    car.fairingGlassMat.uniforms.uCoreColor.value.setHex(palette.rim);
    car.fairingGlassMat.uniforms.uFresnelAlpha.value =
      status === "active" ? 0.88 : status === "done" ? 0.8 : 0.56;
    car.fairingGlassMat.uniforms.uFillStrength.value =
      status === "active" ? 0.74 : status === "done" ? 0.58 : 0.24;
  }
  if (car.fairingRimMat) {
    car.fairingRimMat.color.setHex(
      status === "pending" ? 0x90b6fa : palette.rim,
    );
  }
  if (car.fairingGlintMat) {
    car.fairingGlintMat.color.setHex(
      status === "pending" ? 0xd6e6ff : palette.rim,
    );
    car.fairingGlintMat.opacity =
      status === "active" ? 0.92 : status === "done" ? 0.82 : 0.74;
  }

  car.carAuraMat.color.setHex(palette.primary);
  car.carAuraMat.opacity =
    status === "active" ? 0.62 : status === "done" ? 0.38 : 0.09;

  // Pending wheels stay muted metallic steel blue like mockup's Finalizing bogies
  car.wheelRingMat.color.setHex(
    status === "pending" ? 0x4b689c : palette.primary,
  );
  car.wheelRingMat.opacity =
    status === "active" ? 0.94 : status === "done" ? 0.62 : 0.3;

  car.underglowMat.color.setHex(palette.primary);
  car.underglowMat.opacity =
    status === "active" ? 0.98 : status === "done" ? 0.74 : 0.2;

  car.pulseRingMesh.visible = status === "active";
  car.pulseRingMat.opacity = status === "active" ? 0.78 : 0;

  if (car.couplerMesh && car.couplerMat) {
    car.couplerMesh.visible = true;
    car.couplerMat.color.setHex(status === "active" ? 0xfff0b8 : palette.primary);
    car.couplerMat.opacity = status === "active" ? 0.98 : status === "done" ? 0.92 : 0.64;
  }

  const nextBadgeKey = `${status}:${isSelected}:${car.label}`;
  if (car.renderedBadgeKey !== nextBadgeKey) {
    car.renderedBadgeKey = nextBadgeKey;
    drawCarBadgeCanvas(car.faceCanvas, car.label, status, car.variant);
    car.faceTex.needsUpdate = true;
  }

  car.wireframeMat.color.setHex(
    status === "pending" ? 0x7dd3fc : palette.rim,
  );
}

export function setSceneWireframeMode(
  cars: StageCarRefs[],
  track: TrackRefs,
  enabled: boolean,
): void {
  track.wireframeGroup.visible = enabled;
  track.ribbonMat.opacity = enabled ? 0.24 : 0.94;
  track.fasciaMat.opacity = enabled ? 0.14 : 0.44;

  for (const car of cars) {
    car.wireframeGroup.visible = enabled;
    const baseFill =
      car.status === "active" ? 0.88 : car.status === "done" ? 0.72 : 0.24;
    car.glassShaderMat.uniforms.uFillStrength.value = enabled
      ? baseFill * 0.35
      : baseFill;
    if (car.fairingGlassMat) {
      const fBase =
        car.status === "active" ? 0.74 : car.status === "done" ? 0.58 : 0.24;
      car.fairingGlassMat.uniforms.uFillStrength.value = enabled
        ? fBase * 0.35
        : fBase;
    }
    car.faceMat.opacity = enabled ? 0.62 : 1;
  }
}

const _posTmp = new THREE.Vector3();
const _tanTmp = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _rightVec = new THREE.Vector3();
const _corrUp = new THREE.Vector3();
const _rotMat = new THREE.Matrix4();

export function positionTrainOnCurve(
  cars: StageCarRefs[],
  curve: THREE.CatmullRomCurve3,
  centerT: number,
  activeIdx: number,
  bobElapsed: number,
  curveLen: number,
  gapScale = 1,
  yOffset = 0,
): void {
  const sparkAfterIdx = Math.min(3, Math.max(0, activeIdx));
  const rawTs = [0, 0, 0, 0, 0];
  let accum = 0;
  for (let i = 1; i < cars.length; i++) {
    const gapWorld = (i - 1 === sparkAfterIdx ? 0.82 : 0.22) * gapScale;
    accum += (cars[i - 1].rightSpan + cars[i].leftSpan + gapWorld) / curveLen;
    rawTs[i] = accum;
  }
  const midOffset = rawTs[2];

  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    const t = Math.max(
      0.04,
      Math.min(0.95, centerT + (rawTs[i] - midOffset)),
    );
    car.currentT = t;

    curve.getPointAt(t, _posTmp);
    curve.getTangentAt(t, _tanTmp).normalize();

    _rightVec.crossVectors(_tanTmp, _upVec).normalize();
    _corrUp.crossVectors(_rightVec, _tanTmp).normalize();
    _rotMat.makeBasis(_tanTmp, _corrUp, _rightVec);

    const bobAmp = car.status === "active" ? 0.008 : 0.004;
    const bobOffset = Math.sin(bobElapsed * 2.1 + i * 0.85) * bobAmp;

    car.group.position.set(_posTmp.x, _posTmp.y + bobOffset + yOffset, _posTmp.z);
    car.group.quaternion.setFromRotationMatrix(_rotMat);
  }
}
