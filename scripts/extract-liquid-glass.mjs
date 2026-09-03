import fs from "node:fs";

const ui = fs.readFileSync("UI", "utf8");
const start = ui.indexOf("type LiquidGlassLayerProps");
const end = ui.indexOf("File location: components/ui/cloud-shader.tsx");
if (start < 0 || end < 0) {
  throw new Error("Could not locate LiquidGlass block in UI");
}
const body = ui
  .slice(start, end)
  .trim()
  .replace("const LiquidGlassLayer =", "export const LiquidGlassLayer =");

const out = `"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

${body}
`;

fs.writeFileSync("components/ui/liquid-glass.tsx", out);
console.log("wrote components/ui/liquid-glass.tsx", out.length);
