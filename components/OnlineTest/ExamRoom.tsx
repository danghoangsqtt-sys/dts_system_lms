import React, { useState, useEffect, useRef } from 'react';
import { submitExamResult } from '../../services/databaseService';

export default function ExamRoom({ exam, questions, answerData, user, onExit }: { exam: any, questions: any[], answerData: any, user: any, onExit: () => void }) {
    // Thời gian làm bài (tính bằng giây) - Giả sử exam.duration lưu theo phút
    const [timeLeft, setTimeLeft] = useState((exam.duration || 45) * 60);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [flags, setFlags] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const startTimestamp = useRef(Date.now());
    const [viewMode, setViewMode] = useState<'TESTING' | 'REVIEW' | 'RESULT'>('TESTING');
    const [finalScore, setFinalScore] = useState<number | null>(null);
    const [correctCount, setCorrectCount] = useState<number>(0);

    // Đồng hồ đếm ngược
    useEffect(() => {
        if (timeLeft <= 0) {
            handleAutoSubmit();
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleSelectOption = (qIndex: number, optionLetter: string) => {
        setAnswers(prev => ({ ...prev, [qIndex]: optionLetter }));
    };

    const toggleFlag = (qIndex: number) => {
        setFlags(prev => {
            const newFlags = new Set(prev);
            if (newFlags.has(qIndex)) newFlags.delete(qIndex);
            else newFlags.add(qIndex);
            return newFlags;
        });
    };

    const scrollToQuestion = (index: number) => {
        const el = document.getElementById(`question-${index}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleGoToReview = () => {
        setViewMode('REVIEW');
    };

    const submitFinalExam = async () => {
        setIsSubmitting(true);
        let correct = 0;
        let answersDetail: any = {};

        questions.forEach((q, idx) => {
            const studentAns = answers[idx];
            
            // Hỗ trợ cả 2 trường hợp: examEngine lưu key bằng ID hoặc bằng Index
            const correctAns = answerData[q.id] || answerData[idx]; 
            
            if (q.type === 'MULTIPLE_CHOICE') {
                // FIX LỖI: Bắt buộc phải có câu trả lời (studentAns) thì mới so sánh
                if (studentAns && studentAns === correctAns) {
                    correct++;
                }
            }
            
            answersDetail[q.id || `q-${idx}`] = {
                question_content: typeof q.content === 'string' ? q.content.substring(0, 100) : 'Nội dung câu hỏi',
                student_answer: studentAns || 'Bỏ trống',
                correct_answer: correctAns || 'Không có',
                // Chỉ tính là đúng nếu học viên CÓ CHỌN và CHỌN ĐÚNG
                is_correct: !!(studentAns && studentAns === correctAns)
            };
        });

        // Đề phòng trường hợp lỗi chia cho 0 nếu đề không có câu hỏi nào
        const calculatedScore = questions.length > 0 ? (correct / questions.length) * 10 : 0;
        setCorrectCount(correct);
        setFinalScore(calculatedScore);

        try {
            const timeSpent = (exam.duration || 45) * 60 - timeLeft;
            const compressedData = JSON.stringify({
                student_name: user.fullName || user.name || 'Học viên',
                correct_answers: correct,
                total_questions: questions.length,
                time_spent: timeSpent,
                answers: answers,
                answers_detail: answersDetail
            });

            await submitExamResult({
                exam_id: exam.id,
                student_id: user.id,
                score: parseFloat(calculatedScore.toFixed(2)),
                answers_data: compressedData
            });
            
            // Chuyển sang màn hình Kết quả thay vì dùng alert
            setViewMode('RESULT');
        } catch (error) {
            console.error("Lỗi nộp bài:", error);
            alert("Lỗi nộp bài do cấu trúc dữ liệu Appwrite. Vui lòng thử lại!");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Auto submit khi hết giờ
    const handleAutoSubmit = () => {
        if (viewMode !== 'RESULT') submitFinalExam();
    };

    if (viewMode === 'REVIEW') {
        const answeredCount = Object.keys(answers).length;
        const unansweredCount = questions.length - answeredCount;

        return (
            <div className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto">
                <div className="max-w-3xl mx-auto my-10 p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
                    <h2 className="text-3xl font-black text-[#14452F] text-center mb-2">XÁC NHẬN NỘP BÀI</h2>
                    <p className="text-center text-slate-500 mb-8 font-medium">Bạn có chắc chắn muốn nộp bài thi lúc này?</p>
                    
                    <div className="grid grid-cols-2 gap-6 mb-10">
                        <div className="bg-[#E8F5E9] p-6 rounded-xl border border-green-200 text-center">
                            <h3 className="text-4xl font-black text-[#14452F] mb-1">{answeredCount}</h3>
                            <p className="text-sm font-bold text-green-700 uppercase">Câu đã trả lời</p>
                        </div>
                        <div className={`p-6 rounded-xl border text-center ${unansweredCount > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                            <h3 className={`text-4xl font-black mb-1 ${unansweredCount > 0 ? 'text-red-600' : 'text-slate-600'}`}>{unansweredCount}</h3>
                            <p className={`text-sm font-bold uppercase ${unansweredCount > 0 ? 'text-red-500' : 'text-slate-500'}`}>Câu bỏ trống</p>
                        </div>
                    </div>

                    <div className="flex gap-4 justify-center">
                        <button 
                            onClick={() => setViewMode('TESTING')} 
                            disabled={isSubmitting}
                            className="px-8 py-4 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold uppercase tracking-widest transition-all"
                        >
                            Quay lại làm tiếp
                        </button>
                        <button 
                            onClick={submitFinalExam} 
                            disabled={isSubmitting}
                            className="px-8 py-4 bg-[#14452F] hover:bg-[#0f3523] text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
                        >
                            {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                            NỘP BÀI CHÍNH THỨC
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (viewMode === 'RESULT') {
        return (
            <div className="fixed inset-0 bg-slate-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white p-10 rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 text-center animate-fade-in-up">
                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="fas fa-check text-5xl"></i>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Tuyệt vời! Bạn đã hoàn thành bài thi.</h2>
                    <p className="text-slate-500 mb-8 font-medium">Kết quả của bạn đã được ghi nhận vào hệ thống.</p>
                    
                    <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Điểm số</p>
                        <p className="text-6xl font-black text-[#14452F]">{finalScore?.toFixed(2)}</p>
                        <p className="text-sm font-bold text-slate-500 mt-2">Đúng {correctCount} / {questions.length} câu</p>
                    </div>

                    <button 
                        onClick={onExit} 
                        className="w-full py-4 bg-[#14452F] hover:bg-[#0f3523] text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg"
                    >
                        Quay lại trang chủ
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-100 z-[100] flex flex-col md:flex-row overflow-hidden">
            {/* Cột trái: Danh sách câu hỏi cuộn */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar scroll-smooth">
                <div className="max-w-3xl mx-auto space-y-6 pb-20">
                    <h1 className="text-2xl font-black text-[#14452F] text-center mb-8 bg-white p-4 rounded-xl shadow-sm">
                        BÀI THI: {exam.title}
                    </h1>
                    
                    {questions.map((q, index) => (
                        <div key={index} id={`question-${index}`} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start mb-4">
                                <span className="font-bold text-lg text-slate-800">Câu {index + 1}:</span>
                                <button 
                                    onClick={() => toggleFlag(index)}
                                    className={`transition-colors ${flags.has(index) ? 'text-red-500' : 'text-slate-300 hover:text-red-300'}`}
                                    title="Cắm cờ đánh dấu câu này"
                                >
                                    <i className="fas fa-flag text-xl"></i>
                                </button>
                            </div>
                            <div className="text-slate-700 mb-4 text-base whitespace-pre-wrap">{q.content}</div>
                            
                            {q.imageUrl && (
                                <img src={q.imageUrl} alt="Hình minh họa" className="max-h-48 mb-4 object-contain rounded" />
                            )}

                    {/* Render Giao diện tùy theo Loại câu hỏi */}
                    {q.type === 'ESSAY' ? (
                        <div className="mt-4">
                            <textarea
                                value={answers[index] || ''}
                                onChange={(e) => handleSelectOption(index, e.target.value)}
                                placeholder="Nhập câu trả lời tự luận của bạn vào đây..."
                                className="w-full h-40 p-4 border-2 border-slate-200 rounded-xl outline-none focus:border-[#14452F] focus:ring-4 focus:ring-green-50 transition-all font-medium text-slate-700 bg-slate-50"
                            />
                            <p className="text-right text-[10px] text-slate-400 mt-1 font-bold">Hệ thống tự động lưu nháp <i className="fas fa-save ml-1"></i></p>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {q.options?.map((opt: string, oIdx: number) => {
                                const optionLetter = String.fromCharCode(65 + oIdx);
                                const isSelected = answers[index] === optionLetter;
                                // Tự động loại bỏ chữ "A. " "B. " ở đầu do Word trích ra để giao diện đẹp hơn
                                const cleanOpt = opt.replace(/^[A-Z][\.\:\)]\s*/i, '');
                                return (
                                    <label key={oIdx} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-[#14452F] bg-[#E8F5E9] shadow-sm' : 'border-slate-100 bg-white hover:border-green-200'}`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-[#14452F] text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {optionLetter}
                                        </div>
                                        <span className="font-medium text-slate-700 select-none flex-1">
                                            {cleanOpt}
                                        </span>
                                        <input type="radio" name={`q-${index}`} className="hidden" checked={isSelected} onChange={() => handleSelectOption(index, optionLetter)} />
                                    </label>
                                );
                            })}
                        </div>
                    )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Cột phải: Lưới điều hướng & Nộp bài */}
            <div className="w-full md:w-80 bg-white border-l border-slate-200 p-6 flex flex-col shrink-0">
                <div className="text-center mb-6">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Thời gian còn lại</p>
                    <div className={`text-3xl font-black font-mono ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-[#14452F]'}`}>
                        {formatTime(timeLeft)}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar mb-6">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">Danh sách câu hỏi</p>
                    <div className="grid grid-cols-5 gap-2">
                        {questions.map((_, index) => {
                            const isAnswered = !!answers[index];
                            const isFlagged = flags.has(index);
                            return (
                                <button 
                                    key={index}
                                    onClick={() => scrollToQuestion(index)}
                                    className={`relative h-10 w-full rounded font-bold text-sm transition-all border ${
                                        isAnswered 
                                            ? 'bg-blue-600 text-white border-blue-600' 
                                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                    }`}
                                >
                                    {index + 1}
                                    {isFlagged && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    
                    {/* Chú giải */}
                    <div className="mt-6 space-y-2 text-xs text-slate-600">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded"></div> Đã trả lời</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 border border-slate-300 rounded"></div> Chưa trả lời</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Đặt cờ đánh dấu</div>
                    </div>
                </div>

                <button 
                    onClick={handleGoToReview} 
                    disabled={isSubmitting}
                    className="w-full py-4 bg-[#14452F] hover:bg-[#0f3523] text-white rounded-xl font-black uppercase tracking-widest transition-all flex justify-center items-center gap-2"
                >
                    {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                    Nộp Bài Ngay
                </button>
            </div>
        </div>
    );
}
