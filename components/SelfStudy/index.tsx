import React from 'react';

export default function SelfStudyManager({ user }: { user: any }) {
    return (
        <div className="p-6 h-full flex flex-col">
            <h1 className="text-2xl font-black text-[#14452F] uppercase mb-1">Ôn tập tự học</h1>
            <p className="text-slate-500 text-sm mb-6">Luyện tập với ngân hàng câu hỏi dùng chung và tài liệu hệ thống.</p>
            
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-green-100 text-[#14452F] rounded-full flex items-center justify-center text-3xl mb-4">
                    <i className="fas fa-book-open"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Khu vực luyện tập</h3>
                <p className="text-slate-500">Hệ thống đang tổng hợp ngân hàng câu hỏi công khai để bạn tự luyện tập.</p>
            </div>
        </div>
    );
}
