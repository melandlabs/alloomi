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
    if (parsedUrl.pathname === "/" && !parsedUrl.search) {
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
      url.endsWith(".js");

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
