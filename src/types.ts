export interface SpoketomeEntry {
  notionUrl: string;
  pageId: string;
}

export interface SpoketomeFile {
  filePath: string;
  dirPath: string;
  outputDir: string;
  entries: SpoketomeEntry[];
}

export type PropertyValue =
  | string
  | number
  | boolean
  | string[]
  | null;

export interface ContextEntry {
  title: string;
  notionUrl: string;
  notionPageId: string;
  filePath: string;
  lastPulledAt: string;
  notionLastEditedAt: string;
  properties: Record<string, PropertyValue>;
}

export interface ContextFile {
  version: 1;
  generatedBy: string;
  lastRunAt: string;
  pages: ContextEntry[];
}

export interface PulledPage {
  title: string;
  pageId: string;
  notionUrl: string;
  markdown: string;
  lastEditedTime: string;
  sanitizedFilename: string;
  properties: Record<string, PropertyValue>;
}

export interface CliOptions {
  verbose: boolean;
  quiet: boolean;
  dryRun: boolean;
  dir: string;
}
