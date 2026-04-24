/**
 * Inline CSS and JS resources from HTML
 * Converts <link href="style.css"> and <script src="app.js"> to inline content
 * Also fetches and inlines remote CDN resources (CSS, JS) for CSP compatibility
 */
export async function inlineResources(
  html: string,
  fileDir: string,
  taskId?: string,
): Promise<string> {
  let processedHtml = html;

  // Extract and inline CSS (match any link with href, not just .css files)
  const cssRegex = /<link\s+[^>]*?href=["']([^"']+)["'][^>]*>/gi;

  // Collect all matches first
  const cssMatches = [...html.matchAll(cssRegex)];

  // Process in reverse order so that removing earlier tags doesn't affect later indices
  for (let i = cssMatches.length - 1; i >= 0; i--) {
    const match = cssMatches[i];
    const [fullTag, cssPath] = match;
    const matchIndex = match.index;
    if (matchIndex === undefined) continue;

    // Determine if it's a remote URL
    const isRemote =
      cssPath.startsWith("http://") || cssPath.startsWith("https://");

    if (isRemote) {
      // Fetch and inline remote CSS/CDN resources for CSP compatibility
      // Use server-side proxy to avoid browser CSP/CORS restrictions
      try {
        const proxyUrl = `/api/proxy/css?url=${encodeURIComponent(cssPath)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
          const cssContent = await response.text();
          const inlineCss = `<style>\n${cssContent}\n</style>`;
          // Replace based on position, not string match (to avoid matching strings inside other content)
          processedHtml =
            processedHtml.slice(0, matchIndex) +
            inlineCss +
            processedHtml.slice(matchIndex + fullTag.length);
        }
      } catch (err) {
        console.error(
          `[WebsitePreview] Failed to fetch remote CSS ${cssPath}:`,
          err,
        );
        // Remove the tag when fetch fails - keeping external CSS links
        // causes CSP violations. For Google Fonts, this also serves as
        // a fallback to system fonts.
        processedHtml =
          processedHtml.slice(0, matchIndex) +
          processedHtml.slice(matchIndex + fullTag.length);
      }
    } else {
      const relativeCssPath = cssPath.startsWith("/")
        ? cssPath
        : `${fileDir}/${cssPath}`;

      try {
        let cssContent = "";
        const isTauri = !!(globalThis as any).__TAURI__;

        if (isTauri) {
          const { readFile } = await import("@/lib/tauri");
          const data = await readFile(relativeCssPath);
          cssContent = data || "";
        } else if (taskId) {
          // Read from API - handle relative paths
          let apiPath = relativeCssPath;
          // Add taskId if path doesn't contain it
          if (!relativeCssPath.includes(taskId)) {
            apiPath = `${taskId}/${relativeCssPath}`;
          }
          const response = await fetch(`/api/workspace/file/${apiPath}`);
          if (response.ok) {
            const data = await response.json();
            cssContent = data.content || "";
          }
        }

        if (cssContent) {
          const inlineCss = `<style>\n${cssContent}\n</style>`;
          processedHtml =
            processedHtml.slice(0, matchIndex) +
            inlineCss +
            processedHtml.slice(matchIndex + fullTag.length);
        }
      } catch (err) {
        console.error(
          `[WebsitePreview] Failed to inline CSS ${relativeCssPath}:`,
          err,
        );
      }
    }
  }

  // Extract and inline JS (match any src URL, not just .js files)
  const jsRegex = /<script\s+src=["']([^"']+)["'][^>]*><\/script>/gi;
  const jsMatches = [...processedHtml.matchAll(jsRegex)];

  // Process in reverse order so that removing earlier tags doesn't affect later indices
  for (let i = jsMatches.length - 1; i >= 0; i--) {
    const match = jsMatches[i];
    const [fullTag, jsPath] = match;
    const matchIndex = match.index;
    if (matchIndex === undefined) continue;

    // Determine if it's a remote URL
    const isRemote =
      jsPath.startsWith("http://") || jsPath.startsWith("https://");

    if (isRemote) {
      // Known CDN domains that reliably serve JavaScript - skip content-type check and inline directly
      const knownCdnDomains = [
        "cdn.tailwindcss.com",
        "unpkg.com",
        "cdn.jsdelivr.net",
        "cdnjs.cloudflare.com",
        "ajax.googleapis.com",
        "stackpath.bootstrapcdn.com",
        "code.jquery.com",
      ];
      const isKnownCdn = knownCdnDomains.some((domain) =>
        jsPath.includes(domain),
      );

      try {
        const proxyUrl = `/api/proxy/js?url=${encodeURIComponent(jsPath)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          // Fetch failed - keep original tag so iframe can try to load it
          continue;
        }

        const contentType = response.headers.get("content-type") || "";
        const isJavaScript =
          isKnownCdn || // Known CDNs are trusted to serve JS
          contentType.includes("javascript") ||
          contentType.includes("application/javascript") ||
          contentType.includes("application/x-javascript") ||
          jsPath.endsWith(".js");

        if (isJavaScript) {
          const jsContent = await response.text();
          // Escape </script> in JS content to prevent HTML parser from prematurely closing the script tag.
          // Replace </script> with </scr\x69pt> where \x69 is the hex code for 'i'.
          // The HTML parser won't see this as </script> but JS will interpret \x69 as 'i'.
          const escapedJsContent = jsContent.replace(
            /<\/script>/g,
            "</scr\\x69pt>",
          );
          const inlineJs = `<script>\n${escapedJsContent}\n</script>`;
          // Replace based on position, not string match (to avoid matching strings inside other content)
          processedHtml =
            processedHtml.slice(0, matchIndex) +
            inlineJs +
            processedHtml.slice(matchIndex + fullTag.length);
        }
        // If content-type isn't JavaScript and not a known CDN, keep original tag so iframe can try to load it
      } catch (err) {
        console.error(
          `[WebsitePreview] Failed to fetch remote JS ${jsPath}:`,
          err,
        );
        // Network/CORS error - keep original tag so iframe can try to load it
      }
    } else {
      const relativeJsPath = jsPath.startsWith("/")
        ? jsPath
        : `${fileDir}/${jsPath}`;

      try {
        let jsContent = "";
        const isTauri = !!(globalThis as any).__TAURI__;

        if (isTauri) {
          const { readFile } = await import("@/lib/tauri");
          const data = await readFile(relativeJsPath);
          jsContent = data || "";
        } else if (taskId) {
          // Read from API - handle relative paths
          let apiPath = relativeJsPath;
          // Add taskId if path doesn't contain it
          if (!relativeJsPath.includes(taskId)) {
            apiPath = `${taskId}/${relativeJsPath}`;
          }
          const response = await fetch(`/api/workspace/file/${apiPath}`);
          if (response.ok) {
            const data = await response.json();
            jsContent = data.content || "";
          }
        }

        if (jsContent) {
          // Escape </script> in JS content to prevent HTML parser from prematurely closing the script tag.
          // Replace </script> with </scr\x69pt> where \x69 is the hex code for 'i'.
          const escapedJsContent = jsContent.replace(
            /<\/script>/g,
            "</scr\\x69pt>",
          );
          const inlineJs = `<script>\n${escapedJsContent}\n</script>`;
          processedHtml =
            processedHtml.slice(0, matchIndex) +
            inlineJs +
            processedHtml.slice(matchIndex + fullTag.length);
        }
      } catch (err) {
        console.error(
          `[WebsitePreview] Failed to inline JS ${relativeJsPath}:`,
          err,
        );
      }
    }
  }

  return processedHtml;
}
