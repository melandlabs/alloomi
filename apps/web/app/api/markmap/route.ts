import { type NextRequest, NextResponse } from "next/server";

interface Heading {
  depth: number;
  name: string;
  line?: number;
}

/**
 * Parse markdown to extract headings (simplified version)
 */
function parseMarkdown(content: string): Heading[] {
  const headings: Heading[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        depth: match[1].length,
        name: match[2].trim(),
      });
    }
  }

  return headings;
}

/**
 * Convert headings to markmap tree data format
 */
function headingsToTree(headings: Heading[]): {
  name: string;
  children: any[];
} {
  if (!headings.length) {
    return { name: "Mind Map", children: [] };
  }

  const root = { name: "Mind Map", children: [] as any[] };
  const stack: any[] = [{ depth: 0, node: root }];

  for (const heading of headings) {
    const node = { name: heading.name, children: [] };

    while (stack.length > 1 && stack[stack.length - 1].depth >= heading.depth) {
      stack.pop();
    }

    stack[stack.length - 1].node.children.push(node);
    stack.push({ depth: heading.depth, node });
  }

  return root;
}

/**
 * Generate SVG string from tree data (simplified mind map rendering)
 */
function generateSVG(tree: { name: string; children: any[] }): string {
  const nodeWidth = 120;
  const nodeHeight = 36;
  const horizontalSpacing = 160;
  const verticalSpacing = 60;

  // Calculate positions using a simple layout algorithm
  const positions: Map<string, { x: number; y: number }> = new Map();
  const nodes: {
    path: string;
    name: string;
    depth: number;
    x: number;
    y: number;
  }[] = [];

  function calculatePositions(
    node: any,
    depth: number,
    x: number,
    y: number,
    siblingCount = 1,
    siblingIndex = 0,
  ): number {
    const path = node.path || "root";
    positions.set(path, { x, y });
    nodes.push({ path, name: node.name, depth, x, y });

    if (node.children && node.children.length > 0) {
      const totalHeight =
        node.children.length * nodeHeight +
        (node.children.length - 1) * verticalSpacing;
      const currentY = y - totalHeight / 2 + nodeHeight / 2;

      for (let i = 0; i < node.children.length; i++) {
        const childX = x + nodeWidth + horizontalSpacing;
        const childY = currentY + i * (nodeHeight + verticalSpacing);
        calculatePositions(
          node.children[i],
          depth + 1,
          childX,
          childY,
          node.children.length,
          i,
        );
      }
    }

    return nodeHeight;
  }

  calculatePositions(tree, 0, 100, 300);

  // Find bounds
  let maxX = 0;
  let maxY = 0;
  positions.forEach((pos) => {
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  });

  const width = maxX + 100;
  const height = Math.max(600, maxY + 100);

  // Color palette
  const colors = [
    { bg: "#6366f1", text: "#ffffff", line: "#6366f1" },
    { bg: "#8b5cf6", text: "#ffffff", line: "#8b5cf6" },
    { bg: "#ec4899", text: "#ffffff", line: "#ec4899" },
    { bg: "#f43f5e", text: "#ffffff", line: "#f43f5e" },
    { bg: "#f97316", text: "#ffffff", line: "#f97316" },
    { bg: "#eab308", text: "#000000", line: "#eab308" },
    { bg: "#22c55e", text: "#ffffff", line: "#22c55e" },
    { bg: "#14b8a6", text: "#ffffff", line: "#14b8a6" },
    { bg: "#06b6d4", text: "#ffffff", line: "#06b6d4" },
    { bg: "#3b82f6", text: "#ffffff", line: "#3b82f6" },
  ];

  // Generate SVG
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="rootGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#6366f1" flood-opacity="0.25"/>
    </filter>
    <filter id="childShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.1"/>
    </filter>
  </defs>
  <style>
    .node-text { font-family: system-ui, -apple-system, sans-serif; font-weight: 600; }
  </style>
  <rect width="100%" height="100%" fill="url(#bgGradient)"/>
  <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#f8fafc"/>
    <stop offset="100%" stop-color="#f1f5f9"/>
  </linearGradient>
`;

  // Draw connections
  for (const node of nodes) {
    if (node.depth === 0) continue;

    const parentPath = node.path.split("-").slice(0, -1).join("-");
    const parent = nodes.find((n) => n.path === parentPath);
    if (!parent) continue;

    const colorIndex = Math.min(node.depth - 1, colors.length - 1);
    const color = colors[colorIndex].line;

    const x1 = parent.x + nodeWidth;
    const y1 = parent.y + nodeHeight / 2;
    const x2 = node.x;
    const y2 = node.y + nodeHeight / 2;

    const midX = (x1 + x2) / 2;

    svg += `  <path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.4" stroke-linecap="round"/>\n`;
  }

  // Draw nodes
  for (const node of nodes) {
    const isRoot = node.depth === 0;
    const colorIndex = Math.min(node.depth, colors.length - 1);
    const color = colors[colorIndex];

    if (isRoot) {
      svg += `  <g filter="url(#shadow)">
    <rect x="${node.x}" y="${node.y}" width="${nodeWidth}" height="${nodeHeight}" rx="21" ry="21" fill="url(#rootGradient)"/>
    <rect x="${node.x - 4}" y="${node.y - 4}" width="${nodeWidth + 8}" height="${nodeHeight + 8}" rx="25" ry="25" fill="none" stroke="#6366f1" stroke-width="2" stroke-opacity="0.3"/>
    <text x="${node.x + nodeWidth / 2}" y="${node.y + nodeHeight / 2 + 5}" text-anchor="middle" fill="${color.text}" font-size="15" font-weight="700" class="node-text">${escapeXml(truncate(node.name, 12))}</text>
  </g>\n`;
    } else {
      svg += `  <g filter="url(#childShadow)">
    <rect x="${node.x}" y="${node.y}" width="${nodeWidth}" height="${nodeHeight}" rx="12" ry="12" fill="${color.bg}" fill-opacity="0.12"/>
    <rect x="${node.x}" y="${node.y}" width="${nodeWidth}" height="${nodeHeight}" rx="12" ry="12" fill="none" stroke="${color.bg}" stroke-width="2" stroke-opacity="0.6"/>
    <text x="${node.x + nodeWidth / 2}" y="${node.y + nodeHeight / 2 + 4}" text-anchor="middle" fill="${color.bg}" font-size="13" font-weight="600" class="node-text">${escapeXml(truncate(node.name, 14))}</text>
  </g>\n`;
    }
  }

  svg += "</svg>";

  return svg;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const headings = parseMarkdown(content);
    const tree = headingsToTree(headings);
    const svg = generateSVG(tree);

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[API/markmap] Error:", error);
    return NextResponse.json(
      { error: "Failed to render mind map" },
      { status: 500 },
    );
  }
}
