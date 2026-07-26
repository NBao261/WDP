/**
 * Mapbox Directions API Service
 * Gọi REST API để lấy route chỉ đường + hướng dẫn từng bước
 */

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
const DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';

// ─── Types ────────────────────────────────────────────

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  instruction: string;
  distance: number;       // meters
  duration: number;       // seconds
  maneuver: {
    type: string;         // 'turn', 'depart', 'arrive', 'merge', 'fork', ...
    modifier?: string;    // 'left', 'right', 'straight', 'slight left', ...
    location: [number, number]; // [lng, lat]
  };
}

export interface RouteResult {
  coordinates: LatLng[];  // Polyline coordinates
  distance: number;       // Total distance in meters
  duration: number;       // Total duration in seconds
  steps: RouteStep[];     // Turn-by-turn instructions
}

// ─── Helpers ──────────────────────────────────────────

/** Format meters to human-readable */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Format seconds to human-readable */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} phút`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs} giờ ${remainMins} phút` : `${hrs} giờ`;
}

/** Get Ionicons name for maneuver type */
export function getManeuverIcon(type: string, modifier?: string): string {
  if (type === 'depart') return 'navigate';
  if (type === 'arrive') return 'flag';
  if (type === 'roundabout' || type === 'rotary') return 'sync';
  if (type === 'merge') return 'git-merge';
  if (modifier?.includes('left')) return 'arrow-back';
  if (modifier?.includes('right')) return 'arrow-forward';
  if (modifier?.includes('straight')) return 'arrow-up';
  if (modifier?.includes('uturn')) return 'return-down-back';
  return 'arrow-up';
}

/** Calculate haversine distance between two points (meters) */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000; // meters
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── API ──────────────────────────────────────────────

/** Max distance for Mapbox route (500km) */
const MAX_ROUTE_DISTANCE = 500_000;

/**
 * Lấy route chỉ đường từ Mapbox Directions API
 * @param origin Vị trí xuất phát
 * @param destination Vị trí đích
 * @returns RouteResult, hoặc 'TOO_FAR' nếu quá xa, hoặc null nếu lỗi khác
 */
export async function getDirections(
  origin: LatLng,
  destination: LatLng,
): Promise<RouteResult | 'TOO_FAR' | null> {
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'YOUR_MAPBOX_PUBLIC_TOKEN_HERE') {
    console.warn('[Mapbox] Token chưa được cấu hình!');
    return null;
  }

  // Pre-check: if straight-line distance > 500km, skip API call
  const straightLine = haversineDistance(origin, destination);
  if (straightLine > MAX_ROUTE_DISTANCE) {
    console.warn(`[Mapbox] Khoảng cách quá xa: ${(straightLine / 1000).toFixed(0)}km`);
    return 'TOO_FAR';
  }

  try {
    const url = `${DIRECTIONS_URL}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full&steps=true&language=vi`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      console.warn('[Mapbox] Directions API error:', data.code, data.message);
      if (data.message?.includes('distance limitation')) return 'TOO_FAR';
      return null;
    }

    const route = data.routes[0];
    const geometry = route.geometry;

    // Convert GeoJSON coordinates [lng, lat] → LatLng
    const coordinates: LatLng[] = geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng,
      }),
    );

    // Extract steps
    const steps: RouteStep[] = [];
    for (const leg of route.legs) {
      for (const step of leg.steps) {
        steps.push({
          instruction: step.maneuver?.instruction || '',
          distance: step.distance,
          duration: step.duration,
          maneuver: {
            type: step.maneuver?.type || '',
            modifier: step.maneuver?.modifier,
            location: step.maneuver?.location || [0, 0],
          },
        });
      }
    }

    return {
      coordinates,
      distance: route.distance,
      duration: route.duration,
      steps,
    };
  } catch (error) {
    console.error('[Mapbox] Directions error:', error);
    return null;
  }
}

