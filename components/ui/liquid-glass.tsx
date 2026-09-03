"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

type LiquidGlassLayerProps = {
  className?: string;
  /** Corner radius in px. */
  radius?: number;
  /** Rim band that bends light, in px. */
  bevelDepth?: number;
  /** Displacement strength in px. */
  scale?: number;
  /** Chromatic aberration spread in px. */
  aberration?: number;
  /** Extra blur after refraction, in px. */
  frost?: number;
  /** White body tint 0–1. */
  tint?: number;
};

function supportsUrlBackdropFilter(): boolean {
  if (typeof CSS === "undefined" || !CSS.supports) return false;
  return (
    CSS.supports("backdrop-filter", "url(#x)") ||
    CSS.supports("-webkit-backdrop-filter", "url(#x)")
  );
}

function prefersReducedTransparency(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
}

function isSafariLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
}

/** Signed distance to a rounded box centred at the origin. <0 inside. */
function sdRoundedBox(
  px: number,
  py: number,
  halfW: number,
  halfH: number,
  r: number,
): number {
  const qx = Math.abs(px) - halfW + r;
  const qy = Math.abs(py) - halfH + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return inside + outside - r;
}

/**
 * Squircle-dome slope → Snell's-law bend.
 * `x` is depth in from the rim (0 = edge, 1 = flat centre).
 */
function bendFromDepth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  const u = 1 - t;
  const denom = (1 - u ** 4) ** 0.75;
  if (denom < 1e-6) return 0;
  const slope = Math.min(u ** 3 / denom, 8);
  const thetaI = Math.atan(slope);
  const sinT = Math.sin(thetaI) / 1.5;
  if (sinT >= 1) return Math.sin(thetaI);
  return Math.sin(thetaI - Math.asin(sinT));
}

/** Precompute φ(d) = ∫ bend along distance-from-rim. */
function buildPhiTable(bevelPx: number): Float32Array {
  const n = Math.max(1, Math.ceil(bevelPx));
  const phi = new Float32Array(n + 1);
  for (let d = 1; d <= n; d++) {
    phi[d] = (phi[d - 1] ?? 0) + bendFromDepth(d / n);
  }
  return phi;
}

function samplePhi(phi: Float32Array, depth: number): number {
  if (depth <= 0) return phi[0] ?? 0;
  const max = phi.length - 1;
  if (depth >= max) return phi[max] ?? 0;
  const i = Math.floor(depth);
  const f = depth - i;
  return (phi[i] ?? 0) * (1 - f) + (phi[i + 1] ?? 0) * f;
}

/**
 * R = horizontal bend, G = vertical bend, B = rim specular, A = shape mask.
 * Neutral grey (128) means zero displacement.
 */
function computeDisplacementData(opts: {
  width: number;
  height: number;
  radius: number;
  bevelDepth: number;
  dpr?: number;
}) {
  const dpr = opts.dpr ?? 1;
  const gain = 1.35;
  const light = { x: -0.55, y: -0.85 };
  const lightLen = Math.hypot(light.x, light.y) || 1;
  const lx = light.x / lightLen;
  const ly = light.y / lightLen;

  const W = Math.max(1, Math.round(opts.width * dpr));
  const H = Math.max(1, Math.round(opts.height * dpr));
  const halfW = W / 2;
  const halfH = H / 2;
  const r = Math.min(opts.radius * dpr, halfW, halfH);
  const bevel = Math.max(1, opts.bevelDepth * dpr);
  const phi = buildPhiTable(bevel);

  const field = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const py = y - halfH + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x - halfW + 0.5;
      const d = sdRoundedBox(px, py, halfW, halfH, r);
      const idx = y * W + x;
      field[idx] = d > 0 ? 0 : samplePhi(phi, Math.min(bevel, -d));
    }
  }

  const data = new Uint8ClampedArray(W * H * 4);
  const EPS = 1;

  for (let y = 0; y < H; y++) {
    const py = y - halfH + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x - halfW + 0.5;
      const i = (y * W + x) << 2;
      const d = sdRoundedBox(px, py, halfW, halfH, r);

      if (d > 0) {
        data[i] = 128;
        data[i + 1] = 128;
        data[i + 2] = 128;
        data[i + 3] = 0;
        continue;
      }

      const x0 = Math.max(0, x - EPS);
      const x1 = Math.min(W - 1, x + EPS);
      const y0 = Math.max(0, y - EPS);
      const y1 = Math.min(H - 1, y + EPS);
      const dPhiX =
        ((field[y * W + x1] ?? 0) - (field[y * W + x0] ?? 0)) / (x1 - x0 || 1);
      const dPhiY =
        ((field[y1 * W + x] ?? 0) - (field[y0 * W + x] ?? 0)) / (y1 - y0 || 1);

      const dx = Math.max(-1, Math.min(1, dPhiX * gain));
      const dy = Math.max(-1, Math.min(1, dPhiY * gain));

      let specular = 0;
      if (d >= -bevel) {
        const gx =
          sdRoundedBox(px + EPS, py, halfW, halfH, r) -
          sdRoundedBox(px - EPS, py, halfW, halfH, r);
        const gy =
          sdRoundedBox(px, py + EPS, halfW, halfH, r) -
          sdRoundedBox(px, py - EPS, halfW, halfH, r);
        const len = Math.hypot(gx, gy) || 1;
        const nx = gx / len;
        const ny = gy / len;
        const facing = Math.max(0, nx * lx + ny * ly);
        const opposite = Math.max(0, -(nx * lx + ny * ly)) * 0.35;
        const rim = 1 - Math.min(1, -d / bevel);
        specular = (facing + opposite) * rim;
      }

      data[i] = 128 + dx * 127;
      data[i + 1] = 128 + dy * 127;
      data[i + 2] = Math.round(specular * 255);
      data[i + 3] = 255;
    }
  }

  return { data, width: W, height: H };
}

/** PNG blob URL for feImage (WebKit rejects data: URIs inside feImage). */
async function generateDisplacementBlobUrl(opts: {
  width: number;
  height: number;
  radius: number;
  bevelDepth: number;
  dpr?: number;
}): Promise<string> {
  const { data, width, height } = computeDisplacementData(opts);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.putImageData(new ImageData(data, width, height), 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Failed to encode displacement map");
  return URL.createObjectURL(blob);
}

/** Inner `<filter>…</filter>` markup — optics via feDisplacementMap. */
function buildFilterSvg(opts: {
  id: string;
  mapUrl: string;
  width: number;
  height: number;
  scale: number;
  aberration: number;
  frost: number;
}): string {
  const { id, mapUrl, width, height, scale, aberration, frost } = opts;

  const pad = Math.ceil(scale + aberration + 4);
  const px = ((pad / Math.max(1, width)) * 100).toFixed(3);
  const py = ((pad / Math.max(1, height)) * 100).toFixed(3);
  const w = (100 + 2 * Number(px)).toFixed(3);
  const h = (100 + 2 * Number(py)).toFixed(3);

  const map = `<feImage href="${mapUrl}" xlink:href="${mapUrl}" x="0" y="0" width="${width}" height="${height}" result="map" preserveAspectRatio="none"/>`;

  let filter: string;
  if (aberration <= 0) {
    const blur =
      frost > 0
        ? `\n  <feGaussianBlur in="disp" stdDeviation="${frost}"/>`
        : "";
    filter = `<filter id="${id}" color-interpolation-filters="sRGB" x="-${px}%" y="-${py}%" width="${w}%" height="${h}%">
  ${map}
  <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G"${frost > 0 ? ` result="disp"` : ""}/>${blur}
</filter>`;
  } else {
    const sR = scale + aberration;
    const sG = scale;
    const sB = Math.max(0, scale - aberration);
    filter = `<filter id="${id}" color-interpolation-filters="sRGB" x="-${px}%" y="-${py}%" width="${w}%" height="${h}%">
  ${map}
  <feDisplacementMap in="SourceGraphic" in2="map" scale="${sR}" xChannelSelector="R" yChannelSelector="G" result="dispR"/>
  <feColorMatrix in="dispR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
  <feDisplacementMap in="SourceGraphic" in2="map" scale="${sG}" xChannelSelector="R" yChannelSelector="G" result="dispG"/>
  <feColorMatrix in="dispG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
  <feDisplacementMap in="SourceGraphic" in2="map" scale="${sB}" xChannelSelector="R" yChannelSelector="G" result="dispB"/>
  <feColorMatrix in="dispB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
  <feBlend in="red" in2="green" mode="screen" result="rg"/>
  <feBlend in="rg" in2="blue" mode="screen" result="rgb"/>
  <feGaussianBlur in="rgb" stdDeviation="${frost}"/>
</filter>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${filter}</svg>`;
}

/** Full-bleed liquid glass pane. It refracts what is painted below it. */
export const LiquidGlassLayer = ({
  className,
  radius = 0,
  bevelDepth = 56,
  scale = 90,
  aberration = 5,
  frost = 0.2,
  tint = 0.04,
}: LiquidGlassLayerProps) => {
  const reactId = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const blobRef = useRef<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [filterSvg, setFilterSvg] = useState("");
  const [filterId, setFilterId] = useState("");
  const [refract, setRefract] = useState(false);
  const [simpleGlass, setSimpleGlass] = useState(false);

  useEffect(() => {
    setSimpleGlass(isSafariLike() || prefersReducedTransparency());
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || simpleGlass) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.borderBoxSize?.[0];
      const width = box?.inlineSize ?? entry.contentRect.width;
      const height = box?.blockSize ?? entry.contentRect.height;
      setSize({
        w: Math.max(1, Math.round(width)),
        h: Math.max(1, Math.round(height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [simpleGlass]);

  useEffect(() => {
    let cancelled = false;

    async function build() {
      if (
        simpleGlass ||
        size.w <= 0 ||
        size.h <= 0 ||
        !supportsUrlBackdropFilter() ||
        prefersReducedTransparency()
      ) {
        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current);
          blobRef.current = null;
        }
        if (!cancelled) {
          setFilterSvg("");
          setFilterId("");
          setRefract(false);
        }
        return;
      }

      const r = Math.min(radius, size.w / 2, size.h / 2);
      const mapUrl = await generateDisplacementBlobUrl({
        width: size.w,
        height: size.h,
        radius: r,
        bevelDepth: Math.min(bevelDepth, Math.min(size.w, size.h) / 2),
        dpr: 1,
      });

      if (cancelled) {
        URL.revokeObjectURL(mapUrl);
        return;
      }

      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      blobRef.current = mapUrl;

      const id = `lg-${reactId}-${size.w}x${size.h}-${Date.now().toString(36)}`;
      const svg = buildFilterSvg({
        id,
        mapUrl,
        width: size.w,
        height: size.h,
        scale,
        aberration,
        frost,
      });

      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = mapUrl;
      });

      if (cancelled) return;
      setFilterId(id);
      setFilterSvg(svg);
      setRefract(true);
    }

    void build();
    return () => {
      cancelled = true;
    };
  }, [
    simpleGlass,
    size.w,
    size.h,
    radius,
    bevelDepth,
    scale,
    aberration,
    frost,
    reactId,
  ]);

  useEffect(() => {
    return () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, []);

  const backdropFilter = refract
    ? `url(#${filterId}) saturate(1.5)`
    : simpleGlass
      ? "blur(8px) saturate(1.4)"
      : "blur(10px) saturate(1.6) brightness(1.04)";

  const style: CSSProperties = {
    borderRadius: radius,
    background: `rgb(255 255 255 / ${simpleGlass ? 0.16 : tint})`,
    backdropFilter,
    WebkitBackdropFilter: backdropFilter,
  };

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`pointer-events-none overflow-hidden ${className ?? ""}`}
      style={style}
    >
      {filterSvg ? (
        <span
          key={filterId}
          className="pointer-events-none absolute size-0 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: filterSvg }}
        />
      ) : null}
    </div>
  );
};
