import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";

const ALLOWED_DOMAINS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdn.tailwindcss.com",
  "unpkg.com",
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
  "ajax.googleapis.com",
  "stackpath.bootstrapcdn.com",
  "code.jquery.com",
];

// CDN domains that work at root URL (may redirect to versioned paths)
// These are trusted CDNs - allow requests even without explicit path/query
const ROOT_URL_CDNS = ["cdn.tailwindcss.com"];

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url param required" }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(url);

    if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
      return NextResponse.json({ error: "disallowed domain" }, { status: 403 });
    }

    // Validate URL has a meaningful path or query
    // Exception: some CDNs like cdn.tailwindcss.com work at root URL and may redirect to versioned paths
    if (
      parsedUrl.pathname === "/" &&
      !parsedUrl.search &&
      !ROOT_URL_CDNS.includes(parsedUrl.hostname)
    ) {
      return NextResponse.json(
        { error: "URL must have a path or query string" },
        { status: 400 },
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `fetch failed: ${response.status}` },
        { status: 502 },
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const isJs =
      contentType.includes("javascript") ||
      contentType.includes("application/javascript") ||
      contentType.includes("application/x-javascript") ||
      url.endsWith(".js") ||
      // cdn.tailwindcss.com always serves JS even at root URL (may redirect to versioned path)
      parsedUrl.hostname === "cdn.tailwindcss.com";

    if (!isJs) {
      return NextResponse.json({ error: "not JS content" }, { status: 400 });
    }

    const js = await response.text();

    return new NextResponse(js, {
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[Proxy/JS] fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
