"use client";

import { useState } from "react";

/**
 * Copies a link to the clipboard. The Response Link is meant to be sent to
 * everyone who said no, and the Owner Link is meant to be kept, so both are
 * shown in full as well: the button is a convenience, never the only way to
 * get hold of one.
 */
export function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {label}
      </button>{" "}
      {copied ? <span>Copied.</span> : null}
    </p>
  );
}
