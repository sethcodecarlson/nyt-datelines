"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type D3ZoomEvent } from "d3-zoom";
import { feature } from "topojson-client";
import countries110m from "world-atlas/countries-110m.json";

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

const worldAtlasTopology = countries110m as unknown as WorldAtlasTopology;
const worldFeatures = (
  feature(
    worldAtlasTopology as never,
    worldAtlasTopology.objects.countries as never,
  ) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry>
).features as WorldFeature[];
const primaryWorldFeatures = worldFeatures.filter(
  (worldFeature) => worldFeature.properties?.name !== "Antarctica",
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
        height: Math.max(420, Math.round(nextWidth * 0.55)),
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
    selection.call(zoomBehavior.transform, zoomIdentity);

    return () => {
      selection.on(".zoom", null);
      selectionRef.current = null;
      zoomBehaviorRef.current = null;
    };
  }, [size.height, size.width]);

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

    selectionRef.current.call(zoomBehaviorRef.current.transform, zoomIdentity);
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
            {worldFeatures.map((worldFeature, index) => (
              <path
                key={index}
                d={pathGenerator(worldFeature) ?? undefined}
                fill="#1c1d20"
                stroke="#50545c"
                strokeWidth={0.7}
              />
            ))}

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
            <p className="mt-3 text-stone-300">Too many headlines to display.</p>
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
