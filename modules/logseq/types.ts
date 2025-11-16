// Types for Logseq processing

export type LogseqPage = {
  name: string; // page name
  title: string;
  html: string; // rendered HTML from Rust tool
  markdown: string; // original markdown
  metadata?: {
    tags?: string[];
    properties?: Record<string, unknown>;
  };
  isJournal: boolean;
  journalDate?: string; // YYYY-MM-DD format
};

export type LogseqExportResult = {
  pages: LogseqPage[];
  errors?: string[];
};
