"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type D3ZoomEvent } from "d3-zoom";
import { feature, mesh } from "topojson-client";
import countries50m from "world-atlas/countries-50m.json";
import land50m from "world-atlas/land-50m.json";
import usStates10m from "us-atlas/states-10m.json";

type MarkerSummary = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  articleCount: number;
  articles: Array<{
    headline: string;
    url: string;
    dateKey: string;
  }>;
  hasTooManyHeadlines: boolean;
  sourceDates: string[];
  opacity?: number;
};

type TooltipState = {
  label: string;
  x: number;
  y: number;
  articleCount: number;
  articles: MarkerSummary["articles"];
  hasTooManyHeadlines: boolean;
};

type WorldFeature = GeoJSON.Feature<GeoJSON.Geometry>;
type TransformState = {
  x: number;
  y: number;
  k: number;
};

type WorldAtlasTopology = {
  type: "Topology";
  objects: {
    countries: unknown;
  };
};

type LandAtlasTopology = {
  type: "Topology";
  objects: {
    land: unknown;
  };
};

type UsAtlasTopology = {
  type: "Topology";
  objects: {
    nation: unknown;
    states: unknown;
  };
};

const worldAtlasTopology = countries50m as unknown as WorldAtlasTopology;
const worldLandTopology = land50m as unknown as LandAtlasTopology;
const usAtlasTopology = usStates10m as unknown as UsAtlasTopology;

const worldFeatures = (
  feature(
    worldAtlasTopology as never,
    worldAtlasTopology.objects.countries as never,
  ) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry>
).features as WorldFeature[];
const primaryWorldFeatures = worldFeatures.filter(
  (worldFeature) => worldFeature.properties?.name !== "Antarctica",
);
const worldLandFeature = feature(
  worldLandTopology as never,
  worldLandTopology.objects.land as never,
) as unknown as GeoJSON.Feature<GeoJSON.Geometry>;
const countryBordersMesh = mesh(
  worldAtlasTopology as never,
  worldAtlasTopology.objects.countries as never,
  (left, right) => left !== right,
) as unknown as GeoJSON.MultiLineString;
const usStatesMesh = mesh(
  usAtlasTopology as never,
  usAtlasTopology.objects.states as never,
  (left, right) => left !== right,
) as unknown as GeoJSON.MultiLineString;
const usStateFeatures = (
  feature(
    usAtlasTopology as never,
    usAtlasTopology.objects.states as never,
  ) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry>
).features as WorldFeature[];
const DEFAULT_VIEW_SCALE = 1.18;
const highlightedCountryNames = new Set([
  "South Korea",
  "Colombia",
  "Australia",
  "Iraq",
  "China",
  "Lebanon",
  "Germany",
  "Brazil",
  "Netherlands",
  "Egypt",
  "Canada",
  "Kenya",
  "Poland",
  "Saudi Arabia",
  "Hong Kong",
  "Turkey",
  "Israel",
  "South Africa",
  "Afghanistan",
  "Spain",
  "Mexico",
  "France",
  "Italy",
  "India",
  "Japan",
  "Ukraine",
  "Vietnam",
  "Senegal",
  "United Kingdom",
]);
const HIGHLIGHT_FILL = "#7a4242";
const highlightedWorldFeatures = primaryWorldFeatures.filter((worldFeature) =>
  highlightedCountryNames.has(String(worldFeature.properties?.name || "")),
);
const highlightedUsStateIds = new Set([
  "36",
  "06",
  "17",
  "04",
  "08",
  "12",
  "13",
  "26",
  "25",
  "37",
  "42",
  "44",
  "47",
  "48",
  "53",
]);
const highlightedUsStateFeatures = usStateFeatures.filter((stateFeature) =>
  highlightedUsStateIds.has(String(stateFeature.id || "")),
);

export function WorldMap({ markers }: { markers: MarkerSummary[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hideTooltipTimeoutRef = useRef<number | null>(null);
  const selectionRef = useRef<ReturnType<typeof select<SVGSVGElement, unknown>> | null>(
    null,
  );
  const zoomBehaviorRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(
    null,
  );
  const [size, setSize] = useState({ width: 960, height: 540 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [transform, setTransform] = useState<TransformState>({
    x: 0,
    y: 0,
    k: 1,
  });

  const markerOuterRadius = Math.max(3, 10 / transform.k);
  const markerInnerRadius = Math.max(2, 5.5 / transform.k);
  const markerStrokeWidth = Math.max(0.75, 2 / transform.k);
  const coastlineStrokeWidth = Math.max(0.5, 1.2 / transform.k);
  const countryBorderStrokeWidth = Math.max(0.35, 0.9 / transform.k);
  const stateBorderStrokeWidth = Math.max(0.2, 0.7 / transform.k);
  const stateBorderOpacity = Math.max(0, Math.min(0.95, (transform.k - 1.15) / 1.75));
  const defaultZoomTransform = useMemo(
    () =>
      zoomIdentity
        .translate(
          (size.width * (1 - DEFAULT_VIEW_SCALE)) / 2,
          (size.height * (1 - DEFAULT_VIEW_SCALE)) / 2,
        )
        .scale(DEFAULT_VIEW_SCALE),
    [size.height, size.width],
  );

  useEffect(
    () => () => {
      if (hideTooltipTimeoutRef.current) {
        window.clearTimeout(hideTooltipTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = entry.contentRect.width;

      setSize({
        width: nextWidth,
        height: Math.max(400, Math.round(nextWidth * 0.48)),
      });
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 16])
      .translateExtent([
        [-size.width * 0.5, -size.height * 0.5],
        [size.width * 1.5, size.height * 1.5],
      ])
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        const next = event.transform;

        setTransform({
          x: next.x,
          y: next.y,
          k: next.k,
        });
      });

    const selection = select(svgRef.current);
    selectionRef.current = selection;
    zoomBehaviorRef.current = zoomBehavior;
    selection.call(zoomBehavior);
    selection.call(zoomBehavior.transform, defaultZoomTransform);

    return () => {
      selection.on(".zoom", null);
      selectionRef.current = null;
      zoomBehaviorRef.current = null;
    };
  }, [defaultZoomTransform, size.height, size.width]);

  const projection = useMemo(
    () =>
      geoMercator()
        .fitExtent(
          [
            [20, 20],
            [size.width - 20, size.height - 20],
          ],
          {
            type: "FeatureCollection",
            features: primaryWorldFeatures,
          },
        )
        .precision(0.1),
    [size.height, size.width],
  );

  const pathGenerator = useMemo(() => geoPath(projection), [projection]);

  const positionedMarkers = useMemo(() => {
    return markers
      .map((marker) => {
        const projected = projection([marker.longitude, marker.latitude]);

        if (!projected) {
          return null;
        }

        return {
          ...marker,
          x: projected[0],
          y: projected[1],
        };
      })
      .filter((marker): marker is MarkerSummary & { x: number; y: number } =>
        Boolean(marker),
      );
  }, [markers, projection]);

  function showTooltip(
    event: React.MouseEvent<SVGCircleElement>,
    marker: MarkerSummary,
  ) {
    if (!containerRef.current) {
      return;
    }

    if (hideTooltipTimeoutRef.current) {
      window.clearTimeout(hideTooltipTimeoutRef.current);
      hideTooltipTimeoutRef.current = null;
    }

    const bounds = containerRef.current.getBoundingClientRect();

    setTooltip({
      label: marker.label,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      articleCount: marker.articleCount,
      articles: marker.articles,
      hasTooManyHeadlines: marker.hasTooManyHeadlines,
    });
  }

  function scheduleHideTooltip() {
    if (hideTooltipTimeoutRef.current) {
      window.clearTimeout(hideTooltipTimeoutRef.current);
    }

    hideTooltipTimeoutRef.current = window.setTimeout(() => {
      setTooltip(null);
      hideTooltipTimeoutRef.current = null;
    }, 120);
  }

  function cancelHideTooltip() {
    if (hideTooltipTimeoutRef.current) {
      window.clearTimeout(hideTooltipTimeoutRef.current);
      hideTooltipTimeoutRef.current = null;
    }
  }

  function handleZoom(direction: "in" | "out") {
    if (!selectionRef.current || !zoomBehaviorRef.current) {
      return;
    }

    selectionRef.current.call(
      zoomBehaviorRef.current.scaleBy,
      direction === "in" ? 1.4 : 1 / 1.4,
    );
  }

  function resetZoom() {
    if (!selectionRef.current || !zoomBehaviorRef.current) {
      return;
    }

    selectionRef.current.call(zoomBehaviorRef.current.transform, defaultZoomTransform);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-stone-800 bg-[linear-gradient(180deg,#1b2b38_0%,#11202d_100%)]">
        <div className="absolute bottom-4 right-4 z-10 flex gap-3">
          <button
            type="button"
            onClick={() => handleZoom("in")}
            className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-stone-700 bg-stone-950/90 text-3xl font-semibold text-stone-100 transition hover:bg-stone-900"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => handleZoom("out")}
            className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-stone-700 bg-stone-950/90 text-3xl font-semibold text-stone-100 transition hover:bg-stone-900"
            aria-label="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="rounded-full border border-stone-700 bg-stone-950/90 px-9 py-4 text-xl font-medium text-stone-200 transition hover:bg-stone-900"
          >
            Reset
          </button>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${size.width} ${size.height}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label="Interactive world map"
        >
          <rect width={size.width} height={size.height} fill="transparent" />
          <g
            transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}
          >
            <path
              d={pathGenerator(worldLandFeature) ?? undefined}
              fill="#1b1c20"
              stroke="#6b7280"
              strokeWidth={coastlineStrokeWidth}
              vectorEffect="non-scaling-stroke"
            />
            {highlightedWorldFeatures.map((worldFeature) => (
              <path
                key={`highlight-${String(worldFeature.properties?.name || worldFeature.id)}`}
                d={pathGenerator(worldFeature) ?? undefined}
                fill={HIGHLIGHT_FILL}
                opacity={0.68}
                stroke="none"
              />
            ))}
            {highlightedUsStateFeatures.map((stateFeature) => (
              <path
                key={`state-highlight-${String(stateFeature.id)}`}
                d={pathGenerator(stateFeature) ?? undefined}
                fill={HIGHLIGHT_FILL}
                opacity={0.68}
                stroke="none"
              />
            ))}
            <path
              d={pathGenerator(countryBordersMesh) ?? undefined}
              fill="none"
              stroke="#7c8593"
              strokeWidth={countryBorderStrokeWidth}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={pathGenerator(usStatesMesh) ?? undefined}
              fill="none"
              stroke="#4d5560"
              strokeWidth={stateBorderStrokeWidth}
              strokeLinejoin="round"
              opacity={stateBorderOpacity}
              vectorEffect="non-scaling-stroke"
            />

            {positionedMarkers.map((marker) => (
              <g key={marker.id} transform={`translate(${marker.x}, ${marker.y})`}>
                <circle
                  r={markerOuterRadius}
                  fill="rgba(219, 174, 111, 0.18)"
                  opacity={marker.opacity ?? 1}
                />
                <circle
                  r={markerInnerRadius}
                  fill="#d0a06d"
                  stroke="#111214"
                  strokeWidth={markerStrokeWidth}
                  opacity={marker.opacity ?? 1}
                  onMouseEnter={(event) => showTooltip(event, marker)}
                  onMouseMove={(event) => showTooltip(event, marker)}
                  onMouseLeave={scheduleHideTooltip}
                />
              </g>
            ))}
          </g>
        </svg>
      </div>
      {tooltip ? (
        <div
          className="absolute z-10 max-h-[24rem] w-[22rem] overflow-y-auto rounded-2xl border border-stone-800 bg-stone-950/95 px-4 py-3 text-sm text-stone-50 shadow-2xl"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y + 12,
          }}
          onMouseEnter={cancelHideTooltip}
          onMouseLeave={scheduleHideTooltip}
        >
          <p className="font-semibold">{tooltip.label}</p>
          <p className="mt-1 text-stone-300">
            {tooltip.articleCount} article{tooltip.articleCount === 1 ? "" : "s"}
          </p>
          {tooltip.hasTooManyHeadlines ? (
            <p className="mt-3 text-stone-300">
              Too many headlines to display. (See list below.)
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {tooltip.articles.map((article) => (
                <a
                  key={`${article.dateKey}-${article.url}`}
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm leading-5 text-stone-100 underline decoration-stone-600 underline-offset-2 transition hover:text-[#d0a06d] hover:decoration-[#d0a06d]"
                >
                  {article.headline}
                </a>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
