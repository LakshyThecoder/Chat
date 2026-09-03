import fs from "node:fs";
import path from "node:path";

const transcript =
  "C:/Users/Lakshy/.cursor/projects/f-Lumera-Group-LLC-Prodcut-For-ChatGPT-Hackathon-Aegis/agent-transcripts/8044edf9-6b54-4782-85c0-cbe6e3046a92/8044edf9-6b54-4782-85c0-cbe6e3046a92.jsonl";
const root = "F:/(Lumera Group LLC)/Prodcut For ChatGPT Hackathon/Aegis";

const lines = fs.readFileSync(transcript, "utf8").split(/\n/).filter(Boolean);
let applied = 0;
let missed = 0;

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
    if (part?.type !== "tool_use" || part?.name !== "StrReplace") continue;
    const p = part.input?.path;
    const oldStr = part.input?.old_string;
    const newStr = part.input?.new_string;
    if (typeof p !== "string" || typeof oldStr !== "string" || typeof newStr !== "string") {
      continue;
    }
    const normalized = p.replace(/\\/g, "/");
    const idx = normalized.toLowerCase().lastIndexOf("/src/");
    if (idx < 0) continue;
    const rel = normalized.slice(idx + 1);
    const dest = path.join(root, rel);
    if (!fs.existsSync(dest)) {
      missed += 1;
      console.log("missing file for patch", rel);
      continue;
    }
    const current = fs.readFileSync(dest, "utf8");
    if (!current.includes(oldStr)) {
      // already applied or diverged
      continue;
    }
    const replaceAll = Boolean(part.input?.replace_all);
    const next = replaceAll
      ? current.split(oldStr).join(newStr)
      : current.replace(oldStr, newStr);
    fs.writeFileSync(dest, next, "utf8");
    applied += 1;
    console.log("patched", rel);
  }
}

console.log({ applied, missed });
