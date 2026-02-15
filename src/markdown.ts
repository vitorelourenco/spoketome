import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";

type RichText = { plain_text: string; href: string | null; annotations: Annotations };
type Annotations = {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
};

function renderRichText(texts: RichText[]): string {
  return texts
    .map((t) => {
      let s = t.plain_text;
      if (t.annotations.code) s = `\`${s}\``;
      if (t.annotations.bold) s = `**${s}**`;
      if (t.annotations.italic) s = `*${s}*`;
      if (t.annotations.strikethrough) s = `~~${s}~~`;
      if (t.href) s = `[${s}](${t.href})`;
      return s;
    })
    .join("");
}

function getBlockChildren(block: any): BlockObjectResponse[] {
  return block._children ?? [];
}

function convertBlock(block: BlockObjectResponse, indent: number = 0): string {
  const prefix = "  ".repeat(indent);
  const b = block as any;

  switch (block.type) {
    case "paragraph":
      return prefix + renderRichText(b.paragraph.rich_text);

    case "heading_1":
      return `# ${renderRichText(b.heading_1.rich_text)}`;

    case "heading_2":
      return `## ${renderRichText(b.heading_2.rich_text)}`;

    case "heading_3":
      return `### ${renderRichText(b.heading_3.rich_text)}`;

    case "bulleted_list_item": {
      const text = `${prefix}- ${renderRichText(b.bulleted_list_item.rich_text)}`;
      const children = getBlockChildren(block)
        .map((c) => convertBlock(c, indent + 1))
        .join("\n");
      return children ? `${text}\n${children}` : text;
    }

    case "numbered_list_item": {
      const text = `${prefix}1. ${renderRichText(b.numbered_list_item.rich_text)}`;
      const children = getBlockChildren(block)
        .map((c) => convertBlock(c, indent + 1))
        .join("\n");
      return children ? `${text}\n${children}` : text;
    }

    case "to_do": {
      const checkbox = b.to_do.checked ? "[x]" : "[ ]";
      return `${prefix}- ${checkbox} ${renderRichText(b.to_do.rich_text)}`;
    }

    case "toggle": {
      const text = `${prefix}<details><summary>${renderRichText(b.toggle.rich_text)}</summary>\n`;
      const children = getBlockChildren(block)
        .map((c) => convertBlock(c, indent))
        .join("\n\n");
      return `${text}\n${children}\n\n${prefix}</details>`;
    }

    case "code": {
      const lang = b.code.language !== "plain text" ? b.code.language : "";
      const code = renderRichText(b.code.rich_text);
      return `${prefix}\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case "quote": {
      const text = renderRichText(b.quote.rich_text);
      const lines = text.split("\n").map((l: string) => `${prefix}> ${l}`);
      return lines.join("\n");
    }

    case "callout": {
      const icon = b.callout.icon?.emoji ?? "";
      const text = renderRichText(b.callout.rich_text);
      return `${prefix}> ${icon} ${text}`;
    }

    case "divider":
      return `${prefix}---`;

    case "image": {
      const url =
        b.image.type === "external" ? b.image.external.url : b.image.file.url;
      const caption = b.image.caption?.length
        ? renderRichText(b.image.caption)
        : "";
      return `${prefix}![${caption}](${url})`;
    }

    case "bookmark":
      return `${prefix}[${b.bookmark.url}](${b.bookmark.url})`;

    case "link_preview":
      return `${prefix}[${b.link_preview.url}](${b.link_preview.url})`;

    case "embed":
      return `${prefix}[${b.embed.url}](${b.embed.url})`;

    case "video": {
      const vUrl =
        b.video.type === "external" ? b.video.external.url : b.video.file.url;
      return `${prefix}[Video](${vUrl})`;
    }

    case "file": {
      const fUrl =
        b.file.type === "external" ? b.file.external.url : b.file.file.url;
      const fCaption = b.file.caption?.length
        ? renderRichText(b.file.caption)
        : b.file.name ?? "File";
      return `${prefix}[${fCaption}](${fUrl})`;
    }

    case "pdf": {
      const pUrl =
        b.pdf.type === "external" ? b.pdf.external.url : b.pdf.file.url;
      return `${prefix}[PDF](${pUrl})`;
    }

    case "table": {
      const rows = getBlockChildren(block);
      return renderTable(rows, b.table.has_column_header);
    }

    case "table_row":
      // Handled by table parent
      return "";

    case "child_page":
      return `${prefix}[${b.child_page.title}] (child page)`;

    case "child_database":
      return `${prefix}[${b.child_database.title}] (child database)`;

    case "equation":
      return `${prefix}$$${b.equation.expression}$$`;

    case "table_of_contents":
      return `${prefix}*(Table of contents)*`;

    case "breadcrumb":
      return "";

    case "column_list": {
      return getBlockChildren(block)
        .map((c) => convertBlock(c, indent))
        .join("\n\n");
    }

    case "column": {
      return getBlockChildren(block)
        .map((c) => convertBlock(c, indent))
        .join("\n\n");
    }

    case "synced_block": {
      return getBlockChildren(block)
        .map((c) => convertBlock(c, indent))
        .join("\n\n");
    }

    default:
      return `${prefix}<!-- unsupported block: ${block.type} -->`;
  }
}

function renderTable(rows: BlockObjectResponse[], hasHeader: boolean): string {
  if (rows.length === 0) return "";

  const lines: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as any;
    const cells = (row.table_row?.cells ?? []) as RichText[][];
    const rendered = cells.map((cell) => renderRichText(cell));
    lines.push(`| ${rendered.join(" | ")} |`);

    if (i === 0 && hasHeader) {
      lines.push(`| ${rendered.map(() => "---").join(" | ")} |`);
    }
  }

  // If no header row but we have data, add a separator after first row anyway
  if (!hasHeader && rows.length > 0) {
    const row = rows[0] as any;
    const cells = (row.table_row?.cells ?? []) as RichText[][];
    lines.splice(1, 0, `| ${cells.map(() => "---").join(" | ")} |`);
  }

  return lines.join("\n");
}

export function blocksToMarkdown(
  blocks: BlockObjectResponse[],
  title: string,
): string {
  const lines: string[] = [`# ${title}`, ""];

  for (const block of blocks) {
    const md = convertBlock(block);
    if (md !== "") {
      lines.push(md);
      lines.push("");
    }
  }

  return lines.join("\n");
}
