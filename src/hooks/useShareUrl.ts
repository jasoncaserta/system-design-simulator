import { useState } from 'react';

export function useShareUrl(): { share: () => void; copied: boolean } {
  const [copied, setCopied] = useState(false);

  const share = () => {
    const url = window.location.href;
    const writeToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Fallback for non-secure contexts (e.g. http://localhost) where
        // navigator.clipboard is unavailable. document.execCommand('copy') is
        // deprecated but remains the only cross-browser option in that case.
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    writeToClipboard();
  };

  return { share, copied };
}
