"use client";

import { PageBlocksContext } from "@/lib/page-blocks-context";
import type { Node } from "@/modules/content/schema";
import type { TreeNode } from "@/modules/content/queries";

type PageBlocksContextProviderProps = {
  tree: TreeNode | null;
  pageUuid: string;
  children: React.ReactNode;
};

export function PageBlocksContextProvider({
  tree,
  pageUuid,
  children,
}: PageBlocksContextProviderProps) {
  return (
    <PageBlocksContext.Provider value={{ tree, pageUuid }}>
      {children}
    </PageBlocksContext.Provider>
  );
}
