import React, { useState, useEffect } from 'react';
import { parseExamText } from '../../utils/textExamParser';

export default function ImportModal({ onClose, onImport }: { onClose: () => void, onImport: (qs: any[]) => void }) {
    const [rawText, setRawText] = useState('');
    const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);

    // Tự động Parse mỗi khi text thay đổi
    useEffect(() => {
        const timer = setTimeout(() => {
            if (rawText.trim()) {
                setParsedQuestions(parseExamText(rawText));
            } else {
                setParsedQuestions([]);
            }
        }, 500); // Debounce 500ms
        return () => clearTimeout(timer);
    }, [rawText]);

    return (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex p-4 md:p-8">
            <div className="bg-white w-full h-full rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-black text-[#14452F]">Import Đề Thi từ Word/Text</h2>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded font-bold">Hủy</button>
                        <button onClick={() => onImport(parsedQuestions)} className="px-6 py-2 bg-[#14452F] text-white rounded font-bold">Lưu {parsedQuestions.length} Câu Hỏi</button>
                    </div>
                </div>

                {/* Body - Split Pane */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Cột trái: Preview */}
                    <div className="w-1/2 border-r border-slate-200 p-4 overflow-y-auto bg-slate-50/50">
                        <h3 className="font-bold text-slate-600 mb-4 uppercase text-xs">Xem trước hiển thị</h3>
                        {parsedQuestions.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
                                <i className="fas fa-eye-slash text-4xl mb-3"></i>
                                <p className="font-bold">Chưa có dữ liệu</p>
                                <p className="text-xs mt-1">Dán text vào ô bên phải để xem trước kết quả phân tích.</p>
                            </div>
                        )}
                        {parsedQuestions.map((q, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded p-4 mb-4 shadow-sm">
                                <div className="flex justify-between mb-2">
                                    <span className="font-bold text-[#14452F]">Câu {idx + 1}</span>
                                    {q.correctAnswer && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">Đáp án: {q.correctAnswer}</span>}
                                </div>
                                <p className="mb-2 whitespace-pre-wrap">{q.content}</p>
                                {q.imageUrl && <p className="text-xs text-blue-500 italic mb-2">[Có chứa hình ảnh: {q.imageUrl}]</p>}
                                <div className="space-y-1">
                                    {q.options.map((opt: string, i: number) => (
                                        <div key={i} className={`p-2 rounded text-sm ${q.correctAnswer && opt.startsWith(q.correctAnswer) ? 'bg-green-50 border border-green-200' : 'bg-slate-50'}`}>{opt}</div>
                                    ))}
                                </div>
                                {q.explanation && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                                        <span className="font-bold text-slate-700">Giải thích:</span> {q.explanation}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Cột phải: Text Editor */}
                    <div className="w-1/2 p-4 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-600 uppercase text-xs">Nhập nội dung (Text thô)</h3>
                            <button className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded font-bold" onClick={() => {/* Thêm logic upload DOCX sau */}}>
                                <i className="fas fa-file-word mr-1"></i> Upload DOCX
                            </button>
                        </div>
                        <textarea 
                            className="flex-1 w-full border border-slate-300 rounded p-4 outline-none focus:border-[#14452F] font-mono text-sm resize-none"
                            placeholder="Dán nội dung từ file Word vào đây...&#10;&#10;Hệ thống hỗ trợ nhận diện:&#10;• Mẫu 1: Dấu * trước đáp án đúng&#10;• Mẫu 2: Bảng đáp án cuối bài&#10;• Mẫu 3: Chọn A/B/C/D&#10;• Mẫu 4: Dạng số thứ tự 1. 2. 3."
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
