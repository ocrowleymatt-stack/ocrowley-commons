/**
 * Geospatial clustering helpers (geocoding left to host adapters).
 * Source: nexus-backend services/geospatialService.js clustering path.
 */

export interface GeoPoint {
  id: string;
  value: string;
  lat: number;
  lon: number;
  displayName?: string;
  confidence?: number;
  type?: string;
  source?: string;
}

export interface GeoCluster {
  center: GeoPoint;
  points: GeoPoint[];
  radius: number;
}

export interface GeospatialBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeospatialResult {
  points: GeoPoint[];
  clusters: GeoCluster[];
  bounds: GeospatialBounds | null;
}

/** Rough degree threshold (~5km near equator). */
export function clusterGeoPoints(points: GeoPoint[], degreeThreshold = 0.05): GeospatialResult {
  const clusters: GeoCluster[] = [];
  const used = new Set<number>();

  points.forEach((point, i) => {
    if (used.has(i)) return;
    const cluster: GeoCluster = { center: point, points: [point], radius: 0 };
    points.forEach((other, j) => {
      if (i === j || used.has(j)) return;
      const dist = Math.hypot(point.lat - other.lat, point.lon - other.lon);
      if (dist < degreeThreshold) {
        cluster.points.push(other);
        used.add(j);
      }
    });
    used.add(i);
    cluster.radius = cluster.points.length * 0.01;
    clusters.push(cluster);
  });

  return {
    points,
    clusters,
    bounds:
      points.length > 0
        ? {
            north: Math.max(...points.map(p => p.lat)),
            south: Math.min(...points.map(p => p.lat)),
            east: Math.max(...points.map(p => p.lon)),
            west: Math.min(...points.map(p => p.lon)),
          }
        : null,
  };
}

export type GeocodeFn = (location: string) => Promise<{
  lat: number;
  lon: number;
  displayName?: string;
  type?: string;
} | null>;

export async function buildGeospatialData(
  candidates: Array<{ id: string; value: string; type?: string; confidence?: number; source?: string }>,
  geocode: GeocodeFn,
  options: { limit?: number; delayMs?: number } = {},
): Promise<GeospatialResult & { totalLocations: number; geocodedCount: number }> {
  const limit = options.limit ?? 30;
  const delayMs = options.delayMs ?? 200;
  const locationPoints = candidates.filter(
    dp =>
      dp.type === 'location' ||
      dp.type === 'address' ||
      dp.type === 'place' ||
      (dp.value &&
        /\b(street|road|avenue|lane|drive|court|place|square|london|manchester|birmingham|uk|england|wales|scotland)\b/i.test(
          dp.value,
        )),
  );

  const geocoded: GeoPoint[] = [];
  for (const point of locationPoints.slice(0, limit)) {
    const coords = await geocode(point.value);
    if (coords) {
      geocoded.push({
        id: point.id,
        value: point.value,
        lat: coords.lat,
        lon: coords.lon,
        displayName: coords.displayName,
        confidence: point.confidence ?? 50,
        type: point.type,
        source: point.source ?? 'unknown',
      });
    }
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }

  const clustered = clusterGeoPoints(geocoded);
  return {
    ...clustered,
    totalLocations: locationPoints.length,
    geocodedCount: geocoded.length,
  };
}
