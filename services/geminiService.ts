
/**
 * geminiService.ts — Secure Frontend Client
 * All AI requests are proxied through /api/ai/* serverless functions.
 * NO API keys exist on the client side.
 */

import { Question, QuestionType, VectorChunk, AppSettings, UserProfile } from "../types";
import { findRelevantChunks } from "./documentProcessor";

// --- CONFIGURATION ---
const PRIMARY_MODEL = "gemini-2.5-flash-preview-04-17";

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
 * Helper: Call the serverless AI proxy with error handling and queue info.
 */
const callAIProxy = async (endpoint: string, body: any): Promise<any> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const localKey = localStorage.getItem('DTS_GEMINI_API_KEY');
  if (localKey) headers['X-Gemini-Key'] = localKey;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    const data = await response.json();
    const err = new Error(data.error || 'Hệ thống đang quá tải. Vui lòng thử lại sau.');
    (err as any).status = 429;
    (err as any).retryAfterMs = data.retryAfterMs;
    (err as any).queuePosition = data.queuePosition;
    throw err;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Server error (${response.status})`);
  }

  return response.json();
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
    const settings = getSettings();
    let contextText = "";
    let ragSources: { uri: string; title: string }[] = [];
    
    // RAG Logic — embedding still runs via proxy
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

    const targetModel = config?.model || settings.modelName || PRIMARY_MODEL;
    const tools = [{ googleSearch: {} }];

    const data = await callAIProxy('/api/ai/chat', {
      history,
      message,
      model: targetModel,
      systemInstruction: getSystemInstruction(settings, contextText, user),
      temperature: config?.temperature || settings.temperature,
      tools,
    });

    const allSources = [...ragSources, ...(data.sources || [])].filter(
      (v, i, a) => a.findIndex(t => t.uri === v.uri) === i
    );

    return {
      text: data.text || "AI không thể tạo phản hồi.",
      sources: allSources,
      modelUsed: data.modelUsed,
      remaining: data.remaining, // quota remaining for this window
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
    const data = await callAIProxy('/api/ai/generate', {
      prompt: promptText,
      count,
      difficulty,
    });

    return data.questions || [];
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
      const data = await callAIProxy('/api/ai/evaluate', {
        question,
        correctAnswer: correctAnswerOrContext,
        userAnswer,
      });

      return {
        score: data.score ?? 0,
        feedback: data.feedback || "AI không thể đánh giá.",
      };
    } catch (error: any) {
      console.error("Evaluation Error:", error);
      throw error;
    }
};
