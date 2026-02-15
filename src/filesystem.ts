import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

const MAX_FILENAME_LENGTH = 100;

export function sanitizeFilename(title: string): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_FILENAME_LENGTH);

  return (sanitized || "untitled") + ".md";
}

export async function ensureCleanOutputDir(dirPath: string): Promise<string> {
  const outputDir = join(dirPath, "spoketome");
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  return outputDir;
}

export async function writeMarkdownFile(
  outputDir: string,
  filename: string,
  content: string,
  existingFiles: Set<string>,
): Promise<string> {
  const base = filename.replace(/\.md$/, "");
  let candidate = filename;
  let suffix = 1;

  while (existingFiles.has(candidate)) {
    candidate = `${base}-${suffix}.md`;
    suffix++;
  }

  existingFiles.add(candidate);
  const filePath = join(outputDir, candidate);
  await writeFile(filePath, content, "utf-8");
  return candidate;
}
