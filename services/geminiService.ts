import { GoogleGenAI } from "@google/genai";
import { CustomerData } from '../types';

export const analyzeMapData = async (data: CustomerData[], focusField: string): Promise<string> => {
  if (!process.env.API_KEY) {
    return "عفواً، مفتاح API غير متوفر. يرجى التحقق من الإعدادات.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // We take a sample to avoid token limits if dataset is huge
    const sampleSize = 50;
    const sampleData = data.slice(0, sampleSize).map(item => {
        // Create a simplified object with relevant fields
        const { id, lat, lng, ...rest } = item;
        return JSON.stringify(rest);
    }).join('\n');

    const prompt = `
      بصفتك محلل بيانات جغرافية وتسويقية، قم بتحليل عينة البيانات التالية لعملاء.
      
      البيانات مجمعة بناءً على الحقل: "${focusField}".
      
      العينة (JSON):
      ${sampleData}
      
      المطلوب:
      1. قدم ملخصاً قصيراً عن توزيع العملاء بناءً على "${focusField}".
      2. هل هناك أي أنماط ملحوظة؟
      3. اقتراحات لتحسين التوزيع أو المبيعات بناءً على هذه البيانات.
      
      اكتب الرد باللغة العربية وبشكل نقاط واضحة.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "لم يتم استلام رد من النموذج.";

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "حدث خطأ أثناء محاولة تحليل البيانات. يرجى المحاولة مرة أخرى.";
  }
};
