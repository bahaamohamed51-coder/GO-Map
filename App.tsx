import React, { useState, useMemo, useEffect } from 'react';
import { Upload, Download, Map as MapIcon, Layers, Filter, Users, Table as TableIcon, Maximize2, Minimize2, Search, MousePointer2, Hand } from 'lucide-react';
import MapComponent from './components/MapComponent';
import LayerControl from './components/LayerControl';
import CustomerEditor from './components/CustomerEditor';
import FilterPanel from './components/FilterPanel';
import BulkEditor from './components/BulkEditor';
import AttributeTable from './components/AttributeTable';
import PlacesSearchPanel from './components/PlacesSearchPanel';
import { LayerConfig, CustomerData, FilterRule, ShapeType, BoundingBox } from './types';
import { parseExcelFile, generateColorMap, exportLayersToExcel } from './utils/excelHelpers';
import { fetchAddressForPoint } from './utils/apiService';

const App: React.FC = () => {
  const [layers, setLayers] = useState<LayerConfig[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{data: CustomerData, layerId: string} | null>(null);
  const [multiSelected, setMultiSelected] = useState<{data: CustomerData, layerId: string}[]>([]);
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [enrichingLayerId, setEnrichingLayerId] = useState<string | null>(null);

  // Map Cursor Mode
  const [cursorMode, setCursorMode] = useState<'hand' | 'arrow'>('hand');

  // Search Area Bounds
  const [searchBounds, setSearchBounds] = useState<BoundingBox | null>(null);
  const [isSelectingSearchArea, setIsSelectingSearchArea] = useState(false);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'layers' | 'filters' | 'search'>('layers');
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Filter State
  const [filters, setFilters] = useState<FilterRule[]>([]);

  // Toggle Browser Full Screen
  const toggleFullScreen = () => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((e) => {
              console.error(`Error attempting to enable fullscreen mode: ${e.message} (${e.name})`);
          });
          setIsFullScreen(true);
      } else {
          if (document.exitFullscreen) {
              document.exitFullscreen();
          }
          setIsFullScreen(false);
      }
  };

  useEffect(() => {
      const handleFsChange = () => {
          setIsFullScreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Compute Base Visible Data based on Layers + Filters
  const filteredLayers = useMemo(() => {
    return layers.map(layer => {
      // 1. Legend Filter
      let visibleData = layer.data;
      if (layer.hiddenCategories && layer.hiddenCategories.length > 0) {
          visibleData = visibleData.filter(d => {
              const val = String(d[layer.colorByField] || 'غير محدد');
              return !layer.hiddenCategories.includes(val);
          });
      }

      // 2. Advanced Filters Panel
      if (filters.length > 0) {
          visibleData = visibleData.filter(item => {
            return filters.every(filter => {
              if (filter.style?.enabled) return true;
              const itemVal = item[filter.field];
              if (itemVal == null) return false;
              const strVal = String(itemVal).toLowerCase();
              const filterVal = filter.value.toLowerCase();
              switch (filter.operator) {
                case 'contains': return strVal.includes(filterVal);
                case 'equals': return strVal === filterVal;
                case 'in': return filterVal.split(',').map(s => s.trim()).includes(strVal);
                default: return true;
              }
            });
          });
      }

      return { ...layer, data: visibleData };
    });
  }, [layers, filters]);

  const allVisibleData = useMemo(() => {
      return filteredLayers.filter(l => l.visible).flatMap(l => l.data.map(d => ({ ...d, _layerId: l.id })));
  }, [filteredLayers]);

  // Determine Data shown in Table (Respect Spatial Selection)
  const tableData = useMemo(() => {
      if (multiSelected.length > 0) {
          return multiSelected.map(s => s.data);
      }
      return allVisibleData;
  }, [multiSelected, allVisibleData]);


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const data = await parseExcelFile(file);
        if (data.length === 0) {
            alert('بيانات غير صالحة');
            return;
        }

        const keys = Object.keys(data[0]);
        const candidateKey = keys.find(k => !['id', 'lat', 'lng'].includes(k) && !k.toLowerCase().includes('date')) || keys[0];

        const newLayer: LayerConfig = {
          id: `layer-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          fileName: file.name,
          data: data,
          visible: true,
          colorByField: candidateKey,
          shapeByField: candidateKey, 
          labelByField: '', 
          pointSize: 12,
          colorMap: generateColorMap(data, candidateKey),
          shapeMap: {}, 
          hiddenCategories: [],
          defaultColor: '#3b82f6',
          defaultShape: 'circle'
        };

        setLayers(prev => [...prev, newLayer]);
      } catch (error) {
        console.error(error);
        alert("خطأ في قراءة الملف");
      }
    }
  };

  const updateLayerConfig = (id: string, updates: Partial<LayerConfig>) => {
      setLayers(prev => prev.map(l => {
          if (l.id !== id) return l;
          const updated = { ...l, ...updates };
          if (updates.colorByField && updates.colorByField !== l.colorByField) {
              updated.colorMap = generateColorMap(l.data, updates.colorByField);
              updated.hiddenCategories = []; 
          }
          return updated;
      }));
  };

  const updateStyleMap = (id: string, value: string, type: 'color' | 'shape', newValue: string) => {
      setLayers(prev => prev.map(l => {
          if (l.id !== id) return l;
          if (type === 'color') {
              return { ...l, colorMap: { ...l.colorMap, [value]: newValue } };
          } else {
              return { ...l, shapeMap: { ...l.shapeMap, [value]: newValue as ShapeType } };
          }
      }));
  };

  const toggleLayerCategory = (layerId: string, category: string) => {
      setLayers(prev => prev.map(l => {
          if (l.id !== layerId) return l;
          const isHidden = l.hiddenCategories.includes(category);
          return {
              ...l,
              hiddenCategories: isHidden 
                ? l.hiddenCategories.filter(c => c !== category)
                : [...l.hiddenCategories, category]
          };
      }));
  };

  const handleQuickFilter = (field: string, value: string) => {
      const newFilter: FilterRule = {
          id: Date.now().toString(),
          field: field,
          operator: 'equals',
          value: value
      };
      setFilters([newFilter]);
      setActiveTab('filters');
      if (!isSidebarOpen) setIsSidebarOpen(true);
  };

  const handleAddColumn = (colName: string) => {
      setLayers(prev => prev.map(layer => ({
          ...layer,
          data: layer.data.map(d => ({ ...d, [colName]: '' }))
      })));
  };

  const handleAddRow = () => {
      if (layers.length === 0) return;
      const targetLayerId = layers.find(l => l.visible)?.id || layers[0].id;
      setLayers(prev => prev.map(layer => {
          if (layer.id !== targetLayerId) return layer;
          const newRow: CustomerData = {
              id: `new-${Date.now()}`,
              lat: layers[0].data[0]?.lat || 30,
              lng: layers[0].data[0]?.lng || 31,
          };
          Object.keys(layer.data[0] || {}).forEach(k => {
              if (k !== 'id' && k !== 'lat' && k !== 'lng') newRow[k] = '';
          });
          return { ...layer, data: [newRow, ...layer.data] };
      }));
  };

  const handleSaveCustomer = (id: string, updatedData: Partial<CustomerData>) => {
    setLayers(prev => prev.map(layer => {
      const exists = layer.data.some(d => d.id === id);
      if (exists) {
        return { ...layer, data: layer.data.map(item => item.id === id ? { ...item, ...updatedData } : item) };
      }
      return layer;
    }));
  };

  const handleBulkSave = (updates: Partial<CustomerData>) => {
    const targetIds = new Set(tableData.map(d => d.id));

    setLayers(prev => prev.map(layer => {
        const itemsToUpdate = layer.data.filter(d => targetIds.has(d.id));
        if (itemsToUpdate.length === 0) return layer;

        return { 
            ...layer, 
            data: layer.data.map(item => targetIds.has(item.id) ? { ...item, ...updates } : item) 
        };
    }));
    
    setShowBulkEditor(false);
  };

  const handleEnrichLayer = async (layerId: string) => {
      if (enrichingLayerId) return;
      
      const layer = layers.find(l => l.id === layerId);
      if (!layer) return;

      setEnrichingLayerId(layerId);
      
      const hasSelection = multiSelected.length > 0;
      const selectedIds = new Set(multiSelected.map(s => s.data.id));

      const newData = [...layer.data];
      
      const indicesToProcess = newData
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => (hasSelection ? selectedIds.has(d.id) : true))
        .filter(({ d }) => d.lat && d.lng && !d['المنطقة']) 
        .map(({ i }) => i);

      const maxProcess = Math.min(indicesToProcess.length, 500);
      
      for (let k = 0; k < maxProcess; k++) {
          const i = indicesToProcess[k];
          const areaName = await fetchAddressForPoint(newData[i].lat, newData[i].lng);
          newData[i] = { ...newData[i], 'المنطقة': areaName };
          
          if (k % 5 === 0 || k === maxProcess - 1) {
              setLayers(prev => prev.map(l => l.id === layerId ? { ...l, data: [...newData] } : l));
          }
          await new Promise(r => setTimeout(r, 1100)); 
      }
      
      setEnrichingLayerId(null);
      alert('تم تحديث البيانات بنجاح!');
  };

  // Export filtered data instead of all layers
  const handleExport = () => {
      exportLayersToExcel(filteredLayers);
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden bg-gray-900 font-sans ${isFullScreen ? 'fixed inset-0 z-[9999] bg-gray-900' : ''}`} dir="rtl">
      
      {!isFullScreen && (
          <header className="bg-slate-800 shadow-md h-14 border-b border-slate-700 flex items-center justify-between px-4 z-20">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                    <MapIcon size={20} />
                </div>
                <h1 className="font-bold text-lg text-white hidden md:block">GeoExcel Mapper</h1>
            </div>
            
            <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-blue-400 rounded-lg hover:bg-slate-600 cursor-pointer transition-colors text-sm font-medium border border-slate-600">
                    <Upload size={16} />
                    <span>رفع ملف</span>
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                </label>
                <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-green-400 rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium border border-slate-600">
                    <Download size={16} />
                    <span>تصدير (المفلتر)</span>
                </button>
                <button onClick={toggleFullScreen} className="p-2 hover:bg-slate-700 text-white rounded-lg transition-colors" title="ملء الشاشة">
                    <Maximize2 size={20} />
                </button>
            </div>
          </header>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`
            bg-slate-800/95 backdrop-blur-sm shadow-xl border-l border-slate-700 z-[2000] transition-all duration-300 flex flex-col
            ${isFullScreen ? (isSidebarOpen ? 'w-80 border-r border-slate-700' : 'w-0 overflow-hidden') : (isSidebarOpen ? 'translate-x-0 absolute md:static top-0 right-0 bottom-0 w-80' : 'translate-x-full md:translate-x-0 md:w-0 absolute md:static top-0 right-0 bottom-0')}
        `}>
            {isFullScreen && (
                <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800">
                    <span className="font-bold text-white">القائمة الجانبية</span>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-red-400"><Minimize2 size={16} /></button>
                </div>
            )}

            <div className="flex border-b border-slate-700">
                <button onClick={() => setActiveTab('layers')} className={`flex-1 py-3 text-sm font-semibold border-b-2 flex items-center justify-center gap-2 transition-colors ${activeTab === 'layers' ? 'border-blue-500 text-blue-400 bg-slate-700' : 'border-transparent text-gray-400 hover:text-white'}`}>
                    <Layers size={16} /> الطبقات
                </button>
                <button onClick={() => setActiveTab('filters')} className={`flex-1 py-3 text-sm font-semibold border-b-2 flex items-center justify-center gap-2 transition-colors ${activeTab === 'filters' ? 'border-blue-500 text-blue-400 bg-slate-700' : 'border-transparent text-gray-400 hover:text-white'}`}>
                    <Filter size={16} /> الفلترة
                </button>
                <button onClick={() => setActiveTab('search')} className={`flex-1 py-3 text-sm font-semibold border-b-2 flex items-center justify-center gap-2 transition-colors ${activeTab === 'search' ? 'border-blue-500 text-blue-400 bg-slate-700' : 'border-transparent text-gray-400 hover:text-white'}`}>
                    <Search size={16} /> بحث
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {activeTab === 'layers' && (
                    <>
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-700 mb-3 flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                                <MousePointer2 size={12} /> نمط المؤشر:
                            </span>
                            <div className="flex bg-slate-800 rounded p-1 border border-slate-600">
                                <button 
                                    onClick={() => setCursorMode('arrow')} 
                                    className={`p-1.5 rounded transition-colors ${cursorMode === 'arrow' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    title="مؤشر سهم"
                                >
                                    <MousePointer2 size={16}/>
                                </button>
                                <button 
                                    onClick={() => setCursorMode('hand')} 
                                    className={`p-1.5 rounded transition-colors ${cursorMode === 'hand' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    title="مؤشر يد (تحريك)"
                                >
                                    <Hand size={16}/>
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-3">
                             <h2 className="font-bold text-white text-sm">قائمة الطبقات ({layers.length})</h2>
                        </div>
                        {filteredLayers.map(layer => (
                            <LayerControl 
                                key={layer.id} 
                                layer={layer}
                                onToggleVisibility={(id) => setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l))}
                                onDelete={(id) => setLayers(prev => prev.filter(l => l.id !== id))}
                                onUpdateConfig={updateLayerConfig}
                                onUpdateStyleMap={updateStyleMap}
                                onFocusValue={handleQuickFilter}
                                onToggleCategory={toggleLayerCategory}
                                onEnrichData={handleEnrichLayer}
                                isEnriching={enrichingLayerId === layer.id}
                            />
                        ))}
                    </>
                )}
                {activeTab === 'filters' && (
                    <FilterPanel filters={filters} onChange={setFilters} allData={allVisibleData} />
                )}
                {activeTab === 'search' && (
                    <PlacesSearchPanel 
                        onAddLayer={(newLayer) => {
                            setLayers(prev => [...prev, newLayer]);
                            setActiveTab('layers');
                            setSearchBounds(null); 
                        }}
                        onSelectMapArea={() => {
                            if (window.innerWidth < 768) setIsSidebarOpen(false); 
                            setIsSelectingSearchArea(true);
                        }}
                        selectedBounds={searchBounds}
                    />
                )}
            </div>
            
            {multiSelected.length > 0 && (
                <div className="p-4 border-t border-slate-700 bg-slate-900">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-blue-400">محدد: {multiSelected.length}</span>
                        <button onClick={() => setMultiSelected([])} className="text-xs text-gray-400 hover:text-white">إلغاء</button>
                    </div>
                    <button onClick={() => setShowBulkEditor(true)} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-700">
                        <Users size={16} /> تعديل {multiSelected.length} عنصر
                    </button>
                </div>
            )}
        </div>

        <div className="flex-1 relative bg-gray-200 flex flex-col">
            
            <div className="absolute top-4 right-4 z-[1001] flex flex-col gap-2">
                {!isSidebarOpen && (
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-slate-800 text-white rounded-md shadow-md hover:bg-slate-700 border border-slate-600">
                        <Layers size={20} />
                    </button>
                )}
                
                <button 
                    onClick={toggleFullScreen} 
                    className={`p-2 bg-slate-800 text-white rounded-md shadow-md hover:bg-slate-700 border border-slate-600 ${isFullScreen ? 'bg-red-900/50 border-red-500 text-red-100' : ''}`}
                    title={isFullScreen ? "خروج من وضع ملء الشاشة" : "عرض الخريطة في شاشة كاملة"}
                >
                    {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
            </div>

            <MapComponent 
                layers={filteredLayers} 
                onSelectCustomer={(c, lId) => { setMultiSelected([]); setSelectedCustomer({ data: c, layerId: lId }); }}
                onMultiSelect={(sel) => { 
                    setMultiSelected(sel); 
                    setSelectedCustomer(null); 
                }}
                selectedCustomerId={selectedCustomer?.data.id}
                selectedCustomerIds={useMemo(() => new Set(multiSelected.map(s => s.data.id)), [multiSelected])}
                filters={filters}
                isSelectingSearchArea={isSelectingSearchArea}
                onSearchAreaComplete={(bounds) => {
                    setSearchBounds(bounds);
                    setIsSelectingSearchArea(false);
                    if (!isSidebarOpen) setIsSidebarOpen(true); 
                }}
                cursorMode={cursorMode}
            />
            
            <div className="absolute bottom-6 left-6 z-[999]">
                <button 
                    onClick={() => setIsTableOpen(!isTableOpen)}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg border border-slate-600 flex items-center gap-2 hover:bg-slate-700 transition-colors font-medium text-sm"
                >
                    <TableIcon size={18} />
                    {isTableOpen ? 'إخفاء الجدول' : 'عرض الجدول'}
                </button>
            </div>

            {isTableOpen && (
                <AttributeTable 
                    data={tableData} // Pass filtered data
                    onClose={() => setIsTableOpen(false)}
                    onRowClick={(c) => setSelectedCustomer({ data: c, layerId: c['_layerId'] })}
                    onUpdateData={(id, f, v) => handleSaveCustomer(id, { [f]: v })}
                    onAddColumn={handleAddColumn}
                    onAddRow={handleAddRow}
                    onBulkEdit={() => setShowBulkEditor(true)}
                    isFilteredBySelection={multiSelected.length > 0}
                />
            )}
        </div>
      </div>

      {selectedCustomer && (
        <CustomerEditor 
            customer={selectedCustomer.data}
            onSave={(id, data) => { handleSaveCustomer(id, data); setSelectedCustomer(null); }}
            onClose={() => setSelectedCustomer(null)}
        />
      )}

      {showBulkEditor && layers.length > 0 && (
        <BulkEditor 
            selectedCount={tableData.length}
            sampleData={tableData[0] || layers[0].data[0]}
            onSave={handleBulkSave}
            onClose={() => setShowBulkEditor(false)}
        />
      )}
    </div>
  );
};

export default App;