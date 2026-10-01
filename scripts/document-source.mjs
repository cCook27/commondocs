import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

const stripDocumentMarkers = (value) => value
  .replace(/^---\s*\n/, "")
  .replace(/\n---\s*(?:\n[\s\S]*)?$/, "")
  .trim();

export async function loadDocumentSource(repoRoot, sourceRel) {
  const sourcePath = path.resolve(repoRoot, sourceRel);
  const source = await fs.readFile(sourcePath, "utf8");
  const sourceFrontMatter = source.match(/^---\n([\s\S]*?)\n---\n/);
  const metadataCandidates = ["metadata.yaml", "metadata.yml", "metadata.md"];

  let metadataPath;
  let metadataSource;

  for (const filename of metadataCandidates) {
    const candidate = path.join(path.dirname(sourcePath), filename);
    try {
      metadataSource = await fs.readFile(candidate, "utf8");
      metadataPath = candidate;
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  if (!metadataSource && sourceFrontMatter) metadataSource = sourceFrontMatter[1];
  if (!metadataSource) {
    throw new Error(`Missing adjacent metadata.yaml for ${sourceRel}`);
  }

  const metadata = stripDocumentMarkers(metadataSource);
  const scalar = (key, fallback = "") => {
    const match = metadata.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match ? match[1].replace(/^["']|["']$/g, "") : fallback;
  };

  return {
    source,
    sourcePath,
    sourceSha256: hash(source),
    body: sourceFrontMatter ? source.slice(sourceFrontMatter[0].length) : source,
    metadataPath,
    metadataRel: metadataPath ? path.relative(repoRoot, metadataPath) : sourceRel,
    metadataSha256: hash(metadata),
    scalar,
  };
}
