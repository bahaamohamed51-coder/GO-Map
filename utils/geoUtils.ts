import { GeoPoint, CustomerData } from '../types';

// Calculate distance between two points in meters
export const getDistanceMeters = (p1: GeoPoint, p2: GeoPoint): number => {
  const R = 6371e3; // metres
  const φ1 = p1.lat * Math.PI / 180;
  const φ2 = p2.lat * Math.PI / 180;
  const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
  const Δλ = (p2.lng - p1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Ray-casting algorithm to check if point is inside polygon
export const isPointInPolygon = (point: GeoPoint, vs: GeoPoint[]): boolean => {
  const x = point.lng, y = point.lat;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].lng, yi = vs[i].lat;
    const xj = vs[j].lng, yj = vs[j].lat;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export const filterDataByPolygon = (data: CustomerData[], polygon: GeoPoint[]): CustomerData[] => {
  return data.filter(d => isPointInPolygon({ lat: d.lat, lng: d.lng }, polygon));
};

export const filterDataByCircle = (data: CustomerData[], center: GeoPoint, radiusMeters: number): CustomerData[] => {
  return data.filter(d => getDistanceMeters({ lat: d.lat, lng: d.lng }, center) <= radiusMeters);
};
