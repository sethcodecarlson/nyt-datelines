export type DateKey =
  | "2026-03-05"
  | "2026-03-07"
  | "2026-03-10"
  | "2026-03-13"
  | "2026-03-18"
  | "2026-03-24"
  | "2026-03-25";

export type LocationRecord = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export const previewLocations: Record<string, LocationRecord> = {
  washington_dc: {
    id: "washington_dc",
    label: "Washington, DC",
    latitude: 38.9072,
    longitude: -77.0369,
  },
  new_york_city: {
    id: "new_york_city",
    label: "New York City",
    latitude: 40.7128,
    longitude: -74.006,
  },
  london: {
    id: "london",
    label: "London",
    latitude: 51.5072,
    longitude: -0.1276,
  },
  los_angeles: {
    id: "los_angeles",
    label: "Los Angeles",
    latitude: 34.0549,
    longitude: -118.2426,
  },
  kyiv: {
    id: "kyiv",
    label: "Kyiv, Ukraine",
    latitude: 50.4501,
    longitude: 30.5234,
  },
  beirut: {
    id: "beirut",
    label: "Beirut, Lebanon",
    latitude: 33.8938,
    longitude: 35.5018,
  },
  dubai: {
    id: "dubai",
    label: "Dubai, United Arab Emirates",
    latitude: 25.2048,
    longitude: 55.2708,
  },
  san_francisco: {
    id: "san_francisco",
    label: "San Francisco, Calif.",
    latitude: 37.7749,
    longitude: -122.4194,
  },
  oakland: {
    id: "oakland",
    label: "Oakland, Calif.",
    latitude: 37.8044,
    longitude: -122.2711,
  },
  copenhagen: {
    id: "copenhagen",
    label: "Copenhagen",
    latitude: 55.6761,
    longitude: 12.5683,
  },
  houston: {
    id: "houston",
    label: "Houston",
    latitude: 29.7604,
    longitude: -95.3698,
  },
  atlanta: {
    id: "atlanta",
    label: "Atlanta",
    latitude: 33.749,
    longitude: -84.388,
  },
  berlin: {
    id: "berlin",
    label: "Berlin",
    latitude: 52.52,
    longitude: 13.405,
  },
  sydney: {
    id: "sydney",
    label: "Sydney, Australia",
    latitude: -33.8688,
    longitude: 151.2093,
  },
  dakar: {
    id: "dakar",
    label: "Dakar, Senegal",
    latitude: 14.7167,
    longitude: -17.4677,
  },
  nashville: {
    id: "nashville",
    label: "Nashville",
    latitude: 36.1627,
    longitude: -86.7816,
  },
};

export const previewDates: Record<
  DateKey,
  { label: string; locationIds: string[] }
> = {
  "2026-03-05": {
    label: "Mar 5",
    locationIds: ["new_york_city", "london", "kyiv"],
  },
  "2026-03-07": {
    label: "Mar 7",
    locationIds: ["new_york_city", "beirut", "los_angeles", "dakar"],
  },
  "2026-03-10": {
    label: "Mar 10",
    locationIds: ["new_york_city", "london", "dubai", "san_francisco"],
  },
  "2026-03-13": {
    label: "Mar 13",
    locationIds: ["berlin", "oakland", "atlanta", "houston"],
  },
  "2026-03-18": {
    label: "Mar 18",
    locationIds: ["kyiv", "beirut", "sydney", "washington_dc"],
  },
  "2026-03-24": {
    label: "Mar 24",
    locationIds: ["washington_dc", "copenhagen", "london", "houston"],
  },
  "2026-03-25": {
    label: "Mar 25",
    locationIds: [
      "washington_dc",
      "san_francisco",
      "oakland",
      "berlin",
      "nashville",
    ],
  },
};

export const activeDateKeys = Object.keys(previewDates) as DateKey[];
