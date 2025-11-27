"use client";

import { createContext, useContext } from "react";
import type { TreeNode } from "@/modules/content/queries";

type PageBlocksContextType = {
  tree: TreeNode | null;
  pageUuid: string;
};

export const PageBlocksContext = createContext<PageBlocksContextType | undefined>(
  undefined
);

export function usePageBlocks() {
  const context = useContext(PageBlocksContext);
  if (!context) {
    return { tree: null, pageUuid: "" };
  }
  return context;
}
