import workCases from "./content/workCases.json";

export type Category = "KEY VISUAL" | "PACKAGE" | "媒体传播" | "虚幻引擎";

export type MediaItem = {
  type: "image" | "video";
  src: string;
  poster?: string;
  alt: string;
};

export type MasonryMediaItem = {
  type: "image" | "video";
  src: string;
  poster?: string;
  alt?: string;
};

export type CaseStudy = {
  id: string;
  createdAt?: string;
  title: string;
  category: Category;
  year: string;
  summary: string;
  tags: string[];
  cover: string;
  featured: boolean;
  featuredOrder: number;
  masonry: boolean;
  masonryOrder: number;
  masonryImages: string[];
  masonryMedia?: MasonryMediaItem[];
  detailMedia: MediaItem[];
};

export const categories: Array<"全部" | Category> = [
  "全部",
  "KEY VISUAL",
  "PACKAGE",
  "媒体传播",
  "虚幻引擎",
];

export const caseStudies = workCases as CaseStudy[];

export async function loadCaseStudies() {
  try {
    const response = await fetch(`/content/workCases.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("content unavailable");
    return (await response.json()) as CaseStudy[];
  } catch {
    return caseStudies;
  }
}
