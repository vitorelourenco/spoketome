import { readdir, readFile, access } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { extractPageId } from "./notion-url.js";
import type { SpoketomeFile, SpoketomeEntry } from "./types.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "spoketome"]);
const ROOT_MARKER = ".spoketomeroot";
const SPOKETOME_FILE = ".spoketome";
const SPOKETOME_DEV_FILE = ".spoketome.dev";

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
  // Track directories that have a .spoketome or .spoketome.dev file
  const dirsWithFiles = new Map<
    string,
    { shared?: string; dev?: string }
  >();

  const entries = await readdir(rootDir, {
    withFileTypes: true,
    recursive: true,
  });

  for (const entry of entries) {
    if (entry.isDirectory()) continue;

    const parentPath = entry.parentPath ?? entry.path;
    const rel = relative(rootDir, parentPath);
    const relParts = rel ? rel.split("/") : [];
    if (relParts.some((part) => SKIP_DIRS.has(part))) continue;

    if (entry.name !== SPOKETOME_FILE && entry.name !== SPOKETOME_DEV_FILE)
      continue;

    const filePath = join(parentPath, entry.name);
    const dirPath = dirname(filePath);

    if (!dirsWithFiles.has(dirPath)) {
      dirsWithFiles.set(dirPath, {});
    }
    const record = dirsWithFiles.get(dirPath)!;
    if (entry.name === SPOKETOME_FILE) {
      record.shared = filePath;
    } else {
      record.dev = filePath;
    }
  }

  for (const [dirPath, files] of dirsWithFiles) {
    const outputDir = join(dirPath, "spoketome");
    const merged = await mergeEntries(files.shared, files.dev, verbose);

    if (merged.length > 0) {
      const label = files.shared ?? files.dev!;
      results.push({
        filePath: label,
        dirPath,
        outputDir,
        entries: merged,
      });
    }
  }

  return results;
}

/**
 * Merge entries from .spoketome and .spoketome.dev:
 * - .spoketome provides the shared base set
 * - .spoketome.dev plain URLs are added
 * - .spoketome.dev lines starting with ! exclude matching URLs from the shared set
 */
async function mergeEntries(
  sharedPath: string | undefined,
  devPath: string | undefined,
  verbose: boolean,
): Promise<SpoketomeEntry[]> {
  // Parse shared entries
  let shared: SpoketomeEntry[] = [];
  if (sharedPath) {
    const content = await readFile(sharedPath, "utf-8");
    shared = parseUrls(content, sharedPath, verbose);
  }

  if (!devPath) return shared;

  // Parse dev file — separate includes from excludes
  const devContent = await readFile(devPath, "utf-8");
  const includes: SpoketomeEntry[] = [];
  const excludeUrls = new Set<string>();

  for (const rawLine of devContent.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("!")) {
      const url = line.slice(1).trim();
      if (url) excludeUrls.add(url);
      continue;
    }

    const pageId = extractPageId(line);
    if (!pageId) {
      if (verbose) {
        console.warn(
          `  Warning: invalid Notion URL in ${devPath}: ${line}`,
        );
      }
      continue;
    }
    includes.push({ notionUrl: line, pageId });
  }

  // Apply excludes to shared, then append dev includes
  const filtered = shared.filter(
    (entry) => !excludeUrls.has(entry.notionUrl),
  );

  if (verbose && excludeUrls.size > 0) {
    const excluded = shared.length - filtered.length;
    if (excluded > 0) {
      console.log(
        `  ${devPath}: excluded ${excluded} URL(s) from shared config`,
      );
    }
  }

  // Dedupe by pageId — dev includes win over shared
  const seenIds = new Set(filtered.map((e) => e.pageId));
  for (const entry of includes) {
    if (!seenIds.has(entry.pageId)) {
      filtered.push(entry);
      seenIds.add(entry.pageId);
    }
  }

  return filtered;
}

function parseUrls(
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
