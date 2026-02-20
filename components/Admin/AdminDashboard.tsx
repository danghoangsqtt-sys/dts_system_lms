
import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import TeacherManager from './TeacherManager';
import ClassManager from './ClassManager';
import StudentApproval from './StudentApproval';

interface AdminDashboardProps {
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNotify }) => {
  const location = useLocation();

  const NavItem = ({ to, label, icon }: { to: string, label: string, icon: string }) => {
    const active = location.pathname.endsWith(to);
    return (
      <Link 
        to={to} 
        className={`flex items-center gap-3 px-8 py-4 chamfer-sm font-black text-[10px] uppercase tracking-widest transition-all relative overflow-hidden group ${
          active 
            ? 'bg-[#14452F] text-white shadow-lg shadow-[#14452F]/20' 
            : 'bg-white text-slate-500 border-2 border-slate-100 hover:border-[#14452F]/30 hover:text-[#14452F]'
        }`}
      >
        <i className={`fas ${icon} text-sm ${active ? 'text-green-400' : 'text-slate-400 group-hover:text-[#14452F]'}`}></i>
        {label}
        {active && <div className="absolute right-0 top-0 w-2 h-2 bg-green-400"></div>}
      </Link>
    );
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 animate-fade-in pb-24 font-[Roboto]">
      
      {/* Command Center Header */}
      <header className="bg-slate-900 p-8 chamfer-lg border-b-4 border-[#14452F] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#14452F]/20 chamfer-diag -mr-16 -mt-16 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-1 bg-gradient-to-r from-[#14452F] to-transparent"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-[#14452F] px-3 py-1 chamfer-sm border border-green-500/30">
              <span className="w-1.5 h-1.5 bg-green-500 animate-pulse"></span>
              <span className="text-[9px] font-black text-green-400 uppercase tracking-[0.3em]">System Admin</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Trung tâm Quản trị DHsystem</h1>
            <p className="text-slate-400 text-xs font-medium max-w-xl">
              Phân quyền truy cập, quản lý nhân sự và cấu hình lớp học toàn hệ thống.
            </p>
          </div>
          
          <div className="flex gap-2">
             <div className="bg-white/5 p-4 chamfer-sm border border-white/10 text-center">
                <div className="text-2xl font-black text-white">Active</div>
                <div className="text-[8px] text-slate-400 uppercase tracking-widest">Trạng thái</div>
             </div>
             <div className="bg-white/5 p-4 chamfer-sm border border-white/10 text-center">
                <div className="text-2xl font-black text-[#14452F]">PRO</div>
                <div className="text-[8px] text-slate-400 uppercase tracking-widest">Giấy phép</div>
             </div>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <div className="flex flex-wrap gap-2">
          <NavItem to="teachers" label="Nhân sự (Giảng viên)" icon="fa-chalkboard-user" />
          <NavItem to="classes" label="Cấu trúc Lớp học" icon="fa-school" />
          <NavItem to="students" label="Phê duyệt Học viên" icon="fa-user-check" />
      </div>

      {/* Content Area */}
      <div className="bg-white chamfer-lg border border-slate-200 shadow-sm min-h-[600px] relative">
        <Routes>
          <Route path="/" element={
            <div className="h-full flex flex-col items-center justify-center p-20 text-center opacity-50">
                <div className="w-32 h-32 bg-slate-100 chamfer-lg flex items-center justify-center mb-6">
                    <i className="fas fa-shield-halved text-6xl text-slate-300"></i>
                </div>
                <h2 className="text-2xl font-black text-slate-400 uppercase tracking-tight">Chọn chức năng quản trị</h2>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mt-2">Sử dụng thanh điều hướng phía trên</p>
            </div>
          } />
          <Route path="teachers" element={<TeacherManager onNotify={onNotify} />} />
          <Route path="classes" element={<ClassManager onNotify={onNotify} />} />
          <Route path="students" element={<StudentApproval />} />
        </Routes>
      </div>
    </div>
  );
};

export default AdminDashboard;
