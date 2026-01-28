export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface CustomerData {
  id: string; // Internal unique ID
  _customColor?: string; // New: Manually assigned color
  [key: string]: any; // Dynamic fields from Excel
}

export type ShapeType = 'circle' | 'square' | 'triangle' | 'star' | 'hexagon' | 'diamond';

export interface LayerConfig {
  id: string;
  name: string;
  fileName: string;
  data: CustomerData[];
  visible: boolean;
  isPlacesLayer?: boolean; // To identify layers created by search
  
  // Style Config
  colorByField: string; 
  shapeByField: string;
  labelByField: string; // New: Field to display as text label
  pointSize: number;
  
  colorMap: Record<string, string>; 
  shapeMap: Record<string, ShapeType>;
  
  // Filtering specific categories in Legend
  hiddenCategories: string[];
  
  // Base/Fallback styles
  defaultColor: string;
  defaultShape: ShapeType;
}

export interface MapViewport {
  center: GeoPoint;
  zoom: number;
}

export interface FilterStyle {
  enabled: boolean;
  color: string;
  shape: ShapeType;
}

export interface FilterRule {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'in';
  value: string;
  style?: FilterStyle;
}

export type SelectionMode = 'none' | 'polygon' | 'circle' | 'rectangle';

export interface BoundingBox {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}