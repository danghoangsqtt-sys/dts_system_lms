
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
  const currentTab = location.pathname.split('/').pop() || 'dashboard';

  const NavItem = ({ to, label, icon }: { to: string, label: string, icon: string }) => {
    const active = location.pathname.endsWith(to);
    return (
      <Link 
        to={to} 
        className={`px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border ${
          active 
            ? 'bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-500/20' 
            : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'
        }`}
      >
        <i className={`fas ${icon} mr-2`}></i> {label}
      </Link>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 animate-fade-in pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3 text-blue-600 font-black text-[11px] uppercase tracking-[0.3em]">
            <i className="fas fa-shield-halved"></i>
            Hệ thống Quản trị Trung tâm
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Admin Control Panel</h1>
          <p className="text-slate-500 text-sm font-medium">Quản lý nhân sự, lớp học và phê duyệt người dùng toàn hệ thống.</p>
        </div>
        <div className="flex gap-3 relative z-10 mt-6 md:mt-0">
          <NavItem to="teachers" label="Giảng viên" icon="fa-chalkboard-user" />
          <NavItem to="classes" label="Lớp học" icon="fa-school" />
          <NavItem to="students" label="Học viên" icon="fa-users" />
        </div>
      </header>

      <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[600px]">
        <Routes>
          <Route path="/" element={<div className="p-20 text-center space-y-4">
            <i className="fas fa-chart-pie text-6xl text-slate-200 mb-6"></i>
            <h2 className="text-2xl font-black text-slate-800">Chào mừng Admin!</h2>
            <p className="text-slate-500 max-w-md mx-auto">Vui lòng chọn một mục ở thanh menu phía trên để bắt đầu quản lý hệ thống LMS.</p>
          </div>} />
          <Route path="teachers" element={<TeacherManager onNotify={onNotify} />} />
          <Route path="classes" element={<ClassManager onNotify={onNotify} />} />
          <Route path="students" element={<StudentApproval onNotify={onNotify} />} />
        </Routes>
      </div>
    </div>
  );
};

export default AdminDashboard;
