import fs from "node:fs";
import path from "node:path";

const transcript =
  "C:/Users/Lakshy/.cursor/projects/f-Lumera-Group-LLC-Prodcut-For-ChatGPT-Hackathon-Aegis/agent-transcripts/8044edf9-6b54-4782-85c0-cbe6e3046a92/8044edf9-6b54-4782-85c0-cbe6e3046a92.jsonl";
const root = "F:/(Lumera Group LLC)/Prodcut For ChatGPT Hackathon/Aegis";

const lines = fs.readFileSync(transcript, "utf8").split(/\n/).filter(Boolean);
/** @type {Map<string, string>} */
const files = new Map();

for (const line of lines) {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  const content = obj?.message?.content;
  if (!Array.isArray(content)) continue;
  for (const part of content) {
    if (part?.type !== "tool_use" || part?.name !== "Write") continue;
    const p = part.input?.path;
    const contents = part.input?.contents;
    if (typeof p !== "string" || typeof contents !== "string") continue;
    // Keep last write for each path
    const normalized = p.replace(/\\/g, "/");
    if (
      normalized.includes("/src/") ||
      normalized.endsWith("/src") ||
      /[/\\]src[/\\]/.test(p) ||
      normalized.includes("Aegis/src/") ||
      /\\src\\/.test(p)
    ) {
      files.set(normalized, contents);
    }
  }
}

let restored = 0;
for (const [p, contents] of files) {
  // Resolve to workspace-relative src path
  let rel = p;
  const idx = rel.toLowerCase().lastIndexOf("/src/");
  if (idx >= 0) {
    rel = rel.slice(idx + 1); // src/...
  } else {
    continue;
  }
  const dest = path.join(root, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents, "utf8");
  restored += 1;
  console.log("restored", rel);
}

console.log("total", restored);
