import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Popup, useMap, useMapEvents, Polygon, Circle, Marker, Tooltip } from 'react-leaflet';
import { LayerConfig, CustomerData, SelectionMode, GeoPoint, ShapeType, FilterRule, BoundingBox } from '../types';
import { LatLngBoundsExpression } from 'leaflet';
import * as L from 'leaflet';
import { Circle as CircleIcon, Hexagon, Eraser, Spline } from 'lucide-react';
import { filterDataByCircle, filterDataByPolygon, getDistanceMeters } from '../utils/geoUtils';
import { fetchAddressForPoint } from '../utils/apiService';

const getShapeSVG = (shape: ShapeType, color: string, size: number, isSelected: boolean) => {
    const stroke = isSelected ? '#fff' : '#00000033';
    const strokeWidth = isSelected ? 3 : 1;
    const opacity = 0.9;
    
    const shapes: Record<ShapeType, string> = {
        circle: `<circle cx="12" cy="12" r="10" />`,
        square: `<rect x="4" y="4" width="16" height="16" rx="2" />`,
        triangle: `<polygon points="12,2 22,20 2,20" />`,
        diamond: `<polygon points="12,2 22,12 12,22 2,12" />`,
        star: `<polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />`,
        hexagon: `<polygon points="12,2 21,7 21,17 12,22 3,17 3,7" />`
    };

    return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <g fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" fill-opacity="${opacity}">
            ${shapes[shape] || shapes.circle}
        </g>
    </svg>`;
};

const createCustomIcon = (shape: ShapeType, color: string, baseSize: number, isSelected: boolean) => {
    const size = isSelected ? baseSize * 1.5 : baseSize;
    return L.divIcon({
        className: 'custom-shape-icon',
        html: getShapeSVG(shape, color, size, isSelected),
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
        popupAnchor: [0, -size/2]
    });
};

interface MapComponentProps {
  layers: LayerConfig[];
  onSelectCustomer: (customer: CustomerData, layerId: string) => void;
  onMultiSelect: (customers: { data: CustomerData, layerId: string }[]) => void;
  selectedCustomerId?: string;
  selectedCustomerIds?: Set<string>;
  filters?: FilterRule[];
  
  // Search Area Mode
  isSelectingSearchArea?: boolean;
  onSearchAreaComplete?: (bounds: BoundingBox) => void;
  cursorMode?: 'hand' | 'arrow';
}

const BoundsFitter = ({ data }: { data: CustomerData[] }) => {
  const map = useMap();
  useEffect(() => {
    if (data.length > 0) {
      try {
          const bounds: LatLngBoundsExpression = data.map(d => [d.lat, d.lng]);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      } catch(e) { }
    }
  }, [data.length, map]); 
  return null;
};

// Component to handle Map Interactions (Double Click, Single Click)
const MapInteractionHandler = ({ 
    selectionMode, 
    onClosePopup 
}: { 
    selectionMode: SelectionMode,
    onClosePopup: () => void
}) => {
    const map = useMap();
    const [popupInfo, setPopupInfo] = useState<{lat: number, lng: number, content: string} | null>(null);

    useMapEvents({
        click(e) {
            // Single click hides custom popup
            if (popupInfo) {
                setPopupInfo(null);
                map.closePopup();
            }
            onClosePopup();
        },
        dblclick(e) {
            if (selectionMode !== 'none') return; // Don't trigger if drawing
            
            // Fetch address on double click
            L.DomEvent.stopPropagation(e);
            const { lat, lng } = e.latlng;
            
            // Show loading popup immediately
            const popup = L.popup()
                .setLatLng(e.latlng)
                .setContent('<div class="text-center text-xs p-2 text-slate-200">جاري جلب البيانات...</div>')
                .openOn(map);

            fetchAddressForPoint(lat, lng).then(address => {
                const content = `
                    <div class="text-right p-1" dir="rtl">
                        <div class="font-bold text-sm mb-1 text-blue-400">بيانات الموقع</div>
                        <div class="text-xs mb-2 text-slate-200">${address}</div>
                        <div class="text-[10px] text-slate-400 font-mono bg-slate-700 p-1 rounded">
                            ${lat.toFixed(6)}, ${lng.toFixed(6)}
                        </div>
                    </div>
                `;
                popup.setContent(content);
                setPopupInfo({ lat, lng, content });
            });
        }
    });

    // Disable default double click zoom if we use it for info
    useEffect(() => {
        if (selectionMode === 'none') {
            map.doubleClickZoom.disable();
        } else {
            map.doubleClickZoom.enable();
        }
        return () => { map.doubleClickZoom.enable(); };
    }, [map, selectionMode]);

    return null;
};

const DrawController = ({ 
    mode, 
    onPolygonComplete, 
    onCircleComplete
}: { 
    mode: SelectionMode, 
    onPolygonComplete: (points: GeoPoint[]) => void, 
    onCircleComplete: (center: GeoPoint, radius: number) => void
}) => {
    const [points, setPoints] = useState<GeoPoint[]>([]);
    const [circleCenter, setCircleCenter] = useState<GeoPoint | null>(null);
    const [tempRadius, setTempRadius] = useState<number>(0);
    
    useMapEvents({
        click(e) {
            if (mode === 'polygon') {
                setPoints(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
            } else if (mode === 'circle') {
                if (!circleCenter) {
                    setCircleCenter({ lat: e.latlng.lat, lng: e.latlng.lng });
                } else {
                    const radius = getDistanceMeters(circleCenter, { lat: e.latlng.lat, lng: e.latlng.lng });
                    onCircleComplete(circleCenter, radius);
                    setCircleCenter(null);
                    setTempRadius(0);
                }
            }
        },
        mousemove(e) {
            if (mode === 'circle' && circleCenter) {
                const r = getDistanceMeters(circleCenter, { lat: e.latlng.lat, lng: e.latlng.lng });
                setTempRadius(r);
            }
        },
        dblclick(e) {
            if (mode === 'polygon') {
                // Prevent the map dblclick from firing
                L.DomEvent.stopPropagation(e);
                if (points.length > 2) {
                    onPolygonComplete(points);
                    setPoints([]); 
                }
            }
        }
    });

    return (
        <>
            {mode === 'polygon' && points.length > 0 && (
                <>
                    <Polygon positions={points.map(p => [p.lat, p.lng])} color="#3b82f6" dashArray="5, 5" />
                    {points.map((p, i) => (
                        <Marker key={i} position={[p.lat, p.lng]} icon={L.divIcon({ className: 'w-2 h-2 bg-blue-500 rounded-full border border-white', iconSize: [8,8] })} />
                    ))}
                </>
            )}
            {mode === 'circle' && circleCenter && (
                <Circle center={[circleCenter.lat, circleCenter.lng]} radius={tempRadius} color="#3b82f6" dashArray="5, 5" />
            )}
        </>
    );
};

const MapComponent: React.FC<MapComponentProps> = ({ 
    layers, 
    onSelectCustomer, 
    onMultiSelect,
    selectedCustomerId,
    selectedCustomerIds,
    filters = [],
    isSelectingSearchArea = false,
    onSearchAreaComplete,
    cursorMode = 'hand'
}) => {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none');
  const [selectionShape, setSelectionShape] = useState<any>(null);

  // Switch to polygon mode if search area selection is active
  useEffect(() => {
      if (isSelectingSearchArea) {
          setSelectionMode('polygon');
          setSelectionShape(null); 
      } else if (selectionMode === 'polygon' && !isSelectingSearchArea) {
          // If we manually exited selection, ensure mode resets (handled by setSelectionMode usually)
      }
  }, [isSelectingSearchArea]);

  const allVisibleData = layers.filter(l => l.visible).flatMap(l => l.data.map(d => ({ ...d, _layerId: l.id })));

  const handlePolygonComplete = (points: GeoPoint[]) => {
    // If selecting for search, convert polygon to bounding box
    if (isSelectingSearchArea && onSearchAreaComplete) {
        const lats = points.map(p => p.lat);
        const lngs = points.map(p => p.lng);
        const bounds: BoundingBox = {
            minLat: Math.min(...lats),
            maxLat: Math.max(...lats),
            minLng: Math.min(...lngs),
            maxLng: Math.max(...lngs)
        };
        onSearchAreaComplete(bounds);
        setSelectionMode('none');
        return;
    }

    setSelectionShape({ type: 'poly', points });
    const selected: { data: CustomerData, layerId: string }[] = [];
    layers.filter(l => l.visible).forEach(layer => {
        const inPoly = filterDataByPolygon(layer.data, points);
        inPoly.forEach(d => selected.push({ data: d, layerId: layer.id }));
    });
    onMultiSelect(selected);
    setSelectionMode('none');
  };

  const handleCircleComplete = (center: GeoPoint, radius: number) => {
    setSelectionShape({ type: 'circle', center, radius });
    const selected: { data: CustomerData, layerId: string }[] = [];
    layers.filter(l => l.visible).forEach(layer => {
        const inCircle = filterDataByCircle(layer.data, center, radius);
        inCircle.forEach(d => selected.push({ data: d, layerId: layer.id }));
    });
    onMultiSelect(selected);
    setSelectionMode('none');
  };
  
  const clearSelection = () => {
    setSelectionShape(null);
    onMultiSelect([]);
    setSelectionMode('none');
  };

  const getStyle = (customer: CustomerData, layer: LayerConfig) => {
    if (customer._customColor) {
        return { 
            color: customer._customColor, 
            shape: layer.shapeMap[String(customer[layer.shapeByField])] || layer.defaultShape 
        };
    }
    for (const filter of filters) {
        if (filter.style?.enabled) {
             const val = String(customer[filter.field] || '').toLowerCase();
             const filterVal = filter.value.toLowerCase();
             let match = false;
             if (filter.operator === 'contains') match = val.includes(filterVal);
             else if (filter.operator === 'equals') match = val === filterVal;
             if (match) return { color: filter.style.color, shape: filter.style.shape };
        }
    }
    const colorKey = String(customer[layer.colorByField] || 'DEFAULT');
    const shapeKey = String(customer[layer.shapeByField] || 'DEFAULT');
    return {
        color: layer.colorMap[colorKey] || layer.defaultColor,
        shape: layer.shapeMap[shapeKey] || layer.defaultShape
    };
  };

  return (
    <div className={`relative h-full w-full group ${selectionMode !== 'none' || isSelectingSearchArea ? 'cursor-crosshair' : (cursorMode === 'arrow' ? 'cursor-default' : 'cursor-grab active:cursor-grabbing')}`}>
        
        {/* Map Toolbar - Dark Mode */}
        {!isSelectingSearchArea && (
            <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 bg-slate-800/90 backdrop-blur rounded-lg shadow-md p-1.5 border border-slate-600">
                <button 
                    onClick={() => setSelectionMode('polygon')}
                    className={`p-2 rounded-md transition-colors ${selectionMode === 'polygon' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                    title="تحديد حر (مضلع)"
                >
                    <Spline size={20} />
                </button>
                <button 
                    onClick={() => setSelectionMode('circle')}
                    className={`p-2 rounded-md transition-colors ${selectionMode === 'circle' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                    title="تحديد دائري"
                >
                    <CircleIcon size={20} />
                </button>
                <div className="w-full h-[1px] bg-slate-600 my-0.5"></div>
                <button 
                    onClick={clearSelection}
                    className="p-2 rounded-md hover:bg-red-900/50 text-red-400 transition-colors"
                    title="مسح التحديد"
                >
                    <Eraser size={20} />
                </button>
            </div>
        )}

        {isSelectingSearchArea && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-amber-600 text-white px-4 py-2 rounded-lg shadow-lg font-bold animate-pulse border border-white/20 flex flex-col items-center">
                <span>قم بتحديد النقاط على الخريطة لرسم المنطقة</span>
                <span className="text-[10px] font-normal">اضغط مرتين لإنهاء الرسم</span>
            </div>
        )}

        <MapContainer 
            center={[30.0444, 31.2357]} 
            zoom={6} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            doubleClickZoom={false} // Managed manually
        >
            <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapInteractionHandler selectionMode={selectionMode} onClosePopup={() => {}} />
            <BoundsFitter data={allVisibleData} />
            
            <DrawController 
                mode={selectionMode} 
                onPolygonComplete={handlePolygonComplete} 
                onCircleComplete={handleCircleComplete}
            />

            {selectionShape?.type === 'poly' && (
                <Polygon positions={selectionShape.points.map((p: any) => [p.lat, p.lng])} color="#2563eb" fillColor="#3b82f6" fillOpacity={0.2} />
            )}
            {selectionShape?.type === 'circle' && (
                <Circle center={[selectionShape.center.lat, selectionShape.center.lng]} radius={selectionShape.radius} color="#2563eb" fillColor="#3b82f6" fillOpacity={0.2} />
            )}

            {layers.map((layer) => {
                if (!layer.visible) return null;
                return layer.data.map((customer) => {
                    const style = getStyle(customer, layer);
                    const isSingleSelected = customer.id === selectedCustomerId;
                    const isMultiSelected = selectedCustomerIds?.has(customer.id) ?? false;
                    const isAnySelected = isSingleSelected || isMultiSelected;
                    const isDimmed = selectedCustomerIds && selectedCustomerIds.size > 0 && !isMultiSelected;

                    return (
                        <Marker
                            key={customer.id}
                            position={[customer.lat, customer.lng]}
                            icon={createCustomIcon(style.shape, style.color, layer.pointSize || 12, isAnySelected)}
                            opacity={isDimmed ? 0.3 : 1}
                            eventHandlers={{
                                click: (e) => {
                                    L.DomEvent.stopPropagation(e);
                                    if (isSelectingSearchArea) return; 
                                    if (selectionMode !== 'none') return; // Don't select markers while drawing
                                    onSelectCustomer(customer, layer.id);
                                },
                            }}
                        >
                            {layer.labelByField && customer[layer.labelByField] && (
                                <Tooltip direction="top" offset={[0, -10]} opacity={0.9} permanent>
                                    <span className="font-bold text-xs">{String(customer[layer.labelByField])}</span>
                                </Tooltip>
                            )}
                            <Popup>
                                <div className="text-right" dir="rtl">
                                <h3 className="font-bold text-sm mb-1 text-blue-400">{layer.name}</h3>
                                <div className="text-xs space-y-1 text-slate-200">
                                    {Object.entries(customer).slice(0, 6).map(([key, val]) => {
                                        if (key === 'id' || key === 'lat' || key === 'lng' || key === '_layerId' || key === '_customColor') return null;
                                        return (
                                            <div key={key}>
                                                <span className="font-semibold text-slate-400">{key}: </span>
                                                <span>{String(val)}</span>
                                            </div>
                                        )
                                    })}
                                    <div className="pt-2 text-[10px] text-slate-500">
                                        {customer.lat.toFixed(5)}, {customer.lng.toFixed(5)}
                                    </div>
                                </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                });
            })}
        </MapContainer>
    </div>
  );
};

export default MapComponent;
