
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi đăng nhập. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-[Roboto] bg-[#050B14]">
      {/* 1. Background Effects (Cyberpunk Grid & Glow) */}
      <div className="absolute inset-0 z-0">
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        
        {/* Animated Glow Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#14452F]/30 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      {/* 2. Login Card (Glassmorphism Dark) */}
      <div className="relative z-10 w-full max-w-[420px] mx-4">
        {/* Decorative Border Glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-[#14452F] rounded-2xl blur opacity-30 animate-tilt"></div>
        
        <div className="relative bg-[#0F172A]/80 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-2xl shadow-2xl">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-[#14452F] to-emerald-900 mb-4 shadow-lg shadow-emerald-900/50 border border-white/10">
              <i className="fas fa-graduation-cap text-3xl text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]"></i>
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-1">ĐTS LMS <span className="text-emerald-500">CORE</span></h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">
              Safe Power & Environment
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 text-red-400 text-xs font-bold rounded-lg flex items-start gap-3 animate-shake backdrop-blur-sm">
              <i className="fas fa-circle-exclamation mt-0.5"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest ml-1">Định danh số (Email)</label>
              <div className="relative group">
                <i className="fas fa-fingerprint absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors"></i>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@system.edu.vn"
                  className="w-full pl-11 pr-4 py-3.5 bg-[#020617]/50 border border-slate-700 rounded-lg text-white text-sm font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-slate-600 shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest ml-1">Mã truy cập (Password)</label>
              <div className="relative group">
                <i className="fas fa-shield-halved absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors"></i>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3.5 bg-[#020617]/50 border border-slate-700 rounded-lg text-white text-sm font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-slate-600 shadow-inner"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 bg-gradient-to-r from-[#14452F] to-emerald-800 hover:from-emerald-700 hover:to-emerald-600 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center justify-center gap-3 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed border border-emerald-500/30 group"
            >
              {loading ? <i className="fas fa-circle-notch fa-spin text-emerald-300"></i> : <i className="fas fa-power-off text-emerald-300 group-hover:animate-pulse"></i>}
              {loading ? 'ĐANG KẾT NỐI...' : 'KHỞI ĐỘNG HỆ THỐNG'}
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-white/5">
            <div className="flex justify-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <span className="hover:text-emerald-400 cursor-pointer transition-colors">Trợ giúp</span>
                <span>•</span>
                <span className="hover:text-emerald-400 cursor-pointer transition-colors">Bảo mật</span>
            </div>
            <p className="text-slate-600 text-[9px] font-medium mt-4">
              v3.9.0 | Powered by Gemini 2.5 Flash
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
