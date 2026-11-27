"use client";

import { useState, useTransition } from "react";
import { createGuestLink } from "@/lib/actions/guestLink";

export function GuestLinkForm({ journeyId }: { journeyId: string }) {
  const [pending, startTransition] = useTransition();
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col sm:flex-row gap-2"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            try {
              const token = await createGuestLink(journeyId, formData);
              setLastToken(token);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not create link");
            }
          });
        }}
      >
        <input
          name="label"
          type="text"
          placeholder="Optional label (e.g. March workshop)"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create guest link"}
        </button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {lastToken ? <CopyGuestLink token={lastToken} /> : null}
    </div>
  );
}

function CopyGuestLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const href =
    typeof window !== "undefined" ? `${window.location.origin}/join/${token}` : `/join/${token}`;

  return (
    <div className="rounded-lg border border-border bg-canvas p-3 space-y-2">
      <p className="text-xs text-muted uppercase tracking-wide">Guest link (view access, 30 days)</p>
      <div className="flex gap-2">
        <input readOnly value={href} className="flex-1 text-xs rounded border border-border px-2 py-1.5 bg-white" />
        <button
          type="button"
          className="text-xs font-medium text-brand px-2"
          onClick={async () => {
            await navigator.clipboard.writeText(href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}