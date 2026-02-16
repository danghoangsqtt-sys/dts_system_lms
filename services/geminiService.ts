
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Question, QuestionType, VectorChunk, AppSettings } from "../types";
import { findRelevantChunks } from "./documentProcessor";

// --- CONSTANTS ---
const PRIMARY_MODEL = "gemini-3-flash-preview"; // Thông minh nhất, hỗ trợ Search
const FALLBACK_MODEL = "gemini-1.5-flash";      // "Quốc dân": Ổn định, 15 RPM, Free

const DEFAULT_SETTINGS: AppSettings = {
  modelName: PRIMARY_MODEL, 
  aiVoice: "Zephyr",
  temperature: 0.7,
  maxOutputTokens: 2048,
  autoSave: true,
  ragTopK: 5, 
  thinkingBudget: 0, 
  systemExpertise: 'ACADEMIC',
  manualApiKey: ''
};

const getSettings = (): AppSettings => {
  const saved = localStorage.getItem('app_settings');
  return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
};

const getAI = () => {
  const userKey = localStorage.getItem('USER_GEMINI_KEY');
  const apiKey = userKey || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("Vui lòng nhập API Key trong phần Cài đặt để sử dụng AI.");
  }
  
  return new GoogleGenAI({ apiKey });
};

/**
 * WRAPPER THÔNG MINH:
 * 1. Gọi model chính.
 * 2. Nếu lỗi Quota (429) hoặc Server (503) -> Chuyển sang Fallback Model.
 * 3. Khi Fallback: TỰ ĐỘNG TẮT TOOL (Search/Thinking) để đảm bảo thành công.
 */
const generateContentWithFallback = async (
  ai: GoogleGenAI, 
  params: any,
  defaultModel: string
): Promise<{ response: GenerateContentResponse, usedModel: string }> => {
  try {
    // [STEP 1] Thử gọi với Model chính
    console.log(`[AI-CORE] Primary Attempt: ${defaultModel}`);
    const response = await ai.models.generateContent({
      ...params,
      model: defaultModel
    });
    return { response, usedModel: defaultModel };

  } catch (error: any) {
    const errorMsg = error.toString();
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED');
    const isServerError = errorMsg.includes('503') || errorMsg.includes('500') || errorMsg.includes('Overloaded');

    // [STEP 2] Nếu lỗi do quá tải -> Kích hoạt Fallback
    if ((isQuotaError || isServerError) && defaultModel !== FALLBACK_MODEL) {
      console.warn(`[AI-WARNING] ${defaultModel} overloaded (${isQuotaError ? '429' : '503'}). Switching to Fallback: ${FALLBACK_MODEL}`);
      
      try {
        // [STEP 3] Chuẩn bị Config cho Fallback (Tối ưu hóa khả năng thành công)
        const fallbackParams = { ...params };
        
        // TẮT TOOLS: Google Search tốn quota và latency, tắt đi ở chế độ dự phòng
        if (fallbackParams.config) {
            fallbackParams.config.tools = undefined; 
            // TẮT THINKING: 1.5 Flash không hỗ trợ thinking
            if (fallbackParams.config.thinkingConfig) {
                delete fallbackParams.config.thinkingConfig;
            }
        }

        const fallbackResponse = await ai.models.generateContent({
          ...fallbackParams,
          model: FALLBACK_MODEL
        });
        return { response: fallbackResponse, usedModel: FALLBACK_MODEL };
      } catch (fallbackError: any) {
        console.error(`[AI-ERROR] Fallback cũng thất bại:`, fallbackError);
        throw fallbackError; // Ném lỗi gốc nếu cả 2 đều chết
      }
    }

    throw error; // Ném lỗi nếu không phải do quota (ví dụ: Key sai, Prompt bị chặn)
  }
};

const getSystemInstruction = (settings: AppSettings, contextText: string) => {
  let instruction = `Bạn là Chuyên gia Cao cấp kiêm Giảng viên môn "Nguồn điện An toàn và Môi trường". 
NHIỆM VỤ: Giải đáp thắc mắc về kỹ thuật điện, tiêu chuẩn an toàn (IEC 60364, TCVN), các loại nguồn điện (PV, Wind, Battery), và tác động môi trường của ngành năng lượng.
PHONG CÁCH: Chuyên nghiệp, chính xác, sử dụng thuật ngữ kỹ thuật chuẩn xác.
ĐỊNH DẠNG: Sử dụng Markdown. Sử dụng LaTeX ($...$) cho công thức.`;

  if (contextText) {
    instruction += `\n\nSử dụng thêm tri thức từ giáo trình này để trả lời:\n${contextText}`;
  }
  return instruction;
};

// --- EXPORTED FUNCTIONS ---

export const generateChatResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  config?: { temperature?: number; maxOutputTokens?: number; model?: string },
  knowledgeBase: VectorChunk[] = []
) => {
  try {
    const ai = getAI();
    const settings = getSettings();
    let contextText = "";
    let ragSources: { uri: string; title: string }[] = [];
    
    // Xử lý RAG
    if (knowledgeBase.length > 0 && message.length > 3) {
      try {
        const topK = settings.ragTopK;
        const relevantChunks = await findRelevantChunks(message, knowledgeBase, topK);
        if (relevantChunks.length > 0) {
          contextText = relevantChunks.map(c => c.text).join("\n\n");
          ragSources = [{ uri: '#', title: 'Tri thức nội bộ hệ thống' }];
        }
      } catch (e) {
        console.warn("[RAG-ERROR] Skipping RAG.");
      }
    }

    const requestedModel = config?.model || settings.modelName || PRIMARY_MODEL;
    const systemInstruction = getSystemInstruction(settings, contextText);

    // Gọi API qua wrapper Fallback
    const { response, usedModel } = await generateContentWithFallback(ai, {
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction,
        temperature: config?.temperature || settings.temperature,
        // Chỉ bật Google Search khi dùng Model chính, nếu Fallback sẽ tự động bị tắt bởi wrapper
        tools: [{ googleSearch: {} }] 
      },
    }, requestedModel);

    // Xử lý nguồn search (chỉ có nếu model chính chạy thành công)
    const searchSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.filter((chunk: any) => chunk.web)
      ?.map((chunk: any) => ({
        uri: chunk.web.uri,
        title: chunk.web.title
      })) || [];

    return {
      text: response.text || "AI không thể tạo phản hồi.",
      sources: [...ragSources, ...searchSources],
      modelUsed: usedModel // Trả về model thực tế đã dùng để UI hiển thị (VD: Hiện badge 'Fallback Mode')
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
    const settings = getSettings();
    
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

    const { response } = await generateContentWithFallback(ai, {
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.8,
      },
    }, settings.modelName || PRIMARY_MODEL);
    
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error: any) {
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
      const settings = getSettings();
      
      const { response } = await generateContentWithFallback(ai, {
          contents: `Đánh giá câu trả lời môn học Nguồn điện an toàn và môi trường.\nCâu hỏi: ${question}\nĐáp án chuẩn: ${correctAnswerOrContext}\nCâu trả lời sinh viên: ${userAnswer}`,
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
      }, settings.modelName || PRIMARY_MODEL);

      const text = response.text;
      if (!text) return { score: 0, feedback: "AI không thể đánh giá." };
      return JSON.parse(text);
    } catch (error: any) {
      throw error;
    }
};
