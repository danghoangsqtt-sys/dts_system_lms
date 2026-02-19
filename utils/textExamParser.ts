export const parseExamText = (rawText: string) => {
    const questions: any[] = [];
    // Tách các câu hỏi dựa trên từ khóa "Câu X" hoặc "Câu X." hoặc "X." (cho Mẫu 4)
    const blocks = rawText.split(/(?=\n(?:Câu\s*\d+|[0-9]+\s*\.)[^\w])/g).map(b => b.trim()).filter(b => b.length > 0);
    
    // Tìm bảng đáp án ở cuối bài (Mẫu 2)
    let globalAnswers: Record<string, string> = {};
    const answerTableMatch = rawText.match(/BẢNG ĐÁP ÁN\n([\s\S]*?)(?:Hướng dẫn giải|$)/);
    if (answerTableMatch) {
        const tokens = answerTableMatch[1].match(/\d+[A-D]/g);
        if (tokens) tokens.forEach(t => globalAnswers[t.match(/\d+/)![0]] = t.match(/[A-D]/)![0]);
    }

    blocks.forEach(block => {
        // Bỏ qua các block không phải câu hỏi (như Header, Bảng đáp án)
        if (!block.match(/^(?:Câu\s*\d+|[0-9]+\s*\.)/)) return;

        const q: any = { type: 'MULTIPLE_CHOICE', content: '', options: [], correctAnswer: '', explanation: '', imageUrl: '' };
        
        // Trích xuất số thứ tự câu
        const qNumMatch = block.match(/^(?:Câu\s*(\d+)|(\d+)\s*\.)/);
        const qNum = qNumMatch ? (qNumMatch[1] || qNumMatch[2]) : '';

        // Trích xuất thẻ ảnh [img:...]
        const imgMatch = block.match(/\[img:([^\]]+)\]/);
        if (imgMatch) {
            q.imageUrl = imgMatch[1]; // Sẽ thay thế bằng base64/url thật ở bước UI
            block = block.replace(imgMatch[0], ''); // Xóa thẻ ảnh khỏi nội dung
        }

        // Tách phần Giải thích (Mẫu 2, 3)
        const explainMatch = block.match(/(?:Hướng dẫn giải|Lời giải|Cách giải:)[\s\S]*/);
        if (explainMatch) {
            q.explanation = explainMatch[0].trim();
            block = block.replace(explainMatch[0], '');
        }

        // Tách phần "Chọn X" (Mẫu 3)
        const chooseMatch = block.match(/Chọn\s*([A-D])/i);
        if (chooseMatch) {
            q.correctAnswer = chooseMatch[1].toUpperCase();
            block = block.replace(chooseMatch[0], '');
        }

        // Tách Nội dung và Đáp án (A, B, C, D hoặc a, b, c, d)
        const lines = block.split('\n');
        const contentLines: string[] = [];
        
        lines.forEach(line => {
            const optMatch = line.match(/^(\*)?\s*([A-Da-d])[\.\:\)]\s*(.*)/);
            if (optMatch) {
                const isCorrect = optMatch[1] === '*';
                const optLetter = optMatch[2].toUpperCase();
                q.options.push(`${optLetter}. ${optMatch[3].trim()}`);
                if (isCorrect) q.correctAnswer = optLetter;
                
                // Bắt tiếp các đáp án cùng dòng (VD: A. ... B. ...)
                const inlineOpts = line.match(/(?:^|\s+)(\*)?\s*([A-Da-d])[\.\:\)]\s*([^A-Da-d\n]+(?:\s+|$)(?!\s*[\.\:\)]))/g);
                if (inlineOpts && inlineOpts.length > 1) {
                    // Xử lý chia tách dòng phức tạp ở đây (Giữ nguyên logic cơ bản cho đơn giản trước)
                }
            } else if (q.options.length === 0) {
                contentLines.push(line);
            }
        });

        q.content = contentLines.join('\n').replace(/^(?:Câu\s*\d+|[0-9]+\s*\.)(?:.*?\))?\s*/, '').trim();

        // Gắn đáp án từ Bảng đáp án (Mẫu 2) nếu có
        if (!q.correctAnswer && globalAnswers[qNum]) {
            q.correctAnswer = globalAnswers[qNum];
        }

        if (q.content) questions.push(q);
    });

    return questions;
};
