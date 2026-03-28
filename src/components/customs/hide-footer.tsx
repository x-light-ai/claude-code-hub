"use client";

import { useEffect } from "react";

export function HideFooter() {
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (footer) {
      footer.style.display = "none";
    }

    return () => {
      const footer = document.querySelector("footer");
      if (footer) {
        footer.style.display = "";
      }
    };
  }, []);

  return null;
}
