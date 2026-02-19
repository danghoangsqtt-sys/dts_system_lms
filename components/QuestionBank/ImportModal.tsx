import React, { useState, useEffect } from 'react';
import { parseExamText } from '../../utils/textExamParser';

export default function ImportModal({ onClose, onImport }: { onClose: () => void, onImport: (qs: any[]) => void }) {
    const [rawText, setRawText] = useState('');
    const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
    const [attachedImages, setAttachedImages] = useState<Record<number, string>>({});

    const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setAttachedImages(prev => ({ ...prev, [index]: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = (index: number) => {
        setAttachedImages(prev => {
            const newState = { ...prev };
            delete newState[index];
            return newState;
        });
    };

    const SAMPLE_TEMPLATES = {
        mau1: `Phần 1. TRẮC NGHIỆM
Câu 1. Trong cuộc khai thác thuộc địa lần thứ hai ở Đông Dương, thực dân Pháp đầu tư vào:
*A. Đồn điền cao su.      B. Công nghiệp luyện kim.
C. Ngành chế tạo máy.     D. Công nghiệp hóa chất.

Câu 2. Đây là câu có đáp án đúng nằm ở B:
A. Phương án sai 1
*B. Phương án đúng
C. Phương án sai 2
D. Phương án sai 3

Phần 2. TỰ LUẬN
Câu 3. Trình bày suy nghĩ của anh/chị về ứng dụng của AI trong giáo dục?`,

        mau2: `Câu 1. Thủ đô của Việt Nam là gì?
A. TP.Hồ Chí Minh      B. Đà Nẵng
C. Hà Nội              D. Cần Thơ

Câu 2. 1 + 1 bằng mấy?
A. 1      B. 2      C. 3      D. 4

BẢNG ĐÁP ÁN
1C 2B

Hướng dẫn giải
Câu 1: 
Thủ đô của Việt Nam là Hà Nội (nằm ở miền Bắc).
Câu 2: 
Phép cộng cơ bản: 1 + 1 = 2.`,

        mau3: `Câu 1.(NB) Ngôn ngữ lập trình phổ biến nhất để làm web là gì?
A. Python      B. C++      C. JavaScript      D. Java

Lời giải
JavaScript là ngôn ngữ chạy trực tiếp trên trình duyệt web.
Chọn C

Câu 2.(VD) Đâu không phải là hệ điều hành?
A. Windows      B. Linux      C. macOS      D. Microsoft Word

Lời giải
Microsoft Word là phần mềm soạn thảo văn bản, không phải hệ điều hành.
Chọn D`,

        mau4: `1. \tKý hiệu cổng AND trong hình là:
[img:$img_1$]                                       
   *a. Hình a
    b. Hình b
    c. Hình c
    d. Hình d
2. \tKý hiệu cổng OR trong hình là: 
[img:$img_2$]
    a. Hình a\t\t*b. Hình b
    c. Hình c\t\td. Hình d`
    };

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
                        <button onClick={() => {
                            const finalQuestions = parsedQuestions.map((q, idx) => ({
                                ...q,
                                image: attachedImages[idx] || q.imageUrl || '',
                            }));
                            onImport(finalQuestions);
                        }} className="px-6 py-2 bg-[#14452F] text-white rounded font-bold">Lưu {parsedQuestions.length} Câu Hỏi</button>
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
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-[#14452F]">Câu {idx + 1}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${q.type === 'ESSAY' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {q.type === 'ESSAY' ? 'Tự luận' : 'Trắc nghiệm'}
                                        </span>
                                    </div>
                                    {q.correctAnswer && q.type !== 'ESSAY' && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">Đáp án: {q.correctAnswer}</span>
                                    )}
                                </div>

                                <p className="mb-2 whitespace-pre-wrap font-medium text-slate-700">{q.content}</p>

                                {/* Khu vực Hình Ảnh */}
                                <div className="mb-3">
                                    {(attachedImages[idx] || (q.imageUrl && q.imageUrl.startsWith('data:'))) ? (
                                        <div className="relative inline-block border border-slate-200 rounded p-1 bg-slate-50">
                                            <img src={attachedImages[idx] || q.imageUrl} alt="Minh họa" className="max-h-32 object-contain rounded" />
                                            <button 
                                                onClick={() => handleRemoveImage(idx)}
                                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600"
                                                title="Xóa ảnh"
                                            >
                                                <i className="fas fa-times text-xs"></i>
                                            </button>
                                        </div>
                                    ) : q.imageUrl ? (
                                        <div className="inline-block border border-amber-200 bg-amber-50 rounded p-3">
                                            <p className="text-xs font-bold text-amber-700 mb-2">
                                                <i className="fas fa-exclamation-triangle mr-1"></i> 
                                                Câu hỏi này cần chèn hình ảnh: <span className="font-mono bg-white px-1 rounded">{q.imageUrl}</span>
                                            </p>
                                            <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold cursor-pointer transition-colors shadow-sm">
                                                <i className="fas fa-upload"></i> Upload Ảnh Cho Câu Này
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(idx, e)} />
                                            </label>
                                        </div>
                                    ) : (
                                        <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-bold cursor-pointer transition-colors border border-dashed border-slate-300">
                                            <i className="fas fa-image"></i> Đính kèm ảnh minh họa
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(idx, e)} />
                                        </label>
                                    )}
                                </div>

                                {/* Chỉ hiển thị Options nếu là Trắc nghiệm */}
                                {q.type === 'MULTIPLE_CHOICE' && q.options && q.options.length > 0 && (
                                    <div className="space-y-1 mb-2">
                                        {q.options.map((opt: string, i: number) => (
                                            <div key={i} className={`p-2 rounded text-sm ${q.correctAnswer && opt.startsWith(q.correctAnswer) ? 'bg-green-50 border border-green-200 font-bold text-green-800' : 'bg-slate-50 text-slate-700 border border-slate-100'}`}>{opt}</div>
                                        ))}
                                    </div>
                                )}

                                {/* Hiển thị Đáp án Tự luận (nếu có) */}
                                {q.type === 'ESSAY' && q.correctAnswer && (
                                    <div className="mt-2 p-3 bg-purple-50 border border-purple-100 rounded text-sm text-slate-700">
                                        <span className="font-bold text-purple-700">Gợi ý đáp án:</span> {q.correctAnswer}
                                    </div>
                                )}

                                {q.explanation && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 text-sm text-slate-600 bg-yellow-50/50 p-2 rounded">
                                        <span className="font-bold text-yellow-700"><i className="fas fa-lightbulb mr-1"></i> Hướng dẫn giải:</span> 
                                        <div className="whitespace-pre-wrap mt-1">{q.explanation}</div>
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
                        <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"><i className="fas fa-magic mr-1"></i> Xem Cấu Trúc Mẫu</p>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                <button 
                                    onClick={() => setRawText(SAMPLE_TEMPLATES.mau1)} 
                                    className="p-2 border border-slate-200 rounded bg-white text-xs font-bold text-slate-600 hover:border-[#14452F] hover:bg-green-50 hover:text-[#14452F] transition-all flex flex-col items-center gap-1 shadow-sm"
                                    title="Đánh dấu đáp án đúng bằng dấu sao (*)"
                                >
                                    <i className="fas fa-asterisk text-[#14452F]"></i> Mẫu 1 (Dấu *)
                                </button>
                                <button 
                                    onClick={() => setRawText(SAMPLE_TEMPLATES.mau2)} 
                                    className="p-2 border border-slate-200 rounded bg-white text-xs font-bold text-slate-600 hover:border-[#14452F] hover:bg-green-50 hover:text-[#14452F] transition-all flex flex-col items-center gap-1 shadow-sm"
                                    title="Bảng đáp án và Hướng dẫn giải nằm ở cuối"
                                >
                                    <i className="fas fa-table text-blue-600"></i> Mẫu 2 (Bảng Đ.Án)
                                </button>
                                <button 
                                    onClick={() => setRawText(SAMPLE_TEMPLATES.mau3)} 
                                    className="p-2 border border-slate-200 rounded bg-white text-xs font-bold text-slate-600 hover:border-[#14452F] hover:bg-green-50 hover:text-[#14452F] transition-all flex flex-col items-center gap-1 shadow-sm"
                                    title="Từ khóa 'Chọn X' nằm trong Lời giải"
                                >
                                    <i className="fas fa-check-circle text-green-600"></i> Mẫu 3 (Chọn X)
                                </button>
                                <button 
                                    onClick={() => setRawText(SAMPLE_TEMPLATES.mau4)} 
                                    className="p-2 border border-slate-200 rounded bg-white text-xs font-bold text-slate-600 hover:border-[#14452F] hover:bg-green-50 hover:text-[#14452F] transition-all flex flex-col items-center gap-1 shadow-sm"
                                    title="Định dạng lộn xộn, chứa hình ảnh [img:...]"
                                >
                                    <i className="fas fa-image text-amber-500"></i> Mẫu 4 (Hình ảnh)
                                </button>
                            </div>
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
