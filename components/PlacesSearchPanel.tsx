import React, { useState, useEffect } from 'react';
import { Search, MapPin, Loader2, Spline } from 'lucide-react';
import { searchPlacesInArea } from '../utils/apiService';
import { LayerConfig, BoundingBox } from '../types';
import { generateColorMap } from '../utils/excelHelpers';

interface PlacesSearchPanelProps {
  onAddLayer: (layer: LayerConfig) => void;
  onSelectMapArea: () => void;
  selectedBounds: BoundingBox | null;
}

const PlacesSearchPanel: React.FC<PlacesSearchPanelProps> = ({ onAddLayer, onSelectMapArea, selectedBounds }) => {
  const [area, setArea] = useState('');
  const [activity, setActivity] = useState('');
  const [loading, setLoading] = useState(false);
  const [useMapSelection, setUseMapSelection] = useState(false);

  // Auto-set mode when bounds are received
  useEffect(() => {
      if (selectedBounds) {
          setUseMapSelection(true);
      }
  }, [selectedBounds]);

  const handleSearch = async () => {
    if (!activity) return;
    if (!useMapSelection && !area) return;
    
    setLoading(true);

    try {
      const results = await searchPlacesInArea(
          activity, 
          useMapSelection ? 'منطقة محددة' : area, 
          useMapSelection ? selectedBounds || undefined : undefined
      );
      
      if (results.length === 0) {
        alert('لم يتم العثور على نتائج.');
        setLoading(false);
        return;
      }

      const newLayer: LayerConfig = {
        id: `search-${Date.now()}`,
        name: `${activity} في ${useMapSelection ? 'الخريطة' : area}`,
        fileName: 'بحث الخريطة',
        data: results,
        visible: true,
        isPlacesLayer: true,
        colorByField: 'النوع',
        shapeByField: 'النوع',
        labelByField: 'الاسم',
        pointSize: 15,
        colorMap: generateColorMap(results, 'النوع'),
        shapeMap: {},
        hiddenCategories: [],
        defaultColor: '#ef4444',
        defaultShape: 'star'
      };

      onAddLayer(newLayer);
      if (!useMapSelection) setArea('');
      setActivity('');
    } catch (e) {
      alert('حدث خطأ أثناء البحث');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <Search size={18} className="text-blue-400" />
            البحث عن نشاط
        </h3>
        
        <div className="space-y-3">
            {/* Area Selection Mode */}
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-600 mb-2">
                <button 
                    onClick={() => setUseMapSelection(false)}
                    className={`flex-1 text-xs py-1.5 rounded transition-colors ${!useMapSelection ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                >
                    كتابة اسم المنطقة
                </button>
                <button 
                    onClick={() => setUseMapSelection(true)}
                    className={`flex-1 text-xs py-1.5 rounded transition-colors ${useMapSelection ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                >
                    تحديد على الخريطة
                </button>
            </div>

            {useMapSelection ? (
                 <div className="bg-slate-700/30 p-3 rounded border border-slate-600 border-dashed text-center">
                    {selectedBounds ? (
                        <div className="text-emerald-400 text-xs flex flex-col items-center gap-1">
                            <MapPin size={16} />
                            <span>تم تحديد المنطقة بنجاح</span>
                            <button onClick={onSelectMapArea} className="text-[10px] underline text-slate-400 hover:text-white mt-1">تغيير التحديد</button>
                        </div>
                    ) : (
                        <button 
                            onClick={onSelectMapArea}
                            className="text-amber-400 hover:text-amber-300 text-xs flex flex-col items-center gap-2 w-full"
                        >
                            <Spline size={20} />
                            <span>اضغط هنا لتحديد منطقة البحث (رسم مضلع)</span>
                        </button>
                    )}
                 </div>
            ) : (
                <div>
                    <label className="block text-xs text-slate-400 mb-1">المنطقة (مثال: المعادي)</label>
                    <div className="relative">
                        <MapPin size={14} className="absolute top-2.5 right-2.5 text-slate-500" />
                        <input 
                            type="text" 
                            value={area}
                            onChange={(e) => setArea(e.target.value)}
                            placeholder="اسم المنطقة..."
                            className="w-full p-2 pr-8 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 outline-none"
                        />
                    </div>
                </div>
            )}

            <div>
                <label className="block text-xs text-slate-400 mb-1">النشاط (مثال: صيدلية)</label>
                <div className="relative">
                    <Search size={14} className="absolute top-2.5 right-2.5 text-slate-500" />
                    <input 
                        type="text" 
                        value={activity}
                        onChange={(e) => setActivity(e.target.value)}
                        placeholder="نوع النشاط..."
                        className="w-full p-2 pr-8 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 outline-none"
                    />
                </div>
            </div>

            <button 
                onClick={handleSearch}
                disabled={loading || (!area && !useMapSelection) || (useMapSelection && !selectedBounds) || !activity}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors mt-2"
            >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                بحث وإضافة للخريطة
            </button>
        </div>
      </div>
    </div>
  );
};

export default PlacesSearchPanel;