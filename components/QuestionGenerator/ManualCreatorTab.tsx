import React, { useState, useEffect } from 'react';
import { Question, QuestionType, QuestionFolder } from '../../types';

interface ManualCreatorTabProps {
  folders: QuestionFolder[]; // Kept for interface compatibility but we use `availableFolders` string array
  availableFolders: string[]; // NEW prop
  onQuestionCreated: (question: Question) => void;
  onQuestionsGenerated: (questions: Question[]) => void;
  onNotify: (message: string, type: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const BLOOM_LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Phân tích', 'Đánh giá', 'Sáng tạo'];

const ManualCreatorTab: React.FC<ManualCreatorTabProps> = ({ 
  availableFolders, 
  onQuestionCreated, 
  onNotify, 
  isLoading, 
  setIsLoading 
}) => {
  const [manualQ, setManualQ] = useState({
    content: '',
    type: QuestionType.MULTIPLE_CHOICE,
    options: ['', '', '', ''],
    correctAnswer: '',
    explanation: '',
    bloomLevel: 'Nhận biết',
    category: 'An toàn điện',
    folder: 'Mặc định', // Changed from folderId to folder string
    image: '' 
  });

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleAttachImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        onNotify("Vui lòng chỉ chọn định dạng hình ảnh (PNG, JPG, JPEG).", "warning");
        return;
    }

    setIsLoading(true);
    try {
        const base64 = await fileToBase64(file);
        setManualQ(prev => ({ ...prev, image: base64 }));
        onNotify("Đã đính kèm ảnh minh họa cho câu hỏi.", "success");
    } catch (err) {
        onNotify("Lỗi khi xử lý hình ảnh.", "error");
    } finally {
        setIsLoading(false);
    }
  };

  const handleRemoveImage = () => {
    setManualQ(prev => ({ ...prev, image: '' }));
  };

  const handleAddManual = () => {
    if (!manualQ.content.trim()) return onNotify("Nội dung câu hỏi không được để trống", "warning");
    if (!manualQ.folder.trim()) return onNotify("Vui lòng nhập tên thư mục lưu trữ", "warning");
    
    let finalCorrectAnswer = manualQ.correctAnswer;

    if (manualQ.type === QuestionType.MULTIPLE_CHOICE) {
      if (manualQ.options.some(opt => !opt.trim())) return onNotify("Vui lòng nhập đầy đủ các phương án", "warning");
      if (selectedIndex === null) return onNotify("Vui lòng chọn đáp án đúng", "warning");
      finalCorrectAnswer = manualQ.options[selectedIndex];
    } else {
      if (!manualQ.correctAnswer.trim()) return onNotify("Vui lòng nhập đáp án chuẩn cho câu hỏi tự luận", "warning");
    }

    const newQuestion: Question = {
      ...manualQ,
      correctAnswer: finalCorrectAnswer,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      options: manualQ.type === QuestionType.MULTIPLE_CHOICE ? manualQ.options : undefined,
      folderId: 'default' // Fallback for legacy
    } as Question;

    onQuestionCreated(newQuestion);
    
    setManualQ({ 
        ...manualQ, 
        content: '', 
        correctAnswer: '', 
        explanation: '', 
        options: ['', '', '', ''],
        image: '' 
    });
    setSelectedIndex(null);
    onNotify("Đã thêm câu hỏi vào ngân hàng đề.", "success");
  };

  return (
    <div className="space-y-8 animate-fade-in">
       {/* Folder Selection Input */}
       <div className="space-y-2">
          <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1">Thư mục / Chủ đề lưu trữ</label>
          <input 
            list="folderOptions"
            value={manualQ.folder} 
            onChange={e => setManualQ({...manualQ, folder: e.target.value})} 
            placeholder="Chọn hoặc nhập tên thư mục mới..."
            className="w-full p-4 bg-[#E8F5E9]/50 border border-[#14452F]/20 chamfer-sm font-bold text-slate-700 focus:bg-white outline-none transition-all"
          />
          <datalist id="folderOptions">
            {availableFolders.map(f => (
              <option key={f} value={f} />
            ))}
          </datalist>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nội dung câu hỏi & Ảnh minh họa</label>
             <div className="relative group">
                <textarea 
                   value={manualQ.content} 
                   onChange={e => setManualQ({...manualQ, content: e.target.value})} 
                   placeholder="Nhập nội dung câu hỏi (sử dụng $...$ cho LaTeX)..." 
                   className="w-full h-72 p-8 bg-gray-50 border border-gray-200 chamfer-lg outline-none focus:border-[#14452F] font-medium transition-all focus:bg-white focus:shadow-xl custom-scrollbar" 
                />
                
                {manualQ.image && (
                    <div className="absolute bottom-24 left-8 right-8 h-32 bg-white/90 backdrop-blur chamfer-md border border-[#14452F]/20 p-2 flex items-center gap-4 shadow-xl group/img animate-fade-in-up">
                        <div className="h-full aspect-square chamfer-sm overflow-hidden border border-gray-100 bg-slate-50 shadow-inner">
                            <img src={manualQ.image} className="w-full h-full object-contain" alt="Preview minh họa" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-black text-[#14452F] uppercase tracking-tight">Ảnh đính kèm</p>
                            <p className="text-[9px] text-gray-400 leading-tight">Ảnh này sẽ hiển thị ngay dưới nội dung câu hỏi.</p>
                        </div>
                        <button 
                            onClick={handleRemoveImage}
                            className="w-8 h-8 chamfer-sm bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center mr-2 shadow-sm"
                        >
                            <i className="fas fa-trash-alt text-[10px]"></i>
                        </button>
                    </div>
                )}

                <label className="absolute bottom-6 right-6 w-14 h-14 bg-white chamfer-sm flex items-center justify-center text-[#14452F] shadow-lg border border-gray-100 cursor-pointer hover:bg-[#14452F] hover:text-white transition-all active:scale-90">
                   {isLoading ? <i className="fas fa-circle-notch fa-spin text-xl"></i> : <i className="fas fa-image text-xl"></i>}
                   <input type="file" accept="image/*" className="hidden" onChange={handleAttachImage} />
                </label>
             </div>
          </div>
          
          <div className="space-y-6">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mức độ Bloom</label>
                   <select 
                      value={manualQ.bloomLevel} 
                      onChange={e => setManualQ({...manualQ, bloomLevel: e.target.value})} 
                      className="w-full p-4 bg-gray-50 border border-gray-200 chamfer-sm font-bold text-slate-700 focus:bg-white outline-none transition-all"
                   >
                      {BLOOM_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Loại câu hỏi</label>
                   <div className="flex gap-1 bg-gray-50 p-1 chamfer-sm border border-gray-200">
                      <button onClick={() => setManualQ({...manualQ, type: QuestionType.MULTIPLE_CHOICE})} className={`flex-1 py-3 chamfer-sm font-black text-[9px] uppercase transition-all ${manualQ.type === QuestionType.MULTIPLE_CHOICE ? 'bg-white text-[#14452F] chamfer-shadow' : 'text-gray-400'}`}>Trắc nghiệm</button>
                      <button onClick={() => setManualQ({...manualQ, type: QuestionType.ESSAY})} className={`flex-1 py-3 chamfer-sm font-black text-[9px] uppercase transition-all ${manualQ.type === QuestionType.ESSAY ? 'bg-white text-[#14452F] chamfer-shadow' : 'text-gray-400'}`}>Tự luận</button>
                   </div>
                </div>
             </div>

             {manualQ.type === QuestionType.MULTIPLE_CHOICE ? (
                <div className="grid grid-cols-1 gap-3 bg-[#E8F5E9]/30 p-6 chamfer-lg border border-[#14452F]/10">
                   <label className="text-[10px] font-black text-[#14452F] uppercase tracking-widest ml-1 mb-1 block">Phương án & Đáp án đúng</label>
                   <div className="grid grid-cols-1 gap-2">
                      {manualQ.options.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                          <input 
                            type="text" 
                            value={opt} 
                            onChange={e => { 
                                const n = [...manualQ.options]; 
                                n[i] = e.target.value; 
                                setManualQ({...manualQ, options: n}); 
                            }} 
                            placeholder={`Phương án ${String.fromCharCode(65+i)}`} 
                            className="flex-1 px-4 py-3 bg-white border border-gray-200 chamfer-sm outline-none focus:border-[#14452F] text-sm font-medium shadow-sm transition-all" 
                          />
                          <button 
                            type="button"
                            onClick={() => setSelectedIndex(i)} 
                            className={`w-12 h-12 chamfer-sm flex items-center justify-center transition-all ${selectedIndex === i ? 'bg-green-600 text-white shadow-lg' : 'bg-white text-gray-300 border border-gray-100 hover:border-green-300'}`}
                          >
                            <i className="fas fa-check text-xs"></i>
                          </button>
                        </div>
                      ))}
                   </div>
                </div>
             ) : (
                <div className="space-y-2 bg-purple-50/30 p-6 chamfer-lg border border-purple-100/50">
                   <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest ml-1 mb-1 block">Đáp án chuẩn / Gợi ý chấm</label>
                   <textarea 
                      value={manualQ.correctAnswer} 
                      onChange={e => setManualQ({...manualQ, correctAnswer: e.target.value})} 
                      placeholder="Nhập nội dung đáp án chuẩn chi tiết để AI làm căn cứ chấm điểm..." 
                      className="w-full h-32 p-5 bg-white border border-purple-100 chamfer-md outline-none focus:border-purple-500 font-medium transition-all shadow-sm" 
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
                  className="w-full p-4 bg-gray-50 border border-gray-100 chamfer-sm outline-none focus:border-[#14452F] text-sm font-medium" 
                />
             </div>

             <button 
               onClick={handleAddManual} 
               disabled={isLoading}
               className="w-full py-5 bg-[#14452F] text-white chamfer-md font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-[#0F3624] transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
             >
                <i className="fas fa-plus-circle"></i> THÊM VÀO GIỎ CÂU HỎI
             </button>
          </div>
       </div>
    </div>
  );
};

export default ManualCreatorTab;