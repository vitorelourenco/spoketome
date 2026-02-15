import { readdir, readFile, access } from "node:fs/promises";
import { join, dirname, relative, parse as parsePath } from "node:path";
import { extractPageId } from "./notion-url.js";
import type { SpoketomeFile, SpoketomeEntry } from "./types.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "spoketome"]);
const ROOT_MARKER = ".spoketomeroot";

/**
 * Walk up from startDir looking for a .spoketomeroot marker.
 * Returns the directory containing the marker, or startDir if none found.
 */
export async function findProjectRoot(
  startDir: string,
  verbose: boolean,
): Promise<string> {
  let dir = startDir;

  while (true) {
    try {
      await access(join(dir, ROOT_MARKER));
      if (verbose) {
        console.log(`Found ${ROOT_MARKER} in ${dir}`);
      }
      return dir;
    } catch {
      // No marker here, try parent
    }

    const parent = dirname(dir);
    if (parent === dir) {
      // Reached filesystem root without finding marker — stay at startDir
      if (verbose) {
        console.log(
          `No ${ROOT_MARKER} found, using ${startDir} as search root`,
        );
      }
      return startDir;
    }
    dir = parent;
  }
}

export async function discoverSpoketomeFiles(
  rootDir: string,
  verbose: boolean,
): Promise<SpoketomeFile[]> {
  const results: SpoketomeFile[] = [];

  const entries = await readdir(rootDir, {
    withFileTypes: true,
    recursive: true,
  });

  for (const entry of entries) {
    // Skip excluded directories
    if (entry.isDirectory()) continue;

    const parentPath = entry.parentPath ?? entry.path;
    // Use relative path from rootDir so the root itself is never skipped
    const rel = relative(rootDir, parentPath);
    const relParts = rel ? rel.split("/") : [];
    if (relParts.some((part) => SKIP_DIRS.has(part))) continue;

    if (entry.name !== ".spoketome") continue;

    const filePath = join(parentPath, entry.name);
    const dirPath = dirname(filePath);
    const outputDir = join(dirPath, "spoketome");

    const content = await readFile(filePath, "utf-8");
    const parsed = parseSpoketomeContent(content, filePath, verbose);

    if (parsed.length > 0) {
      results.push({ filePath, dirPath, outputDir, entries: parsed });
    }
  }

  return results;
}

function parseSpoketomeContent(
  content: string,
  filePath: string,
  verbose: boolean,
): SpoketomeEntry[] {
  const entries: SpoketomeEntry[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const pageId = extractPageId(line);
    if (!pageId) {
      if (verbose) {
        console.warn(`  Warning: invalid Notion URL in ${filePath}: ${line}`);
      }
      continue;
    }

    entries.push({ notionUrl: line, pageId });
  }

  return entries;
}
