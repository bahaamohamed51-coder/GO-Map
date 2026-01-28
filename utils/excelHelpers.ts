import * as XLSX from 'xlsx';
import { CustomerData, LayerConfig } from '../types';
import { LAT_KEYS, LNG_KEYS, CATEGORY_COLORS } from '../constants';

// Helper to find lat/lng columns insensitively
const findKey = (row: any, keys: string[]) => {
  const rowKeys = Object.keys(row);
  return rowKeys.find(k => keys.includes(k.toLowerCase()));
};

export const parseExcelFile = async (file: File): Promise<CustomerData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        // Process data to standard format
        const processed: CustomerData[] = jsonData.map((row, index) => {
          const latKey = findKey(row, LAT_KEYS);
          const lngKey = findKey(row, LNG_KEYS);

          let lat = 0;
          let lng = 0;

          if (latKey && lngKey) {
            lat = parseFloat(row[latKey]);
            lng = parseFloat(row[lngKey]);
          }

          return {
            id: `row-${Date.now()}-${index}`,
            ...row,
            lat: isNaN(lat) ? 0 : lat,
            lng: isNaN(lng) ? 0 : lng,
          };
        }).filter(c => c.lat !== 0 && c.lng !== 0); // Filter invalid coordinates

        resolve(processed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

export const generateColorMap = (data: CustomerData[], field: string): Record<string, string> => {
  const uniqueValues = Array.from(new Set(data.map(d => String(d[field] || 'غير محدد'))));
  const map: Record<string, string> = {};
  uniqueValues.forEach((val, idx) => {
    map[val] = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
  });
  return map;
};

export const exportLayersToExcel = (layers: LayerConfig[]) => {
  const workbook = XLSX.utils.book_new();

  layers.forEach(layer => {
    // Remove internal ID before export
    const cleanData = layer.data.map(({ id, ...rest }) => rest);
    const worksheet = XLSX.utils.json_to_sheet(cleanData);
    XLSX.utils.book_append_sheet(workbook, worksheet, layer.name.substring(0, 31));
  });

  XLSX.writeFile(workbook, `GeoExcel_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
