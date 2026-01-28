import { CustomerData, BoundingBox } from '../types';
import { getDistanceMeters } from './geoUtils';

// Spatial Cache Entry
interface CacheEntry {
    lat: number;
    lng: number;
    address: string;
    scope: 'detailed' | 'broad';
}

// In-memory spatial cache
const spatialCache: CacheEntry[] = [];

// Configuration for spatial grouping
// If a new point is within X meters of a cached point, reuse the address.
const THRESHOLD_DETAILED = 200; // meters (Same neighborhood/street)
const THRESHOLD_BROAD = 2000;   // meters (Same city district/area)

export const fetchAddressForPoint = async (lat: number, lng: number, scope: 'detailed' | 'broad' = 'detailed'): Promise<string> => {
  const threshold = scope === 'broad' ? THRESHOLD_BROAD : THRESHOLD_DETAILED;

  // 1. Spatial Cache Lookup (The "Map Label" Logic)
  // Check if we already have a point nearby with the same scope
  const nearbyEntry = spatialCache.find(entry => 
      entry.scope === scope && 
      getDistanceMeters({ lat, lng }, { lat: entry.lat, lng: entry.lng }) < threshold
  );

  if (nearbyEntry) {
      return nearbyEntry.address;
  }

  // 2. Network Request (If no nearby point found)
  try {
    // Zoom level controls granularity: 18=House, 14=Neighborhood, 10=City
    const zoom = scope === 'broad' ? 10 : 16;
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&addressdetails=1`,
      { headers: { 'User-Agent': 'GeoExcelMapper/1.0' } }
    );
    
    if (!response.ok) throw new Error("Network response was not ok");
    
    const data = await response.json();
    let address = 'غير معروف';

    if (data.address) {
        if (scope === 'broad') {
            // Prefer larger administrative areas
            address = data.address.city || data.address.state || data.address.province || data.address.county || data.address.town || data.address.village || 'غير معروف';
        } else {
            // Prefer local areas
            address = data.address.suburb || data.address.neighbourhood || data.address.city_district || data.address.quarter || data.address.road || data.address.city || 'غير معروف';
        }
    }
    
    // 3. Save to Spatial Cache
    spatialCache.push({ lat, lng, address, scope });
    
    return address;
  } catch (error) {
    console.error("Geocoding error", error);
    return 'خطأ';
  }
};

// Search Places (Query -> Lat/Lng points)
export const searchPlacesInArea = async (activity: string, areaName: string, bounds?: BoundingBox): Promise<CustomerData[]> => {
  try {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(activity)}&format=json&addressdetails=1&limit=50`;
    
    if (bounds) {
        url += `&viewbox=${bounds.minLng},${bounds.maxLat},${bounds.maxLng},${bounds.minLat}&bounded=1`;
    } else {
        url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(activity + ' in ' + areaName)}&format=json&addressdetails=1&limit=50`;
    }

    const response = await fetch(url, { headers: { 'User-Agent': 'GeoExcelMapper/1.0' } });
    const data = await response.json();

    return data.map((item: any, index: number) => ({
      id: `place-${Date.now()}-${index}`,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      'الاسم': item.name || activity,
      'النوع': item.type,
      'المنطقة': areaName || 'منطقة محددة',
      'العنوان الكامل': item.display_name
    }));
  } catch (error) {
    console.error("Search error", error);
    return [];
  }
};
