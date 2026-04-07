"use client";

import { useEffect, useMemo, useState } from "react";
import { datelineData } from "@/lib/dateline-data";
import { WorldMap } from "@/components/world-map";

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

type AnimatedLocationStep = {
  locationId: string;
  onStart: number;
  onDuration: number;
  offStart: number;
  offDuration: number;
};

type AnimatedDateStep = {
  dateKey: string;
  startOffset: number;
  endOffset: number;
  steps: AnimatedLocationStep[];
};

const visibleWeekDays = [
  [8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 21],
  [22, 23, 24, 25, 26, 27, 28],
];
const visibleDateKeys = visibleWeekDays.flat().map(formatDateKey);
const animationDateKeys = Object.keys(datelineData.dates)
  .filter((dateKey) => visibleDateKeys.includes(dateKey))
  .sort();
const calendarGridTemplate = "3rem repeat(7, minmax(5.25rem, 1fr))";
const ON_WINDOW_MS = 3600;
const FULLY_ON_HOLD_MS = 2000;
const OFF_WINDOW_MS = 3600;
const DAY_STAGGER_MS = 7000;
const MIN_FADE_MS = 280;
const MAX_FADE_MS = 700;

function formatDateKey(day: number) {
  return `2026-03-${String(day).padStart(2, "0")}`;
}

function formatShortDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

function shuffle<T>(items: T[]) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildStepSequence(
  locationIds: string[],
  cycleStartOffset: number,
): AnimatedLocationStep[] {
  const onOrder = shuffle(locationIds);
  const offOrder = shuffle(locationIds);
  const offIndexByLocationId = new Map(
    offOrder.map((locationId, index) => [locationId, index]),
  );
  const stepSize = locationIds.length > 0 ? ON_WINDOW_MS / locationIds.length : 0;
  const offStepSize = locationIds.length > 0 ? OFF_WINDOW_MS / locationIds.length : 0;

  return onOrder.map((locationId, index) => {
    const onStart =
      cycleStartOffset +
      index * stepSize +
      randomBetween(0, Math.max(stepSize * 0.55, 40));
    const onDuration = randomBetween(MIN_FADE_MS, MAX_FADE_MS);
    const offIndex = offIndexByLocationId.get(locationId) ?? index;
    const offStart =
      cycleStartOffset +
      ON_WINDOW_MS +
      FULLY_ON_HOLD_MS +
      offIndex * offStepSize +
      randomBetween(0, Math.max(offStepSize * 0.55, 40));
    const offDuration = randomBetween(MIN_FADE_MS, MAX_FADE_MS);

    return {
      locationId,
      onStart,
      onDuration,
      offStart,
      offDuration,
    };
  });
}

function buildAnimationPlan() {
  return animationDateKeys.map((dateKey, index) => {
    const startOffset = index * DAY_STAGGER_MS;
    const dateRecord = datelineData.dates[dateKey];
    const steps = buildStepSequence(dateRecord.locationIds, startOffset);

    return {
      dateKey,
      startOffset,
      endOffset:
        startOffset +
        ON_WINDOW_MS +
        FULLY_ON_HOLD_MS +
        OFF_WINDOW_MS +
        MAX_FADE_MS,
      steps,
    } satisfies AnimatedDateStep;
  });
}

function getStepOpacity(step: AnimatedLocationStep, elapsedMs: number) {
  if (elapsedMs < step.onStart) {
    return 0;
  }

  if (elapsedMs < step.onStart + step.onDuration) {
    return (elapsedMs - step.onStart) / step.onDuration;
  }

  if (elapsedMs < step.offStart) {
    return 1;
  }

  if (elapsedMs < step.offStart + step.offDuration) {
    return 1 - (elapsedMs - step.offStart) / step.offDuration;
  }

  return 0;
}

function getWeekDateKeys(days: number[]) {
  return days.map(formatDateKey);
}

export function DatelineExplorer() {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [activePanelDate, setActivePanelDate] = useState<string | null>(null);
  const [animationPlan, setAnimationPlan] = useState<AnimatedDateStep[] | null>(
    null,
  );
  const [animationStartedAt, setAnimationStartedAt] = useState<number | null>(null);
  const [animationElapsedMs, setAnimationElapsedMs] = useState(0);
  const [animationSpeedMultiplier, setAnimationSpeedMultiplier] = useState(1);

  const animationActive = Boolean(animationPlan && animationStartedAt !== null);

  useEffect(() => {
    if (!animationActive || animationStartedAt === null) {
      return;
    }

    let frameId = 0;

    const tick = () => {
      const elapsedMs =
        (performance.now() - animationStartedAt) * animationSpeedMultiplier;
      const totalDuration =
        animationPlan?.[animationPlan.length - 1]?.endOffset ?? 0;

      if (elapsedMs >= totalDuration) {
        setAnimationElapsedMs(totalDuration);
        setAnimationPlan(null);
        setAnimationStartedAt(null);
        return;
      }

      setAnimationElapsedMs(elapsedMs);
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [animationActive, animationPlan, animationSpeedMultiplier, animationStartedAt]);

  const animatedDateKeys = useMemo(() => {
    if (!animationPlan) {
      return new Set<string>();
    }

    return new Set(
      animationPlan
        .filter(
          (dateStep) =>
            animationElapsedMs >= dateStep.startOffset &&
            animationElapsedMs <= dateStep.endOffset,
        )
        .map((dateStep) => dateStep.dateKey),
    );
  }, [animationElapsedMs, animationPlan]);

  const selectedMarkers = useMemo<MarkerSummary[]>(() => {
    const markerMap = new Map<string, MarkerSummary>();
    const orderedSelectedDates = [...selectedDates].sort();

    for (const dateKey of orderedSelectedDates) {
      const dateRecord = datelineData.dates[dateKey];

      if (!dateRecord) {
        continue;
      }

      for (const locationId of dateRecord.locationIds) {
        const location = datelineData.locations[locationId];
        const articleCount = dateRecord.locationArticleCounts[locationId] ?? 0;

        if (!location) {
          continue;
        }

        const existing = markerMap.get(locationId);
        const articles = (dateRecord.locationArticles[locationId] || []).map(
          (article) => ({
            ...article,
            dateKey,
          }),
        );

        if (existing) {
          if (!existing.sourceDates.includes(dateKey)) {
            existing.sourceDates.push(dateKey);
            existing.articleCount += articleCount;
            existing.articles.push(...articles);
            existing.hasTooManyHeadlines =
              existing.hasTooManyHeadlines || existing.articles.length > 12;
          }
          continue;
        }

        markerMap.set(locationId, {
          ...location,
          articleCount,
          articles,
          hasTooManyHeadlines: articles.length > 12,
          sourceDates: [dateKey],
        });
      }
    }

    if (animationPlan) {
      for (const dateStep of animationPlan) {
        const dateRecord = datelineData.dates[dateStep.dateKey];

        if (!dateRecord) {
          continue;
        }

        for (const step of dateStep.steps) {
          const opacity = getStepOpacity(step, animationElapsedMs);

          if (opacity <= 0) {
            continue;
          }

          const location = datelineData.locations[step.locationId];

          if (!location) {
            continue;
          }

          const existing = markerMap.get(step.locationId);
          const articleCount = dateRecord.locationArticleCounts[step.locationId] ?? 0;
          const articles = (dateRecord.locationArticles[step.locationId] || []).map(
            (article) => ({
              ...article,
              dateKey: dateStep.dateKey,
            }),
          );

          if (existing) {
            existing.opacity = Math.max(existing.opacity ?? 0, opacity);
            if (!existing.sourceDates.includes(dateStep.dateKey)) {
              existing.sourceDates.push(dateStep.dateKey);
              existing.articleCount += articleCount;
              existing.articles.push(...articles);
              existing.hasTooManyHeadlines =
                existing.hasTooManyHeadlines || existing.articles.length > 12;
            }
            continue;
          }

          markerMap.set(step.locationId, {
            ...location,
            articleCount,
            articles,
            hasTooManyHeadlines: articles.length > 12,
            sourceDates: [dateStep.dateKey],
            opacity,
          });
        }
      }
    }

    return [...markerMap.values()]
      .map((marker) => ({
        ...marker,
        articles: marker.hasTooManyHeadlines
          ? marker.articles
          : marker.articles.slice(0, 12),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [animationElapsedMs, animationPlan, selectedDates]);

  const selectedDatePanels = useMemo(() => {
    return selectedDates
      .map((dateKey) => {
        const dateRecord = datelineData.dates[dateKey];

        if (!dateRecord) {
          return null;
        }

        return {
          dateKey,
          label: `${formatShortDate(dateKey)} datelines (${dateRecord.locationIds.length})`,
          locations: dateRecord.locationIds
            .map((locationId) => {
              const location = datelineData.locations[locationId];
              const articleCount = dateRecord.locationArticleCounts[locationId] ?? 0;
              const articles = dateRecord.locationArticles[locationId] || [];

              if (!location) {
                return null;
              }

              return {
                id: locationId,
                label:
                  articleCount > 1
                    ? `${location.label} (${articleCount} articles)`
                    : location.label,
                articles,
              };
            })
            .filter(
              (
                location,
              ): location is {
                id: string;
                label: string;
                articles: Array<{ headline: string; url: string }>;
              } => Boolean(location),
            ),
        };
      })
      .filter(
        (
          panel,
        ): panel is {
          dateKey: string;
          label: string;
          locations: Array<{
            id: string;
            label: string;
            articles: Array<{ headline: string; url: string }>;
          }>;
        } => Boolean(panel),
      );
  }, [selectedDates]);

  const resolvedActivePanelDate =
    activePanelDate && selectedDates.includes(activePanelDate)
      ? activePanelDate
      : (selectedDates[selectedDates.length - 1] ?? null);

  const activeDatePanel =
    selectedDatePanels.find((panel) => panel.dateKey === resolvedActivePanelDate) ??
    null;

  function toggleDate(dateKey: string) {
    setSelectedDates((current) => {
      if (current.includes(dateKey)) {
        const next = current.filter((value) => value !== dateKey);

        if (activePanelDate === dateKey) {
          setActivePanelDate(next[next.length - 1] ?? null);
        }

        return next;
      }

      setActivePanelDate(dateKey);
      return [...current, dateKey];
    });
  }

  function toggleWeek(days: number[]) {
    const weekDateKeys = getWeekDateKeys(days).filter((dateKey) =>
      Boolean(datelineData.dates[dateKey]),
    );

    if (weekDateKeys.length === 0) {
      return;
    }

    setSelectedDates((current) => {
      const allSelected = weekDateKeys.every((dateKey) => current.includes(dateKey));

      if (allSelected) {
        const next = current.filter((dateKey) => !weekDateKeys.includes(dateKey));

        if (activePanelDate && weekDateKeys.includes(activePanelDate)) {
          setActivePanelDate(next[next.length - 1] ?? null);
        }

        return next;
      }

      const next = current.filter((dateKey) => !weekDateKeys.includes(dateKey));
      const nextSelectedDates = [...next, ...weekDateKeys];
      setActivePanelDate(weekDateKeys[weekDateKeys.length - 1] ?? null);
      return nextSelectedDates;
    });
  }

  function stopAnimation() {
    setAnimationPlan(null);
    setAnimationStartedAt(null);
    setAnimationElapsedMs(0);
    setAnimationSpeedMultiplier(1);
  }

  function toggleAnimation(speedMultiplier = 1) {
    if (animationActive) {
      stopAnimation();
      return;
    }

    setSelectedDates([]);
    setActivePanelDate(null);
    setAnimationElapsedMs(0);
    setAnimationSpeedMultiplier(speedMultiplier);
    setAnimationPlan(buildAnimationPlan());
    setAnimationStartedAt(performance.now());
  }

  return (
    <main className="min-h-screen bg-[#111214] px-4 py-6 text-stone-100 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-5 z-10 flex justify-center px-6">
            <h1 className="font-[Iowan_Old_Style,Baskerville,Palatino,'Times_New_Roman',serif] text-3xl font-semibold tracking-tight text-stone-50 drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] md:text-5xl">
              NYT Dateline Viewer
            </h1>
          </div>
          <WorldMap markers={selectedMarkers} />
          <p className="mt-3 text-right text-xs leading-5 text-stone-500">
            * Countries and U.S. states where The Times maintains an ongoing
            physical presence are highlighted.
          </p>
        </div>

        <div className="grid gap-x-8 gap-y-3 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 text-sm text-stone-200 md:grid-cols-2">
              <div className="rounded-2xl border border-stone-800 bg-stone-900/70 px-4 py-3">
                <p className="text-3xl font-semibold text-stone-50">
                  {selectedDates.length}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-400">
                  Selected dates
                </p>
              </div>
              <div className="rounded-2xl border border-stone-800 bg-stone-900/70 px-4 py-3">
                <p className="text-3xl font-semibold text-stone-50">
                  {selectedMarkers.length}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-400">
                  Unique datelines
                </p>
              </div>
            </div>
            {selectedDatePanels.length > 0 && activeDatePanel ? (
              <div className="flex min-h-[21rem] overflow-hidden rounded-[1.5rem] border border-stone-800 bg-stone-900/50">
                <div className="flex w-[3.5rem] flex-col gap-2 border-r border-stone-800 bg-stone-950/70 p-2">
                  {selectedDatePanels.map((panel) => {
                    const dayLabel = new Date(`${panel.dateKey}T12:00:00`).getDate();
                    const isActive = panel.dateKey === activeDatePanel.dateKey;

                    return (
                      <button
                        key={panel.dateKey}
                        type="button"
                        onClick={() => setActivePanelDate(panel.dateKey)}
                        className={[
                          "flex min-h-[4.75rem] flex-col items-center justify-center rounded-xl border px-1 py-2 text-center transition",
                          isActive
                            ? "border-[#d0a06d] bg-[#d0a06d] text-stone-950 shadow-lg"
                            : "border-stone-800 bg-stone-950/60 text-stone-300 hover:bg-stone-900",
                        ].join(" ")}
                        aria-label={`Show ${formatShortDate(panel.dateKey)} datelines`}
                      >
                        <span
                          className={[
                            "text-[9px] font-semibold uppercase tracking-[0.18em]",
                            isActive ? "text-stone-800" : "text-stone-500",
                          ].join(" ")}
                        >
                          Mar
                        </span>
                        <span className="mt-1 text-xl font-semibold leading-none">
                          {dayLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 p-4">
                  <p className="text-lg font-semibold text-stone-50">
                    {activeDatePanel.label}
                  </p>
                  <div className="mt-4 space-y-4">
                    {activeDatePanel.locations.map((location) => (
                      <div key={`${activeDatePanel.dateKey}-${location.id}`}>
                        <p className="text-sm font-medium leading-6 text-stone-200">
                          {location.label}
                        </p>
                        <div className="mt-1.5 space-y-1.5">
                          {location.articles.map((article) => (
                            <a
                              key={`${location.id}-${article.url}`}
                              href={article.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-sm leading-5 text-stone-400 underline decoration-stone-700 underline-offset-2 transition hover:text-stone-200 hover:decoration-stone-400"
                            >
                              {article.headline}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-stone-800 bg-stone-900/30 p-4 text-sm leading-6 text-stone-500">
                Select a date on the calendar to list that day&apos;s datelines
                here.
              </div>
            )}
          </div>

          <div className="rounded-[1.75rem] border border-stone-800 bg-stone-950/70 p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="mt-2 text-2xl font-semibold text-stone-50">
                  March 2026
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleAnimation(2)}
                  className="rounded-full border border-stone-700 bg-stone-900 px-4 py-2 text-sm font-medium text-stone-200 transition hover:bg-stone-800"
                >
                  {animationActive ? "Stop animation" : "Play animation"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDates([])}
                  className="rounded-full border border-stone-700 bg-stone-900 px-4 py-2 text-sm font-medium text-stone-200 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={selectedDates.length === 0}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <div className="min-w-[43rem] space-y-2">
                <div
                  className="grid gap-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-stone-500"
                  style={{ gridTemplateColumns: calendarGridTemplate }}
                >
                  <div />
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
              {visibleWeekDays.map((weekDays, weekIndex) => {
                const weekDateKeys = getWeekDateKeys(weekDays);
                const activeWeekDateKeys = weekDateKeys.filter((dateKey) =>
                  Boolean(datelineData.dates[dateKey]),
                );
                const isWeekSelected =
                  activeWeekDateKeys.length > 0 &&
                  activeWeekDateKeys.every((dateKey) => selectedDates.includes(dateKey));

                return (
                  <div
                    key={`week-${weekIndex}`}
                    className="grid gap-2"
                    style={{ gridTemplateColumns: calendarGridTemplate }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleWeek(weekDays)}
                      className={[
                        "group flex min-h-[5.25rem] w-12 flex-col items-center justify-center justify-self-center rounded-2xl py-2 transition",
                        activeWeekDateKeys.length > 0
                          ? "hover:bg-stone-900/50"
                          : "cursor-default text-stone-600",
                      ].join(" ")}
                      disabled={activeWeekDateKeys.length === 0}
                      aria-label={`Toggle week ${weekIndex + 1}`}
                    >
                      <span
                        className={[
                          "relative flex h-8 w-8 items-center justify-center rounded-full border transition",
                          isWeekSelected
                            ? "border-[#d0a06d] bg-stone-950 shadow-[0_0_0_1px_rgba(208,160,109,0.18)_inset]"
                            : activeWeekDateKeys.length > 0
                              ? "border-stone-600 bg-stone-950/80 group-hover:border-stone-400"
                              : "border-stone-800 bg-stone-950/40",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "h-3.5 w-3.5 rounded-full transition",
                            isWeekSelected
                              ? "bg-[#d0a06d] shadow-[0_0_12px_rgba(208,160,109,0.35)]"
                              : "bg-transparent",
                          ].join(" ")}
                        />
                      </span>
                      <span className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-stone-500">
                        Select week
                      </span>
                    </button>

                    {weekDays.map((day) => {
                      const dateKey = formatDateKey(day);
                      const dayRecord = datelineData.dates[dateKey];
                      const isActive = Boolean(dayRecord);
                      const isSelected = selectedDates.includes(dateKey);
                      const isAnimationChecked = animatedDateKeys.has(dateKey);
                      const showCheckmark = isSelected || isAnimationChecked;

                      return (
                        <button
                          key={dateKey}
                          type="button"
                          onClick={() => isActive && toggleDate(dateKey)}
                          className={[
                            "group aspect-square rounded-2xl border p-2 text-left transition",
                            isActive
                              ? "border-stone-800 bg-stone-900/80 hover:-translate-y-0.5 hover:bg-stone-900"
                              : "cursor-default border-transparent bg-stone-950/60 text-stone-600",
                            showCheckmark
                              ? "border-[#d0a06d] bg-[#d0a06d] text-stone-950 shadow-lg"
                              : "",
                          ].join(" ")}
                          disabled={!isActive}
                        >
                          <div className="relative flex h-full flex-col justify-between">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-semibold">{day}</span>
                            </div>
                            {showCheckmark ? (
                              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-4xl font-bold text-[#2f9e44]">
                                ✓
                              </span>
                            ) : null}
                            <span
                              className={[
                                "text-[11px] leading-4",
                                showCheckmark
                                  ? "text-stone-800"
                                  : isActive
                                    ? "text-stone-400"
                                    : "text-stone-600",
                              ].join(" ")}
                            >
                              {isActive
                                ? `${dayRecord.locationIds.length} dateline${
                                    dayRecord.locationIds.length === 1 ? "" : "s"
                                  }`
                                : "No data"}
                            </span>
                          </div>
                        </button>
                        );
                    })}
                  </div>
                );
              })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-stone-800 bg-stone-900/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
            Data status
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-400">
            Generated data is live. The map uses deduplicated markers across
            selected dates, and the review count tracks rows that still deserve
            a human glance.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-800 bg-stone-950 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Resolved
              </p>
              <p className="mt-2 text-2xl font-semibold text-stone-50">
                {datelineData.meta.resolvedLocationCount}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-800 bg-stone-950 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Review
              </p>
              <p className="mt-2 text-2xl font-semibold text-stone-50">
                {datelineData.meta.reviewLocationCount}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-800 bg-stone-950 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Unresolved
              </p>
              <p className="mt-2 text-2xl font-semibold text-stone-50">
                {datelineData.meta.unresolvedLocationCount}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
