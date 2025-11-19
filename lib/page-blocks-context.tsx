"use client";

import { createContext, useContext } from "react";
import type { Node } from "@/modules/content/schema";

type PageBlocksContextType = {
  blocks: Node[];
  pageUuid: string;
};

export const PageBlocksContext = createContext<PageBlocksContextType | undefined>(
  undefined
);

export function usePageBlocks() {
  const context = useContext(PageBlocksContext);
  if (!context) {
    return { blocks: [], pageUuid: "" };
  }
  return context;
}
