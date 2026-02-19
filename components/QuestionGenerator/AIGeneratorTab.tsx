import React, { useState } from 'react';
import { extractTextFromPDF } from '../../services/documentProcessor';
import { generateQuestionsByAI } from '../../services/geminiService';
import { Question, QuestionType, QuestionFolder } from '../../types';

interface AIGeneratorTabProps {
  folders: QuestionFolder[];
  availableFolders: string[]; // NEW prop
  onQuestionsGenerated: (questions: Question[]) => void;
  onNotify: (message: string, type: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const BLOOM_LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Phân tích', 'Đánh giá', 'Sáng tạo'];

const AIGeneratorTab: React.FC<AIGeneratorTabProps> = ({ 
  availableFolders, 
  onQuestionsGenerated, 
  onNotify, 
  isLoading, 
  setIsLoading 
}) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [bloomCounts, setBloomCounts] = useState<Record<string, number>>({
    'Nhận biết': 0, 'Thông hiểu': 0, 'Vận dụng': 0, 'Phân tích': 0, 'Đánh giá': 0, 'Sáng tạo': 0
  });
  const [qType, setQType] = useState<QuestionType>(QuestionType.MULTIPLE_CHOICE);
  const [targetFolder, setTargetFolder] = useState<string>('Mặc định');

  const totalQuestions = Object.values(bloomCounts).reduce((a, b) => a + b, 0);

  const normalizeType = (rawType: any): QuestionType => {
    const typeStr = String(rawType || "").toUpperCase();
    if (typeStr.includes("MULTIPLE") || typeStr.includes("TRẮC NGHIỆM") || typeStr.includes("TRAC NGHIEM")) {
      return QuestionType.MULTIPLE_CHOICE;
    }
    return QuestionType.ESSAY;
  };

  const handleGenerate = async () => {
    if (totalQuestions === 0) return onNotify("Hãy chọn ít nhất 1 mức độ Bloom", "warning");
    if (!pdfFile) return onNotify("Hãy tải lên tệp tài liệu nguồn", "warning");
    if (!targetFolder.trim()) return onNotify("Vui lòng nhập tên thư mục lưu trữ", "warning");

    setIsLoading(true);
    try {
      const contextContent = await extractTextFromPDF(pdfFile);
      const bloomRequest = Object.entries(bloomCounts)
        .filter(([_, c]) => c > 0)
        .map(([l, c]) => `${c} câu mức độ ${l}`)
        .join(', ');
      
      const prompt = `Dựa vào tài liệu: "${contextContent.substring(0, 15000)}" hãy tạo ${totalQuestions} câu ${qType === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm (MULTIPLE_CHOICE)' : 'Tự luận (ESSAY)'} bao gồm: ${bloomRequest}.
      
      YÊU CẦU QUAN TRỌNG:
      1. Với câu hỏi Trắc nghiệm: Phải có 4 phương án rõ ràng, 1 đáp án đúng và phần giải thích tại sao đúng.
      2. Với câu hỏi Tự luận: Nội dung câu hỏi phải mang tính gợi mở/vấn đáp. Trường 'correctAnswer' PHẢI chứa nội dung đáp án chuẩn chi tiết và đầy đủ để giảng viên chấm điểm.
      3. Sử dụng LaTeX cho công thức toán/điện trong dấu $.
      4. Trả về JSON array. Trường 'type' bắt buộc là 'MULTIPLE_CHOICE' hoặc 'ESSAY'.`;
      
      const rawQuestions = await generateQuestionsByAI(prompt, totalQuestions, "Phân tích tài liệu");
      
      const processed = rawQuestions.map(q => ({
        ...q, 
        id: Math.random().toString(36).substr(2, 9), 
        folderId: 'default',
        folder: targetFolder, // Assign selected folder
        createdAt: Date.now(),
        type: normalizeType(q.type)
      } as Question));
      
      onQuestionsGenerated(processed);
      onNotify("AI đã biên soạn đề thi thành công!", "success");
    } catch (e) { 
      onNotify("Lỗi xử lý AI. Vui lòng kiểm tra lại kết nối.", "error"); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
       <div className="border-2 border-dashed border-slate-200 p-16 chamfer-lg text-center bg-slate-50 hover:border-[#14452F]/50 hover:bg-[#E8F5E9]/50 transition-all relative cursor-pointer group">
          <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
          <i className={`fas ${pdfFile ? 'fa-file-circle-check text-green-600' : 'fa-cloud-upload-alt text-slate-300'} text-5xl mb-4 group-hover:scale-110 transition-transform`}></i>
          <p className="font-bold text-slate-600">{pdfFile ? pdfFile.name : "Kéo thả hoặc chọn giáo trình PDF để AI biên soạn đề"}</p>
          <p className="text-[10px] text-slate-400 mt-2 font-black uppercase tracking-widest">Hỗ trợ tối đa 15,000 ký tự tri thức</p>
       </div>

        {/* Folder Selection */}
       <div className="mt-4 mb-4">
          <label className="block text-xs font-bold text-[#14452F] uppercase mb-2">
              <i className="fas fa-folder-open mr-2"></i> Thư mục lưu trữ
          </label>
          <input 
            type="text"
            list="ai-folder-options"
            value={targetFolder} 
            onChange={e => setTargetFolder(e.target.value)} 
            placeholder="Chọn hoặc tự gõ tên thư mục mới..."
            className="w-full bg-white border-2 border-slate-200 text-slate-700 px-4 py-3 chamfer-sm font-medium focus:border-[#14452F] focus:ring-0 outline-none transition-all"
          />
          {/* ĐẢM BẢO id của datalist phải khớp chính xác với thuộc tính list của input ở trên */}
          <datalist id="ai-folder-options">
            {availableFolders && availableFolders.map((folderName, idx) => (
              <option key={`ai-folder-${idx}`} value={folderName} />
            ))}
          </datalist>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-th-large text-[#14452F]"></i> Ma trận câu hỏi theo Bloom
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BLOOM_LEVELS.map(l => (
                <div key={l} className="bg-white p-3 chamfer-sm border border-slate-100 shadow-sm focus-within:border-[#14452F] transition-colors">
                  <label className="text-[9px] font-black text-slate-400 block text-center truncate mb-1 uppercase">{l}</label>
                  <input 
                    type="number" min="0" 
                    value={bloomCounts[l]} 
                    onChange={e => setBloomCounts({...bloomCounts, [l]: parseInt(e.target.value)||0})} 
                    className="w-full text-center font-black text-[#14452F] outline-none bg-transparent" 
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-cog text-[#14452F]"></i> Cấu hình loại đề
              </label>
              <div className="flex gap-2 bg-slate-50 p-1.5 chamfer-sm border border-slate-100">
                <button 
                  onClick={() => setQType(QuestionType.MULTIPLE_CHOICE)} 
                  className={`flex-1 py-3 chamfer-sm font-black text-[11px] uppercase tracking-widest transition-all ${qType === QuestionType.MULTIPLE_CHOICE ? 'bg-white text-[#14452F] chamfer-shadow' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Trắc nghiệm
                </button>
                <button 
                  onClick={() => setQType(QuestionType.ESSAY)} 
                  className={`flex-1 py-3 chamfer-sm font-black text-[11px] uppercase tracking-widest transition-all ${qType === QuestionType.ESSAY ? 'bg-white text-[#14452F] chamfer-shadow' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Tự luận
                </button>
              </div>
            </div>
            <button 
              onClick={handleGenerate} 
              disabled={isLoading || !pdfFile || totalQuestions === 0} 
              className="w-full bg-[#14452F] text-white px-12 py-5 chamfer-md font-black chamfer-shadow disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 text-xs uppercase tracking-widest"
            >
              {isLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
              {isLoading ? "ĐANG PHÂN TÍCH TÀI LIỆU..." : "AI BIÊN SOẠN NGAY"}
            </button>
          </div>
       </div>
    </div>
  );
};

export default AIGeneratorTab;