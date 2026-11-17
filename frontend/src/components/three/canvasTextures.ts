import * as THREE from "three";
import type { StageStatus } from "../../types/groundly";

export const STAGE_COLORS: Record<
  StageStatus,
  {
    primary: number;
    emissive: number;
    rim: number;
    coreWhite: number;
    smokeHex: number;
    hex: string;
    litHex: string;
    rgba: string;
    label: string;
  }
> = {
  done: {
    primary: 0x22f5a0,
    emissive: 0x0ed482,
    rim: 0xbaffdf,
    coreWhite: 0xeafff7,
    smokeHex: 0x6dffcb,
    hex: "#22f59d",
    litHex: "#ffffff",
    rgba: "34, 245, 157",
    label: "VERIFIED",
  },
  active: {
    primary: 0xffc038,
    emissive: 0xff9b08,
    rim: 0xfff0be,
    coreWhite: 0xfffbeb,
    smokeHex: 0xffe296,
    hex: "#ffc142",
    litHex: "#ffffff",
    rgba: "255, 193, 66",
    label: "ACTIVE",
  },
  pending: {
    primary: 0x4b74c9,
    emissive: 0x243e7d,
    rim: 0x8db2f8,
    coreWhite: 0xd8e6ff,
    smokeHex: 0x7aaeff,
    hex: "#6689cc",
    litHex: "#c9d9f5",
    rgba: "122, 166, 255",
    label: "QUEUED",
  },
};

export function createGlowSpriteTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    1,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.16, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.48, "rgba(255,255,255,0.24)");
  grad.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 4-point diamond lens-flare star texture for subtle bridge rim sparkles.
 */
export function createRimStarFlareTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  const c = size / 2;

  const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.48);
  core.addColorStop(0, "rgba(255, 255, 255, 1)");
  core.addColorStop(0.18, "rgba(219, 234, 254, 0.78)");
  core.addColorStop(0.5, "rgba(129, 140, 248, 0.24)");
  core.addColorStop(1, "rgba(99, 102, 241, 0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  // Horizontal & vertical razor-thin flare spikes
  const hGrad = ctx.createLinearGradient(0, c, size, c);
  hGrad.addColorStop(0, "rgba(255,255,255,0)");
  hGrad.addColorStop(0.5, "rgba(255,255,255,0.95)");
  hGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hGrad;
  ctx.fillRect(4, c - 1.5, size - 8, 3);

  const vGrad = ctx.createLinearGradient(c, 0, c, size);
  vGrad.addColorStop(0, "rgba(255,255,255,0)");
  vGrad.addColorStop(0.5, "rgba(255,255,255,0.95)");
  vGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = vGrad;
  ctx.fillRect(c - 1.5, 4, 3, size - 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Soft elliptical atmospheric bloom halo placed behind each 3D car.
 */
export function createCarAuraTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1.65, 0.94);
  const grad = ctx.createRadialGradient(0, 10, 10, 0, 10, 148);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  grad.addColorStop(0.32, "rgba(255, 255, 255, 0.48)");
  grad.addColorStop(0.68, "rgba(255, 255, 255, 0.14)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 10, 148, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Fibrous multi-wisp billowing vapor cloud textures for rich diagonal wind-blown steam trails.
 */
export function createSmokeVariantTextures(): THREE.CanvasTexture[] {
  const configs: [number, number, number, number][][] = [
    [
      [0.46, 0.54, 0.3, 0.46],
      [0.34, 0.44, 0.21, 0.38],
      [0.62, 0.39, 0.22, 0.38],
      [0.52, 0.27, 0.17, 0.32],
      [0.39, 0.65, 0.17, 0.28],
      [0.69, 0.56, 0.15, 0.26],
      [0.48, 0.46, 0.13, 0.44],
      [0.27, 0.53, 0.11, 0.24],
      [0.58, 0.48, 0.11, 0.36],
      [0.42, 0.34, 0.12, 0.3],
    ],
    [
      [0.52, 0.49, 0.28, 0.46],
      [0.37, 0.34, 0.21, 0.38],
      [0.64, 0.55, 0.21, 0.36],
      [0.44, 0.67, 0.17, 0.3],
      [0.6, 0.28, 0.17, 0.32],
      [0.29, 0.55, 0.14, 0.26],
      [0.53, 0.43, 0.12, 0.44],
      [0.72, 0.4, 0.11, 0.24],
      [0.42, 0.5, 0.11, 0.34],
      [0.56, 0.6, 0.12, 0.28],
    ],
    [
      [0.47, 0.47, 0.28, 0.44],
      [0.62, 0.43, 0.22, 0.38],
      [0.36, 0.58, 0.2, 0.36],
      [0.5, 0.26, 0.18, 0.32],
      [0.3, 0.39, 0.15, 0.28],
      [0.68, 0.62, 0.14, 0.26],
      [0.52, 0.5, 0.11, 0.42],
      [0.41, 0.34, 0.11, 0.3],
      [0.6, 0.32, 0.1, 0.28],
      [0.34, 0.49, 0.11, 0.32],
    ],
  ];

  return configs.map((lobes) => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);

    for (const [cx, cy, r, peakAlpha] of lobes) {
      const px = cx * size;
      const py = cy * size;
      const pr = r * size;
      const g = ctx.createRadialGradient(px, py, pr * 0.04, px, py, pr);
      g.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.56, peakAlpha * 0.92)})`);
      g.addColorStop(0.35, `rgba(255, 248, 236, ${Math.min(0.36, peakAlpha * 0.62)})`);
      g.addColorStop(0.7, `rgba(232, 242, 255, ${peakAlpha * 0.16})`);
      g.addColorStop(1, "rgba(210, 230, 255, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/**
 * Razor-crisp horizontal golden spark needle texture for the coupler energy jet.
 */
export function createSparkStreakTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 32;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);

  const cy = h * 0.5;
  const streakGrad = ctx.createLinearGradient(0, cy, w, cy);
  streakGrad.addColorStop(0, "rgba(255, 190, 50, 0)");
  streakGrad.addColorStop(0.45, "rgba(255, 224, 130, 0.94)");
  streakGrad.addColorStop(0.82, "rgba(255, 254, 246, 1)");
  streakGrad.addColorStop(1, "rgba(255, 210, 90, 0)");
  ctx.fillStyle = streakGrad;
  ctx.beginPath();
  ctx.ellipse(w * 0.55, cy, w * 0.44, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  const tip = ctx.createRadialGradient(w * 0.82, cy, 0.5, w * 0.82, cy, 9);
  tip.addColorStop(0, "rgba(255, 255, 255, 1)");
  tip.addColorStop(0.36, "rgba(255, 226, 130, 0.8)");
  tip.addColorStop(1, "rgba(255, 180, 30, 0)");
  ctx.fillStyle = tip;
  ctx.beginPath();
  ctx.arc(w * 0.82, cy, 9, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Fine delicate concentric golden energy rings pulsing behind the active golden car
 * matching the thin multi-ring orbital motif in the mockup.
 */
export function createPulseRingTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  const c = size / 2;
  const grad = ctx.createRadialGradient(c, c, 12, c, c, c);
  grad.addColorStop(0, "rgba(255, 212, 92, 0.28)");
  grad.addColorStop(0.38, "rgba(255, 184, 48, 0.11)");
  grad.addColorStop(0.75, "rgba(255, 165, 20, 0.035)");
  grad.addColorStop(1, "rgba(255, 160, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  for (const [r, alpha, lw] of [
    [size * 0.2, 0.42, 1.4],
    [size * 0.26, 0.34, 1.2],
    [size * 0.32, 0.25, 1.1],
    [size * 0.38, 0.18, 1.0],
    [size * 0.44, 0.12, 0.9],
    [size * 0.485, 0.07, 0.8],
  ]) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 224, 140, ${alpha})`;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Vertical translucent glass-refraction light-curtain pier placed STRICTLY UNDER
 * the curved glass viaduct deck (zero spikes protruding above the rails!).
 */
export function createLightPillarTexture(): THREE.CanvasTexture {
  const w = 160;
  const h = 384;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);

  // Soft wide glass curtain band with crisp bright core and subtle refraction edges
  const horiz = ctx.createLinearGradient(0, 0, w, 0);
  horiz.addColorStop(0, "rgba(79, 70, 229, 0)");
  horiz.addColorStop(0.18, "rgba(79, 118, 240, 0.16)");
  horiz.addColorStop(0.4, "rgba(129, 166, 250, 0.44)");
  horiz.addColorStop(0.5, "rgba(224, 242, 254, 0.72)");
  horiz.addColorStop(0.6, "rgba(129, 166, 250, 0.44)");
  horiz.addColorStop(0.82, "rgba(79, 118, 240, 0.16)");
  horiz.addColorStop(1, "rgba(79, 70, 229, 0)");
  ctx.fillStyle = horiz;
  ctx.fillRect(0, 0, w, h);

  for (const offset of [-18, -5, 5, 18]) {
    const x = w * 0.5 + offset;
    const g = ctx.createLinearGradient(x - 4, 0, x + 4, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(
      0.5,
      Math.abs(offset) < 8 ? "rgba(239,246,255,0.62)" : "rgba(165,180,252,0.34)",
    );
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 4, 0, 8, h);
  }

  ctx.globalCompositeOperation = "destination-in";
  const vert = ctx.createLinearGradient(0, 0, 0, h);
  vert.addColorStop(0, "rgba(0,0,0,0)");
  vert.addColorStop(0.05, "rgba(0,0,0,0.96)");
  vert.addColorStop(0.24, "rgba(0,0,0,0.82)");
  vert.addColorStop(0.58, "rgba(0,0,0,0.38)");
  vert.addColorStop(0.86, "rgba(0,0,0,0.08)");
  vert.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vert;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Wide curved sapphire-indigo multi-lane optical glass highway ribbon texture.
 */
export function createViaductDeckTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "rgba(37, 99, 235, 0.16)");
  base.addColorStop(0.12, "rgba(67, 97, 238, 0.68)");
  base.addColorStop(0.5, "rgba(19, 36, 112, 0.78)");
  base.addColorStop(0.88, "rgba(79, 128, 255, 0.72)");
  base.addColorStop(1, "rgba(37, 99, 235, 0.18)");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Subtle translucent glass deck segments
  ctx.strokeStyle = "rgba(165, 200, 255, 0.2)";
  ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.06);
    ctx.lineTo(x + 22, h * 0.94);
    ctx.stroke();
  }

  // Vivid glowing multi-lane fiber-optic highway tracks spanning the full glass bridge width
  const lanes: [number, number, string][] = [
    [0.05, 3.0, "rgba(224, 242, 254, 0.98)"],
    [0.16, 1.9, "rgba(165, 180, 252, 0.88)"],
    [0.29, 2.0, "rgba(96, 165, 250, 0.86)"],
    [0.42, 1.7, "rgba(191, 219, 254, 0.8)"],
    [0.56, 1.8, "rgba(139, 92, 246, 0.84)"],
    [0.69, 2.0, "rgba(96, 165, 250, 0.88)"],
    [0.82, 2.1, "rgba(196, 181, 253, 0.9)"],
    [0.95, 3.2, "rgba(239, 246, 255, 1.0)"],
  ];
  for (const [ly, thickness, col] of lanes) {
    const y = ly * h;
    const g = ctx.createLinearGradient(0, y - thickness * 3.5, 0, y + thickness * 3.5);
    g.addColorStop(0, "rgba(99, 102, 241, 0)");
    g.addColorStop(0.5, col);
    g.addColorStop(1, "rgba(99, 102, 241, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - thickness * 3.5, w, thickness * 7);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(5, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Cosmic violet-indigo-magenta twilight wash in the upper-right sky.
 */
export function createNebulaBackdropTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  const g1 = ctx.createRadialGradient(
    size * 0.54,
    size * 0.46,
    8,
    size * 0.54,
    size * 0.46,
    size * 0.48,
  );
  g1.addColorStop(0, "rgba(168, 85, 247, 0.54)");
  g1.addColorStop(0.35, "rgba(99, 102, 241, 0.3)");
  g1.addColorStop(0.72, "rgba(30, 58, 138, 0.08)");
  g1.addColorStop(1, "rgba(2, 6, 20, 0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Faint midnight-blue perspective floor grid beneath the bridge.
 */
export function createFloorGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#020614";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(46, 82, 152, 0.24)";
  ctx.lineWidth = 1.5;
  const step = 64;
  for (let p = 0; p <= size; p += step) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Hero-scale 1024x512 Glass Car Stage Badge matching mockup proportions:
 * - Bold large circle icon + stage label spanning ~76% of the interior glass pane
 * - Soft luminous lower-sill glow + micro-stardust specks inside Active & Done cars
 * - Subtle diagonal specular glass sheen across the panel (zero rectangular borders)
 */
export function drawCarBadgeCanvas(
  canvas: HTMLCanvasElement,
  label: string,
  status: StageStatus,
  variant: "nose" | "body" | "tail",
): void {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const palette = STAGE_COLORS[status];
  const scale = w / 1024;

  ctx.clearRect(0, 0, w, h);

  // 1. Subtle diagonal specular glass sheen across the upper glass pane
  ctx.save();
  const sheen = ctx.createLinearGradient(w * 0.08, 0, w * 0.66, h * 0.92);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0)");
  sheen.addColorStop(0.24, "rgba(255, 255, 255, 0.075)");
  sheen.addColorStop(0.46, "rgba(255, 255, 255, 0.018)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 2. Luminous lower-edge bloom + delicate micro-sparkle particles matching mockup
  ctx.save();
  ctx.translate(w * 0.5, h * 0.9);
  ctx.scale(2.45, 0.78);
  const softGlow = ctx.createRadialGradient(0, 0, 12, 0, 0, h * 0.58);
  if (status === "active") {
    softGlow.addColorStop(0, "rgba(255, 224, 118, 0.82)");
    softGlow.addColorStop(0.42, "rgba(255, 180, 34, 0.38)");
    softGlow.addColorStop(1, "rgba(255, 168, 22, 0)");
  } else if (status === "done") {
    softGlow.addColorStop(0, "rgba(42, 245, 168, 0.64)");
    softGlow.addColorStop(0.45, "rgba(16, 210, 132, 0.26)");
    softGlow.addColorStop(1, "rgba(16, 200, 128, 0)");
  } else {
    softGlow.addColorStop(0, "rgba(86, 138, 238, 0.22)");
    softGlow.addColorStop(0.55, "rgba(28, 56, 124, 0.07)");
    softGlow.addColorStop(1, "rgba(24, 50, 112, 0)");
  }
  ctx.fillStyle = softGlow;
  ctx.beginPath();
  ctx.arc(0, 0, h * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (status === "active" || status === "done") {
    ctx.save();
    for (let i = 0; i < 46; i++) {
      const sx = w * (0.08 + ((i * 73) % 84) / 100);
      const sy = h * (0.56 + ((i * 37) % 38) / 100);
      const r = (1.2 + (i % 3) * 0.9) * scale;
      ctx.fillStyle =
        status === "active"
          ? `rgba(255, 246, 206, ${0.42 + (i % 4) * 0.16})`
          : `rgba(196, 255, 232, ${0.34 + (i % 4) * 0.14})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. Mockup-Matched Hero Stage Icon Circle + Typography
  const radius = 78 * scale;
  const cx =
    variant === "nose"
      ? w * 0.23
      : variant === "tail"
        ? w * 0.22
        : w * 0.21;
  const cy = h * 0.5;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle =
    status === "active"
      ? "rgba(154, 92, 10, 0.46)"
      : status === "done"
        ? "rgba(8, 82, 52, 0.42)"
        : "rgba(12, 24, 56, 0.34)";
  ctx.fill();
  ctx.strokeStyle =
    status === "pending" ? "rgba(218, 234, 255, 0.84)" : "#ffffff";
  ctx.lineWidth = (status === "pending" ? 3.8 : 4.8) * scale;
  if (status === "pending") {
    ctx.setLineDash([4.5 * scale, 8.5 * scale]);
  }
  ctx.shadowColor = `rgba(${palette.rgba}, 0.95)`;
  ctx.shadowBlur = (status === "pending" ? 6 : 16) * scale;
  ctx.stroke();
  ctx.restore();

  // Icon glyph inside circle
  ctx.save();
  ctx.strokeStyle = status === "pending" ? "#eef4ff" : "#ffffff";
  ctx.fillStyle = status === "pending" ? "#eef4ff" : "#ffffff";
  ctx.lineWidth = 7.4 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (status === "done") {
    ctx.beginPath();
    ctx.moveTo(cx - 26 * scale, cy + 4 * scale);
    ctx.lineTo(cx - 5 * scale, cy + 23 * scale);
    ctx.lineTo(cx + 29 * scale, cy - 21 * scale);
    ctx.stroke();
  } else if (status === "active") {
    ctx.lineWidth = 5.4 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 15 * scale, cy - 29 * scale);
    ctx.lineTo(cx + 15 * scale, cy - 29 * scale);
    ctx.moveTo(cx - 7.5 * scale, cy - 29 * scale);
    ctx.lineTo(cx - 7.5 * scale, cy - 8 * scale);
    ctx.lineTo(cx - 29 * scale, cy + 23 * scale);
    ctx.quadraticCurveTo(
      cx - 31 * scale,
      cy + 31 * scale,
      cx - 20 * scale,
      cy + 31 * scale,
    );
    ctx.lineTo(cx + 20 * scale, cy + 31 * scale);
    ctx.quadraticCurveTo(
      cx + 31 * scale,
      cy + 31 * scale,
      cx + 29 * scale,
      cy + 23 * scale,
    );
    ctx.lineTo(cx + 7.5 * scale, cy - 8 * scale);
    ctx.lineTo(cx + 7.5 * scale, cy - 29 * scale);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 15 * scale, cy + 5 * scale);
    ctx.lineTo(cx + 15 * scale, cy + 5 * scale);
    ctx.lineTo(cx + 24 * scale, cy + 23 * scale);
    ctx.quadraticCurveTo(
      cx + 24 * scale,
      cy + 28 * scale,
      cx + 18 * scale,
      cy + 28 * scale,
    );
    ctx.lineTo(cx - 18 * scale, cy + 28 * scale);
    ctx.quadraticCurveTo(
      cx - 24 * scale,
      cy + 28 * scale,
      cx - 24 * scale,
      cy + 23 * scale,
    );
    ctx.closePath();
    ctx.fill();
  } else {
    for (const dx of [-20 * scale, 0, 20 * scale]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy, 5.4 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Stage Label Typography matching mockup scale & clarity across all 5 cars
  ctx.save();
  ctx.fillStyle = status === "pending" ? "#e6efff" : "#ffffff";
  const fontSize = label.length >= 11 ? 88 : label.length >= 9 ? 94 : 102;
  ctx.font = `600 ${Math.round(fontSize * scale)}px 'Plus Jakarta Sans', 'Inter', sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.shadowColor =
    status === "active"
      ? "rgba(255, 198, 64, 0.92)"
      : status === "done"
        ? "rgba(34, 245, 157, 0.84)"
        : "rgba(110, 172, 255, 0.52)";
  ctx.shadowBlur = (status === "pending" ? 7 : 13) * scale;
  ctx.fillText(label, cx + 102 * scale, cy + 3 * scale);
  ctx.restore();
}
