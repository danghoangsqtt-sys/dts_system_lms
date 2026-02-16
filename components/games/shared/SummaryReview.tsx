
import React from 'react';
import { Question } from '../../../types';
import { formatContent } from '../../../utils/textFormatter';

interface SummaryReviewProps {
  questions: Question[];
  userAnswers: any[];
  onExit: () => void;
}

const SummaryReview: React.FC<SummaryReviewProps> = ({ questions, userAnswers, onExit }) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-6 animate-fade-in pb-20">
      <h3 className="text-2xl font-black text-white text-center mb-8 uppercase tracking-widest">Xem lại kết quả</h3>
      {questions.map((q, idx) => {
        const isCorrect = userAnswers[idx] === q.correctAnswer || (typeof userAnswers[idx] === 'number' && userAnswers[idx] >= 5);
        return (
          <div key={idx} className={`p-6 rounded-[2rem] border transition-all ${isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex justify-between items-center mb-4">
              <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase text-white">Câu {idx + 1}</span>
              {isCorrect ? (
                <span className="text-green-400 font-black text-xs"><i className="fas fa-check-circle mr-1"></i> ĐÚNG</span>
              ) : (
                <span className="text-red-400 font-black text-xs"><i className="fas fa-times-circle mr-1"></i> SAI</span>
              )}
            </div>
            <div className="text-white font-bold text-lg mb-4">
              {formatContent(q.content)}
            </div>
            <div className="space-y-2">
              <div className="text-xs">
                <span className="text-slate-400 uppercase font-black tracking-tighter mr-2">Bạn chọn:</span>
                <span className="text-white font-medium">
                  {typeof userAnswers[idx] === 'number' ? `(Chấm điểm AI: ${userAnswers[idx]}/10)` : userAnswers[idx] || "Bỏ trống"}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-green-400 uppercase font-black tracking-tighter mr-2">Đáp án đúng:</span>
                <span className="text-green-300 font-bold">{q.correctAnswer}</span>
              </div>
            </div>
            {q.explanation && (
              <div className="mt-4 pt-4 border-t border-white/5 text-[11px] text-slate-400 italic">
                <span className="font-black not-italic text-blue-400 uppercase mr-2">Giải thích:</span>
                {q.explanation}
              </div>
            )}
          </div>
        );
      })}
      <button 
        onClick={onExit} 
        className="w-full py-5 bg-white text-slate-900 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:bg-blue-500 hover:text-white transition"
      >
        VỀ TRANG CHỦ
      </button>
    </div>
  );
};

export default SummaryReview;
