import React, { useMemo } from 'react';
import { FilterRule, CustomerData, ShapeType } from '../types';
import { Plus, Trash2, Filter, Search, ListFilter, PlayCircle } from 'lucide-react';

interface FilterPanelProps {
  filters: FilterRule[];
  onChange: (filters: FilterRule[]) => void;
  allData: CustomerData[]; 
}

const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onChange, allData }) => {
  const availableFields = useMemo(() => {
    if (allData.length === 0) return [];
    return Object.keys(allData[0]).filter(k => !['id', 'lat', 'lng', '_layerId'].includes(k));
  }, [allData]);

  const getUniqueValues = (field: string) => {
    const values = new Set(allData.map(d => String(d[field] || '')).filter(Boolean));
    return Array.from(values).sort().slice(0, 100);
  };

  const addFilter = () => {
    const newFilter: FilterRule = {
      id: Date.now().toString(),
      field: availableFields[0] || '',
      operator: 'contains',
      value: '',
      style: { enabled: false, color: '#ef4444', shape: 'star' }
    };
    onChange([...filters, newFilter]);
  };

  const updateFilter = (id: string, updates: Partial<FilterRule>) => {
    onChange(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };
  
  const updateFilterStyle = (id: string, styleUpdates: Partial<FilterRule['style']>) => {
    onChange(filters.map(f => f.id === id ? { ...f, style: { ...f.style!, ...styleUpdates } } : f));
  };

  const removeFilter = (id: string) => {
    onChange(filters.filter(f => f.id !== id));
  };

  if (availableFields.length === 0) return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-500 gap-2">
          <Filter size={32} className="opacity-50" />
          <p className="text-sm">لا توجد بيانات متاحة للفلترة.</p>
      </div>
  );

  return (
    <div className="space-y-4">
      
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <ListFilter size={16} className="text-blue-500" />
            القواعد النشطة ({filters.length})
        </h3>
        <button 
            onClick={addFilter} 
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full hover:bg-blue-500 flex items-center gap-1 transition-all shadow-md hover:shadow-lg"
        >
          <Plus size={14} /> قاعدة جديدة
        </button>
      </div>

      <div className="space-y-3">
          {filters.length === 0 && (
              <div className="text-center p-6 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/50 text-slate-400">
                  <p className="text-sm">لم تقم بإضافة أي فلاتر بعد.</p>
                  <p className="text-xs mt-1 text-slate-500">اضغط على "قاعدة جديدة" للبدء.</p>
              </div>
          )}

          {filters.map((filter, index) => {
            const uniqueValues = getUniqueValues(filter.field);
            const isSelectable = uniqueValues.length > 0 && uniqueValues.length < 50;

            return (
                <div key={filter.id} className="group bg-slate-800 rounded-lg border border-slate-700 shadow-md overflow-hidden hover:border-slate-600 transition-colors">
                    
                    {/* Filter Header / Bar */}
                    <div className="p-3 bg-slate-700/30 border-b border-slate-700/50 flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded">#{index + 1}</span>
                        <div className="flex-1 text-xs text-slate-300 font-medium">قاعدة تصفية</div>
                        <button onClick={() => removeFilter(filter.id)} className="text-slate-500 hover:text-red-400 p-1 rounded-md hover:bg-slate-700 transition-colors">
                            <Trash2 size={14} />
                        </button>
                    </div>

                    <div className="p-3 space-y-3">
                        {/* Logic Row */}
                        <div className="grid grid-cols-[1.5fr_1fr] gap-2">
                             <div>
                                <label className="block text-[10px] text-slate-400 mb-1">الحقل</label>
                                <div className="relative">
                                    <select 
                                        value={filter.field}
                                        onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                                        className="w-full text-xs p-2 pl-2 border border-slate-600 rounded bg-slate-900 text-slate-200 outline-none focus:border-blue-500 appearance-none"
                                    >
                                        {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                             </div>
                             <div>
                                <label className="block text-[10px] text-slate-400 mb-1">الشرط</label>
                                <select 
                                    value={filter.operator}
                                    onChange={(e) => updateFilter(filter.id, { operator: e.target.value as any })}
                                    className="w-full text-xs p-2 border border-slate-600 rounded bg-slate-900 text-slate-200 outline-none focus:border-blue-500"
                                >
                                    <option value="contains">يحتوي على</option>
                                    <option value="equals">يساوي تماماً</option>
                                    <option value="in">ضمن قائمة</option>
                                </select>
                             </div>
                        </div>

                        {/* Value Row */}
                        <div>
                            <label className="block text-[10px] text-slate-400 mb-1">القيمة</label>
                            {isSelectable && filter.operator !== 'contains' ? (
                                <select
                                    value={filter.value}
                                    onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                                    className="w-full text-xs p-2 border border-slate-600 rounded bg-slate-900 text-slate-200 outline-none focus:border-blue-500"
                                >
                                    <option value="">-- اختر قيمة --</option>
                                    {uniqueValues.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            ) : (
                                <div className="relative">
                                    <Search size={12} className="absolute top-2.5 left-2.5 text-slate-500" />
                                    <input 
                                        type="text"
                                        value={filter.value}
                                        onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                                        placeholder="اكتب القيمة هنا..."
                                        className="w-full text-xs p-2 pl-8 border border-slate-600 rounded bg-slate-900 text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Highlight Toggle */}
                        <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between">
                             <label className="flex items-center gap-2 cursor-pointer select-none">
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={filter.style?.enabled}
                                        onChange={(e) => updateFilterStyle(filter.id, { enabled: e.target.checked })}
                                    />
                                    <div className="w-8 h-4 bg-slate-700 rounded-full peer-checked:bg-blue-600 transition-colors"></div>
                                    <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                                </div>
                                <span className="text-xs text-slate-400">تمييز لوني (Highlight)</span>
                             </label>

                             {filter.style?.enabled && (
                                <div className="flex items-center gap-2 animate-fadeIn">
                                    <input 
                                        type="color" 
                                        value={filter.style.color}
                                        onChange={(e) => updateFilterStyle(filter.id, { color: e.target.value })}
                                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                                        title="لون التمييز"
                                    />
                                    <select 
                                        value={filter.style.shape}
                                        onChange={(e) => updateFilterStyle(filter.id, { shape: e.target.value as ShapeType })}
                                        className="text-[10px] p-1 border border-slate-600 rounded bg-slate-900 text-slate-200 outline-none"
                                    >
                                        <option value="circle">دائرة</option>
                                        <option value="star">نجمة</option>
                                        <option value="square">مربع</option>
                                        <option value="triangle">مثلث</option>
                                    </select>
                                </div>
                             )}
                        </div>
                    </div>
                </div>
            );
          })}
      </div>
    </div>
  );
};

export default FilterPanel;