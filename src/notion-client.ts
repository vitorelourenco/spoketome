import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  BlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import { blocksToMarkdown } from "./markdown.js";
import type { PulledPage, PropertyValue } from "./types.js";
import { sanitizeFilename } from "./filesystem.js";

let client: Client;

export function initNotionClient(token: string): void {
  client = new Client({ auth: token });
}

function extractTitle(page: PageObjectResponse): string {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "title" && prop.title.length > 0) {
      return prop.title.map((t) => t.plain_text).join("");
    }
  }
  return "Untitled";
}

function extractPropertyValue(prop: any): PropertyValue {
  switch (prop.type) {
    case "rich_text":
      return prop.rich_text.map((t: any) => t.plain_text).join("") || null;
    case "number":
      return prop.number;
    case "select":
      return prop.select?.name ?? null;
    case "multi_select":
      return prop.multi_select.map((s: any) => s.name);
    case "status":
      return prop.status?.name ?? null;
    case "date":
      if (!prop.date) return null;
      return prop.date.end
        ? `${prop.date.start} → ${prop.date.end}`
        : prop.date.start;
    case "checkbox":
      return prop.checkbox;
    case "url":
      return prop.url;
    case "email":
      return prop.email;
    case "phone_number":
      return prop.phone_number;
    case "formula":
      return extractFormulaValue(prop.formula);
    case "rollup":
      return prop.rollup?.number ?? null;
    case "people":
      return prop.people.map((p: any) => p.name ?? p.id);
    case "files":
      return prop.files.map(
        (f: any) => f.external?.url ?? f.file?.url ?? f.name,
      );
    case "relation":
      return prop.relation.map((r: any) => r.id);
    case "created_time":
      return prop.created_time;
    case "created_by":
      return prop.created_by?.name ?? prop.created_by?.id ?? null;
    case "last_edited_time":
      return prop.last_edited_time;
    case "last_edited_by":
      return prop.last_edited_by?.name ?? prop.last_edited_by?.id ?? null;
    case "unique_id":
      return prop.unique_id
        ? `${prop.unique_id.prefix ? prop.unique_id.prefix + "-" : ""}${prop.unique_id.number}`
        : null;
    default:
      return null;
  }
}

function extractFormulaValue(formula: any): PropertyValue {
  switch (formula.type) {
    case "string":
      return formula.string;
    case "number":
      return formula.number;
    case "boolean":
      return formula.boolean;
    case "date":
      return formula.date?.start ?? null;
    default:
      return null;
  }
}

function extractProperties(
  page: PageObjectResponse,
): Record<string, PropertyValue> {
  const properties: Record<string, PropertyValue> = {};

  for (const [name, prop] of Object.entries(page.properties)) {
    // Skip the title property — it's already captured as the page title
    if (prop.type === "title") continue;

    properties[name] = extractPropertyValue(prop);
  }

  return properties;
}

async function fetchAllBlocks(blockId: string): Promise<BlockObjectResponse[]> {
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      const b = block as BlockObjectResponse;
      blocks.push(b);

      // Recursively fetch children (but not child_page or child_database)
      if (b.has_children && b.type !== "child_page" && b.type !== "child_database") {
        const children = await fetchAllBlocks(b.id);
        (b as any)._children = children;
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return blocks;
}

export async function fetchPage(
  pageId: string,
  notionUrl: string,
): Promise<PulledPage> {
  const page = (await client.pages.retrieve({
    page_id: pageId,
  })) as PageObjectResponse;

  const title = extractTitle(page);
  const lastEditedTime = page.last_edited_time;
  const properties = extractProperties(page);

  const blocks = await fetchAllBlocks(pageId);
  const markdown = blocksToMarkdown(blocks, title);

  return {
    title,
    pageId,
    notionUrl,
    markdown,
    lastEditedTime,
    sanitizedFilename: sanitizeFilename(title),
    properties,
  };
}
