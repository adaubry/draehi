"use client";

import { useEffect, useState } from "react";

export function MobileMenuTrigger() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = () => {
    if (mounted) {
      const button = document.querySelector(
        'button[aria-label="Toggle navigation menu"]'
      ) as HTMLButtonElement;
      if (button) {
        button.click();
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 transition-colors"
      aria-label="Toggle menu"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>
  );
}
