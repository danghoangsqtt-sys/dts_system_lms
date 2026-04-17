
/**
 * geminiService.ts — Bluebee Architecture (Client-Side BYOK)
 * 
 * AI calls are made DIRECTLY from the browser to Gemini API.
 * Each user provides their own API Key (BYOK = Bring Your Own Key).
 * Priority: 1. User Custom Key (localStorage) → 2. VITE env var (fallback)
 */

import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Question, QuestionType, VectorChunk, AppSettings, UserProfile } from "../types";
import { findRelevantChunks } from "./documentProcessor";

// --- CONFIGURATION ---
const PRIMARY_MODEL = "gemini-2.5-flash"; 
const FALLBACK_MODEL = "gemini-2.0-flash";
const STORAGE_KEY_API = 'DTS_GEMINI_API_KEY';

// Context safety limits
const MAX_CONTEXT_CHARS = 600000; // ~150K tokens
const MAX_HISTORY_LENGTH = 20;

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
 * Get API Key — Priority: User Custom Key → VITE env var
 */
export const getDynamicApiKey = (): string | undefined => {
  const customKey = localStorage.getItem(STORAGE_KEY_API);
  if (customKey && customKey.trim().length > 0) {
    return customKey;
  }
  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
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
      model: PRIMARY_MODEL,
      contents: "Hi",
    });
    return true;
  } catch (error) {
    console.error("API Key Validation Failed:", error);
    return false;
  }
};

/**
 * SMART WRAPPER with model fallback.
 * Order: PRIMARY_MODEL → FALLBACK_MODEL → throw error
 * Retry up to 4 times per model with exponential backoff.
 */
const generateWithFallback = async (
  ai: GoogleGenAI, 
  params: any, 
  retryCount = 4
): Promise<{ response: GenerateContentResponse, usedModel: string }> => {
  const modelsToTry = [params.model || PRIMARY_MODEL, FALLBACK_MODEL];
  
  for (const modelToUse of modelsToTry) {
    let attempt = 0;
    const currentConfig = params.config ? { ...params.config } : {};

    while (attempt < retryCount) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model: modelToUse,
          config: currentConfig
        });
        
        if (modelToUse !== (params.model || PRIMARY_MODEL)) {
          console.info(`[AI Fallback] Đang dùng model dự phòng: ${modelToUse}`);
        }
        return { response, usedModel: modelToUse };

      } catch (error: any) {
        const msg = error?.toString() || '';
        const status = error?.status || 0;
        const isQuotaError = msg.includes('429') || status === 429 || msg.includes('RESOURCE_EXHAUSTED');
        const isServerOverload = msg.includes('503') || status === 503 || msg.includes('Overloaded');
        const isModelError = msg.includes('model') && (msg.includes('not found') || status === 404);

        if (isModelError || isServerOverload) {
          console.warn(`[AI Fallback] Model ${modelToUse} không khả dụng, thử model dự phòng...`);
          break;
        }

        if (isQuotaError) {
          attempt++;
          if (attempt >= retryCount) break;
          const delay = 500 * Math.pow(2, attempt);
          console.warn(`[AI Retry] ${attempt}/${retryCount} - Chờ ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw error; // Non-retryable
      }
    }
  }
  
  throw new Error("Lỗi kết nối AI. Vui lòng kiểm tra API Key và thử lại sau.");
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
    roleInstruction = `
    VAI TRÒ: Thầy giáo AI (Socratic Tutor) hướng dẫn học viên ${userName}.
    PHONG CÁCH: Thân thiện, khuyến khích tư duy.
    `;
  }

  let instruction = `${roleInstruction}
  
  CẤU TRÚC TRẢ LỜI & SỬ DỤNG CÔNG CỤ (QUAN TRỌNG):
  1. **TRA CỨU GOOGLE (Ưu tiên):** 
     - Sử dụng Google Search nếu cần thông tin thực tế bổ sung.

  2. **Cấu trúc phản hồi:**
     - Trả lời trực tiếp câu hỏi dựa trên nội dung tài liệu cung cấp (nếu có).
     - Định dạng Markdown và LaTeX ($...$) cho công thức.
  `;

  if (contextText) {
    const truncatedContext = contextText.length > MAX_CONTEXT_CHARS 
      ? contextText.substring(0, MAX_CONTEXT_CHARS) + "\n\n[...NỘI DUNG ĐÃ BỊ CẮT DO QUÁ DÀI...]"
      : contextText;

    instruction += `\n\n[QUY TẮC CỨNG]:
1. TUYỆT ĐỐI chỉ dùng thông tin trong tài liệu này để thực hiện yêu cầu. Không bịa đặt.
2. Nếu tài liệu không chứa đủ dữ liệu, hãy trả lời: "Tài liệu không đủ thông tin".

[NỘI DUNG TÀI LIỆU]:\n${truncatedContext}`;
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
    
    // RAG Logic — now using direct embedding (via documentProcessor)
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

    // Trim history to avoid context overflow
    const trimmedHistory = history.slice(-MAX_HISTORY_LENGTH);

    const targetModel = config?.model || settings.modelName || PRIMARY_MODEL;
    const tools = [{ googleSearch: {} }];

    const { response, usedModel } = await generateWithFallback(ai, {
      model: targetModel,
      contents: [
        ...trimmedHistory,
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

    const allSources = [...ragSources, ...searchSources].filter((v,i,a)=>a.findIndex(t=>(t.uri === v.uri))===i);

    return {
      text: response.text || "AI không thể tạo phản hồi.",
      sources: allSources,
      modelUsed: usedModel
    };
  } catch (error: any) {
    console.error("AI Core Error:", error);
    throw new Error(error.message || "Lỗi kết nối AI. Vui lòng kiểm tra API Key.");
  }
};

export const generateQuestionsByAI = async (
  promptText: string,
  count: number,
  difficulty: string,
  contextText?: string
): Promise<Partial<Question>[]> => {
  try {
    const ai = getAI();
    
    let finalPrompt = promptText;
    if (contextText) {
      const truncatedContext = contextText.length > MAX_CONTEXT_CHARS
        ? contextText.substring(0, MAX_CONTEXT_CHARS) + "\n\n[...NỘI DUNG ĐÃ BỊ CẮT DO QUÁ DÀI...]"
        : contextText;

      finalPrompt = `
Bạn là một chuyên gia sư phạm. Tôi cung cấp cho bạn một tài liệu đầy đủ dưới đây.
[QUY TẮC CỨNG]:
1. TUYỆT ĐỐI chỉ dùng thông tin trong tài liệu này để thực hiện yêu cầu. Không bịa đặt.
2. Nếu tài liệu không chứa đủ dữ liệu, hãy trả lời theo JSON rỗng [].

[NỘI DUNG TÀI LIỆU]:
${truncatedContext}

[YÊU CẦU CỦA NGƯỜI DÙNG]:
${promptText}
`;
    }

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

    const { response } = await generateWithFallback(ai, {
      model: PRIMARY_MODEL,
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.4,
      },
    });
    
    const rawText = response.text || "";
    if (!rawText) return [];

    const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const parsed = JSON.parse(cleanedText);
      return Array.isArray(parsed) ? parsed : [];
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      throw new Error("Lỗi cấu trúc dữ liệu AI. Vui lòng thử lại.");
    }
  } catch (error: any) {
    console.error("Question Gen Error:", error);
    throw new Error(error.message || "Lỗi kết nối AI. Vui lòng kiểm tra API Key.");
  }
};

export const evaluateOralAnswer = async (
    question: string,
    correctAnswerOrContext: string,
    userAnswer: string
): Promise<{ score: number; feedback: string }> => {
    try {
      const ai = getAI();
      
      const evaluationPrompt = `Đánh giá câu trả lời môn học.
Câu hỏi: ${question}
Đáp án chuẩn: ${correctAnswerOrContext}
Câu trả lời sinh viên: ${userAnswer}

Hãy cho điểm từ 0-10 và nhận xét ngắn gọn bằng tiếng Việt.`;

      const { response } = await generateWithFallback(ai, {
          model: PRIMARY_MODEL,
          contents: [{ role: 'user', parts: [{ text: evaluationPrompt }] }],
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

      const rawText = response.text || "";
      if (!rawText) return { score: 0, feedback: "AI không thể đánh giá." };

      const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
          return JSON.parse(cleanedText);
      } catch (parseError) {
          console.error("Evaluation Parse Error:", parseError);
          return { score: 0, feedback: "Lỗi cấu trúc dữ liệu AI khi đánh giá." };
      }
    } catch (error: any) {
      console.error("Evaluation Error:", error);
      throw new Error(error.message || "Lỗi kết nối AI khi chấm điểm.");
    }
};

export const generateStudentPerformanceEvaluation = async (
  studentName: string,
  score: number,
  timeSpentStr: string,
  redFlags: number,
  wrongQuestionContents: string[]
): Promise<string> => {
  try {
    const ai = getAI();
    let wrongText = "Không có câu sai.";
    if (wrongQuestionContents.length > 0) {
      wrongText = wrongQuestionContents.map((q, i) => `${i + 1}. ${q}`).join('\n');
    }

    const prompt = `Đánh giá khách quan và ngắn gọn (1 đoạn khoảng 30-50 chữ) về bài kiểm tra của học sinh ${studentName}.
Thông tin bài thi:
- Điểm: ${score}/10
- Thời gian làm bài: ${timeSpentStr}
- Số lần cảnh báo gian lận (Tab switch/Mất kết nối): ${redFlags}
- Các nội dung làm sai chính:
${wrongText}

Hãy viết một nhận xét dành cho giáo viên, đánh giá thái độ (dựa vào redFlags), tốc độ làm bài và kiến thức bị hổng (dựa vào câu sai). Không cần lời chào hỏi, đi thẳng vào đánh giá.`;

    const { response } = await generateWithFallback(ai, {
      model: PRIMARY_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
      }
    });

    return response.text || "AI không thể tạo nhận xét.";
  } catch (error) {
    console.error("Gemini Evaluation Error:", error);
    return "Không thể khởi tạo nhận xét, lỗi kết nối dịch vụ AI.";
  }
};
