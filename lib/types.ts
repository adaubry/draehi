// Shared types across modules

export type Breadcrumb = {
  title: string;
  slug: string;
  href: string;
};

export type NavItem = {
  title: string;
  href: string;
  depth: number;
  isJournal?: boolean;
};

export type DeploymentStatus = "pending" | "building" | "success" | "failed";
export type SyncStatus = "idle" | "syncing" | "success" | "error";
