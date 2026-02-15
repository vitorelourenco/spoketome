# spoketome

Bridge Notion docs into your codebase as plain files.

Drop a `.spoketome` file anywhere in your project with links to Notion pages. Run `spoketome` and it pulls those pages as markdown into a sibling `spoketome/` folder, alongside a `context.yaml` with metadata (title, status, authors, dates — whatever properties the Notion page has).

## Why not just use an MCP or Skills?

- **No setup to enforce on anyone.** It's just files in a repo.
- **Any tool can read the output** — Claude, Cursor, grep, CI, whatever. No vendor dependency.
- **Notion stays the source of truth** for everyone (PMs, clients, devs). The repo gets a mirror.

## How developers stay in control

- `.spoketome` files can be shared (committed) or personal (gitignored)
- `.spoketome.dev` files (always gitignored) let you add your own pages or exclude shared ones with `!`
- `.spoketomeroot` marks the project boundary so it never scans beyond your project
- Each dev curates their own context without impacting others

## How AI tools use it

- One skill/instruction: "read `spoketome/context.yaml`, check the properties to decide what's relevant, then read only those markdown files"
- Context is scoped by directory — docs live next to the code they apply to
- The AI reads a small metadata index first, then selectively loads what it needs. Cheaper than loading everything into every prompt.

## The flow

```
.spoketome file (Notion URLs) → spoketome pull → spoketome/ dir with .md + context.yaml
```

## Setup

```bash
npm install
```

Create a Notion integration at [notion.so/my-integrations](https://www.notion.so/my-integrations) and share your pages with it.

## Usage

```bash
# Set your token
export NOTION_TOKEN=ntn_xxx

# Or put it in a .env file in your project root
echo "NOTION_TOKEN=ntn_xxx" > .env

# Run
npx spoketome

# Or point at a specific directory
npx spoketome --dir ./my-project
```

### CLI options

```
-d, --dir <path>   Base directory to search (default: ".")
-v, --verbose       Show detailed output
-q, --quiet         Suppress non-error output
    --dry-run       Show what would be done without writing files
-h, --help          Show this help message
```

## File reference

### `.spoketome`

One Notion page URL per line. Comments with `#`, blank lines ignored.

```
# Architecture decisions
https://www.notion.so/ADR-001-abc123...
https://www.notion.so/ADR-002-def456...
```

### `.spoketome.dev`

Personal overlay, always gitignored. Plain URLs are added, `!` prefix excludes from the shared set.

```
# I don't need this one
!https://www.notion.so/ADR-002-def456...

# But I want my personal notes
https://www.notion.so/My-Notes-789abc...
```

### `.spoketomeroot`

Empty marker file. Place it at your project root to stop the upward directory search.

### `spoketome/context.yaml`

Generated metadata for each pulled page:

```yaml
version: 1
generatedBy: "spoketome@0.1.0"
lastRunAt: "2026-02-15T14:30:00.000Z"
pages:
  - title: "ADR 001"
    notionUrl: "https://www.notion.so/ADR-001-abc123..."
    notionPageId: "abc12345-6789-0abc-def0-123456789abc"
    filePath: "adr-001.md"
    lastPulledAt: "2026-02-15T14:30:00.000Z"
    notionLastEditedAt: "2026-02-14T10:00:00.000Z"
    properties:
      Status: "Approved"
      Authors: ["Alice", "Bob"]
      Date: "2026-01-15"
```

## Single runtime dependency

The official [Notion SDK](https://github.com/makenotion/notion-sdk-js). Everything else is hand-rolled.
