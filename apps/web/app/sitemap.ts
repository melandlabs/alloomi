import type { MetadataRoute } from "next";
import { siteMetadata } from "@/lib/marketing/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteMetadata.siteUrl.replace(/\/$/, "");
  const lastModified = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/privacy",
    "/support",
    "/terms",
  ].map<MetadataRoute.Sitemap[number]>((path) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.5,
  }));

  return staticRoutes;
}
