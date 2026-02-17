
import React, { useState, useRef, useEffect } from 'react';
import { generateChatResponse } from '../services/geminiService';
import { ChatMessage, VectorChunk } from '../types';
import LiveChat from './LiveChat';
import { formatContent } from '../utils/textFormatter';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ChatbotProps {
  temperature?: number;
  maxTokens?: number;
  aiVoice?: string;
  knowledgeBase: VectorChunk[];
  onNotify?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ temperature, maxTokens, aiVoice = 'Kore', knowledgeBase, onNotify }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'TEXT' | 'LIVE'>('TEXT');
  const [input, setInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  
  const getInitialMessage = () => {
      if (user?.role === 'teacher') return `Xin chào Giảng viên ${user.fullName}. Tôi có thể hỗ trợ gì cho giáo án hôm nay?`;
      if (user?.role === 'admin') return `Hệ thống sẵn sàng. Xin chào Quản trị viên ${user.fullName}.`;
      return `Chào ${user?.fullName || 'bạn'}. Tôi là trợ lý học tập AI. Bạn cần giải đáp thắc mắc gì về môn học?`;
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeModel, setActiveModel] = useState<string>(''); 
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (user && messages.length === 0) {
          setMessages([{
              id: 'welcome',
              role: 'model',
              text: getInitialMessage(),
              timestamp: Date.now(),
          }]);
      }
  }, [user]);

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
        onNotify?.("Vui lòng nhập API KEY trong phần Cài đặt.", "warning");
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
    setActiveModel('');

    try {
        const history = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

        const response = await generateChatResponse(
            history, 
            userMsg.text, 
            { temperature, maxOutputTokens: maxTokens },
            knowledgeBase,
            user 
        );
        
        if (response.modelUsed) setActiveModel(response.modelUsed);

        const modelMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: response.text || "Lỗi: Không thể tạo phản hồi.",
            timestamp: Date.now(),
            sources: response.sources,
            isRAG: response.sources.some(s => s.title.includes('Giáo trình'))
        };
        
        setMessages((prev) => [...prev, modelMsg]);
    } catch (error: any) {
        setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            text: "Không thể xử lý yêu cầu. Vui lòng kiểm tra kết nối mạng.",
            timestamp: Date.now()
        }]);
    } finally {
        setIsLoading(false);
    }
  };

  // Styles cho hiệu ứng cắt vát (Chamfered)
  const chamferedStyle = {
    clipPath: 'polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)'
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end pointer-events-none font-[Roboto]">
      {isOpen && (
        <div 
            className="bg-white w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-100px)] shadow-2xl flex flex-col pointer-events-auto animate-slide-up mb-4 border border-[#14452F]/20"
            style={{ 
                borderTopLeftRadius: '20px', 
                borderBottomRightRadius: '20px',
                borderTopRightRadius: '0',
                borderBottomLeftRadius: '0' 
            }}
        >
          
          {/* Header - Styled with #14452F and angular cuts */}
          <div className="bg-[#14452F] p-5 flex justify-between items-center shrink-0 rounded-tl-[18px]">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 flex items-center justify-center relative" style={chamferedStyle}>
                    <i className="fas fa-robot text-white text-lg"></i>
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-[#14452F] rounded-full"></div>
                </div>
                <div>
                    <h3 className="text-white font-bold text-sm uppercase tracking-wider">Trợ lý AI ĐTS</h3>
                    <p className="text-[10px] text-white/60 font-medium">Sẵn sàng hỗ trợ học tập</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                  onClick={() => setMode(mode === 'TEXT' ? 'LIVE' : 'TEXT')} 
                  className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border transition-all ${mode === 'LIVE' ? 'bg-red-500 text-white border-red-500' : 'bg-transparent text-white/80 border-white/30 hover:bg-white/10'}`}
                  style={chamferedStyle}
                >
                   {mode === 'TEXT' ? 'Voice Mode' : 'Text Mode'}
                </button>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
                  style={{ clipPath: 'polygon(20% 0, 100% 0, 100% 80%, 80% 100%, 0 100%, 0 20%)' }}
                >
                    <i className="fas fa-times"></i>
                </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden bg-[#F8FAFC] flex flex-col relative rounded-br-[18px]">
            {!hasKey ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 text-slate-400">
                    <div className="w-20 h-20 bg-slate-100 flex items-center justify-center text-4xl text-[#14452F]" style={chamferedStyle}>
                        <i className="fas fa-key"></i>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[#14452F] uppercase tracking-widest mb-2">Yêu cầu cấu hình</h3>
                        <p className="text-xs max-w-[200px] mx-auto">Vui lòng nhập Google Gemini API Key của bạn trong phần cài đặt để kích hoạt trợ lý.</p>
                    </div>
                    <Link 
                        to="/settings" 
                        onClick={() => setIsOpen(false)} 
                        className="px-6 py-3 bg-[#14452F] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#0F3624] transition-all"
                        style={chamferedStyle}
                    >
                        Đi tới Cài đặt
                    </Link>
                </div>
            ) : mode === 'LIVE' ? (
                <div className="h-full">
                    <LiveChat voiceName={aiVoice} onClose={() => setMode('TEXT')} />
                </div>
            ) : (
                <div className="h-full flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div 
                                    className={`max-w-[85%] p-4 text-sm shadow-sm relative ${
                                        msg.role === 'user' 
                                            ? 'bg-[#14452F] text-white' 
                                            : 'bg-white border border-gray-200 text-slate-800'
                                    }`}
                                    style={{
                                        clipPath: msg.role === 'user' 
                                            ? 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                                            : 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
                                    }}
                                >
                                    {msg.role === 'model' && msg.isRAG && (
                                        <div className="text-[9px] font-black text-[#14452F] mb-2 uppercase tracking-widest flex items-center gap-1 border-b border-gray-100 pb-1">
                                            <i className="fas fa-database"></i> Dữ liệu cục bộ
                                        </div>
                                    )}
                                    <div className="leading-relaxed whitespace-pre-wrap">
                                      {formatContent(msg.text)}
                                    </div>
                                    {msg.sources && msg.sources.length > 0 && (
                                        <div className={`mt-3 pt-2 border-t flex flex-wrap gap-2 ${msg.role === 'user' ? 'border-white/20' : 'border-gray-100'}`}>
                                            {msg.sources.map((src, idx) => (
                                                <a 
                                                    key={idx} 
                                                    href={src.uri} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className={`text-[9px] px-2 py-1 uppercase font-bold transition-all hover:underline ${
                                                        msg.role === 'user' 
                                                            ? 'bg-white/10 text-white' 
                                                            : 'bg-[#14452F]/5 text-[#14452F]'
                                                    }`}
                                                >
                                                    Ref: {src.title || "Link"}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[9px] text-slate-400 mt-1.5 uppercase font-bold tracking-wider px-1">
                                    {msg.role === 'user' ? 'Bạn' : 'Trợ lý AI'}
                                </span>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-start">
                                <div className="bg-white p-4 border border-gray-200" style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>
                                    <div className="flex space-x-1.5">
                                        <div className="w-1.5 h-1.5 bg-[#14452F] animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 bg-[#14452F] animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                        <div className="w-1.5 h-1.5 bg-[#14452F] animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 bg-white border-t border-slate-100">
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 transition-colors focus-within:border-[#14452F] focus-within:bg-white focus-within:shadow-sm" style={chamferedStyle}>
                            <input
                              type="text"
                              value={input}
                              onChange={(e) => setInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                              placeholder="Nhập câu hỏi của bạn..."
                              className="flex-1 bg-transparent border-none text-slate-800 text-sm outline-none placeholder:text-slate-400 px-3 font-medium"
                              autoFocus
                            />
                            <button
                              onClick={handleSendMessage}
                              disabled={isLoading || !input.trim()}
                              className="w-10 h-10 bg-[#14452F] text-white flex items-center justify-center hover:bg-[#0F3624] disabled:opacity-50 disabled:bg-slate-300 transition-all"
                              style={{ clipPath: 'polygon(20% 0, 100% 0, 100% 80%, 80% 100%, 0 100%, 0 20%)' }}
                            >
                              <i className="fas fa-paper-plane text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Toggle Button - Chamfered & Green */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 flex items-center justify-center text-2xl transition-all pointer-events-auto shadow-[0_10px_30px_rgba(20,69,47,0.3)] hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(20,69,47,0.4)] ${
          isOpen ? 'bg-slate-800 text-white' : 'bg-[#14452F] text-white'
        }`}
        style={{ clipPath: 'polygon(20% 0, 100% 0, 100% 80%, 80% 100%, 0 100%, 0 20%)' }}
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-comment-dots'}`}></i>
      </button>
    </div>
  );
};

export default Chatbot;
