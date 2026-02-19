
import React from 'react';
import { Question, QuestionType, QuestionFolder } from '../../types';
import { formatContent } from '../../utils/textFormatter';

interface ReviewListProps {
  questions: Question[];
  folders: QuestionFolder[];
  selectedFolderId: string;
  onUpdateQuestion: (index: number, updated: Question) => void;
  onRemoveQuestion: (index: number) => void;
  onApproveAll: () => void;
  onCancel: () => void;
}

const ReviewList: React.FC<ReviewListProps> = ({ 
  questions, 
  folders, 
  selectedFolderId, 
  onUpdateQuestion, 
  onRemoveQuestion, 
  onApproveAll, 
  onCancel 
}) => {

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    const updatedQ = { 
        ...questions[index], 
        imageFile: file, 
        previewUrl: previewUrl 
    };
    onUpdateQuestion(index, updatedQ);
  };

  const handleRemoveImage = (index: number) => {
    const updatedQ = { 
        ...questions[index], 
        imageFile: undefined, 
        previewUrl: undefined,
        image: undefined // Remove existing image if any
    };
    onUpdateQuestion(index, updatedQ);
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 h-full flex flex-col animate-fade-in-up">
      <header className="flex justify-between items-center mb-8 pb-6 border-b border-gray-100">
        <div>
          <h2 className="text-3xl font-black text-gray-800 tracking-tight">Xác nhận dữ liệu</h2>
          <p className="text-gray-500 text-sm italic">Kiểm tra lại nội dung, hình ảnh và thư mục lưu trữ trước khi xác nhận.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-6 py-2.5 text-gray-400 font-bold hover:text-gray-600 transition-all">Hủy bỏ</button>
          <button onClick={onApproveAll} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-xl hover:bg-blue-700 transition-all active:scale-95">
             Lưu {questions.length} câu vào hệ thống
          </button>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
        {questions.map((q, i) => {
          const folderName = folders.find(f => f.id === q.folderId)?.name || "Mặc định";
          const displayImage = q.previewUrl || q.image;
          
          return (
            <div key={q.id} className="p-8 bg-gray-50/50 rounded-[2.5rem] border border-gray-100 relative group overflow-hidden transition-all hover:bg-white hover:shadow-xl">
               <div className={`absolute top-0 left-0 w-1.5 h-full ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
               
               <button 
                 onClick={() => onRemoveQuestion(i)}
                 className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white text-gray-300 hover:text-red-500 hover:shadow-md transition-all flex items-center justify-center border border-gray-100 z-10"
                 title="Xóa câu này khỏi hàng chờ"
               >
                  <i className="fas fa-trash-alt text-xs"></i>
               </button>

               <div className="flex flex-wrap gap-3 items-center mb-6">
                  <span className="bg-white px-3 py-1 rounded-full text-[10px] font-black text-blue-500 border border-blue-50 shadow-sm">CÂU {i+1}</span>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${q.type === QuestionType.MULTIPLE_CHOICE ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {q.type === QuestionType.MULTIPLE_CHOICE ? 'Trắc nghiệm' : 'Tự luận'}
                  </span>
                  <span className="text-[10px] font-black text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100">{q.bloomLevel}</span>
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1.5">
                    <i className="fas fa-folder text-[8px]"></i> {folderName}
                  </span>
               </div>

               <div className="mb-4">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <i className="fas fa-question-circle text-blue-400"></i> Nội dung câu hỏi
                   </p>
                   <textarea 
                      value={q.content}
                      onChange={(e) => onUpdateQuestion(i, { ...q, content: e.target.value })}
                      className="w-full bg-transparent border-none font-bold text-gray-800 text-xl leading-relaxed outline-none focus:ring-0 resize-none p-0 custom-scrollbar"
                      rows={2}
                   />
                   <div className="mt-2 text-xs text-gray-400 italic">
                     Preview: {formatContent(q.content)}
                   </div>
               </div>

               {/* --- IMAGE UPLOAD UI --- */}
               <div className="mb-6">
                   {displayImage ? (
                     <div className="relative inline-block group/img">
                        <img src={displayImage} alt="Minh họa câu hỏi" className="max-h-48 rounded-xl border border-gray-200 object-contain shadow-sm bg-white" />
                        <button 
                            onClick={() => handleRemoveImage(i)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                            title="Xóa ảnh"
                        >
                            <i className="fas fa-times text-[10px]"></i>
                        </button>
                        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[9px] font-black px-2 py-1 rounded backdrop-blur-sm">
                            {q.imageFile ? "Ảnh mới (Chờ lưu)" : "Ảnh hiện có"}
                        </div>
                     </div>
                   ) : (
                     <label className="inline-flex items-center gap-2 bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-200 transition-all border border-slate-200 hover:border-slate-300">
                        <i className="fas fa-image text-lg"></i>
                        <span>Thêm ảnh minh họa</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelect(e, i)} />
                     </label>
                   )}
               </div>

               {q.options && q.type === QuestionType.MULTIPLE_CHOICE ? (
                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <i className="fas fa-list-ul text-blue-400"></i> Các phương án trả lời
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map((opt, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => onUpdateQuestion(i, { ...q, correctAnswer: opt })}
                          className={`p-4 rounded-2xl border text-sm transition-all flex items-center gap-3 cursor-pointer ${opt === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-700 font-bold ring-4 ring-green-100/50' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200'}`}
                        >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 ${opt === q.correctAnswer ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                {String.fromCharCode(65+idx)}
                            </span>
                            <input 
                              value={opt}
                              onChange={(e) => {
                                  const newOpts = [...(q.options || [])];
                                  newOpts[idx] = e.target.value;
                                  onUpdateQuestion(i, { ...q, options: newOpts, correctAnswer: opt === q.correctAnswer ? e.target.value : q.correctAnswer });
                              }}
                              className="bg-transparent border-none w-full p-0 focus:ring-0 font-medium"
                            />
                        </div>
                        ))}
                    </div>
                 </div>
               ) : (
                 <div className="bg-white/80 p-6 rounded-3xl border border-purple-100 shadow-sm">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <i className="fas fa-key"></i> Đáp án chuẩn / Gợi ý chấm điểm
                    </p>
                    <textarea 
                      value={q.correctAnswer}
                      onChange={(e) => onUpdateQuestion(i, { ...q, correctAnswer: e.target.value })}
                      className="w-full bg-transparent border-none text-gray-700 leading-relaxed font-medium focus:ring-0 resize-none p-0 custom-scrollbar"
                      rows={3}
                    />
                    <div className="mt-2 text-xs text-gray-400 italic">
                      Preview: {formatContent(q.correctAnswer)}
                    </div>
                 </div>
               )}
               
               {q.explanation && (
                   <div className="mt-6 pt-4 border-t border-gray-200/50">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Giải thích/Ghi chú:</p>
                       <input 
                          value={q.explanation}
                          onChange={(e) => onUpdateQuestion(i, { ...q, explanation: e.target.value })}
                          className="w-full bg-transparent border-none text-xs text-gray-500 italic focus:ring-0 p-0"
                       />
                   </div>
               )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReviewList;
