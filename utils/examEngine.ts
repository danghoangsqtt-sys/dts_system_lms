
import { Question, QuestionType } from '../types';

/**
 * Fisher-Yates Shuffle Algorithm
 * Randomizes an array in-place (O(n) complexity).
 */
export const shuffleArray = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

/**
 * Helper to remove prefixes like "A. ", "B)", "C: " from strings
 */
const stripPrefix = (text: string): string => {
    if (!text) return '';
    // Removes A-Z followed by dot, colon, or parenthesis at the start
    return text.replace(/^[A-Z][\.\:\)]\s*/i, '').trim();
};

export interface AnswerEntry {
    correctLetter: string;
    content: string;
    explanation: string;
}

export interface GeneratedExamData {
    examQuestions: any[];
    answerData: Record<number, AnswerEntry>;
    examCode: string;
}

/**
 * Generates a complete exam paper with shuffled questions and shuffled options.
 * @param sourceQuestions List of available questions
 * @param count Number of questions to select
 * @param examCode The exam code identifier
 */
export const generateExamPaper = (sourceQuestions: any[], count: number, examCode: string): GeneratedExamData => {
    const selected = shuffleArray(sourceQuestions).slice(0, count);
    const finalQuestions: any[] = [];
    
    // answerData chứa nhiều thông tin hơn (Chữ cái, Nội dung, Giải thích)
    const answerData: Record<number, AnswerEntry> = {};

    selected.forEach((q, index) => {
        const qNumber = index + 1;
        if (q.type === 'MULTIPLE_CHOICE' && q.options) {
            const rawCorrect = (q.correctAnswer || '').trim();
            const cleanOptions = q.options.map((opt: string) => opt.replace(/^[A-D][\.\:\)]\s*/, '').trim());
            
            // Xác định nội dung đáp án đúng:
            // Case 1: correctAnswer chỉ là chữ cái (A, B, C, D) → tra theo index
            // Case 2: correctAnswer là "A. Nội dung..." → bỏ prefix rồi so sánh
            // Case 3: correctAnswer là nội dung đầy đủ → so sánh trực tiếp
            let correctContent = '';
            const letterMatch = rawCorrect.match(/^([A-D])[\.\:\)]?\s*$/i);
            
            if (letterMatch) {
                // Case 1: Chỉ là chữ cái → lấy nội dung từ options theo index
                const letterIndex = letterMatch[1].toUpperCase().charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
                correctContent = cleanOptions[letterIndex] || '';
            } else {
                // Case 2 & 3: Bỏ prefix nếu có, dùng nội dung gốc
                correctContent = rawCorrect.replace(/^[A-D][\.\:\)]\s*/, '').trim();
            }

            const compareCorrect = correctContent.toLowerCase().replace(/\s+/g, '');

            // Xáo trộn đáp án
            const shuffledOptions = shuffleArray<string>(cleanOptions);
            
            const prefixes = ['A', 'B', 'C', 'D', 'E', 'F'];
            const finalOptions = shuffledOptions.map((opt, i) => `${prefixes[i]}. ${opt}`);
            
            // Tìm vị trí đáp án đúng sau khi xáo trộn
            const correctIndex = shuffledOptions.findIndex(opt => 
                opt.toLowerCase().replace(/\s+/g, '') === compareCorrect
            );
            
            answerData[qNumber] = {
                correctLetter: correctIndex !== -1 ? prefixes[correctIndex] : 'Lỗi/Chưa xác định',
                content: correctContent,
                explanation: q.explanation || 'Không có giải thích chi tiết.'
            };

            finalQuestions.push({ ...q, options: finalOptions });
        } else {
            answerData[qNumber] = {
                correctLetter: 'Tự luận',
                content: q.correctAnswer || 'Xem hướng dẫn',
                explanation: q.explanation || 'Không có giải thích.'
            };
            finalQuestions.push(q);
        }
    });

    return { examQuestions: finalQuestions, answerData, examCode };
};
