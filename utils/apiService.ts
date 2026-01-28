import { CustomerData, BoundingBox } from '../types';

// Reverse Geocoding (Lat/Lng -> Address)
export const fetchAddressForPoint = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
      { headers: { 'User-Agent': 'GeoExcelMapper/1.0' } }
    );
    const data = await response.json();
    return data.address?.suburb || data.address?.neighbourhood || data.address?.city_district || data.address?.city || data.address?.town || 'غير معروف';
  } catch (error) {
    console.error("Geocoding error", error);
    return 'خطأ';
  }
};

// Search Places (Query -> Lat/Lng points)
// Supports Area Name OR Bounding Box
export const searchPlacesInArea = async (activity: string, areaName: string, bounds?: BoundingBox): Promise<CustomerData[]> => {
  try {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(activity)}&format=json&addressdetails=1&limit=50`;
    
    if (bounds) {
        // Nominatim viewbox format: <x1>,<y1>,<x2>,<y2> (left, top, right, bottom) -> minLon, maxLat, maxLon, minLat
        // But strictly: left,top,right,bottom -> minLng,maxLat,maxLng,minLat
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