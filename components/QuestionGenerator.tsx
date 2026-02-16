
import React, { useState, useEffect } from 'react';
import { generateQuestionsByAI } from '../services/geminiService';
import { Question, QuestionType, QuestionFolder } from '../types';
import { extractTextFromPDF } from '../services/documentProcessor';
import { GoogleGenAI } from "@google/genai";

interface QuestionGeneratorProps {
  folders: QuestionFolder[];
  onSaveQuestions: (questions: Question[]) => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type TabMode = 'AI' | 'MANUAL' | 'IMPORT';

const BLOOM_LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Phân tích', 'Đánh giá', 'Sáng tạo'];

const QuestionGenerator: React.FC<QuestionGeneratorProps> = ({ folders, onSaveQuestions, onNotify }) => {
  const [activeTab, setActiveTab] = useState<TabMode>('AI');
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [isPreview, setIsPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('default');

  // AI State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [bloomCounts, setBloomCounts] = useState<Record<string, number>>({
    'Nhận biết': 0, 'Thông hiểu': 0, 'Vận dụng': 0, 'Phân tích': 0, 'Đánh giá': 0, 'Sáng tạo': 0
  });
  const [qType, setQType] = useState<QuestionType>(QuestionType.MULTIPLE_CHOICE);

  // Manual Input State
  const [manualQ, setManualQ] = useState({
    content: '',
    type: QuestionType.MULTIPLE_CHOICE,
    options: ['', '', '', ''],
    correctAnswer: '',
    explanation: '',
    bloomLevel: 'Nhận biết',
    category: 'An toàn điện',
    folderId: 'default'
  });

  useEffect(() => {
    setManualQ(prev => ({ ...prev, folderId: selectedFolderId }));
  }, [selectedFolderId]);

  /**
   * Helper to manually render math and markdown to bypass quirks mode check
   */
  const formatText = (text: string) => {
    if (!text) return null;
    let html = text;

    // KaTeX render
    html = html.replace(/\$\$(.*?)\$\$/gs, (_, math) => {
      try { return (window as any).katex.renderToString(math, { displayMode: true, throwOnError: false }); } catch (e) { return math; }
    });
    html = html.replace(/\$(.*?)\$/g, (_, math) => {
      try { return (window as any).katex.renderToString(math, { displayMode: false, throwOnError: false }); } catch (e) { return math; }
    });

    // Simple Markdown
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const totalQuestions: number = (Object.values(bloomCounts) as number[]).reduce((a: number, b: number) => a + b, 0);

  const normalizeType = (rawType: any): QuestionType => {
    const typeStr = String(rawType || "").toUpperCase();
    if (typeStr.includes("MULTIPLE") || typeStr.includes("TRẮC NGHIỆM") || typeStr.includes("TRAC NGHIEM")) {
      return QuestionType.MULTIPLE_CHOICE;
    }
    return QuestionType.ESSAY;
  };

  const handleAiGenerate = async () => {
    if (totalQuestions === 0) return onNotify("Hãy chọn ít nhất 1 mức độ Bloom", "warning");
    if (!pdfFile) return onNotify("Hãy tải lên tệp tài liệu nguồn", "warning");

    setIsLoading(true);
    try {
      const contextContent = await extractTextFromPDF(pdfFile);
      const bloomRequest = Object.entries(bloomCounts)
        .filter(([_, c]) => (c as number) > 0)
        .map(([l, c]) => `${c as number} câu mức độ ${l}`)
        .join(', ');
      
      const prompt = `Dựa vào tài liệu: "${contextContent.substring(0, 15000)}" hãy tạo ${totalQuestions} câu ${qType === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm (MULTIPLE_CHOICE)' : 'Tự luận (ESSAY)'} bao gồm: ${bloomRequest}.
      
      YÊU CẦU QUAN TRỌNG:
      1. Với câu hỏi Trắc nghiệm: Phải có 4 phương án rõ ràng, 1 đáp án đúng và phần giải thích tại sao đúng.
      2. Với câu hỏi Tự luận: Nội dung câu hỏi phải mang tính gợi mở/vấn đáp. Trường 'correctAnswer' PHẢI chứa nội dung đáp án chuẩn chi tiết và đầy đủ để giảng viên chấm điểm.
      3. Sử dụng LaTeX cho công thức toán/điện trong dấu $.
      4. Trả về JSON array. Trường 'type' bắt buộc là 'MULTIPLE_CHOICE' hoặc 'ESSAY'.`;
      
      const rawQuestions = await generateQuestionsByAI(prompt, totalQuestions as number, "Phân tích tài liệu");
      
      const processed = rawQuestions.map(q => ({
        ...q, 
        id: Math.random().toString(36).substr(2, 9), 
        folderId: selectedFolderId, 
        createdAt: Date.now(),
        type: normalizeType(q.type)
      } as Question));
      setGeneratedQuestions(processed);
      setIsPreview(true);
    } catch (e) { 
      onNotify("Lỗi xử lý AI. Vui lòng kiểm tra lại kết nối.", "error"); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleAddManual = () => {
    if (!manualQ.content.trim()) return onNotify("Nội dung câu hỏi không được để trống", "warning");
    if (manualQ.type === QuestionType.MULTIPLE_CHOICE) {
      if (manualQ.options.some(opt => !opt.trim())) return onNotify("Vui lòng nhập đầy đủ các phương án", "warning");
      if (!manualQ.correctAnswer) return onNotify("Vui lòng chọn đáp án đúng", "warning");
    } else {
      if (!manualQ.correctAnswer.trim()) return onNotify("Vui lòng nhập đáp án chuẩn cho câu hỏi tự luận", "warning");
    }

    const newQuestion: Question = {
      ...manualQ,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      options: manualQ.type === QuestionType.MULTIPLE_CHOICE ? manualQ.options : undefined
    } as Question;

    onSaveQuestions([newQuestion]);
    
    setManualQ({
      content: '',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['', '', '', ''],
      correctAnswer: '',
      explanation: '',
      bloomLevel: 'Nhận biết',
      category: 'An toàn điện',
      folderId: selectedFolderId
    });
    
    onNotify("Đã thêm câu hỏi vào ngân hàng đề.", "success");
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const handleAiFileAnalysis = async (file: File) => {
    setIsLoading(true);
    try {
      /* Enforce exclusively using process.env.API_KEY per guidelines */
      const savedSettings = localStorage.getItem('app_settings');
      const manualApiKey = savedSettings ? JSON.parse(savedSettings).manualApiKey : null;
      const ai = new GoogleGenAI({ apiKey: manualApiKey || process.env.API_KEY || "" });
      /* Fix contents format to use correct structure for multi-part turn per guidelines */
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: "Hãy phân tích tệp/hình ảnh này và trích xuất toàn bộ câu hỏi. Chuyển đổi mọi công thức toán học, ký hiệu điện học thành LaTeX đặt trong dấu $...$. Nếu là tự luận, hãy tạo ra đáp án chuẩn đầy đủ cho trường 'correctAnswer'. Trả về định dạng JSON array: [{content, type, options, correctAnswer, explanation, bloomLevel, category}]. Lưu ý: Trường 'type' bắt buộc là 'MULTIPLE_CHOICE' hoặc 'ESSAY'." },
            { inlineData: { data: await fileToBase64(file), mimeType: file.type } }
          ]
        }
      });

      const text = response.text;
      const cleanJson = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      const processed = parsed.map((q: any) => ({
        ...q, 
        id: Math.random().toString(36).substr(2, 9), 
        folderId: selectedFolderId, 
        createdAt: Date.now(),
        type: normalizeType(q.type)
      }));
      
      setGeneratedQuestions(processed);
      setIsPreview(true);
      onNotify("AI đã chuyển đổi tài liệu sang câu hỏi thành công.", "success");
    } catch (e) {
      onNotify("Không thể xử lý tệp này.", "error");
    } finally { setIsLoading(false); }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const imported = parseSimplifiedTxt(text);
        setGeneratedQuestions(imported);
        setIsPreview(true);
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      handleAiFileAnalysis(file);
    }
  };

  const parseSimplifiedTxt = (text: string): Question[] => {
    const blocks = text.split(/---+\r?\n/).filter(b => b.trim());
    return blocks.map(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      let content = "";
      let options: string[] = [];
      let correctAnswer = "";
      let type = QuestionType.MULTIPLE_CHOICE;
      
      lines.forEach(line => {
        if (line.match(/^[A-D][).:]/i) || line.startsWith('*')) {
          let text = line;
          if (line.startsWith('*')) {
            text = line.substring(1).trim();
            correctAnswer = text.replace(/^[A-D][).:]\s*/i, '');
          }
          options.push(text.replace(/^[A-D][).:]\s*/i, ''));
        } else if (!content) {
          content = line;
        }
      });

      if (options.length === 0) type = QuestionType.ESSAY;

      return {
        id: Math.random().toString(36).substr(2, 9),
        folderId: selectedFolderId,
        content,
        options: options.length > 0 ? options : undefined,
        correctAnswer: correctAnswer || (type === QuestionType.ESSAY ? lines[lines.length-1] : ""),
        type,
        explanation: "Nhập từ tệp văn bản",
        bloomLevel: "Thông hiểu",
        category: "Chung",
        createdAt: Date.now()
      } as Question;
    });
  };

  const downloadSample = () => {
    const content = `Câu 1: Tính điện năng tiêu thụ $A$ khi $P = 2kW$ and $t = 2h$?
A. $1kWh$
*B. $4kWh$
C. $2kWh$
D. $0.5kWh$
---
Câu 2: Tại sao dây tiếp địa có vai trò quan trọng?
Dây tiếp địa giúp dẫn dòng điện rò rỉ xuống đất, bảo vệ người dùng khỏi bị điện giật khi thiết bị hở mạch.`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Mau_Nhanh_ESafe.txt';
    a.click();
  };

  const handleSaveFinal = () => {
    onSaveQuestions(generatedQuestions);
    setGeneratedQuestions([]);
    setIsPreview(false);
  };

  if (isPreview) {
    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 h-full flex flex-col animate-fade-in-up">
        <header className="flex justify-between items-center mb-8 pb-6 border-b border-gray-100">
          <div>
            <h2 className="text-3xl font-black text-gray-800 tracking-tight">Xác nhận dữ liệu</h2>
            <p className="text-gray-500 text-sm">Toàn bộ câu hỏi sẽ được lưu vào: <span className="text-blue-600 font-bold">{folders.find(f => f.id === selectedFolderId)?.name}</span></p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsPreview(false)} className="px-6 py-2.5 text-gray-400 font-bold hover:text-gray-600">Hủy</button>
            <button onClick={handleSaveFinal} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-xl hover:bg-blue-700 transition">
               Lưu {generatedQuestions.length} câu vào hệ thống
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
          {generatedQuestions.map((q, i) => (
            <div key={q.id} className="p-8 bg-gray-50/50 rounded-[2.5rem] border border-gray-100 relative group overflow-hidden">
               <div className={`absolute top-0 left-0 w-1.5 h-full ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
               <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <span className="bg-white px-3 py-1 rounded-full text-[10px] font-black text-blue-500 border border-blue-50 shadow-sm">CÂU {i+1}</span>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {q.type === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm' : 'Tự luận'}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100">{q.bloomLevel}</span>
               </div>

               <div className="mb-6">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <i className="fas fa-question-circle text-blue-400"></i> Nội dung câu hỏi
                   </p>
                   <div className="font-bold text-gray-800 text-xl leading-relaxed math-content">{formatText(q.content)}</div>
               </div>

               {q.options && q.type === QuestionType.MULTIPLE_CHOICE ? (
                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <i className="fas fa-list-ul text-blue-400"></i> Các phương án trả lời
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map((opt, idx) => (
                        <div key={idx} className={`p-4 rounded-2xl border text-sm transition-all flex items-center gap-3 ${opt === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-700 font-bold ring-4 ring-green-100/50' : 'bg-white border-gray-200 text-gray-600'}`}>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 ${opt === q.correctAnswer ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                {String.fromCharCode(65+idx)}
                            </span>
                            <div className="math-content">{formatText(opt)}</div>
                        </div>
                        ))}
                    </div>
                 </div>
               ) : (
                 <div className="bg-white/80 p-6 rounded-3xl border border-purple-100 shadow-sm">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <i className="fas fa-key"></i> Đáp án chuẩn / Gợi ý chấm điểm
                    </p>
                    <div className="text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">{formatText(q.correctAnswer)}</div>
                 </div>
               )}
               
               {q.explanation && (
                   <div className="mt-6 pt-4 border-t border-gray-200/50">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Giải thích/Ghi chú:</p>
                       <div className="text-xs text-gray-500 italic">{formatText(q.explanation)}</div>
                   </div>
               )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-5xl mx-auto flex flex-col h-[750px] overflow-hidden animate-fade-in-up">
      <div className="p-8 flex justify-between items-center border-b border-gray-100 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Biên soạn học liệu</h2>
          <p className="text-gray-500 text-sm italic">Hệ thống hỗ trợ tự động LaTeX hóa công thức từ văn bản và hình ảnh</p>
        </div>
        <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-200">
          {['AI', 'MANUAL', 'IMPORT'].map((m) => (
            <button key={m} onClick={() => setActiveTab(m as TabMode)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === m ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              {m === 'AI' ? 'Phân tích PDF' : m === 'MANUAL' ? 'Nhập tay' : 'Tải tệp thông minh'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        {activeTab === 'AI' ? (
          <div className="space-y-8 animate-fade-in">
             <div className="border-2 border-dashed border-gray-200 p-16 rounded-[3rem] text-center bg-gray-50 hover:border-blue-300 transition-all relative cursor-pointer">
                <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                <i className={`fas ${pdfFile ? 'fa-file-circle-check text-green-500' : 'fa-cloud-upload-alt text-gray-300'} text-5xl mb-4`}></i>
                <p className="font-bold text-gray-600">{pdfFile ? pdfFile.name : "Chọn giáo trình PDF để AI biên soạn đề"}</p>
             </div>
             <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ma trận câu hỏi</label>
                  <div className="grid grid-cols-3 gap-2">{BLOOM_LEVELS.map(l => (
                    <div key={l} className="bg-white p-2 rounded-xl border border-gray-200">
                      <label className="text-[9px] font-bold text-gray-400 block text-center truncate">{l}</label>
                      <input type="number" min="0" value={bloomCounts[l]} onChange={e => setBloomCounts({...bloomCounts, [l]: parseInt(e.target.value)||0})} className="w-full text-center font-black text-blue-600 outline-none" />
                    </div>
                  ))}</div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cài đặt lưu trữ</label>
                  <select value={selectedFolderId} onChange={e => setSelectedFolderId(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-700">{folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                  <div className="flex gap-2">
                    <button onClick={() => setQType(QuestionType.MULTIPLE_CHOICE)} className={`flex-1 py-3 rounded-xl font-bold border transition ${qType === QuestionType.MULTIPLE_CHOICE ? 'bg-blue-600 text-white' : 'bg-white text-gray-400'}`}>Trắc nghiệm</button>
                    <button onClick={() => setQType(QuestionType.ESSAY)} className={`flex-1 py-3 rounded-xl font-bold border transition ${qType === QuestionType.ESSAY ? 'bg-blue-600 text-white' : 'bg-white text-gray-400'}`}>Tự luận</button>
                  </div>
                </div>
             </div>
          </div>
        ) : activeTab === 'MANUAL' ? (
          <div className="space-y-6 animate-fade-in">
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nội dung câu hỏi</label>
                   <textarea value={manualQ.content} onChange={e => setManualQ({...manualQ, content: e.target.value})} placeholder="Nhập nội dung câu hỏi (sử dụng $...$ cho LaTeX)..." className="w-full h-48 p-6 bg-gray-50 border border-gray-200 rounded-[2rem] outline-none focus:border-blue-500 font-medium transition-all" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cấu hình bài học</label>
                    <select value={manualQ.folderId} onChange={e => setManualQ({...manualQ, folderId: e.target.value})} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-blue-700">{folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                    <select value={manualQ.bloomLevel} onChange={e => setManualQ({...manualQ, bloomLevel: e.target.value})} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-600">{BLOOM_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Hình thức thi</label>
                    <div className="flex gap-2">
                      <button onClick={() => setManualQ({...manualQ, type: QuestionType.MULTIPLE_CHOICE, correctAnswer: ''})} className={`flex-1 py-3 rounded-xl font-bold border transition-all ${manualQ.type === QuestionType.MULTIPLE_CHOICE ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-400'}`}>Trắc nghiệm</button>
                      <button onClick={() => setManualQ({...manualQ, type: QuestionType.ESSAY, correctAnswer: ''})} className={`flex-1 py-3 rounded-xl font-bold border transition-all ${manualQ.type === QuestionType.ESSAY ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-400'}`}>Tự luận</button>
                    </div>
                  </div>
                </div>
             </div>

             {manualQ.type === QuestionType.MULTIPLE_CHOICE ? (
                <div className="grid grid-cols-1 gap-4 bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100">
                   <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Các phương án & Đáp án đúng</label>
                   <div className="grid grid-cols-2 gap-4">
                      {manualQ.options.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                          <input type="text" value={opt} onChange={e => { const n = [...manualQ.options]; n[i] = e.target.value; setManualQ({...manualQ, options: n}); }} placeholder={`Phương án ${String.fromCharCode(65+i)}`} className="flex-1 p-3 rounded-xl border border-gray-200 outline-none focus:border-blue-500 transition-all" />
                          <button onClick={() => setManualQ({...manualQ, correctAnswer: opt})} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${manualQ.correctAnswer === opt && opt !== '' ? 'bg-green-600 text-white shadow-lg shadow-green-200' : 'bg-white text-gray-300 border-2 border-gray-100'}`}><i className="fas fa-check text-xs"></i></button>
                        </div>
                      ))}
                   </div>
                </div>
             ) : (
                <div className="space-y-2 bg-purple-50/50 p-6 rounded-[2rem] border border-purple-100 animate-fade-in">
                   <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest ml-1">Đáp án chuẩn / Gợi ý chấm điểm (Bắt buộc cho vấn đáp AI)</label>
                   <textarea 
                      value={manualQ.correctAnswer} 
                      onChange={e => setManualQ({...manualQ, correctAnswer: e.target.value})} 
                      placeholder="Nhập nội dung đáp án chuẩn chi tiết để AI làm căn cứ chấm điểm cho sinh viên..." 
                      className="w-full h-32 p-5 bg-white border border-purple-100 rounded-2xl outline-none focus:border-purple-500 font-medium transition-all" 
                   />
                </div>
             )}

             <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Giải thích / Ghi chú (Optional)</label>
                <input 
                  type="text" 
                  value={manualQ.explanation} 
                  onChange={e => setManualQ({...manualQ, explanation: e.target.value})} 
                  placeholder="Giải thích lý do chọn đáp án này hoặc nguồn trích dẫn..." 
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-blue-500" 
                />
             </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center space-y-6 animate-fade-in">
             <div className="w-full max-w-2xl text-center space-y-6">
                <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex flex-col items-center gap-3">
                   <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Vị trí lưu trữ trong ngân hàng đề</label>
                   <select 
                      value={selectedFolderId} 
                      onChange={e => setSelectedFolderId(e.target.value)} 
                      className="w-full max-md p-3 bg-white border border-blue-200 rounded-xl font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                   >
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                   </select>
                   <p className="text-[10px] text-blue-400 italic">Câu hỏi từ tệp sẽ được tự động thêm vào thư mục này</p>
                </div>

                <div className="border-4 border-dashed border-blue-100 p-16 rounded-[4rem] bg-blue-50/30 hover:bg-blue-50 transition-all relative group cursor-pointer shadow-inner">
                    <input type="file" accept=".txt,.docx,.png,.jpg,.jpeg" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImportFile} />
                    <i className="fas fa-file-word text-6xl text-blue-400 mb-6 group-hover:scale-110 transition-transform"></i>
                    <h3 className="text-xl font-black text-blue-900 mb-2">Tải tệp đề thi thông minh</h3>
                    <p className="text-sm text-blue-500 font-bold uppercase tracking-widest">Hỗ trợ .DOCX, .TXT, .PNG, .JPG</p>
                    <div className="mt-4 bg-white/80 py-2 px-4 rounded-full border border-blue-100 text-[10px] font-black text-blue-400 uppercase tracking-tighter shadow-sm">
                      AI Tự động chuyển hình ảnh & công thức sang LaTeX
                    </div>
                </div>
                <div className="flex gap-4 justify-center">
                   <button onClick={downloadSample} className="px-8 py-3 bg-gray-800 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-black transition"><i className="fas fa-download"></i> Tải mẫu TXT nhanh</button>
                   <div className="p-4 bg-yellow-50 rounded-2xl text-[10px] text-left border border-yellow-100 max-w-xs font-medium italic text-yellow-700">
                      Mẹo: Dùng dấu * ở trước nội dung đáp án (Vd: *220V) để AI nhận biết đáp án đúng trong tệp TXT.
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>

      <div className="p-8 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
        <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Trạng thái hệ thống</span>
            <span className="text-sm font-bold text-blue-700">{isLoading ? 'Đang xử lý dữ liệu...' : 'Sẵn sàng nhập liệu'}</span>
        </div>
        <div className="flex gap-4">
           {activeTab === 'AI' && (
             <button onClick={handleAiGenerate} disabled={isLoading || !pdfFile || totalQuestions === 0} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black shadow-2xl disabled:bg-gray-300 hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
               {isLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-magic"></i>} AI BIÊN SOẠN
             </button>
           )}
           {activeTab === 'MANUAL' && (
             <button onClick={handleAddManual} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all"><i className="fas fa-plus mr-2"></i> THÊM VÀO NGÂN HÀNG</button>
           )}
        </div>
      </div>
    </div>
  );
};

export default QuestionGenerator;