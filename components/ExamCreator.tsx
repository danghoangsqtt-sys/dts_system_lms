
import React, { useState, useMemo } from 'react';
import { Question, QuestionType, Exam } from '../types';
import { formatContent } from '../utils/textFormatter';

interface ExamConfig {
  organizationName: string; // Tên cơ quan/Bộ chủ quản
  schoolName: string;       // Tên trường/Đơn vị
  school: string;
  department: string;
  subject: string;          // Tên Môn học
  moduleTerm: string;       // Tên Học phần / Chuyên đề
  examName: string;
  examCode: string;
  time: string;
  semester: string;
  year: string;
  organizer: string;
}

interface ExamCreatorProps {
  questions: Question[]; // Toàn bộ ngân hàng câu hỏi
  viewExam?: Exam; // Nếu truyền vào, component sẽ ở chế độ xem lại đề đã lưu
  onBack: () => void;
  onSaveExam?: (exam: Exam) => void;
}

const BLOOM_LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Phân tích', 'Đánh giá', 'Sáng tạo'];

const ExamCreator: React.FC<ExamCreatorProps> = ({ questions, viewExam, onBack, onSaveExam }) => {
  const [step, setStep] = useState<'MATRIX' | 'PREVIEW'>(viewExam ? 'PREVIEW' : 'MATRIX');
  const [matrixCounts, setMatrixCounts] = useState<Record<string, number>>({
    'Nhận biết': 0, 'Thông hiểu': 0, 'Vận dụng': 0, 'Phân tích': 0, 'Đánh giá': 0, 'Sáng tạo': 0
  });

  const [examConfig, setExamConfig] = useState<ExamConfig>(viewExam?.config || {
    organizationName: 'BỘ GIÁO DỤC VÀ ĐÀO TẠO',
    schoolName: 'TRƯỜNG ĐẠI HỌC ...',
    school: 'TÊN CƠ SỞ ĐÀO TẠO',
    department: 'KHOA / TỔ BỘ MÔN',
    subject: 'NGUỒN ĐIỆN AN TOÀN VÀ MÔI TRƯỜNG',
    moduleTerm: 'Lý thuyết cơ sở',
    examName: 'BÀI KIỂM TRA ĐỊNH KỲ',
    examCode: Math.floor(100 + Math.random() * 900).toString(),
    time: '60',
    semester: 'Học kỳ II',
    year: '2025 - 2026',
    organizer: 'BỘ GIÁO DỤC VÀ ĐÀO TẠO'
  });

  const [currentQuestionIds, setCurrentQuestionIds] = useState<string[]>(viewExam?.questionIds || []);

  // Các câu hỏi thực tế đang được chọn cho đề thi
  const selectedQuestions = useMemo(() => {
    return currentQuestionIds.map(id => questions.find(q => q.id === id)).filter(Boolean) as Question[];
  }, [currentQuestionIds, questions]);

  // Thuật toán Trộn
  const shuffle = <T,>(array: T[]): T[] => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const handleGenerateExam = () => {
    const newSelectedIds: string[] = [];
    const errors: string[] = [];

    BLOOM_LEVELS.forEach(level => {
      const countRequested = matrixCounts[level];
      if (countRequested <= 0) return;

      const availableInLevel = questions.filter(q => q.bloomLevel === level);
      if (availableInLevel.length < countRequested) {
        errors.push(`Mức độ "${level}" chỉ có ${availableInLevel.length} câu trong kho (yêu cầu ${countRequested})`);
      } else {
        const shuffled = shuffle(availableInLevel);
        newSelectedIds.push(...shuffled.slice(0, countRequested).map(q => q.id));
      }
    });

    if (errors.length > 0) {
      alert("Không đủ câu hỏi trong kho:\n" + errors.join("\n"));
      return;
    }

    if (newSelectedIds.length === 0) {
      alert("Vui lòng nhập số lượng câu hỏi vào ma trận.");
      return;
    }

    setCurrentQuestionIds(shuffle(newSelectedIds)); // Trộn thứ tự các câu trong đề
    setStep('PREVIEW');
  };

  const handleSave = () => {
    if (!onSaveExam) return;
    const newExam: Exam = {
      id: Date.now().toString(),
      title: examConfig.examName,
      type: 'REGULAR',
      questionIds: currentQuestionIds,
      createdAt: Date.now(),
      config: examConfig
    };
    onSaveExam(newExam);
  };

  const totalQuestionsRequested = Object.values(matrixCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-[5000] bg-slate-50 flex flex-col font-inter animate-fade-in overflow-hidden">
      {/* Top Bar Navigation */}
      <header className="h-20 bg-white border-b border-slate-200 px-10 flex items-center justify-between shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all active:scale-90"
          >
            <i className="fas fa-times"></i>
          </button>
          <div className="h-8 w-[1px] bg-slate-200"></div>
          <div>
            <h2 className="font-black text-slate-900 tracking-tight leading-none">
                {viewExam ? 'Chi tiết đề thi' : 'Công cụ soạn thảo đề thi'}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                {step === 'MATRIX' ? 'Thiết lập ma trận câu hỏi' : 'Trình xem trước & Xuất bản A4'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {step === 'MATRIX' ? (
            <button 
                onClick={handleGenerateExam}
                className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"
            >
                Sinh đề ngẫu nhiên <i className="fas fa-wand-magic-sparkles ml-2"></i>
            </button>
          ) : (
            <>
              {!viewExam && (
                <button 
                    onClick={() => setStep('MATRIX')}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                    Đổi ma trận
                </button>
              )}
              <button 
                onClick={() => window.print()}
                className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all"
              >
                In Đề Thi (A4)
              </button>
              {!viewExam && (
                <button 
                    onClick={handleSave}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
                >
                    Lưu vào Ngân hàng <i className="fas fa-save ml-2"></i>
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-10 print:p-0 print:overflow-visible bg-slate-50 print:bg-white">
        
        {step === 'MATRIX' ? (
          <div className="max-w-4xl mx-auto space-y-10 animate-fade-in-up">
            <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-10">
                <div className="space-y-6">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tighter border-b border-slate-50 pb-4">1. Thông tin đơn vị & Định danh đề thi</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên cơ quan/Bộ chủ quản</label>
                            <input 
                              type="text" 
                              value={examConfig.organizationName} 
                              onChange={e => setExamConfig({...examConfig, organizationName: e.target.value})} 
                              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                              placeholder="Ví dụ: BỘ GIÁO DỤC VÀ ĐÀO TẠO"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên trường/Đơn vị</label>
                            <input 
                              type="text" 
                              value={examConfig.schoolName} 
                              onChange={e => setExamConfig({...examConfig, schoolName: e.target.value})} 
                              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                              placeholder="Ví dụ: TRƯỜNG ĐẠI HỌC KINH TẾ"
                            />
                        </div>
                    </div>
                    
                    <div className="p-8 bg-purple-50/50 rounded-[2.5rem] border border-purple-100 space-y-6">
                        <div className="flex items-center gap-3">
                            <i className="fas fa-graduation-cap text-purple-600"></i>
                            <h4 className="text-[11px] font-black text-purple-600 uppercase tracking-[0.2em]">Thông tin học thuật</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên Môn học</label>
                                <input 
                                  type="text" 
                                  value={examConfig.subject} 
                                  onChange={e => setExamConfig({...examConfig, subject: e.target.value})} 
                                  className="w-full p-4 bg-white border border-purple-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                                  placeholder="Ví dụ: NGUỒN ĐIỆN AN TOÀN VÀ MÔI TRƯỜNG"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên Học phần / Chuyên đề</label>
                                <input 
                                  type="text" 
                                  value={examConfig.moduleTerm} 
                                  onChange={e => setExamConfig({...examConfig, moduleTerm: e.target.value})} 
                                  className="w-full p-4 bg-white border border-purple-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500" 
                                  placeholder="Ví dụ: Lý thuyết cơ sở"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên bài thi</label>
                            <input type="text" value={examConfig.examName} onChange={e => setExamConfig({...examConfig, examName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã đề</label>
                            <input type="text" value={examConfig.examCode} onChange={e => setExamConfig({...examConfig, examCode: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TG Làm bài (P)</label>
                            <input type="number" value={examConfig.time} onChange={e => setExamConfig({...examConfig, time: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter">2. Ma trận mức độ Bloom</h3>
                        <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black uppercase">
                            Tổng cộng: {totalQuestionsRequested} Câu
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {BLOOM_LEVELS.map(level => {
                            const available = questions.filter(q => q.bloomLevel === level).length;
                            return (
                                <div key={level} className={`p-6 rounded-3xl border transition-all ${matrixCounts[level] > 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{level}</label>
                                        <span className="text-[9px] font-bold text-slate-400">Kho: {available}</span>
                                    </div>
                                    <input 
                                        type="number" 
                                        min="0"
                                        max={available}
                                        value={matrixCounts[level]}
                                        onChange={e => setMatrixCounts({...matrixCounts, [level]: parseInt(e.target.value) || 0})}
                                        className="w-full bg-white border border-slate-200 rounded-xl p-3 font-black text-xl text-blue-600 outline-none text-center focus:ring-4 focus:ring-blue-500/10"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 flex items-center gap-6">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-500 shadow-sm shrink-0">
                        <i className="fas fa-lightbulb text-xl"></i>
                    </div>
                    <p className="text-sm text-blue-800 font-medium leading-relaxed">
                        Hệ thống sẽ tự động quét ngân hàng câu hỏi hiện tại và lấy ngẫu nhiên các câu hỏi khớp với yêu cầu ma trận. 
                        Công thức LaTeX và hình ảnh sẽ được giữ nguyên trong bản in.
                    </p>
                </div>
            </div>
          </div>
        ) : (
          /* PREVIEW STEP: A4 Layout */
          <div 
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
            className="max-w-[210mm] min-h-[297mm] mx-auto bg-white p-[20mm] text-black shadow-[0_20px_80px_rgba(0,0,0,0.1)] print:shadow-none print:m-0 print:p-[15mm] mb-20 animate-fade-in-up"
          >
             
             {/* Header Section - Standard Vietnamese Administrative Format */}
             <div className="flex justify-between items-start mb-6 w-full">
                {/* Left Column: Organization & Candidate Info */}
                <div className="text-center w-[40%] flex flex-col">
                   <h4 className="text-[11px] uppercase leading-tight">{examConfig.organizationName}</h4>
                   <h4 className="text-[12px] font-bold uppercase leading-tight mt-1">{examConfig.schoolName}</h4>
                   <div className="w-[30%] h-[1px] bg-black mx-auto my-1"></div>
                   
                   <div className="text-left mt-6 pl-4 space-y-1">
                      <p className="text-[11px] italic font-medium">Họ và tên: ......................................................</p>
                      <p className="text-[11px] italic font-medium">Số báo danh: ...................................................</p>
                   </div>
                </div>

                {/* Right Column: National Emblem Title */}
                <div className="text-center w-[50%] flex flex-col">
                   <h4 className="text-[11px] font-bold uppercase leading-tight tracking-tight">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
                   <h4 className="text-[12px] font-bold leading-tight mt-1">Độc lập - Tự do - Hạnh phúc</h4>
                   <div className="w-[40%] h-[1px] bg-black mx-auto my-1"></div>
                </div>
             </div>

             {/* Exam Title Section - Centered */}
             <div className="text-center mb-8 w-full border-t border-black/5 pt-4">
                <h2 className="text-[18px] font-bold uppercase leading-tight mb-1">{examConfig.examName}</h2>
                <h3 className="text-[14px] font-bold uppercase leading-tight">
                   Môn: {examConfig.subject} 
                   {examConfig.moduleTerm && <span className="ml-2 font-medium normal-case">({examConfig.moduleTerm})</span>}
                </h3>
                <p className="text-[12px] italic mt-1">(Thời gian làm bài: {examConfig.time} phút, không kể thời gian giao đề)</p>
                <div className="border border-black px-4 py-1 inline-block mt-4 font-bold text-[13px] tracking-widest">
                   MÃ ĐỀ THI: {examConfig.examCode}
                </div>
             </div>

             <div className="space-y-8">
                <p className="text-[12px] italic pb-2 mb-4 text-center border-b border-dashed border-black/10">(Học sinh/Sinh viên không được sử dụng tài liệu trừ phụ lục quy định)</p>
                
                {selectedQuestions.map((q, idx) => (
                   <div key={q.id} className="text-[14px] leading-relaxed break-inside-avoid mb-6">
                      <div className="flex gap-2 font-bold mb-3 items-start">
                         <span className="shrink-0">Câu {idx + 1}:</span>
                         <div className="flex-1">{formatContent(q.content)}</div>
                      </div>
                      
                      {q.image && (
                        <div className="my-6 flex justify-center">
                            <img src={q.image} className="max-h-[70mm] max-w-full object-contain border border-black/5 rounded-sm" alt="Hình minh họa" />
                        </div>
                      )}
                      
                      {q.type === QuestionType.MULTIPLE_CHOICE && q.options && (
                         <div className="grid grid-cols-2 gap-x-12 gap-y-3 mt-3 ml-8">
                            {q.options.map((opt, i) => (
                               <div key={i} className="flex gap-2 items-start">
                                  <span className="font-bold">{String.fromCharCode(65 + i)}.</span>
                                  <div className="flex-1">{formatContent(opt)}</div>
                               </div>
                            ))}
                         </div>
                      )}

                      {q.type === QuestionType.ESSAY && (
                         <div className="mt-4 border-b border-dashed border-gray-100 h-2"></div>
                      )}
                   </div>
                ))}
             </div>

             <div className="text-center mt-16 mb-16 italic text-[14px] font-bold tracking-[0.5em]">--- HẾT ---</div>

             {/* ANSWER SHEET (Giấu khi in nếu không cần, hoặc in kèm) */}
             <div className="print:break-before-page pt-20 border-t-8 border-double border-slate-100 print:border-none">
                <h2 className="text-center text-[18px] font-bold uppercase mb-4">ĐÁP ÁN & HƯỚNG DẪN CHẤM</h2>
                <div className="grid grid-cols-10 border border-black mb-10">
                   {selectedQuestions.map((q, i) => {
                        const ansIdx = q.type === QuestionType.MULTIPLE_CHOICE && q.options 
                            ? q.options.indexOf(q.correctAnswer)
                            : -1;
                        return (
                            <div key={i} className="border border-black p-2 text-center text-[10px]">
                                <div className="font-bold border-b border-gray-200 mb-1">{i+1}</div>
                                <div className="font-black text-blue-800">
                                    {ansIdx >= 0 ? String.fromCharCode(65 + ansIdx) : 'TL'}
                                </div>
                            </div>
                        )
                   })}
                </div>
                <div className="space-y-6">
                    {selectedQuestions.map((q, i) => (
                        <div key={i} className="text-[12px] bg-slate-50 p-4 rounded-lg border border-slate-100 print:bg-white print:border-black/10">
                            <p className="font-bold mb-1">Câu {i+1} ({q.bloomLevel}):</p>
                            <div className="text-gray-700 italic">
                                {formatContent(q.type === QuestionType.ESSAY ? q.correctAnswer : q.explanation || "Không có giải thích chi tiết.")}
                            </div>
                        </div>
                    ))}
                </div>
             </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
            body { background: white !important; }
            header { display: none !important; }
            aside { display: none !important; }
            main { padding: 0 !important; margin: 0 !important; }
            .fixed { position: relative !important; }
            .overflow-hidden { overflow: visible !important; }
            .print\\:hidden { display: none !important; }
            .print\\:p-0 { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default ExamCreator;
