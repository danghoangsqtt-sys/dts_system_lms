
import React, { useState, useRef, useEffect } from 'react';
import { generateChatResponse } from '../services/geminiService';
import { ChatMessage, VectorChunk } from '../types';
import LiveChat from './LiveChat';
import { formatContent } from '../utils/textFormatter';
import { Link } from 'react-router-dom';

interface ChatbotProps {
  temperature?: number;
  maxTokens?: number;
  aiVoice?: string;
  knowledgeBase: VectorChunk[];
  onNotify?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ temperature, maxTokens, aiVoice = 'Kore', knowledgeBase, onNotify }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'TEXT' | 'LIVE'>('TEXT');
  const [input, setInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Xin chào! Tôi là Trợ lý AI được huấn luyện bởi **DHsystem**. Tôi đã sẵn sàng hỗ trợ bạn học tập môn **Nguồn điện an toàn và môi trường**. Bạn cần tôi giải đáp nội dung gì?',
      timestamp: Date.now(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = localStorage.getItem('USER_GEMINI_KEY');
    setHasKey(!!key);
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, mode]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    if (!hasKey) {
        onNotify?.("Vui lòng cấu hình API Key trong cài đặt để sử dụng AI.", "warning");
        return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
        const history = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

        const response = await generateChatResponse(
            history, 
            userMsg.text, 
            { temperature, maxOutputTokens: maxTokens },
            knowledgeBase 
        );
        
        const modelMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: response.text || "Xin lỗi, DHsystem AI hiện chưa tìm thấy thông tin phù hợp.",
            timestamp: Date.now(),
            sources: response.sources,
            isRAG: response.sources.some(s => s.title.includes('Giáo trình'))
        };
        
        setMessages((prev) => [...prev, modelMsg]);
    } catch (error: any) {
        let errorText = 'DHsystem AI phát hiện lỗi kết nối. Hãy kiểm tra API Key trong phần Cài đặt.';
        
        if (error.toString().includes('429') || error.toString().includes('RESOURCE_EXHAUSTED')) {
          errorText = '⚠️ **Hết lượt sử dụng (Quota Exceeded)**: Bạn đã vượt quá giới hạn lượt hỏi miễn phí trong phút/ngày của Google Gemini API. Vui lòng thử lại sau ít phút hoặc sử dụng API Key khác.';
        }

        setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            text: errorText,
            timestamp: Date.now()
        }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end pointer-events-none">
      {isOpen && (
        <div className="bg-white w-[380px] sm:w-[450px] max-w-[calc(100vw-3rem)] h-[680px] max-h-[calc(100vh-120px)] rounded-[2.5rem] shadow-[0_30px_90px_-15px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-slate-100 mb-6 animate-fade-in-up pointer-events-auto ring-1 ring-slate-900/5">
          
          <div className="bg-[#0f172a] p-5 flex justify-between items-center shrink-0 border-b border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <i className="fas fa-robot text-xl"></i>
                </div>
                <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-black text-[14px] leading-none tracking-tight">DHsystem AI</h4>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                    </div>
                    <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-widest mt-1.5 block">Personal Tutor</span>
                </div>
            </div>
            <div className="flex gap-2 relative z-10">
                <button 
                  onClick={() => setMode(mode === 'TEXT' ? 'LIVE' : 'TEXT')} 
                  className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${mode === 'LIVE' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                >
                   <i className={`fas ${mode === 'TEXT' ? 'fa-microphone' : 'fa-comment-dots'}`}></i>
                </button>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="w-10 h-10 rounded-xl bg-white/5 text-slate-400 hover:text-white transition flex items-center justify-center"
                >
                    <i className="fas fa-times text-sm"></i>
                </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden bg-slate-50 flex flex-col relative">
            {!hasKey ? (
                <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-6">
                    <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl shadow-inner">
                        <i className="fas fa-key"></i>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Kích hoạt Trí tuệ AI</h3>
                        <p className="text-slate-500 text-xs font-medium leading-relaxed mt-2">Học viên cần sử dụng Gemini API Key cá nhân để trò chuyện trực tiếp với Trợ lý học tập.</p>
                    </div>
                    <Link to="/settings" onClick={() => setIsOpen(false)} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-500 transition-all">
                        Cấu hình API Key ngay
                    </Link>
                </div>
            ) : mode === 'LIVE' ? (
                <div className="h-full">
                    <LiveChat voiceName={aiVoice} onClose={() => setMode('TEXT')} />
                </div>
            ) : (
                <div className="h-full flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                <div className={`max-w-[90%] p-4 rounded-[1.8rem] text-[13.5px] shadow-sm relative ${
                                  msg.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                    : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none ring-1 ring-slate-200/50'
                                }`}>
                                    {msg.role === 'model' && msg.isRAG && (
                                        <div className="flex items-center gap-1.5 mb-2.5 text-[9px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 w-fit uppercase tracking-tighter">
                                            <i className="fas fa-brain-circuit"></i> NGUỒN TRI THỨC GIÁO TRÌNH
                                        </div>
                                    )}
                                    <div className="leading-relaxed font-medium">
                                      {formatContent(msg.text)}
                                    </div>
                                    {msg.sources && msg.sources.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                                            {msg.sources.map((src, idx) => (
                                                <a 
                                                  key={idx} 
                                                  href={src.uri} 
                                                  target="_blank" 
                                                  rel="noreferrer" 
                                                  className="text-[9px] font-bold bg-slate-50 text-blue-600 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-blue-50 transition-all flex items-center gap-2"
                                                >
                                                    <i className="fas fa-link text-[8px]"></i> {src.title || "Tham khảo"}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-100 p-4 rounded-3xl rounded-tl-none flex items-center gap-1.5 shadow-sm">
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                        <div className="flex items-center gap-3 p-1.5 bg-slate-50 border border-slate-200 rounded-[2.2rem] focus-within:ring-4 focus-within:ring-blue-500/5 transition-all">
                            <input
                              type="text"
                              value={input}
                              onChange={(e) => setInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                              placeholder="Nhập câu hỏi chuyên môn..."
                              className="flex-1 bg-transparent px-4 py-2 text-[14px] outline-none font-medium text-slate-700"
                            />
                            <button
                              onClick={handleSendMessage}
                              disabled={isLoading || !input.trim()}
                              className="bg-blue-600 text-white w-11 h-11 rounded-full flex items-center justify-center hover:bg-blue-700 transition shadow-lg disabled:bg-slate-300 shrink-0"
                            >
                              <i className="fas fa-paper-plane text-[14px]"></i>
                            </button>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-[2rem] shadow-2xl flex items-center justify-center text-2xl transition-all transform hover:scale-105 active:scale-95 border-4 border-white relative group overflow-hidden pointer-events-auto ${
          isOpen ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white'
        }`}
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-robot'} transition-all duration-300`}></i>
      </button>
    </div>
  );
};

export default Chatbot;
