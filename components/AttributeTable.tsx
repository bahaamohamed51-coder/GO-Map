import React, { useState, useMemo } from 'react';
import { CustomerData } from '../types';
import { X, MapPin, Plus, Filter, Users, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface AttributeTableProps {
  data: CustomerData[];
  onClose: () => void;
  onRowClick: (customer: CustomerData) => void;
  onUpdateData: (id: string, field: string, value: string) => void;
  onAddColumn: (name: string) => void;
  onAddRow: () => void;
  onBulkEdit: () => void;
  isFilteredBySelection: boolean;
}

const ITEMS_PER_PAGE = 50;

const AttributeTable: React.FC<AttributeTableProps> = ({ 
    data, onClose, onRowClick, onUpdateData, onAddColumn, onAddRow, onBulkEdit, isFilteredBySelection 
}) => {
  const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);

  const columns = useMemo(() => {
    if (data.length === 0) return [];
    const keys = new Set<string>();
    // Scan first 20 rows to find all keys
    data.slice(0, 20).forEach(d => {
        Object.keys(d).forEach(k => keys.add(k));
    });
    return Array.from(keys).filter(k => !['id', '_layerId', '_customColor'].includes(k));
  }, [data]);

  const filteredData = useMemo(() => {
      // Reset page when filters change
      if (currentPage !== 1) setCurrentPage(1);
      
      return data.filter(row => {
          return Object.entries(columnFilters).every(([key, filterVal]) => {
              if (!filterVal) return true;
              return String(row[key] || '').toLowerCase().includes((filterVal as string).toLowerCase());
          });
      });
  }, [data, columnFilters]); // Removed currentPage dependency to avoid loop

  // Paginate the filtered data
  const paginatedData = useMemo(() => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

  const handleStartEdit = (id: string, field: string, currentValue: any) => {
    setEditingCell({ id, field });
    setEditValue(String(currentValue));
  };

  const handleSaveEdit = () => {
    if (editingCell) {
      onUpdateData(editingCell.id, editingCell.field, editValue);
      setEditingCell(null);
    }
  };

  const handleAddCol = () => {
      const name = prompt("أدخل اسم العمود الجديد:");
      if (name) onAddColumn(name);
  };

  if (data.length === 0) return (
      <div className="absolute bottom-0 left-0 right-0 bg-slate-900 shadow-[0_-4px_10px_rgba(0,0,0,0.3)] z-[999] h-[20vh] border-t border-slate-700 text-white flex items-center justify-center">
          <div className="text-slate-500">لا توجد بيانات للعرض (قد تكون جميع الطبقات مخفية)</div>
          <button onClick={onClose} className="absolute top-2 right-2 p-1 hover:bg-slate-700 rounded"><X size={18} /></button>
      </div>
  );

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-slate-900 shadow-[0_-4px_10px_rgba(0,0,0,0.3)] z-[999] flex flex-col transition-all duration-300 h-[45vh] border-t border-slate-700 text-white">
      
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                جدول البيانات ({filteredData.length})
                {isFilteredBySelection && <span className="bg-blue-600 text-[10px] px-2 py-0.5 rounded-full">مفلتر حسب التحديد</span>}
            </h3>
            <div className="h-4 w-[1px] bg-slate-600"></div>
            <button onClick={onBulkEdit} className="flex items-center gap-1 text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 px-2 py-1 rounded hover:bg-yellow-600/30 transition-colors">
                <Users size={12} /> تعديل جماعي ({filteredData.length})
            </button>
            <button onClick={handleAddCol} className="flex items-center gap-1 text-xs bg-slate-700 text-slate-200 border border-slate-600 px-2 py-1 rounded hover:bg-slate-600 transition-colors">
                <Plus size={12} /> عمود جديد
            </button>
            <button onClick={onAddRow} className="flex items-center gap-1 text-xs bg-slate-700 text-slate-200 border border-slate-600 px-2 py-1 rounded hover:bg-slate-600 transition-colors">
                <Plus size={12} /> صف جديد
            </button>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table className="w-full text-sm text-right border-collapse relative">
          <thead className="bg-slate-800 text-slate-300 sticky top-0 shadow-sm z-10">
            <tr>
              <th className="p-2 border-b border-slate-700 w-12 text-center bg-slate-800 z-20 sticky left-0">#</th>
              {columns.map(col => (
                <th key={col} className="p-2 border-b border-l border-slate-700 min-w-[150px] bg-slate-800">
                  <div className="flex flex-col gap-1">
                      <span className="font-semibold px-1 text-slate-200">{col}</span>
                      <div className="relative">
                        <Filter size={10} className="absolute top-2 left-2 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="بحث..." 
                            className="w-full text-xs p-1 pl-6 border border-slate-600 rounded bg-slate-900 text-white focus:border-blue-500 outline-none placeholder-slate-600"
                            value={columnFilters[col] || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, [col]: e.target.value }))}
                        />
                      </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => (
              <tr key={row.id} className="hover:bg-slate-800 transition-colors border-b border-slate-800/50 group">
                <td className="p-2 text-center text-slate-500 text-xs bg-slate-900 group-hover:bg-slate-800 sticky left-0 border-r border-slate-700">
                    <button 
                        onClick={() => onRowClick(row)}
                        className="text-blue-400 hover:text-blue-300"
                        title="ذهاب للموقع"
                    >
                        <MapPin size={16} />
                    </button>
                </td>
                {columns.map(col => {
                  const isEditing = editingCell?.id === row.id && editingCell?.field === col;
                  const value = row[col];
                  
                  return (
                    <td 
                        key={`${row.id}-${col}`} 
                        className="p-2 border-l border-slate-700 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis cursor-cell text-slate-300"
                        onDoubleClick={() => handleStartEdit(row.id, col, value)}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                            <input 
                                autoFocus
                                className="w-full p-1 text-xs border border-blue-500 rounded outline-none bg-slate-800 text-white"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                                onBlur={handleSaveEdit}
                            />
                        </div>
                      ) : (
                        <span title={String(value)}>{value}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="bg-slate-800 border-t border-slate-700 p-2 flex items-center justify-between shrink-0">
         <span className="text-xs text-slate-400 px-2">
            عرض {paginatedData.length} من أصل {filteredData.length} سجل
         </span>
         
         <div className="flex items-center gap-1">
            <button 
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:text-slate-600 disabled:hover:bg-transparent"
            >
                <ChevronsRight size={16} />
            </button>
            <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:text-slate-600 disabled:hover:bg-transparent"
            >
                <ChevronRight size={16} />
            </button>
            
            <span className="text-xs bg-slate-900 px-3 py-1 rounded text-slate-200 min-w-[3rem] text-center border border-slate-700">
                {currentPage} / {totalPages || 1}
            </span>
            
            <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:text-slate-600 disabled:hover:bg-transparent"
            >
                <ChevronLeft size={16} />
            </button>
            <button 
                onClick={() => setCurrentPage(totalPages)} 
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:text-slate-600 disabled:hover:bg-transparent"
            >
                <ChevronsLeft size={16} />
            </button>
         </div>
      </div>

    </div>
  );
};

export default AttributeTable;
