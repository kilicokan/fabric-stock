import { useEffect } from "react";

export function useGlobalBarcode(onScan: (code: string) => void) {
  useEffect(() => {
    let barcodeBuffer = "";
    let timeoutId: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      if (!isInputActive) {
        if (e.key === "Enter") {
          if (barcodeBuffer.trim().length > 2) {
            onScan(barcodeBuffer.trim());
          }
          barcodeBuffer = "";
        } else if (e.key.length === 1) {
          barcodeBuffer += e.key;
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            barcodeBuffer = "";
          }, 120);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan]);
}
