import React, { useState, useEffect } from 'react';
import { submitExamResult } from '../../services/databaseService';

export default function ExamRoom({ exam, questions, answerData, user, onExit }: { exam: any, questions: any[], answerData: any, user: any, onExit: () => void }) {
    // Thời gian làm bài (tính bằng giây) - Giả sử exam.duration lưu theo phút
    const [timeLeft, setTimeLeft] = useState((exam.duration || 45) * 60);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [flags, setFlags] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleAutoSubmit = async () => {
        alert("Hết giờ làm bài! Hệ thống đang tự động nộp bài...");
        await submitFinalExam();
    };

    const handleManualSubmit = async () => {
        const unanswered = questions.length - Object.keys(answers).length;
        const msg = unanswered > 0 
            ? `Bạn còn ${unanswered} câu chưa làm. Bạn có chắc chắn muốn nộp bài không?`
            : `Bạn đã làm xong tất cả câu hỏi. Xác nhận nộp bài?`;
        
        if (window.confirm(msg)) {
            await submitFinalExam();
        }
    };

    const submitFinalExam = async () => {
        setIsSubmitting(true);
        let correctCount = 0;
        
        // Chấm điểm tự động
        questions.forEach((q, index) => {
            const qNum = index + 1;
            const studentAns = answers[index];
            const correctAns = answerData[qNum]?.correctLetter; // Lấy từ đáp án đã xáo trộn
            
            if (studentAns && correctAns && studentAns.startsWith(correctAns)) {
                correctCount++;
            }
        });

        const score = (correctCount / questions.length) * 10;

        try {
            await submitExamResult({
                exam_id: exam.id,
                student_id: user.id,
                student_name: user.name || 'Học viên',
                score: parseFloat(score.toFixed(2)),
                correct_answers: correctCount,
                total_questions: questions.length,
                answers_data: JSON.stringify(answers)
            });
            alert(`Nộp bài thành công! Điểm của bạn: ${score.toFixed(2)}/10`);
            onExit();
        } catch (error) {
            console.error(error);
            alert("Lỗi nộp bài. Vui lòng thử lại!");
            setIsSubmitting(false);
        }
    };

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

                            <div className="space-y-2">
                                {q.options && q.options.map((opt: string, i: number) => {
                                    const optLetter = opt.charAt(0); // A, B, C, D
                                    return (
                                        <label key={i} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${answers[index] === optLetter ? 'bg-blue-50 border-blue-400' : 'border-slate-200 hover:bg-slate-50'}`}>
                                            <input 
                                                type="radio" 
                                                name={`q-${index}`} 
                                                checked={answers[index] === optLetter}
                                                onChange={() => handleSelectOption(index, optLetter)}
                                                className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-slate-700">{opt}</span>
                                        </label>
                                    );
                                })}
                            </div>
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
                    onClick={handleManualSubmit} 
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
