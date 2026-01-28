import React, { useState } from 'react';
import { LayerConfig, ShapeType } from '../types';
import { Eye, EyeOff, Trash2, ChevronDown, Palette, ScanEye, CheckSquare, Square, MapPin, Loader2, Copy } from 'lucide-react';

interface LayerControlProps {
  layer: LayerConfig;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void; // New Prop
  onUpdateConfig: (id: string, updates: Partial<LayerConfig>) => void;
  onUpdateStyleMap: (id: string, value: string, type: 'color' | 'shape', newValue: string) => void;
  onFocusValue: (field: string, value: string) => void;
  onToggleCategory: (layerId: string, category: string) => void; 
  onEnrichData?: (layerId: string) => void; 
  isEnriching?: boolean; 
}

const SHAPES: ShapeType[] = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon'];

const LayerControl: React.FC<LayerControlProps> = ({ 
  layer, 
  onToggleVisibility, 
  onDelete, 
  onDuplicate,
  onUpdateConfig,
  onUpdateStyleMap,
  onFocusValue,
  onToggleCategory,
  onEnrichData,
  isEnriching = false
}) => {
  const [expanded, setExpanded] = useState(false);
  const [editingValue, setEditingValue] = useState<string | null>(null);

  const availableKeys = layer.data.length > 0 
    ? Object.keys(layer.data[0]).filter(k => !['id', 'lat', 'lng'].includes(k)) 
    : [];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 mb-3 overflow-hidden transition-all shadow-sm">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-800 to-slate-750 cursor-pointer hover:bg-slate-750"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 overflow-hidden">
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                className={`p-1.5 rounded-full transition-colors ${layer.visible ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-700 text-gray-400'}`}
                title={layer.visible ? "إخفاء" : "إظهار"}
            >
                {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <div className="flex flex-col overflow-hidden">
                <span className="font-semibold text-sm truncate text-slate-100" title={layer.fileName}>
                    {layer.name}
                </span>
                {layer.isPlacesLayer && <span className="text-[10px] text-yellow-500">نتائج بحث</span>}
            </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
             <button 
                onClick={(e) => { e.stopPropagation(); onDuplicate(layer.id); }}
                className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-slate-700 rounded-md transition-colors"
                title="تكرار الطبقة (نسخة)"
            >
                <Copy size={15} />
            </button>
             <button 
                onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-md transition-colors"
                title="حذف الطبقة"
            >
                <Trash2 size={15} />
            </button>
            <div className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                <ChevronDown size={16} className="text-slate-400" />
            </div>
        </div>
      </div>

      {/* Expanded Config */}
      {expanded && (
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
            
            {/* Geo Enrichment Button */}
            {!layer.isPlacesLayer && onEnrichData && (
                <div className="mb-4">
                    <button 
                        onClick={() => onEnrichData(layer.id)}
                        disabled={isEnriching}
                        className="w-full py-2 px-3 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-600/50 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {isEnriching ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                        {isEnriching ? 'جاري جلب أسماء المناطق...' : 'إضافة "اسم المنطقة" للبيانات'}
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1 text-center">
                        سيقوم بجلب اسم المنطقة لكل نقطة وإضافته للجدول.
                    </p>
                </div>
            )}

            {/* Field Selection Grid */}
            <div className="grid grid-cols-1 gap-4 mb-4">
                <div>
                    {/* Color */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                            <Palette size={10} /> تصنيف حسب
                        </label>
                        <select 
                            value={layer.colorByField}
                            onChange={(e) => onUpdateConfig(layer.id, { colorByField: e.target.value })}
                            className="w-full text-xs p-2 border border-slate-600 rounded bg-slate-700 text-slate-100 outline-none focus:border-blue-500"
                        >
                            {availableKeys.map(key => <option key={key} value={key}>{key}</option>)}
                        </select>
                    </div>
                </div>

                {/* Point Size Control */}
                <div>
                    <label className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                        <span>حجم النقاط</span>
                        <span className="text-white">{layer.pointSize || 12}px</span>
                    </label>
                    <input 
                        type="range" 
                        min="2" 
                        max="30" 
                        value={layer.pointSize || 12}
                        onChange={(e) => onUpdateConfig(layer.id, { pointSize: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
            </div>

            {/* Legend / Style Editor */}
            <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                <div className="flex justify-between items-center mb-2 px-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400">مفتاح الخريطة</p>
                    <button 
                        onClick={() => onUpdateConfig(layer.id, { hiddenCategories: [] })} 
                        className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline"
                    >
                        عرض الكل
                    </button>
                </div>
                
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {Object.keys(layer.colorMap).map((value) => {
                        const color = layer.colorMap[value] || layer.defaultColor;
                        const shape = layer.shapeMap[value] || layer.defaultShape;
                        const isHidden = layer.hiddenCategories?.includes(value);
                        const isVisible = !isHidden;

                        return (
                            <div key={value} className="relative group">
                                <div className={`flex items-center justify-between text-xs p-1.5 rounded transition-colors ${isVisible ? 'hover:bg-slate-700' : 'hover:bg-slate-700/50'}`}>
                                    
                                    <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                        {/* Toggle Visibility Checkbox */}
                                        <button 
                                            onClick={() => onToggleCategory(layer.id, value)}
                                            className={`transition-colors flex-shrink-0 ${isVisible ? 'text-blue-500' : 'text-slate-600'}`}
                                        >
                                            {isVisible ? <CheckSquare size={14} /> : <Square size={14} />}
                                        </button>

                                        {/* Color Swatch & Label */}
                                        <div 
                                            className={`flex items-center gap-2 cursor-pointer flex-1 truncate ${!isVisible ? 'opacity-40 grayscale' : ''}`}
                                            onClick={() => setEditingValue(editingValue === value ? null : value)}
                                        >
                                            <div className="w-2.5 h-2.5 rounded-sm shadow-sm" style={{ backgroundColor: color }}></div>
                                            <span className="truncate max-w-[120px] text-slate-200">{value}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                                        <button 
                                            onClick={() => onFocusValue(layer.colorByField, value)}
                                            className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-600 rounded"
                                            title={`تركيز على هذا العنصر`}
                                        >
                                            <ScanEye size={14} />
                                        </button>
                                        <span className="text-[10px] text-slate-400 ml-1 bg-slate-800 px-1 rounded border border-slate-700">{shape}</span>
                                    </div>
                                </div>

                                {/* Style Popover */}
                                {editingValue === value && (
                                    <div className="mt-2 mb-2 p-3 bg-slate-800 border border-slate-600 shadow-xl rounded-lg animate-fadeIn">
                                        <div className="flex gap-3 mb-2">
                                            <div className="flex-1">
                                                <label className="block text-[10px] text-slate-400 mb-1">اللون</label>
                                                <input 
                                                    type="color" 
                                                    value={color}
                                                    onChange={(e) => onUpdateStyleMap(layer.id, value, 'color', e.target.value)}
                                                    className="w-full h-8 cursor-pointer rounded border border-slate-600 bg-slate-700"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[10px] text-slate-400 mb-1">الشكل</label>
                                                <div className="grid grid-cols-3 gap-1">
                                                    {SHAPES.map(s => (
                                                        <button 
                                                            key={s}
                                                            onClick={() => onUpdateStyleMap(layer.id, value, 'shape', s)}
                                                            className={`h-6 flex items-center justify-center rounded border transition-all ${shape === s ? 'bg-blue-600 border-blue-400 text-white' : 'border-slate-600 bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                                            title={s}
                                                        >
                                                            <div className={`w-1.5 h-1.5 bg-current ${s === 'circle' ? 'rounded-full' : ''}`} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-left border-t border-slate-700 pt-2">
                                            <button onClick={(e) => { e.stopPropagation(); setEditingValue(null); }} className="text-xs text-blue-400 hover:text-blue-300">تم</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default LayerControl;
