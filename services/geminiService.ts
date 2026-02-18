
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Question, QuestionType, VectorChunk, AppSettings, UserProfile } from "../types";
import { findRelevantChunks } from "./documentProcessor";

// --- CONFIGURATION ---
const PRIMARY_MODEL = "gemini-2.5-flash"; 
const FALLBACK_MODEL = "gemini-flash-latest"; 
const STORAGE_KEY_API = 'DTS_GEMINI_API_KEY';

const DEFAULT_SETTINGS: AppSettings = {
  modelName: PRIMARY_MODEL, 
  aiVoice: "Zephyr",
  temperature: 0.7,
  maxOutputTokens: 2048,
  autoSave: true,
  ragTopK: 5, 
  thinkingBudget: 0, 
  systemExpertise: 'ACADEMIC'
};

const getSettings = (): AppSettings => {
  const saved = localStorage.getItem('app_settings');
  return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
};

/**
 * Retrieves the API Key with priority:
 * 1. User Custom Key (LocalStorage)
 * 2. System Environment Variable
 */
export const getDynamicApiKey = (): string | undefined => {
  const customKey = localStorage.getItem(STORAGE_KEY_API);
  if (customKey && customKey.trim().length > 0) {
    return customKey;
  }
  return process.env.API_KEY;
};

const getAI = (specificKey?: string) => {
  const apiKey = specificKey || getDynamicApiKey();
  
  if (!apiKey) {
    throw new Error("Vui lòng nhập Gemini API Key trong phần Cài đặt hệ thống (Settings) để sử dụng các tính năng AI.");
  }
  
  return new GoogleGenAI({ apiKey });
};

/**
 * Validates an API Key by making a lightweight request.
 */
export const validateApiKey = async (key: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hi",
    });
    return true;
  } catch (error) {
    console.error("API Key Validation Failed:", error);
    return false;
  }
};

/**
 * SMART WRAPPER: Handles 429/503 errors by falling back to a stable model.
 */
const generateWithFallback = async (
  ai: GoogleGenAI, 
  params: any, 
  retryCount = 4
): Promise<{ response: GenerateContentResponse, usedModel: string }> => {
  let currentModel = params.model;

  // SAFETY NET: Force downgrade if 3.0 is requested due to quota issues
  if (currentModel === 'gemini-3-flash-preview') {
      console.warn("[AI-SAFETY] Intercepted 3.0 request. Downgrading to 2.5 Flash for stability.");
      currentModel = PRIMARY_MODEL;
  }
  
  if (!currentModel) currentModel = PRIMARY_MODEL;

  let attempt = 0;
  // Clone config to safely modify for fallback
  let currentConfig = params.config ? { ...params.config } : {};

  while (attempt < retryCount) {
    try {
      // Execute request
      const response = await ai.models.generateContent({
        ...params,
        model: currentModel,
        config: currentConfig
      });
      
      return { response, usedModel: currentModel };

    } catch (error: any) {
      const msg = error.toString();
      const status = error.status || 0;
      const isQuotaError = msg.includes('429') || status === 429 || msg.includes('RESOURCE_EXHAUSTED');
      const isServerOverload = msg.includes('503') || status === 503 || msg.includes('Overloaded');

      if (isQuotaError || isServerOverload) {
        console.warn(`[AI-WARN] Model ${currentModel} hit limit (Status: ${status}).`);

        // LEVEL 1: Switch to Fallback Model (High Quota) but TRY TO KEEP TOOLS
        if (currentModel !== FALLBACK_MODEL) {
           console.log(`[AI-FALLBACK] Switching to ${FALLBACK_MODEL} (Stable) - Retaining tools.`);
           currentModel = FALLBACK_MODEL;
           
           if (currentConfig.thinkingConfig) delete currentConfig.thinkingConfig;
           
           // Small delay to let buffers clear
           await new Promise(r => setTimeout(r, 500));
           continue; 
        }

        // LEVEL 2: If Fallback with Tools fails, remove Tools (Text Only Mode)
        if (currentModel === FALLBACK_MODEL && currentConfig.tools) {
           console.log(`[AI-FALLBACK] Disabling tools for ${FALLBACK_MODEL} to ensure text response.`);
           delete currentConfig.tools;
           await new Promise(r => setTimeout(r, 800));
           continue;
        }

        // LEVEL 3: Exponential Backoff if already on bare-bones Fallback
        attempt++;
        if (attempt >= retryCount) break; // Exit loop to throw error

        const delay = 1000 * Math.pow(2, attempt);
        console.log(`[AI-RETRY] Retrying ${FALLBACK_MODEL} in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Throw immediately for other errors (400, 401, 404)
      if (status === 404 || msg.includes('404')) {
         throw new Error(`Model '${currentModel}' không tồn tại (404).`);
      }
      throw error;
    }
  }
  
  throw new Error("Hệ thống AI đang quá tải (429/503). Vui lòng thử lại sau hoặc đổi API Key.");
};

const getSystemInstruction = (settings: AppSettings, contextText: string, user?: UserProfile | null) => {
  const userName = user?.fullName || "Bạn";
  const userRole = user?.role || "student";

  let roleInstruction = "";

  if (userRole === 'teacher') {
    roleInstruction = `
    VAI TRÒ: Đồng nghiệp ảo (AI Co-pilot) hỗ trợ giảng viên ${userName}.
    PHONG CÁCH: Chuyên nghiệp, đi thẳng vào chuyên môn.
    NHIỆM VỤ: Soạn giáo án, đề xuất câu hỏi thi, tra cứu quy chuẩn.
    `;
  } else if (userRole === 'admin') {
    roleInstruction = `
    VAI TRÒ: System Bot (CLI Style).
    PHONG CÁCH: Cực ngắn gọn. Chỉ báo cáo trạng thái hoặc kết quả.
    `;
  } else {
    // Default: Student
    roleInstruction = `
    VAI TRÒ: Thầy giáo AI (Socratic Tutor) hướng dẫn học viên ${userName}.
    PHONG CÁCH: Thân thiện, khuyến khích tư duy.
    `;
  }

  let instruction = `${roleInstruction}
  
  CẤU TRÚC TRẢ LỜI & SỬ DỤNG CÔNG CỤ (QUAN TRỌNG):
  1. **TRA CỨU GOOGLE (Ưu tiên số 1):** 
     - Với mọi câu hỏi về thông số kỹ thuật, quy chuẩn (TCVN, IEC), công nghệ mới hoặc kiến thức thực tế: BẮT BUỘC sử dụng công cụ Google Search.
     - Tổng hợp thông tin từ ít nhất 2-3 nguồn tìm được.
     - KHÔNG được bịa đặt thông tin nếu không tìm thấy.

  2. **Cấu trúc phản hồi:**
     - **Tóm tắt:** Trả lời trực tiếp câu hỏi (1-2 câu).
     - **Chi tiết:** Giải thích sâu hơn, dùng gạch đầu dòng cho dễ đọc.
     - **Nguồn tham khảo:** Liệt kê các link web đã dùng (nếu có dùng Search).
     - **Gợi mở:** Đặt 1 câu hỏi ngược lại để kiểm tra mức độ hiểu bài của học viên.

  3. **Định dạng:** Dùng Markdown và LaTeX ($...$) cho công thức điện học.
  `;

  if (contextText) {
    instruction += `\n\n=== DỮ LIỆU TỪ GIÁO TRÌNH (Sử dụng kết hợp với Google Search) ===\n${contextText}`;
  }
  
  return instruction;
};

// --- EXPORTED FUNCTIONS ---

export const generateChatResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  config?: { temperature?: number; maxOutputTokens?: number; model?: string },
  knowledgeBase: VectorChunk[] = [],
  user?: UserProfile | null
) => {
  try {
    const ai = getAI();
    const settings = getSettings();
    let contextText = "";
    let ragSources: { uri: string; title: string }[] = [];
    
    // RAG Logic
    if (knowledgeBase.length > 0 && message.length > 3) {
      try {
        const relevantChunks = await findRelevantChunks(message, knowledgeBase, settings.ragTopK);
        if (relevantChunks.length > 0) {
          contextText = relevantChunks.map(c => c.text).join("\n\n");
          ragSources = [{ uri: '#', title: 'Giáo trình môn học (Local)' }];
        }
      } catch (e) {
        console.warn("[RAG-ERROR] Skipping RAG lookup.", e);
      }
    }

    // Determine initial model preference - Defaulting to 2.5 Flash
    const targetModel = config?.model || settings.modelName || PRIMARY_MODEL;
    
    // Enable Google Search by default for "2.5" and "3" models
    const tools = [{ googleSearch: {} }];

    const { response, usedModel } = await generateWithFallback(ai, {
      model: targetModel,
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: getSystemInstruction(settings, contextText, user),
        temperature: config?.temperature || settings.temperature,
        tools: tools 
      },
    });

    const searchSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.filter((chunk: any) => chunk.web)
      ?.map((chunk: any) => ({
        uri: chunk.web.uri,
        title: chunk.web.title
      })) || [];

    // Filter out duplicate sources
    const allSources = [...ragSources, ...searchSources].filter((v,i,a)=>a.findIndex(t=>(t.uri === v.uri))===i);

    let finalText = response.text || "AI không thể tạo phản hồi.";
    
    return {
      text: finalText,
      sources: allSources,
      modelUsed: usedModel
    };
  } catch (error: any) {
    console.error("AI Core Error:", error);
    throw error;
  }
};

export const generateQuestionsByAI = async (
  promptText: string,
  count: number,
  difficulty: string
): Promise<Partial<Question>[]> => {
  try {
    const ai = getAI();
    
    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          type: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswer: { type: Type.STRING },
          explanation: { type: Type.STRING },
          category: { type: Type.STRING },
          bloomLevel: { type: Type.STRING }
        },
        required: ["content", "type", "correctAnswer", "explanation", "category", "bloomLevel"],
      },
    };

    // Use Fallback mechanism for Question Generation too
    const { response } = await generateWithFallback(ai, {
      model: PRIMARY_MODEL, 
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.5,
      },
    });
    
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Question Gen Error:", error);
    throw error;
  }
};

export const evaluateOralAnswer = async (
    question: string,
    correctAnswerOrContext: string,
    userAnswer: string
): Promise<{ score: number; feedback: string }> => {
    try {
      const ai = getAI();
      
      const { response } = await generateWithFallback(ai, {
          model: PRIMARY_MODEL,
          contents: `Đánh giá câu trả lời môn học.\nCâu hỏi: ${question}\nĐáp án chuẩn: ${correctAnswerOrContext}\nCâu trả lời sinh viên: ${userAnswer}`,
          config: { 
              responseMimeType: "application/json", 
              temperature: 0.3,
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      score: { type: Type.NUMBER },
                      feedback: { type: Type.STRING }
                  },
                  required: ["score", "feedback"]
              }
          }
      });

      const text = response.text;
      if (!text) return { score: 0, feedback: "AI không thể đánh giá." };
      return JSON.parse(text);
    } catch (error: any) {
      console.error("Evaluation Error:", error);
      throw error;
    }
};
