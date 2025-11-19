"use client";

import { useEffect, useRef, useState } from "react";

type ScrollBarProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Reusable scrollbar component with custom styling
 * Provides a styled vertical scroll indicator on the right side
 * Supports infinite scroll feel with smooth scrolling
 */
export function ScrollBar({ children, className = "" }: ScrollBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolling(true);
      const scrollHeight = container.scrollHeight - container.clientHeight;
      if (scrollHeight === 0) {
        setScrollPercentage(0);
      } else {
        const percentage = (container.scrollTop / scrollHeight) * 100;
        setScrollPercentage(percentage);
      }

      // Auto-hide scrollbar indicator after scrolling stops
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1500);
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-auto scroll-smooth"
      >
        {children}
      </div>

      {/* Custom Scrollbar */}
      <div className="absolute right-0 top-0 w-1.5 h-full bg-gray-100 opacity-0 hover:opacity-100 transition-opacity">
        <div
          className={`w-full bg-gray-400 rounded-full transition-all ${
            isScrolling ? "opacity-70" : "opacity-0"
          }`}
          style={{
            height: `${Math.max(20, (100 - scrollPercentage) * 0.1)}%`,
            transform: `translateY(${scrollPercentage}%)`,
            transitionDuration: isScrolling ? "0ms" : "300ms",
          }}
        />
      </div>
    </div>
  );
}
