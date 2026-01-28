import React, { useState } from 'react';
import { CustomerData } from '../types';
import { Save, X, AlertTriangle, Palette } from 'lucide-react';

interface BulkEditorProps {
  selectedCount: number;
  sampleData: CustomerData;
  onSave: (updates: Partial<CustomerData>) => void;
  onClose: () => void;
}

const BulkEditor: React.FC<BulkEditorProps> = ({ selectedCount, sampleData, onSave, onClose }) => {
  const [fieldToUpdate, setFieldToUpdate] = useState<string>('');
  const [newValue, setNewValue] = useState<string>('');
  const [customColor, setCustomColor] = useState<string>('#ef4444');
  const [mode, setMode] = useState<'field' | 'color'>('field');
  
  const availableFields = Object.keys(sampleData).filter(k => !['id', 'lat', 'lng', '_customColor'].includes(k));

  const handleSave = () => {
    if (mode === 'color') {
        onSave({ _customColor: customColor });
    } else {
        if (!fieldToUpdate) return;
        onSave({ [fieldToUpdate]: newValue });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fadeIn border border-slate-700">
        <div className="p-4 border-b border-yellow-800/50 bg-yellow-900/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-yellow-500">
                <AlertTriangle size={20} />
                <h3 className="font-bold text-sm">تعديل جماعي ({selectedCount})</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500">
                <X size={20} />
            </button>
        </div>
        
        <div className="p-5">
            <div className="flex gap-2 mb-4">
                <button 
                    onClick={() => setMode('field')}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${mode === 'field' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                >
                    تعديل بيانات
                </button>
                <button 
                    onClick={() => setMode('color')}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${mode === 'color' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                >
                    تغيير لون المجموعة
                </button>
            </div>

            {mode === 'field' ? (
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">الحقل المراد تعديله</label>
                        <select 
                            value={fieldToUpdate}
                            onChange={(e) => setFieldToUpdate(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm text-white focus:border-blue-500 outline-none"
                        >
                            <option value="">-- اختر الحقل --</option>
                            {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>

                    {fieldToUpdate && (
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">القيمة الجديدة</label>
                            <input 
                                type="text"
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm text-white focus:border-blue-500 outline-none"
                                placeholder="أدخل القيمة..."
                            />
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-4">
                    <label className="block text-sm font-medium text-slate-300 mb-3">اختر لوناً لتمييز العملاء المحددين</label>
                    <div className="flex justify-center items-center gap-4">
                        <input 
                            type="color" 
                            value={customColor}
                            onChange={(e) => setCustomColor(e.target.value)}
                            className="w-16 h-16 rounded cursor-pointer border-2 border-slate-600 bg-slate-700"
                        />
                        <span className="font-mono text-slate-400">{customColor}</span>
                    </div>
                </div>
            )}
        </div>

        <div className="p-3 bg-slate-900 flex justify-end gap-2 border-t border-slate-700">
             <button 
                onClick={onClose}
                className="px-3 py-1.5 text-slate-400 hover:bg-slate-700 rounded text-sm transition-colors"
            >
                إلغاء
            </button>
            <button 
                onClick={handleSave}
                disabled={mode === 'field' && !fieldToUpdate}
                className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {mode === 'color' ? <Palette size={14} /> : <Save size={14} />}
                تطبيق التعديلات
            </button>
        </div>
      </div>
    </div>
  );
};

export default BulkEditor;