import { z } from 'zod'
import type { DatasetCatalog } from './datasetCatalog'
import type { AisPlaybackData, FlowForecastData, GeometryConfig, MainCorridorTracksFile } from './sharedContracts'

const LOCAL_ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/
const DATASET_ID_PATTERN = /^[A-Za-z0-9_-]+$/

function normalizeRuntimePath(value: string) {
  return value.trim().replace(/^\/+/, '')
}

const nonEmptyStringSchema = z.string().trim().min(1)
const optionalDisplayStringSchema = z.string().trim().optional().transform((value) => value ?? '')
const localIsoDateTimeSchema = z
  .string()
  .trim()
  .regex(LOCAL_ISO_DATETIME_PATTERN, 'Expected a local ISO timestamp like 2020-01-01T00:00:00')
const finiteNumberSchema = z.number().finite()
const nonNegativeNumberSchema = z.number().finite().nonnegative()
const nonNegativeIntegerSchema = z.number().int().nonnegative()
const runtimePathSchema = z.string().trim().transform(normalizeRuntimePath).pipe(z.string().min(1))
const datasetIdSchema = z.string().trim().regex(DATASET_ID_PATTERN, 'Dataset ids may only contain letters, numbers, "_" or "-"')
const alertLevelSchema = z.enum(['high', 'medium', 'watch'])
const horizonKeySchema = z.enum(['1h', '2h', '3h'])

const geoPointSchema = z
  .object({
    lon: finiteNumberSchema,
    lat: finiteNumberSchema,
  })
  .strict()

const studyBoundsSchema = z
  .object({
    minLon: finiteNumberSchema,
    maxLon: finiteNumberSchema,
    minLat: finiteNumberSchema,
    maxLat: finiteNumberSchema,
  })
  .strict()
  .refine(
    (value) => value.minLon < value.maxLon && value.minLat < value.maxLat,
    'Study bounds must define increasing longitude and latitude ranges',
  )

const datasetCatalogEntrySchema = z
  .object({
    id: datasetIdSchema,
    label: nonEmptyStringSchema,
    description: optionalDisplayStringSchema,
    aisPlaybackPath: runtimePathSchema,
    flowForecastPath: runtimePathSchema.optional(),
  })
  .strict()

export const datasetCatalogSchema: z.ZodType<DatasetCatalog> = z
  .object({
    defaultDatasetId: datasetIdSchema,
    datasets: z.array(datasetCatalogEntrySchema).min(1),
  })
  .strict()
  .refine(
    (value) => value.datasets.some((dataset) => dataset.id === value.defaultDatasetId),
    'defaultDatasetId must match one of the shipped datasets',
  )

const routeGeometrySchema = z
  .object({
    id: nonEmptyStringSchema,
    labelPoint: geoPointSchema,
    marker: z
      .object({
        baseDurationSeconds: nonNegativeNumberSchema,
        radius: nonNegativeNumberSchema,
      })
      .strict(),
    points: z.array(geoPointSchema).min(2),
  })
  .strict()

const hotspotGeometrySchema = z
  .object({
    id: nonEmptyStringSchema,
    routeId: nonEmptyStringSchema,
    point: geoPointSchema,
  })
  .strict()

export const geometryConfigSchema: z.ZodType<GeometryConfig> = z
  .object({
    meta: z
      .object({
        version: nonNegativeIntegerSchema,
        studyArea: studyBoundsSchema,
        routeOrder: z.array(nonEmptyStringSchema).min(1),
        hotspotOrder: z.array(nonEmptyStringSchema).min(1),
      })
      .strict(),
    routes: z.array(routeGeometrySchema).min(1),
    hotspots: z.array(hotspotGeometrySchema).min(1),
    routeFocusMap: z.record(z.string(), nonEmptyStringSchema),
  })
  .strict()

const playbackMotionSchema = z
  .object({
    durationMs: nonNegativeNumberSchema,
    p0: geoPointSchema,
    p1: geoPointSchema,
    p2: geoPointSchema,
    p3: geoPointSchema,
  })
  .strict()

const playbackGeoTimeSchema = geoPointSchema.extend({
  time: localIsoDateTimeSchema,
})

const playbackTargetHintSchema = geoPointSchema.extend({
  routeId: nonEmptyStringSchema,
})

const playbackVesselSchema = z
  .object({
    mmsi: nonEmptyStringSchema,
    type: nonEmptyStringSchema,
    time: localIsoDateTimeSchema,
    lon: finiteNumberSchema,
    lat: finiteNumberSchema,
    sog: nonNegativeNumberSchema,
    cog: finiteNumberSchema,
    head: finiteNumberSchema.nullable().optional().transform((value) => value ?? null),
    heading: finiteNumberSchema,
    routeId: nonEmptyStringSchema,
    routeDistance: nonNegativeNumberSchema.optional(),
    isFocusArea: z.boolean(),
    trail: z.array(geoPointSchema).optional(),
    routeProgress: nonNegativeNumberSchema.optional(),
    nextRouteProgress: nonNegativeNumberSchema.optional(),
    from: playbackGeoTimeSchema.optional(),
    to: playbackGeoTimeSchema.optional(),
    targetHint: playbackTargetHintSchema.optional(),
    motion: playbackMotionSchema.optional(),
  })
  .strict()

const playbackFrameSchema = z
  .object({
    id: nonEmptyStringSchema,
    sceneId: nonEmptyStringSchema,
    bucketTime: localIsoDateTimeSchema,
    displayLabel: nonEmptyStringSchema,
    activeVesselCount: nonNegativeIntegerSchema,
    vessels: z.array(playbackVesselSchema),
  })
  .strict()

export const aisPlaybackDataSchema: z.ZodType<AisPlaybackData> = z
  .object({
    meta: z
      .object({
        source: nonEmptyStringSchema,
        windowStart: localIsoDateTimeSchema,
        windowEnd: localIsoDateTimeSchema,
        coordinateMode: nonEmptyStringSchema,
        bucketMinutes: nonNegativeIntegerSchema,
        samplingMode: nonEmptyStringSchema,
        studyArea: studyBoundsSchema,
        routeIds: z.array(nonEmptyStringSchema).min(1),
      })
      .strict(),
    frames: z.array(playbackFrameSchema).min(1),
  })
  .strict()

const forecastAlertSchema = z
  .object({
    grid: nonEmptyStringSchema,
    level: alertLevelSchema,
    current: finiteNumberSchema,
    future: finiteNumberSchema,
    note: optionalDisplayStringSchema,
  })
  .strict()

const forecastNarrativeSchema = z
  .object({
    phase: optionalDisplayStringSchema,
    status: optionalDisplayStringSchema,
    summary: optionalDisplayStringSchema,
    logs: z.array(z.string().trim()).default([]),
    strategy: z
      .object({
        headline: optionalDisplayStringSchema,
        summary: optionalDisplayStringSchema,
      })
      .strict(),
    recommendations: z
      .array(
        z
          .object({
            target: nonEmptyStringSchema,
            action: nonEmptyStringSchema,
            reason: nonEmptyStringSchema,
            effect: nonEmptyStringSchema,
          })
          .strict(),
      )
      .default([]),
    benefits: z
      .array(
        z
          .object({
            label: nonEmptyStringSchema,
            before: nonEmptyStringSchema,
            after: nonEmptyStringSchema,
            unit: z.string().trim().optional(),
          })
          .strict(),
      )
      .default([]),
    appliedState: z
      .object({
        status: optionalDisplayStringSchema,
        summary: optionalDisplayStringSchema,
        hotspotScale: nonNegativeNumberSchema,
        focusGrid: nonEmptyStringSchema,
        focusRoute: nonEmptyStringSchema,
        alerts: z.array(forecastAlertSchema).default([]),
      })
      .strict(),
  })
  .strict()

const forecastTimelineEntrySchema = z
  .object({
    sceneId: nonEmptyStringSchema,
    time: localIsoDateTimeSchema,
    current: z
      .object({
        totalFlow: finiteNumberSchema,
        visibleVessels: nonNegativeIntegerSchema,
        keyGrids: z.record(z.string(), finiteNumberSchema),
      })
      .strict(),
    forecast: z
      .object({
        '1h': z.object({ totalFlow: finiteNumberSchema, keyGrids: z.record(z.string(), finiteNumberSchema) }).strict(),
        '2h': z.object({ totalFlow: finiteNumberSchema, keyGrids: z.record(z.string(), finiteNumberSchema) }).strict(),
        '3h': z.object({ totalFlow: finiteNumberSchema, keyGrids: z.record(z.string(), finiteNumberSchema) }).strict(),
      })
      .strict(),
    derived: z
      .object({
        focusGrid: nonEmptyStringSchema,
        focusRoute: nonEmptyStringSchema,
        hotspotCount: nonNegativeIntegerSchema,
        hotspots: z
          .array(
            z
              .object({
                id: nonEmptyStringSchema,
                intensity: nonNegativeNumberSchema,
                level: alertLevelSchema,
              })
              .strict(),
          )
          .default([]),
        alerts: z.array(forecastAlertSchema).default([]),
      })
      .strict(),
    narrative: forecastNarrativeSchema,
  })
  .strict()

export const flowForecastDataSchema: z.ZodType<FlowForecastData> = z
  .object({
    meta: z
      .object({
        source: nonEmptyStringSchema,
        model: nonEmptyStringSchema,
        modelConfigPath: runtimePathSchema,
        weightSource: nonEmptyStringSchema,
        weightSha256: nonEmptyStringSchema,
        historyWindowHours: nonNegativeNumberSchema,
        horizons: z.array(horizonKeySchema).min(1),
        hotspotIds: z.array(nonEmptyStringSchema).min(1),
        routeFocusMap: z.record(z.string(), nonEmptyStringSchema),
        forecastMode: nonEmptyStringSchema,
        inferenceResolutionMinutes: nonNegativeIntegerSchema,
        playbackResolutionMinutes: nonNegativeIntegerSchema,
        interpolationMode: nonEmptyStringSchema,
        windowStart: localIsoDateTimeSchema,
        windowEnd: localIsoDateTimeSchema,
        narrativeMode: nonEmptyStringSchema,
        notice: optionalDisplayStringSchema,
      })
      .strict(),
    series: z
      .object({
        totalFlow: z.array(finiteNumberSchema).min(1),
        forecastTotals: z
          .object({
            '1h': z.array(finiteNumberSchema).min(1),
            '2h': z.array(finiteNumberSchema).min(1),
            '3h': z.array(finiteNumberSchema).min(1),
          })
          .strict(),
        hotspots: z.record(z.string(), z.array(finiteNumberSchema).min(1)),
      })
      .strict(),
    timeline: z.array(forecastTimelineEntrySchema).min(1),
  })
  .strict()

const mainCorridorTrackPointSchema = z
  .object({
    lat: finiteNumberSchema,
    lon: finiteNumberSchema,
    time: localIsoDateTimeSchema,
    cog: finiteNumberSchema.nullable(),
  })
  .strict()

const mainCorridorSummaryEntrySchema = z
  .object({
    corridorId: nonEmptyStringSchema,
    trackCount: nonNegativeIntegerSchema,
    directionLabel: nonEmptyStringSchema,
    labelPoint: geoPointSchema,
  })
  .strict()

const mainCorridorTrackEntrySchema = z
  .object({
    id: nonEmptyStringSchema,
    trackId: nonNegativeIntegerSchema,
    corridorId: nonEmptyStringSchema,
    corridorRank: z.number().int().nullable().optional().transform((value) => value ?? null),
    directionBin: nonNegativeIntegerSchema,
    directionLabel: nonEmptyStringSchema,
    pointCount: nonNegativeIntegerSchema,
    labelPoint: geoPointSchema,
    points: z.array(mainCorridorTrackPointSchema).min(2),
  })
  .strict()
  .refine((value) => value.points.length === value.pointCount, 'pointCount must match the number of shipped points')

export const mainCorridorTracksFileSchema: z.ZodType<MainCorridorTracksFile> = z
  .object({
    source: nonEmptyStringSchema,
    summarySource: nonEmptyStringSchema,
    clusterMode: nonEmptyStringSchema,
    requestedClusterMode: nonEmptyStringSchema,
    trackCount: nonNegativeIntegerSchema,
    corridorCount: nonNegativeIntegerSchema,
    studyArea: studyBoundsSchema,
    corridors: z.array(mainCorridorSummaryEntrySchema).min(1),
    tracks: z.array(mainCorridorTrackEntrySchema).min(1),
  })
  .strict()
  .refine((value) => value.corridors.length === value.corridorCount, 'corridorCount must match the number of shipped corridors')
  .refine((value) => value.tracks.length === value.trackCount, 'trackCount must match the number of shipped tracks')

export function parseDatasetCatalog(value: unknown) {
  return datasetCatalogSchema.parse(value)
}

export function parseGeometryConfig(value: unknown) {
  return geometryConfigSchema.parse(value)
}

export function parseAisPlaybackData(value: unknown) {
  return aisPlaybackDataSchema.parse(value)
}

export function parseFlowForecastData(value: unknown) {
  return flowForecastDataSchema.parse(value)
}

export function parseMainCorridorTracksFile(value: unknown) {
  return mainCorridorTracksFileSchema.parse(value)
}
