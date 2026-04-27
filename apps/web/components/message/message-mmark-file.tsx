"use client";

import { useEffect, useState } from "react";
import { MindMapPreview } from "../artifacts/mindmap-preview";

interface MessageMmarkFileProps {
  /** File URL or blob path */
  src: string;
  /** File name */
  filename: string;
}

/**
 * Helper component to load and render .mmark files in messages
 */
export function MessageMmarkFile({ src, filename }: MessageMmarkFileProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMmark = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(src);
        if (!response.ok) throw new Error("Failed to fetch file");
        const text = await response.text();
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchMmark();
  }, [src]);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground p-2">
        Loading mind map...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-muted-foreground p-2">
        Failed to load mind map: {error}
      </div>
    );
  }

  if (!content) {
    return null;
  }

  return (
    <div className="mt-3">
      <MindMapPreview content={content} filename={filename} maxHeight="400px" />
    </div>
  );
}
