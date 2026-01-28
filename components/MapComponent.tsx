import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Popup, useMap, useMapEvents, Polygon, Circle, Marker, Tooltip, Polyline } from 'react-leaflet';
import { LayerConfig, CustomerData, SelectionMode, GeoPoint, ShapeType, FilterRule, BoundingBox } from '../types';
import { LatLngBoundsExpression } from 'leaflet';
import * as L from 'leaflet';
import { Circle as CircleIcon, Eraser, Spline, MousePointer2, Hand } from 'lucide-react';
import { filterDataByCircle, filterDataByPolygon, getDistanceMeters } from '../utils/geoUtils';
import { fetchAddressForPoint } from '../utils/apiService';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../constants';

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

// --- Optimized Canvas Layer for Large Datasets ---
const OptimizedLayer = ({ 
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
    const rendererRef = useRef<L.Canvas | null>(null);

    // 1. Initialize & Render Data
    useEffect(() => {
        // Create group if not exists
        if (!layerGroupRef.current) {
            layerGroupRef.current = L.layerGroup().addTo(map);
        }
        
        // Create renderer if not exists
        if (!rendererRef.current) {
            rendererRef.current = L.canvas({ padding: 0.5 });
        }

        const group = layerGroupRef.current;
        const myRenderer = rendererRef.current;
        
        // Clear previous content
        group.clearLayers();

        // Performance: Remove group from map during batch addition
        group.removeFrom(map);

        // --- FILTERING LOGIC FOR HIGH PERFORMANCE ---
        // If there is a selection, we ONLY render selected items.
        // If there are filters, we filter data first.
        const hasSelection = (selectedCustomerIds && selectedCustomerIds.size > 0) || !!selectedCustomerId;
        const activeFilters = filters.filter(f => f.style?.enabled || f.value);

        const baseRadius = (layer.pointSize || 8) / 2; 

        // Apply filters and selection logic to get ONLY points to render
        const pointsToRender = layer.data.filter(customer => {
             // 1. Check Selection Strict Mode (If something is selected, hide others)
             if (hasSelection) {
                 const isSelected = customer.id === selectedCustomerId || selectedCustomerIds?.has(customer.id);
                 if (!isSelected) return false;
             }

             // 2. Check Standard Filters (if enabled)
             if (activeFilters.length > 0) {
                 for (const filter of filters) {
                    // Skip style-only filters here, we handle coloring later. 
                    // But if filter has value, it effectively hides rows in table, so we should hide on map too?
                    // The App.tsx already filters layer.data based on "logic" filters.
                    // But for Highlight filters, we keep them.
                    
                    // Actually, Layer.data passed here is ALREADY filtered by Legend and Logic Filters from App.tsx.
                    // So we mainly care about "Selection" here.
                 }
             }
             
             return true;
        });


        pointsToRender.forEach(customer => {
            // Safety check for coordinates
            if (typeof customer.lat !== 'number' || typeof customer.lng !== 'number') return;
            
            // Determine Style
            let color = layer.defaultColor;
            let radius = baseRadius;
            let weight = 1;
            let strokeColor = '#000';
            let fillOpacity = 0.8;

            // From Data Map
            const colorKey = String(customer[layer.colorByField] || 'DEFAULT');
            if (layer.colorMap[colorKey]) {
                color = layer.colorMap[colorKey];
            }
            if (customer._customColor) color = customer._customColor;

            // Apply Highlight Filters
            for (const filter of activeFilters) {
                 if (!filter.style?.enabled) continue;
                 const val = String(customer[filter.field] || '').toLowerCase();
                 const filterVal = filter.value.toLowerCase();
                 if (!filterVal) continue;

                 let match = false;
                 if (filter.operator === 'contains') match = val.includes(filterVal);
                 else if (filter.operator === 'equals') match = val === filterVal;
                 else if (filter.operator === 'in') match = filterVal.split(',').map(s => s.trim()).includes(val);
                 
                 if (match) {
                     color = filter.style!.color;
                     // Optional: Change shape? Canvas circleMarker only supports circle.
                     break; 
                 }
            }

            // Apply Selection Style
            const isSelected = customer.id === selectedCustomerId || selectedCustomerIds?.has(customer.id);
            
            if (isSelected) {
                radius = baseRadius + 4;
                strokeColor = '#fff';
                weight = 3;
                fillOpacity = 1;
            }

            const marker = L.circleMarker([customer.lat, customer.lng], {
                renderer: myRenderer,
                radius: radius,
                weight: weight,
                color: strokeColor,
                fillColor: color,
                fillOpacity: fillOpacity
            });

            // Store data reference on the marker options/object for retrieval later
            (marker as any).customData = customer;

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

        // Add group back to map
        group.addTo(map);

        return () => {
            if (layerGroupRef.current) {
                layerGroupRef.current.clearLayers();
                layerGroupRef.current.remove();
                layerGroupRef.current = null;
            }
        };
    }, [layer.data, layer.id, layer.labelByField, selectedCustomerIds, selectedCustomerId, filters]); 
    // ^ Re-run effect completely on selection change. 
    // This is faster than iterating 100k markers to setOpacity(0).

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
          const validPoints = data.filter(d => 
              typeof d.lat === 'number' && typeof d.lng === 'number' &&
              !isNaN(d.lat) && !isNaN(d.lng)
          );
          if (validPoints.length === 0) return;
          const bounds: LatLngBoundsExpression = validPoints.map(d => [d.lat, d.lng]);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      } catch(e) { 
          console.warn("Bounds fit error ignored:", e);
      }
    }
  }, [data.length, map]); 
  return null;
};

const MapInteractionHandler = ({ 
    selectionMode, 
    onClosePopup,
    cursorMode
}: { 
    selectionMode: SelectionMode,
    onClosePopup: () => void,
    cursorMode: 'hand' | 'arrow'
}) => {
    const map = useMap();
    const [popupInfo, setPopupInfo] = useState<{lat: number, lng: number, content: string} | null>(null);

    // Effect to handle Cursor/Drag modes effectively
    useEffect(() => {
        if (!map) return;
        const container = map.getContainer();

        if (cursorMode === 'hand') {
            map.dragging.enable();
            container.style.cursor = 'grab';
        } else {
            // Arrow mode: Disable drag to allow easy clicking/selection without moving map
            map.dragging.disable();
            container.style.cursor = 'default';
        }

        // Clean up on unmount or change
        return () => {
             container.style.cursor = '';
        }
    }, [cursorMode, map]);


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
        return () => { 
            // Safety check in case map is destroyed
            try { map.doubleClickZoom.enable(); } catch (e) {}
        };
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
    const [mousePos, setMousePos] = useState<L.LatLng | null>(null);
    
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
            setMousePos(e.latlng); // Track mouse everywhere for guide lines
            
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
            {mode === 'polygon' && (
                <>
                    {/* Render Polygon so far */}
                    {points.length > 0 && (
                        <Polygon positions={points.map(p => [p.lat, p.lng])} color="#3b82f6" dashArray="5, 5" />
                    )}
                    
                    {/* Render Vertices */}
                    {points.map((p, i) => (
                        <Marker key={i} position={[p.lat, p.lng]} icon={L.divIcon({ className: 'w-2 h-2 bg-blue-500 rounded-full border border-white', iconSize: [8,8] })} />
                    ))}

                    {/* Render Guide Line (Rubber Band) */}
                    {points.length > 0 && mousePos && (
                        <Polyline 
                            positions={[
                                [points[points.length - 1].lat, points[points.length - 1].lng], 
                                [mousePos.lat, mousePos.lng]
                            ]} 
                            color="#ef4444" 
                            weight={2}
                            dashArray="4, 4" 
                        />
                    )}
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
    
    // Performance: If using OptimizedLayer (1000+ points), we might want to query data directly rather than leafleting
    // But standard geoUtils works on Data Arrays, which is fast.
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
             
             if (!filterVal) continue;

             let match = false;
             if (filter.operator === 'contains') match = val.includes(filterVal);
             else if (filter.operator === 'equals') match = val === filterVal;
             else if (filter.operator === 'in') match = filterVal.split(',').map(s => s.trim()).includes(val);

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
    <div className={`relative h-full w-full group`}>
        
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

                {/* Cursor Mode Tools */}
                <button 
                    onClick={() => onSetCursorMode && onSetCursorMode('arrow')}
                    className={`p-2 rounded-md transition-colors ${cursorMode === 'arrow' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                    title="مؤشر سهم (تحديد فقط)"
                >
                    <MousePointer2 size={20} />
                </button>
                 <button 
                    onClick={() => onSetCursorMode && onSetCursorMode('hand')}
                    className={`p-2 rounded-md transition-colors ${cursorMode === 'hand' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                    title="مؤشر يد (تحريك الخريطة)"
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
            minZoom={2} // Allow zooming out to world view
            preferCanvas={true} 
        >
            <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                className={!navigator.onLine ? 'opacity-0' : ''}
            />
            
            <MapInteractionHandler 
                selectionMode={selectionMode} 
                onClosePopup={() => {}} 
                cursorMode={cursorMode}
            />
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
                
                // PERFORMANCE SWITCH: Use OptimizedLayer for > 1000 points
                // This keeps standard beautiful markers for small files, and fast rendering for huge files.
                const useOptimizedMode = layer.data.length > 1000;

                if (useOptimizedMode) {
                    return (
                        <OptimizedLayer 
                            key={layer.id}
                            layer={layer}
                            onSelect={onSelectCustomer}
                            selectedCustomerIds={selectedCustomerIds}
                            selectedCustomerId={selectedCustomerId}
                            filters={filters}
                        />
                    );
                }

                // Standard Rendering for Small Datasets (< 1000)
                return layer.data.map((customer) => {
                    // Skip invalid data to prevent crashes
                    if (typeof customer.lat !== 'number' || typeof customer.lng !== 'number') return null;

                    // STRICT FILTERING FOR SELECTION IN STANDARD MODE TOO
                    const hasSelection = (selectedCustomerIds && selectedCustomerIds.size > 0) || !!selectedCustomerId;
                    if (hasSelection) {
                         const isSelected = customer.id === selectedCustomerId || selectedCustomerIds?.has(customer.id);
                         if (!isSelected) return null;
                    }

                    const style = getStyle(customer, layer);
                    const isSingleSelected = customer.id === selectedCustomerId;
                    const isMultiSelected = selectedCustomerIds?.has(customer.id) ?? false;
                    const isAnySelected = isSingleSelected || isMultiSelected;
                    
                    // Dimming is deprecated, we now hide unselected, so opacity is always 1 for rendered items
                    const opacity = 1;

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
                            opacity={opacity}
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
