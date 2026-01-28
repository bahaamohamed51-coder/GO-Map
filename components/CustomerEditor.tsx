import React, { useState, useEffect } from 'react';
import { CustomerData } from '../types';
import { Save, X } from 'lucide-react';

interface CustomerEditorProps {
  customer: CustomerData | null;
  onSave: (id: string, updatedData: Partial<CustomerData>) => void;
  onClose: () => void;
}

const CustomerEditor: React.FC<CustomerEditorProps> = ({ customer, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<CustomerData>>({});

  useEffect(() => {
    if (customer) {
      setFormData({ ...customer });
    }
  }, [customer]);

  if (!customer) return null;

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(customer.id, formData);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-slate-700">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900">
            <h3 className="font-bold text-lg text-slate-100">تعديل بيانات العميل</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Form */}
        <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
            <div className="space-y-4">
                {Object.entries(formData).map(([key, val]) => {
                    if (key === 'id') return null; // ID is immutable
                    
                    const isCoordinates = key === 'lat' || key === 'lng';
                    
                    return (
                        <div key={key}>
                            <label className="block text-sm font-medium text-slate-300 mb-1 capitalize">
                                {key} {isCoordinates && <span className="text-xs text-blue-400">(إحداثيات)</span>}
                            </label>
                            <input 
                                type={typeof val === 'number' ? 'number' : 'text'}
                                step={isCoordinates ? "0.000001" : undefined}
                                value={val || ''}
                                onChange={(e) => handleChange(key, typeof val === 'number' ? parseFloat(e.target.value) : e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm text-white focus:border-blue-500 outline-none placeholder-slate-500"
                            />
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900 flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
                إلغاء
            </button>
            <button 
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
            >
                <Save size={16} />
                حفظ التعديلات
            </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerEditor;