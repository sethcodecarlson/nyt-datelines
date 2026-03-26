import fs from "node:fs/promises";
import path from "node:path";
import allTheCities from "all-the-cities";
import worldCountries from "world-countries";

const projectRoot = process.cwd();
const inputPath = path.join(projectRoot, "FINAL-dateline-set.csv");
const outputPath = path.join(projectRoot, "src/data/dateline-data.json");
const reviewPath = path.join(projectRoot, "data/dateline-review.json");
const overridesPath = path.join(projectRoot, "data/location-overrides.json");
const cachePath = path.join(projectRoot, "data/geocode-cache.json");

const stateAbbreviations = new Map([
  ["Ala.", "Alabama"],
  ["Ark.", "Arkansas"],
  ["Calif.", "California"],
  ["Colo.", "Colorado"],
  ["D.C.", "District of Columbia"],
  ["DC", "District of Columbia"],
  ["Fla.", "Florida"],
  ["Ga.", "Georgia"],
  ["Ill.", "Illinois"],
  ["Ky.", "Kentucky"],
  ["Md.", "Maryland"],
  ["Mich.", "Michigan"],
  ["Minn.", "Minnesota"],
  ["Miss.", "Mississippi"],
  ["N.C.", "North Carolina"],
  ["N.M.", "New Mexico"],
  ["N.Y.", "New York"],
  ["Okla.", "Oklahoma"],
  ["S.C.", "South Carolina"],
  ["Wash.", "Washington"],
]);

const adminAliases = new Map([
  ["alabama", { countryCode: "US", adminCode: "AL", label: "Alabama" }],
  ["arkansas", { countryCode: "US", adminCode: "AR", label: "Arkansas" }],
  ["california", { countryCode: "US", adminCode: "CA", label: "California" }],
  ["colorado", { countryCode: "US", adminCode: "CO", label: "Colorado" }],
  [
    "district of columbia",
    { countryCode: "US", adminCode: "DC", label: "District of Columbia" },
  ],
  ["florida", { countryCode: "US", adminCode: "FL", label: "Florida" }],
  ["georgia", { countryCode: "US", adminCode: "GA", label: "Georgia" }],
  ["illinois", { countryCode: "US", adminCode: "IL", label: "Illinois" }],
  ["indiana", { countryCode: "US", adminCode: "IN", label: "Indiana" }],
  ["iowa", { countryCode: "US", adminCode: "IA", label: "Iowa" }],
  ["kentucky", { countryCode: "US", adminCode: "KY", label: "Kentucky" }],
  ["maryland", { countryCode: "US", adminCode: "MD", label: "Maryland" }],
  ["michigan", { countryCode: "US", adminCode: "MI", label: "Michigan" }],
  ["minnesota", { countryCode: "US", adminCode: "MN", label: "Minnesota" }],
  ["mississippi", { countryCode: "US", adminCode: "MS", label: "Mississippi" }],
  ["new mexico", { countryCode: "US", adminCode: "NM", label: "New Mexico" }],
  ["new york", { countryCode: "US", adminCode: "NY", label: "New York" }],
  ["north carolina", { countryCode: "US", adminCode: "NC", label: "North Carolina" }],
  ["oklahoma", { countryCode: "US", adminCode: "OK", label: "Oklahoma" }],
  ["south carolina", { countryCode: "US", adminCode: "SC", label: "South Carolina" }],
  ["texas", { countryCode: "US", adminCode: "TX", label: "Texas" }],
  ["utah", { countryCode: "US", adminCode: "UT", label: "Utah" }],
  ["virginia", { countryCode: "US", adminCode: "VA", label: "Virginia" }],
  ["washington", { countryCode: "US", adminCode: "WA", label: "Washington" }],
  ["alberta", { countryCode: "CA", adminCode: "AB", label: "Alberta" }],
  ["british columbia", { countryCode: "CA", adminCode: "BC", label: "British Columbia" }],
  ["nunavut", { countryCode: "CA", adminCode: "NU", label: "Nunavut" }],
  ["northwest territories", { countryCode: "CA", adminCode: "NT", label: "Northwest Territories" }],
  ["ontario", { countryCode: "CA", adminCode: "ON", label: "Ontario" }],
  ["england", { countryCode: "GB", adminCode: "ENG", label: "England" }],
]);

const regionCentroids = {
  florida: { label: "Florida", latitude: 27.6648, longitude: -81.5158 },
  iowa: { label: "Iowa", latitude: 41.878, longitude: -93.0977 },
  "central virginia": {
    label: "Central Virginia",
    latitude: 37.5407,
    longitude: -78.5,
  },
  "western indiana": {
    label: "Western Indiana",
    latitude: 39.7684,
    longitude: -87.3,
  },
  "central cameroon": {
    label: "Central Cameroon",
    latitude: 5.9,
    longitude: 12.7,
  },
  "northern cameroon": {
    label: "Northern Cameroon",
    latitude: 8.6,
    longitude: 13.6,
  },
  "eastern ukraine": {
    label: "Eastern Ukraine",
    latitude: 48.5,
    longitude: 37.5,
  },
};

const facilityPatterns = [
  /^(.+?),\s*(.+)$/,
  /^(.+?) County$/i,
  /^(.+?) Superior Court$/i,
  /^(.+?) International Airport$/i,
  /^(.+?) Airport$/i,
  /^(.+?) Immigration Processing Center,\s*(.+)$/i,
  /^Hall of Justice,\s*(.+)$/i,
  /^Deutsche Oper,\s*(.+)$/i,
];

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLookupKey(value) {
  return normalizeWhitespace(value)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLocationName(location) {
  let normalized = normalizeWhitespace(location)
    .replaceAll("’", "'")
    .replace(/\bthe Netherlands\b/gi, "Netherlands")
    .replace(/\bthe Philippines\b/gi, "Philippines")
    .replace(/\bthe United Arab Emirates\b/gi, "United Arab Emirates")
    .replace(/\bthe West Bank\b/gi, "West Bank");

  normalized = normalized
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      return stateAbbreviations.get(trimmed) || trimmed;
    })
    .join(", ");

  return normalized;
}

function normalizeDate(dateString) {
  const [month, day, year] = dateString.split("/").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function labelForDate(dateKey) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

function roundCoordinate(value) {
  return Number.parseFloat(value.toFixed(4));
}

function buildLocationId(label, latitude, longitude) {
  return `${slugify(label)}_${String(latitude).replace(".", "_")}_${String(longitude).replace(".", "_")}`;
}

function getPopulationScore(population) {
  if (!population) {
    return 0;
  }

  return Math.min(30, Math.log10(population + 1) * 5);
}

function buildCountryLookup() {
  const lookup = new Map();

  for (const country of worldCountries) {
    const names = [
      country.name?.common,
      country.name?.official,
      ...(country.altSpellings || []),
      country.cca2,
      country.cca3,
    ].filter(Boolean);

    for (const name of names) {
      lookup.set(normalizeLookupKey(name), country);
    }
  }

  return lookup;
}

function buildCityIndex() {
  const index = new Map();

  for (const city of allTheCities) {
    for (const name of [city.name, city.altName]) {
      if (!name) {
        continue;
      }

      const key = normalizeLookupKey(name);
      const bucket = index.get(key) || [];
      bucket.push(city);
      index.set(key, bucket);
    }
  }

  return index;
}

function extractQueryVariants(normalizedLocation) {
  const variants = new Set([normalizedLocation]);

  const parts = normalizedLocation.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts[0]) {
    variants.add(parts[0]);
  }

  if (parts.length > 1) {
    variants.add(parts.slice(1).join(", "));
    variants.add(parts[parts.length - 1]);
  }

  for (const pattern of facilityPatterns) {
    const match = normalizedLocation.match(pattern);
    if (!match) {
      continue;
    }

    for (const capture of match.slice(1)) {
      if (capture) {
        variants.add(normalizeWhitespace(capture));
      }
    }
  }

  return [...variants].filter(Boolean);
}

function buildContext(normalizedLocation, countryLookup) {
  const context = {
    countryCode: null,
    adminCode: null,
  };

  const parts = normalizedLocation.split(",").map((part) => part.trim());

  for (const part of parts) {
    const country = countryLookup.get(normalizeLookupKey(part));
    if (country) {
      context.countryCode = country.cca2;
      break;
    }
  }

  for (const part of parts) {
    const admin = adminAliases.get(normalizeLookupKey(part));
    if (admin) {
      context.countryCode = admin.countryCode;
      context.adminCode = admin.adminCode;
      break;
    }
  }

  return context;
}

function scoreCityCandidate(city, queryVariant, context) {
  let score = getPopulationScore(city.population);
  const normalizedQuery = normalizeLookupKey(queryVariant);
  const exactNameMatch = normalizeLookupKey(city.name) === normalizedQuery;
  const exactAltMatch = city.altName
    ? normalizeLookupKey(city.altName) === normalizedQuery
    : false;

  if (exactNameMatch || exactAltMatch) {
    score += 60;
  }

  if (context.countryCode && city.country === context.countryCode) {
    score += 35;
  }

  if (context.adminCode && city.adminCode === context.adminCode) {
    score += 35;
  }

  if (city.featureCode?.startsWith("PPL")) {
    score += 5;
  }

  return score;
}

function buildCountryLabel(country) {
  return country.name?.common || country.cca3;
}

function buildLocationLabel(city, countryLookup) {
  const country = [...countryLookup.values()].find(
    (candidate) => candidate.cca2 === city.country,
  );
  const admin = [...adminAliases.values()].find(
    (candidate) =>
      candidate.countryCode === city.country && candidate.adminCode === city.adminCode,
  );

  if (city.country === "US" && admin) {
    return `${city.name}, ${admin.label}`;
  }

  if (city.country === "GB" && city.adminCode === "ENG") {
    return `${city.name}, England`;
  }

  if (country) {
    return `${city.name}, ${buildCountryLabel(country)}`;
  }

  return city.name;
}

function resolveOfflineLocation(rawLocation, normalizedLocation, countryLookup, cityIndex) {
  const regionMatch = regionCentroids[normalizeLookupKey(normalizedLocation)];
  if (regionMatch) {
    return {
      status: "review",
      reason: "Resolved to a regional centroid rather than an exact place.",
      label: regionMatch.label,
      latitude: regionMatch.latitude,
      longitude: regionMatch.longitude,
      matches: [
        {
          displayName: regionMatch.label,
          latitude: regionMatch.latitude,
          longitude: regionMatch.longitude,
          score: 55,
        },
      ],
      attemptedQueries: [normalizedLocation],
    };
  }

  const exactCountry = countryLookup.get(normalizeLookupKey(normalizedLocation));
  if (exactCountry?.latlng?.length === 2) {
    return {
      status: "review",
      reason: "Resolved to a country centroid rather than an exact place.",
      label: buildCountryLabel(exactCountry),
      latitude: roundCoordinate(exactCountry.latlng[0]),
      longitude: roundCoordinate(exactCountry.latlng[1]),
      matches: [
        {
          displayName: buildCountryLabel(exactCountry),
          latitude: roundCoordinate(exactCountry.latlng[0]),
          longitude: roundCoordinate(exactCountry.latlng[1]),
          score: 50,
        },
      ],
      attemptedQueries: [normalizedLocation],
    };
  }

  const attemptedQueries = extractQueryVariants(normalizedLocation);
  const context = buildContext(normalizedLocation, countryLookup);
  let best = null;

  for (const queryVariant of attemptedQueries) {
    const candidates = cityIndex.get(normalizeLookupKey(queryVariant)) || [];
    const scored = candidates
      .map((city) => ({
        city,
        score: scoreCityCandidate(city, queryVariant, context),
      }))
      .sort((left, right) => right.score - left.score);

    if (!scored[0]) {
      continue;
    }

    if (!best || scored[0].score > best.top.score) {
      best = {
        queryVariant,
        top: scored[0],
        second: scored[1] || null,
        matches: scored.slice(0, 3).map(({ city, score }) => ({
          displayName: buildLocationLabel(city, countryLookup),
          latitude: roundCoordinate(city.loc.coordinates[1]),
          longitude: roundCoordinate(city.loc.coordinates[0]),
          score,
        })),
      };
    }
  }

  if (!best) {
    return {
      status: "unresolved",
      reason: "No offline city or country match was found.",
      attemptedQueries,
      matches: [],
    };
  }

  const requiresReview =
    best.top.score < 75 || (best.second && best.top.score - best.second.score < 10);
  const latitude = roundCoordinate(best.top.city.loc.coordinates[1]);
  const longitude = roundCoordinate(best.top.city.loc.coordinates[0]);

  return {
    status: requiresReview ? "review" : "resolved",
    reason: requiresReview
      ? "Best offline match is usable but still needs a quick human review."
      : "Resolved from the offline city dataset.",
    label: buildLocationLabel(best.top.city, countryLookup),
    latitude,
    longitude,
    attemptedQueries,
    matches: best.matches,
  };
}

async function readJson(filePath, fallbackValue) {
  try {
    const file = await fs.readFile(filePath, "utf8");
    return JSON.parse(file);
  } catch {
    return fallbackValue;
  }
}

async function main() {
  const csv = await fs.readFile(inputPath, "utf8");
  const overrides = await readJson(overridesPath, {});
  const lines = csv.trim().split(/\r?\n/);
  const rows = lines.slice(1).map(parseCsvLine).map(([rawLocation, rawDate]) => ({
    rawLocation,
    rawDate,
    dateKey: normalizeDate(rawDate),
    normalizedLocation: normalizeLocationName(rawLocation),
  }));

  const uniqueLocations = [...new Set(rows.map((row) => row.rawLocation))];
  const countryLookup = buildCountryLookup();
  const cityIndex = buildCityIndex();
  const locationRecords = {};
  const locationIdsByDedupeKey = new Map();
  const reviewItems = [];
  const resolutionByRawLocation = new Map();

  for (const [index, rawLocation] of uniqueLocations.entries()) {
    const matchingRows = rows.filter((row) => row.rawLocation === rawLocation);
    const normalizedLocation = matchingRows[0].normalizedLocation;
    const override = overrides[rawLocation];

    if (override) {
      const latitude = roundCoordinate(Number(override.latitude));
      const longitude = roundCoordinate(Number(override.longitude));
      const label = override.label || normalizedLocation;
      const dedupeKey = `${slugify(label)}:${latitude}:${longitude}`;
      const existingId = locationIdsByDedupeKey.get(dedupeKey);
      const locationId = existingId || buildLocationId(label, latitude, longitude);

      if (!existingId) {
        locationIdsByDedupeKey.set(dedupeKey, locationId);
        locationRecords[locationId] = {
          id: locationId,
          label,
          latitude,
          longitude,
          sourceNames: [],
          sourceDates: [],
        };
      }

      locationRecords[locationId].sourceNames.push(rawLocation);
      resolutionByRawLocation.set(rawLocation, { status: "resolved", locationId });
    } else {
      const resolution = resolveOfflineLocation(
        rawLocation,
        normalizedLocation,
        countryLookup,
        cityIndex,
      );

      if (resolution.status === "unresolved") {
        reviewItems.push({
          rawLocation,
          normalizedQuery: normalizedLocation,
          dates: [...new Set(matchingRows.map((row) => row.dateKey))].sort(),
          status: "unresolved",
          reason: resolution.reason,
          attemptedQueries: resolution.attemptedQueries,
          matches: resolution.matches,
        });
        resolutionByRawLocation.set(rawLocation, { status: "unresolved" });
      } else {
        const dedupeKey = `${slugify(resolution.label)}:${resolution.latitude}:${resolution.longitude}`;
        const existingId = locationIdsByDedupeKey.get(dedupeKey);
        const locationId =
          existingId ||
          buildLocationId(resolution.label, resolution.latitude, resolution.longitude);

        if (!existingId) {
          locationIdsByDedupeKey.set(dedupeKey, locationId);
          locationRecords[locationId] = {
            id: locationId,
            label: resolution.label,
            latitude: resolution.latitude,
            longitude: resolution.longitude,
            sourceNames: [],
            sourceDates: [],
          };
        }

        locationRecords[locationId].sourceNames.push(rawLocation);
        resolutionByRawLocation.set(rawLocation, { status: "resolved", locationId });

        if (resolution.status === "review") {
          reviewItems.push({
            rawLocation,
            normalizedQuery: normalizedLocation,
            dates: [...new Set(matchingRows.map((row) => row.dateKey))].sort(),
            status: "review",
            reason: resolution.reason,
            attemptedQueries: resolution.attemptedQueries,
            matches: resolution.matches,
          });
        }
      }
    }

    if ((index + 1) % 25 === 0 || index === uniqueLocations.length - 1) {
      console.log(`Processed ${index + 1}/${uniqueLocations.length} locations`);
    }
  }

  const dates = {};

  for (const row of rows) {
    if (!dates[row.dateKey]) {
      dates[row.dateKey] = {
        label: labelForDate(row.dateKey),
        locationIds: [],
        rawLocationCount: 0,
      };
    }

    dates[row.dateKey].rawLocationCount += 1;
    const resolution = resolutionByRawLocation.get(row.rawLocation);

    if (resolution?.status !== "resolved") {
      continue;
    }

    if (!dates[row.dateKey].locationIds.includes(resolution.locationId)) {
      dates[row.dateKey].locationIds.push(resolution.locationId);
    }

    const locationRecord = locationRecords[resolution.locationId];
    if (!locationRecord.sourceDates.includes(row.dateKey)) {
      locationRecord.sourceDates.push(row.dateKey);
    }
  }

  for (const locationRecord of Object.values(locationRecords)) {
    locationRecord.sourceNames.sort((left, right) => left.localeCompare(right));
    locationRecord.sourceDates.sort();
  }

  for (const dateRecord of Object.values(dates)) {
    dateRecord.locationIds.sort();
  }

  const data = {
    meta: {
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      uniqueRawLocations: uniqueLocations.length,
      resolvedLocationCount: Object.keys(locationRecords).length,
      unresolvedLocationCount: reviewItems.filter(
        (item) => item.status === "unresolved",
      ).length,
      reviewLocationCount: reviewItems.filter((item) => item.status === "review")
        .length,
    },
    locations: locationRecords,
    dates,
    review: reviewItems.sort((left, right) =>
      left.rawLocation.localeCompare(right.rawLocation),
    ),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  await fs.writeFile(reviewPath, `${JSON.stringify(data.review, null, 2)}\n`);
  await fs.writeFile(cachePath, `${JSON.stringify({ offline: true }, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        outputPath,
        reviewPath,
        resolvedLocationCount: data.meta.resolvedLocationCount,
        unresolvedLocationCount: data.meta.unresolvedLocationCount,
        reviewLocationCount: data.meta.reviewLocationCount,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
