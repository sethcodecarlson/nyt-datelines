export type DatelineArticle = {
  headline: string;
  url: string;
};

export type DatelineLocation = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  sourceNames: string[];
  sourceDates: string[];
};

export type DatelineDate = {
  label: string;
  locationIds: string[];
  locationArticleCounts: Record<string, number>;
  locationArticles: Record<string, DatelineArticle[]>;
  rawLocationCount: number;
};

export type DatelineReviewItem = {
  rawLocation: string;
  normalizedQuery: string;
  dates: string[];
  status: "review" | "unresolved";
  reason: string;
  attemptedQueries: string[];
  matches: Array<{
    displayName: string;
    latitude: number;
    longitude: number;
    score: number;
  }>;
};

export type DatelineData = {
  meta: {
    generatedAt: string;
    rowCount: number;
    uniqueRawLocations: number;
    resolvedLocationCount: number;
    unresolvedLocationCount: number;
    reviewLocationCount: number;
  };
  locations: Record<string, DatelineLocation>;
  dates: Record<string, DatelineDate>;
  review: DatelineReviewItem[];
};
