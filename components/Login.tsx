
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
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-[Roboto]">
      {/* 1. Nền Video với lớp phủ màu thương hiệu */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover z-0"
        poster="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2073&auto=format&fit=crop"
      >
        <source src="/assets/videos/background.mp4" type="video/mp4" />
        <source src="https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-blue-circuits-989-large.mp4" type="video/mp4" />
      </video>

      {/* 2. Lớp phủ màu Xanh lá đậm (#14452F) */}
      <div className="fixed inset-0 bg-[#14452F]/90 z-0"></div>

      {/* 3. Thẻ Đăng nhập Hiện đại */}
      <div className="relative z-10 w-full max-w-[420px] bg-white p-8 md:p-12 rounded-[16px] shadow-2xl animate-slide-up border-t-4 border-[#14452F]">
        
        {/* Header Thương hiệu */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <i className="fas fa-graduation-cap text-4xl text-[#14452F]"></i>
          </div>
          <h1 className="text-2xl font-bold text-[#14452F] uppercase tracking-wide">Hệ thống LMS ĐTS</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">
            Cổng thông tin đào tạo trực tuyến
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-md flex items-start gap-3">
            <i className="fas fa-circle-exclamation mt-0.5"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 ml-1">Tài khoản / Email</label>
            <div className="relative">
              <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten.dang.nhap@truong.edu.vn"
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 text-sm outline-none focus:border-[#14452F] focus:ring-1 focus:ring-[#14452F] transition-all placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 ml-1">Mật khẩu</label>
            <div className="relative">
              <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu của bạn"
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 text-sm outline-none focus:border-[#14452F] focus:ring-1 focus:ring-[#14452F] transition-all placeholder:text-gray-400"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-[#14452F] text-white font-bold text-sm rounded-lg hover:bg-[#0F3624] transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-sign-in-alt"></i>}
            {loading ? 'ĐANG XÁC THỰC...' : 'ĐĂNG NHẬP'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-100 pt-6">
          <p className="text-gray-400 text-xs font-medium">
            © 2026 Bản quyền thuộc về ĐTS LMS. <br/>
            Hệ thống quản lý học tập & thi trực tuyến.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
