import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { inlineResources } from "@/lib/files/inline-resources";

describe("inlineResources", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("script tag escaping", () => {
    it("should inline JS that contains </script> without breaking HTML structure", async () => {
      // Simulates Tailwind CDN JS which contains </script> strings in its code
      const htmlWithScriptClose = `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div class="bg-white/5 backdrop-blur">Test</div>
</body>
</html>`;

      // Tailwind CDN contains strings like "</script>" for document.write calls
      const mockJsContent = `
        var color = "</script>";
        tailwind.config = {};
      `;

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/proxy/js")) {
          return {
            ok: true,
            headers: new Map([["content-type", "application/javascript"]]),
            text: async () => mockJsContent,
          } as unknown as Response;
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      const result = await inlineResources(htmlWithScriptClose, "/fake/path");

      // Verify the original external script tag was replaced with inline content
      expect(result).not.toContain('src="https://cdn.tailwindcss.com"');

      // The </script> in the JS content should be escaped as </scr\x69pt>
      // This prevents the HTML parser from prematurely closing the script tag
      expect(result).toContain("</scr\\x69pt>");
      expect(result).not.toContain('var color = "</script>"');
    });

    it("should inline multiple script tags with </script> content", async () => {
      const html = `<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://example.com/analytics.js"></script>
</head>
<body></body>
</html>`;

      const tailwindJs = 'document.write("<script></script>");';
      const analyticsJs = 'console.log("</script> in string");';

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/proxy/js")) {
          if (url.includes("cdn.tailwindcss.com")) {
            return {
              ok: true,
              headers: new Map([["content-type", "application/javascript"]]),
              text: async () => tailwindJs,
            } as unknown as Response;
          }
          if (url.includes("example.com")) {
            return {
              ok: true,
              headers: new Map([["content-type", "application/javascript"]]),
              text: async () => analyticsJs,
            } as unknown as Response;
          }
        }
        throw new Error(`Unknown URL: ${url}`);
      });

      const result = await inlineResources(html, "/fake/path");

      // All </script> occurrences in JS content should be escaped
      expect(result).toContain("</scr\\x69pt>");
      expect(result).not.toContain('document.write("<script></script>")');
      expect(result).not.toContain('console.log("</script> in string")');

      // Original src attributes should be replaced with inline content
      expect(result).not.toContain('src="https://cdn.tailwindcss.com"');
      expect(result).not.toContain('src="https://example.com/analytics.js"');
    });

    it("should properly inline both CSS and JS with problematic content", async () => {
      const html = `<html>
<head>
  <link href="https://example.com/style.css">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body></body>
</html>`;

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/proxy/css")) {
          return {
            ok: true,
            text: async () => ".test { content: '</script>'; }",
          } as unknown as Response;
        }
        if (url.includes("/api/proxy/js")) {
          return {
            ok: true,
            headers: new Map([["content-type", "application/javascript"]]),
            text: async () => 'document.write("</script>");',
          } as unknown as Response;
        }
        throw new Error("Unknown URL");
      });

      const result = await inlineResources(html, "/fake/path");

      // CSS should be inlined with style tag
      expect(result).toContain("<style>");
      expect(result).toContain(".test { content: '</script>'; }");

      // JS should be inlined with script tag - </script> should be escaped
      expect(result).toContain("<script>");
      expect(result).toContain('document.write("</scr\\x69pt>")');
    });
  });
});
