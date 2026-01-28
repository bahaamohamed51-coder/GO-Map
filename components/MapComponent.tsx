import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Popup, useMap, useMapEvents, Polygon, Circle, Marker, Tooltip } from 'react-leaflet';
import { LayerConfig, CustomerData, SelectionMode, GeoPoint, ShapeType, FilterRule, BoundingBox } from '../types';
import { LatLngBoundsExpression } from 'leaflet';
import * as L from 'leaflet';
import { Circle as CircleIcon, Eraser, Spline, MousePointer2, Hand } from 'lucide-react';
import { filterDataByCircle, filterDataByPolygon, getDistanceMeters } from '../utils/geoUtils';
import { fetchAddressForPoint } from '../utils/apiService';
import { EGYPT_BOUNDS, DEFAULT_CENTER, DEFAULT_ZOOM } from '../constants';

// --- Icons Helpers ---
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

// --- High Performance Canvas Layer ---
// This component handles massive datasets by bypassing React's reconciliation
// and directly manipulating Leaflet layers.
const LeafletCanvasLayer = ({ 
    layer, 
    onSelect, 
    selectedCustomerIds, 
    selectedCustomerId,
    filters 
}: { 
    layer: LayerConfig, 
    onSelect: (c: CustomerData, layerId: string) => void,
    selectedCustomerIds?: Set<string>,
    selectedCustomerId?: string,
    filters: FilterRule[]
}) => {
    const map = useMap();
    const layerGroupRef = useRef<L.LayerGroup | null>(null);

    // 1. Create Markers (Geometry Only) - Runs only when data changes
    useEffect(() => {
        if (!layerGroupRef.current) {
            layerGroupRef.current = L.layerGroup().addTo(map);
        }
        const group = layerGroupRef.current;
        group.clearLayers();

        layer.data.forEach(customer => {
            // Force Canvas renderer for performance
            const marker = L.circleMarker([customer.lat, customer.lng], {
                renderer: L.canvas(),
                radius: 4, // Default, will be updated by style effect
                weight: 1
            });
            
            // Attach data directly to marker object
            (marker as any).customerData = customer;

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                onSelect(customer, layer.id);
            });

            // Bind Popup
            const popupContent = `
                <div class="text-right" dir="rtl">
                    <h3 class="font-bold text-sm mb-1 text-blue-400">${layer.name}</h3>
                    <div class="text-xs space-y-1 text-slate-200">
                         ${Object.entries(customer).slice(0, 6).map(([key, val]) => {
                            if (['id', 'lat', 'lng', '_layerId', '_customColor'].includes(key)) return '';
                            return `<div><span class="font-semibold text-slate-400">${key}: </span><span>${val}</span></div>`;
                         }).join('')}
                         <div class="pt-2 text-[10px] text-slate-500">
                            ${customer.lat.toFixed(5)}, ${customer.lng.toFixed(5)}
                         </div>
                    </div>
                </div>
            `;
            marker.bindPopup(popupContent, { className: 'custom-popup-dark' });

            if (layer.labelByField && customer[layer.labelByField]) {
                marker.bindTooltip(String(customer[layer.labelByField]), { 
                    direction: 'top', 
                    offset: [0, -5],
                    opacity: 0.9,
                    className: 'font-bold text-xs bg-slate-800 text-white border-slate-600'
                });
            }

            group.addLayer(marker);
        });

        // Cleanup function not needed for group removal here to allow smooth style updates,
        // cleanup happens on unmount.
    }, [layer.data, map, layer.id, layer.name, layer.labelByField]); 

    // 2. Update Styles (Colors, Selection, Filters) - Runs efficiently on interaction
    useEffect(() => {
        const group = layerGroupRef.current;
        if (!group) return;

        const hasSelection = (selectedCustomerIds && selectedCustomerIds.size > 0) || !!selectedCustomerId;
        const activeFilters = filters.filter(f => f.style?.enabled);
        const baseRadius = (layer.pointSize || 12) / 2.5;

        group.eachLayer((l: any) => {
            if (!(l instanceof L.CircleMarker)) return;
            const customer = (l as any).customerData as CustomerData;
            
            // Base Color Logic
            let color = layer.colorMap[String(customer[layer.colorByField] || 'DEFAULT')] || layer.defaultColor;
            if (customer._customColor) color = customer._customColor;
            
            // Filter Highlight Logic
            for (const filter of activeFilters) {
                 const val = String(customer[filter.field] || '').toLowerCase();
                 const filterVal = filter.value.toLowerCase();
                 let match = false;
                 
                 // Skip empty filters
                 if (!filterVal) continue;

                 if (filter.operator === 'contains') match = val.includes(filterVal);
                 else if (filter.operator === 'equals') match = val === filterVal;
                 
                 if (match && filter.style) {
                     color = filter.style.color;
                     break; 
                 }
            }

            // Selection Logic
            const isSelected = customer.id === selectedCustomerId || selectedCustomerIds?.has(customer.id);
            const isDimmed = hasSelection && !isSelected;

            if (isSelected) {
                l.setStyle({
                    color: '#fff',
                    fillColor: color,
                    weight: 2,
                    radius: 8,
                    fillOpacity: 1
                });
                if (!l.isPopupOpen()) l.openPopup();
                l.bringToFront();
            } else if (isDimmed) {
                l.setStyle({
                    color: color,
                    fillColor: color,
                    weight: 1,
                    radius: baseRadius,
                    fillOpacity: 0.2
                });
            } else {
                l.setStyle({
                    color: color,
                    fillColor: color,
                    weight: 1,
                    radius: baseRadius,
                    fillOpacity: 0.8
                });
            }
        });

    }, [layer, filters, selectedCustomerIds, selectedCustomerId]);

    useEffect(() => {
        return () => {
            if (layerGroupRef.current) {
                layerGroupRef.current.remove();
                layerGroupRef.current = null;
            }
        };
    }, []);

    return null;
};


// --- Main Map Component ---

interface MapComponentProps {
  layers: LayerConfig[];
  onSelectCustomer: (customer: CustomerData, layerId: string) => void;
  onMultiSelect: (customers: { data: CustomerData, layerId: string }[]) => void;
  selectedCustomerId?: string;
  selectedCustomerIds?: Set<string>;
  filters?: FilterRule[];
  isSelectingSearchArea?: boolean;
  onSearchAreaComplete?: (bounds: BoundingBox) => void;
  cursorMode?: 'hand' | 'arrow';
  onSetCursorMode?: (mode: 'hand' | 'arrow') => void;
}

const BoundsFitter = ({ data }: { data: CustomerData[] }) => {
  const map = useMap();
  useEffect(() => {
    if (data.length > 0) {
      try {
          const bounds: LatLngBoundsExpression = data.map(d => [d.lat, d.lng]);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      } catch(e) { }
    }
  }, [data.length, map]); 
  return null;
};

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
            if (popupInfo) {
                setPopupInfo(null);
                map.closePopup();
            }
            onClosePopup();
        },
        dblclick(e) {
            if (selectionMode !== 'none') return;
            L.DomEvent.stopPropagation(e);
            if (!navigator.onLine) {
                 L.popup().setLatLng(e.latlng).setContent('<div class="text-center text-xs p-2 text-slate-200">وضع غير متصل</div>').openOn(map);
                return;
            }
            const { lat, lng } = e.latlng;
            const popup = L.popup().setLatLng(e.latlng).setContent('<div class="text-center text-xs p-2 text-slate-200">جاري جلب البيانات...</div>').openOn(map);
            fetchAddressForPoint(lat, lng).then(address => {
                popup.setContent(`<div class="text-right p-1" dir="rtl"><div class="font-bold text-sm mb-1 text-blue-400">الموقع</div><div class="text-xs text-slate-200">${address}</div></div>`);
            });
        }
    });

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
    cursorMode = 'hand',
    onSetCursorMode
}) => {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none');
  const [selectionShape, setSelectionShape] = useState<any>(null);

  useEffect(() => {
      if (isSelectingSearchArea) {
          setSelectionMode('polygon');
          setSelectionShape(null); 
      }
  }, [isSelectingSearchArea]);

  const allVisibleData = useMemo(() => 
    layers.filter(l => l.visible).flatMap(l => l.data.map(d => ({ ...d, _layerId: l.id }))),
  [layers]);

  const handlePolygonComplete = (points: GeoPoint[]) => {
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
             
             // Skip empty filters in style check too
             if (!filterVal) continue;

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
        
        {!isSelectingSearchArea && (
            <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 bg-slate-800/90 backdrop-blur rounded-lg shadow-md p-1.5 border border-slate-600">
                
                {/* Selection Tools */}
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
                <button 
                    onClick={clearSelection}
                    className="p-2 rounded-md hover:bg-red-900/50 text-red-400 transition-colors"
                    title="مسح التحديد"
                >
                    <Eraser size={20} />
                </button>

                <div className="w-full h-[1px] bg-slate-600 my-0.5"></div>

                {/* Cursor Mode Tools (Moved here) */}
                <button 
                    onClick={() => onSetCursorMode && onSetCursorMode('arrow')}
                    className={`p-2 rounded-md transition-colors ${cursorMode === 'arrow' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                    title="مؤشر سهم (للنقر)"
                >
                    <MousePointer2 size={20} />
                </button>
                 <button 
                    onClick={() => onSetCursorMode && onSetCursorMode('hand')}
                    className={`p-2 rounded-md transition-colors ${cursorMode === 'hand' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                    title="مؤشر يد (للتحريك)"
                >
                    <Hand size={20} />
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
            center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} 
            zoom={DEFAULT_ZOOM} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            doubleClickZoom={false}
            maxBounds={EGYPT_BOUNDS}
            maxBoundsViscosity={1.0}
            minZoom={5}
            preferCanvas={true} 
        >
            <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                className={!navigator.onLine ? 'opacity-0' : ''}
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
                
                // PERFORMANCE SWITCH: Use LeafletCanvasLayer for > 500 points
                const useHighPerformanceMode = layer.data.length > 500;

                if (useHighPerformanceMode) {
                    return (
                        <LeafletCanvasLayer 
                            key={layer.id}
                            layer={layer}
                            onSelect={onSelectCustomer}
                            selectedCustomerIds={selectedCustomerIds}
                            selectedCustomerId={selectedCustomerId}
                            filters={filters}
                        />
                    );
                }

                return layer.data.map((customer) => {
                    const style = getStyle(customer, layer);
                    const isSingleSelected = customer.id === selectedCustomerId;
                    const isMultiSelected = selectedCustomerIds?.has(customer.id) ?? false;
                    const isAnySelected = isSingleSelected || isMultiSelected;
                    const isDimmed = selectedCustomerIds && selectedCustomerIds.size > 0 && !isMultiSelected;

                    const PopupContent = (
                         <Popup>
                            <div className="text-right" dir="rtl">
                            <h3 className="font-bold text-sm mb-1 text-blue-400">{layer.name}</h3>
                            <div className="text-xs space-y-1 text-slate-200">
                                {Object.entries(customer).slice(0, 6).map(([key, val]) => {
                                    if (['id', 'lat', 'lng', '_layerId', '_customColor'].includes(key)) return null;
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
                    );

                    const eventHandlers = {
                        click: (e: any) => {
                            L.DomEvent.stopPropagation(e);
                            if (isSelectingSearchArea) return; 
                            if (selectionMode !== 'none') return;
                            onSelectCustomer(customer, layer.id);
                        },
                    };

                    return (
                        <Marker
                            key={customer.id}
                            position={[customer.lat, customer.lng]}
                            icon={createCustomIcon(style.shape, style.color, layer.pointSize || 12, isAnySelected)}
                            opacity={isDimmed ? 0.3 : 1}
                            eventHandlers={eventHandlers}
                        >
                            {layer.labelByField && customer[layer.labelByField] && (
                                <Tooltip direction="top" offset={[0, -10]} opacity={0.9} permanent>
                                    <span className="font-bold text-xs">{String(customer[layer.labelByField])}</span>
                                </Tooltip>
                            )}
                            {PopupContent}
                        </Marker>
                    );
                });
            })}
        </MapContainer>
    </div>
  );
};

export default MapComponent;
