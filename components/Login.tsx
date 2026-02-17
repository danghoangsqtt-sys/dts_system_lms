
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
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-[Roboto] bg-[#020617]">
      {/* 1. DRAGON SCALE BACKGROUND (CSS Pure) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Lớp nền chính xanh đen */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#051120] to-[#020617]"></div>
        
        {/* Họa tiết Vảy rồng (Dragon Scales Pattern) */}
        <div 
          className="absolute inset-0 opacity-[0.15]" 
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 0, #14452F 20%, transparent 21%),
              radial-gradient(circle at 50% 0, #14452F 20%, transparent 21%)
            `,
            backgroundSize: '40px 40px',
            backgroundPosition: '0 0, 20px 20px'
          }}
        ></div>

        {/* Hiệu ứng Glow Cyberpunk (Đèn Neon hắt sáng) */}
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-[#14452F] rounded-full blur-[150px] opacity-40 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-600 rounded-full blur-[150px] opacity-20"></div>
        
        {/* Lưới Grid công nghệ mờ phủ lên trên */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:60px_60px]"></div>
      </div>

      {/* 2. Login Card (Glassmorphism Dark Cyber) */}
      <div className="relative z-10 w-full max-w-[420px] mx-4 group">
        {/* Viền Neon phát sáng khi hover */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-[#14452F] rounded-2xl blur opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
        
        <div className="relative bg-[#0F172A]/80 backdrop-blur-2xl border border-white/5 p-8 md:p-10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          
          {/* Header */}
          <div className="text-center mb-10">
            <div className="relative inline-flex items-center justify-center w-20 h-20 mb-4">
               {/* Logo Hexagon Background */}
               <div className="absolute inset-0 bg-[#14452F] opacity-20 animate-spin-slow" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></div>
               <div className="absolute inset-2 bg-gradient-to-br from-[#14452F] to-emerald-900 shadow-inner" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></div>
               <i className="fas fa-graduation-cap text-3xl text-emerald-300 relative z-10 drop-shadow-[0_0_8px_rgba(110,231,183,0.8)]"></i>
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-1 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
              ĐTS LMS <span className="text-emerald-500">SYSTEM</span>
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2 opacity-60">
               <div className="h-[1px] w-8 bg-emerald-500"></div>
               <p className="text-emerald-400 text-[9px] font-black uppercase tracking-[0.3em]">Safe Power Core</p>
               <div className="h-[1px] w-8 bg-emerald-500"></div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border-l-2 border-red-500 text-red-400 text-xs font-bold rounded-r-lg flex items-start gap-3 animate-shake">
              <i className="fas fa-bug mt-0.5"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Định danh (Email)</label>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <i className="fas fa-user-astronaut text-slate-500 group-focus-within/input:text-emerald-400 transition-colors"></i>
                </div>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="commander@system.edu.vn"
                  className="w-full pl-11 pr-4 py-3.5 bg-[#020617]/60 border border-slate-700 rounded-lg text-white text-sm font-bold outline-none focus:border-emerald-500 focus:bg-[#020617] transition-all placeholder:text-slate-600 shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã bảo mật (Pass)</label>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <i className="fas fa-key text-slate-500 group-focus-within/input:text-emerald-400 transition-colors"></i>
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3.5 bg-[#020617]/60 border border-slate-700 rounded-lg text-white text-sm font-bold outline-none focus:border-emerald-500 focus:bg-[#020617] transition-all placeholder:text-slate-600 shadow-inner"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-4 bg-gradient-to-r from-[#14452F] to-emerald-800 hover:from-emerald-700 hover:to-emerald-600 text-white font-black text-[11px] uppercase tracking-[0.25em] rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center gap-3 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed border-t border-emerald-500/20 group/btn"
            >
              {loading ? <i className="fas fa-circle-notch fa-spin text-emerald-300"></i> : <i className="fas fa-power-off text-emerald-300 group-hover/btn:text-white transition-colors"></i>}
              {loading ? 'INITIALIZING...' : 'ACCESS SYSTEM'}
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-white/5">
            <p className="text-slate-600 text-[9px] font-black uppercase tracking-wider">
              Protected by <span className="text-[#14452F]">Dragon</span>Security Layer
            </p>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 10s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Login;
