import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { discoverSpoketomeFiles } from "./discovery.js";
import { initNotionClient, fetchPage } from "./notion-client.js";
import { ensureOutputDir, writeMarkdownFile } from "./filesystem.js";
import { buildContextFile, writeContextFile } from "./context.js";
import type { CliOptions, PulledPage } from "./types.js";
import { readFile } from "node:fs/promises";

async function getVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf-8"),
    );
    return pkg.version ?? "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function parseCliArgs(): CliOptions {
  const { values } = parseArgs({
    options: {
      verbose: { type: "boolean", short: "v", default: false },
      quiet: { type: "boolean", short: "q", default: false },
      "dry-run": { type: "boolean", default: false },
      dir: { type: "string", short: "d", default: "." },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });

  if (values.help) {
    console.log(`Usage: spoketome [options]

Options:
  -d, --dir <path>   Base directory to search (default: ".")
  -v, --verbose       Show detailed output
  -q, --quiet         Suppress non-error output
      --dry-run       Show what would be done without writing files
  -h, --help          Show this help message`);
    process.exit(0);
  }

  return {
    verbose: values.verbose as boolean,
    quiet: values.quiet as boolean,
    dryRun: values["dry-run"] as boolean,
    dir: values.dir as string,
  };
}

function log(opts: CliOptions, ...args: unknown[]): void {
  if (!opts.quiet) console.log(...args);
}

export async function run(): Promise<void> {
  const opts = parseCliArgs();
  const version = await getVersion();
  const rootDir = resolve(opts.dir);

  // 1. Validate NOTION_TOKEN
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error(
      "Error: NOTION_TOKEN environment variable is required.\n" +
        "Create an integration at https://www.notion.so/my-integrations and set the token.",
    );
    process.exit(1);
  }

  initNotionClient(token);

  // 2. Discover .spoketome files
  log(opts, `Searching for .spoketome files in ${rootDir}...`);
  const spoketomeFiles = await discoverSpoketomeFiles(rootDir, opts.verbose);

  if (spoketomeFiles.length === 0) {
    log(opts, "No .spoketome files found.");
    process.exit(0);
  }

  log(
    opts,
    `Found ${spoketomeFiles.length} .spoketome file(s) with ${spoketomeFiles.reduce((sum, f) => sum + f.entries.length, 0)} page(s) total.`,
  );

  // 3. Process each file
  let totalSuccess = 0;
  let totalFailed = 0;

  for (const file of spoketomeFiles) {
    log(opts, `\nProcessing ${file.filePath}`);

    if (opts.dryRun) {
      for (const entry of file.entries) {
        log(opts, `  Would pull: ${entry.notionUrl}`);
      }
      continue;
    }

    const outputDir = await ensureOutputDir(file.dirPath);
    const existingFiles = new Set<string>();
    const pulledPages: { pulled: PulledPage; writtenFilename: string }[] = [];

    for (const entry of file.entries) {
      try {
        if (opts.verbose) {
          log(opts, `  Pulling ${entry.notionUrl}...`);
        }

        const pulled = await fetchPage(entry.pageId, entry.notionUrl);

        const writtenFilename = await writeMarkdownFile(
          outputDir,
          pulled.sanitizedFilename,
          pulled.markdown,
          existingFiles,
        );

        pulledPages.push({ pulled, writtenFilename });
        log(opts, `  ✓ ${pulled.title} → spoketome/${writtenFilename}`);
        totalSuccess++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ Failed to pull ${entry.notionUrl}: ${msg}`);
        totalFailed++;
      }
    }

    // Write context.yaml
    if (pulledPages.length > 0) {
      const ctx = buildContextFile(pulledPages, version);
      await writeContextFile(outputDir, ctx);
      if (opts.verbose) {
        log(opts, `  Wrote context.yaml`);
      }
    }
  }

  // 4. Summary
  if (!opts.dryRun) {
    log(opts, `\nDone: ${totalSuccess} page(s) pulled, ${totalFailed} failed.`);
  }

  if (totalFailed > 0) {
    process.exit(1);
  }
}
