import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ContextFile,
  ContextEntry,
  PulledPage,
  PropertyValue,
} from "./types.js";

const CONTEXT_FILENAME = "context.yaml";

function escapeYamlString(s: string): string {
  if (
    s.includes(":") ||
    s.includes("#") ||
    s.includes('"') ||
    s.includes("'") ||
    s.startsWith(" ") ||
    s.endsWith(" ")
  ) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return `"${s}"`;
}

function escapeYamlKey(key: string): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) return key;
  return escapeYamlString(key);
}

function serializePropertyValue(val: PropertyValue): string {
  if (val === null) return "null";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return escapeYamlString(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    return `[${val.map((v) => escapeYamlString(String(v))).join(", ")}]`;
  }
  return escapeYamlString(String(val));
}

function serializeContextFile(ctx: ContextFile): string {
  const lines: string[] = [
    `version: ${ctx.version}`,
    `generatedBy: ${escapeYamlString(ctx.generatedBy)}`,
    `lastRunAt: ${escapeYamlString(ctx.lastRunAt)}`,
    `pages:`,
  ];

  for (const page of ctx.pages) {
    lines.push(`  - title: ${escapeYamlString(page.title)}`);
    lines.push(`    notionUrl: ${escapeYamlString(page.notionUrl)}`);
    lines.push(`    notionPageId: ${escapeYamlString(page.notionPageId)}`);
    lines.push(`    filePath: ${escapeYamlString(page.filePath)}`);
    lines.push(`    lastPulledAt: ${escapeYamlString(page.lastPulledAt)}`);
    lines.push(
      `    notionLastEditedAt: ${escapeYamlString(page.notionLastEditedAt)}`,
    );

    const propKeys = Object.keys(page.properties);
    if (propKeys.length > 0) {
      lines.push(`    properties:`);
      for (const key of propKeys) {
        const val = page.properties[key];
        lines.push(`      ${escapeYamlKey(key)}: ${serializePropertyValue(val)}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

export function buildContextFile(
  pages: { pulled: PulledPage; writtenFilename: string }[],
  version: string,
): ContextFile {
  const now = new Date().toISOString();

  return {
    version: 1,
    generatedBy: `spoketome@${version}`,
    lastRunAt: now,
    pages: pages.map(
      ({ pulled, writtenFilename }): ContextEntry => ({
        title: pulled.title,
        notionUrl: pulled.notionUrl,
        notionPageId: pulled.pageId,
        filePath: writtenFilename,
        lastPulledAt: now,
        notionLastEditedAt: pulled.lastEditedTime,
        properties: pulled.properties,
      }),
    ),
  };
}

export async function writeContextFile(
  outputDir: string,
  ctx: ContextFile,
): Promise<void> {
  const filePath = join(outputDir, CONTEXT_FILENAME);
  const yaml = serializeContextFile(ctx);
  await writeFile(filePath, yaml, "utf-8");
}
