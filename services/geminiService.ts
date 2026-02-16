
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, VectorChunk, AppSettings } from "../types";
import { findRelevantChunks } from "./documentProcessor";

const DEFAULT_SETTINGS: AppSettings = {
  modelName: "gemini-3-flash-preview", 
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

/**
 * Lấy GoogleGenAI instance sử dụng API Key.
 * Ưu tiên USER_GEMINI_KEY từ localStorage theo yêu cầu người dùng, sau đó là manualApiKey, cuối cùng là process.env.API_KEY.
 */
const getAI = () => {
  const settings = getSettings();
  const userKey = localStorage.getItem('USER_GEMINI_KEY');
  const apiKey = userKey || settings.manualApiKey || process.env.API_KEY;
  
  if (!apiKey) {
    console.error("[DHSYSTEM-AI] Missing API Key.");
    throw new Error("Vui lòng nhập API Key trong phần Cài đặt để sử dụng tính năng này.");
  }
  
  return new GoogleGenAI({ apiKey });
};

const getSystemInstruction = (settings: AppSettings, contextText: string) => {
  let instruction = `Bạn là Chuyên gia Cao cấp kiêm Giảng viên môn "Nguồn điện An toàn và Môi trường". 
NHIỆM VỤ: Giải đáp thắc mắc về kỹ thuật điện, tiêu chuẩn an toàn (IEC 60364, TCVN), các loại nguồn điện (PV, Wind, Battery), và tác động môi trường của ngành năng lượng.
PHONG CÁCH: Chuyên nghiệp, chính xác, sử dụng thuật ngữ kỹ thuật chuẩn xác.
ĐỊNH DẠNG: Sử dụng Markdown. Sử dụng LaTeX ($...$) cho công thức.
KIẾN THỨC CẬP NHẬT: Sử dụng công cụ Google Search để tìm các quy định mới nhất.`;

  if (contextText) {
    instruction += `\n\nSử dụng thêm tri thức từ giáo trình này để trả lời:\n${contextText}`;
  }
  return instruction;
};

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

    const modelName = config?.model || settings.modelName; 
    const systemInstruction = getSystemInstruction(settings, contextText);

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction,
        temperature: config?.temperature || settings.temperature,
        tools: [{ googleSearch: {} }]
      },
    });

    const searchSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.filter((chunk: any) => chunk.web)
      ?.map((chunk: any) => ({
        uri: chunk.web.uri,
        title: chunk.web.title
      })) || [];

    return {
      text: response.text || "AI không thể tạo phản hồi.",
      sources: [...ragSources, ...searchSources]
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

    const response = await ai.models.generateContent({
      model: settings.modelName,
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.8,
      },
    });
    
    return JSON.parse(response.text || "[]");
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
      const response = await ai.models.generateContent({
          model: settings.modelName,
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
      });
      return JSON.parse(response.text || "{}");
    } catch (error: any) {
      throw error;
    }
};
