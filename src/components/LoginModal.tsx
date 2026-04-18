import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { X, RefreshCw } from "lucide-react";

export function LoginModal({ onClose }: { onClose: () => void }) {
  const [showQr, setShowQr] = useState(false);
  const [qrTimestamp, setQrTimestamp] = useState(Date.now());
  const [countdown, setCountdown] = useState(20);

  useEffect(() => {
    let timer: any;
    if (showQr) {
      // Countdown and refresh
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setQrTimestamp(Date.now());
            return 20;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showQr]);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg shadow-2xl max-w-sm w-full relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold uppercase tracking-wider text-[var(--accent)] mb-2">欢迎回来</h3>
          <p className="text-xs text-[var(--text-dim)]">登录以保存项目并享受云端同步渲染与更多专业功能 (后续开放)</p>
        </div>

        {showQr ? (
          <div className="flex flex-col items-center">
            <div className="bg-white p-2 rounded-lg mb-4 relative group">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=wechat_login_${qrTimestamp}`} 
                alt="WeChat QR Code"
                className="w-48 h-48"
              />
              <div 
                className="absolute inset-0 flex items-center justify-center bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-black rounded-lg" 
                onClick={() => { setQrTimestamp(Date.now()); setCountdown(20); }}
              >
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-pulse" />
                  <span className="text-xs font-bold">点击立刻刷新</span>
                </div>
              </div>
            </div>
            <div className="text-[10px] text-[var(--text-dim)] mb-4 flex items-center gap-2 font-mono">
              <span className={`w-2 h-2 rounded-full ${countdown <= 5 ? 'bg-red-500 animate-pulse' : 'bg-[#07C160]'}`}></span>
              请使用微信扫一扫以登录 ({countdown}s 后刷新)
            </div>
            <button 
              onClick={() => { setShowQr(false); setCountdown(20); }}
              className="text-xs text-[var(--text-dim)] hover:text-white underline underline-offset-2"
            >
              返回其他登录方式
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button 
              onClick={async () => {
                try {
                  const { loginWithGoogle } = await import("../services/firebase");
                  await loginWithGoogle();
                  onClose();
                } catch (e) {
                  alert("登录失败，请检查网络后再试");
                }
              }}
              className="w-full flex items-center justify-center gap-3 bg-[#111] text-white border border-[var(--border)] py-2.5 rounded font-bold hover:bg-white hover:text-black transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              使用 Google 登录
            </button>
            
            <button 
              onClick={() => setShowQr(true)}
              className="w-full flex items-center justify-center gap-3 bg-[#07C160] text-white py-2.5 rounded font-bold hover:bg-[#06ad56] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.5,13.5c-2.8,0-5-1.8-5-4s2.2-4,5-4c2.8,0,5,1.8,5,4S11.3,13.5,8.5,13.5z M7.2,7.3c-0.4,0-0.7,0.3-0.7,0.7s0.3,0.7,0.7,0.7s0.7-0.3,0.7-0.7S7.6,7.3,7.2,7.3z M9.8,7.3c-0.4,0-0.7,0.3-0.7,0.7s0.3,0.7,0.7,0.7s0.7-0.3,0.7-0.7S10.2,7.3,9.8,7.3z M16.5,13.8c-2.4,0-4.3-1.6-4.3-3.6c0-0.2,0-0.4,0.1-0.6c-1,0.2-2.1,0.2-3.1,0.2c-3.1,0-5.7-2.1-5.7-4.6s2.6-4.6,5.7-4.6c3.1,0,5.7,2.1,5.7,4.6c0,0.6-0.1,1.1-0.4,1.7c1.3-0.2,2.7,0,3.9,0.5c0.5-0.7,1-1.5,1.6-2.2c0.2-0.3,0.5-0.3,0.8-0.1c0.1,0.1,0.2,0.2,0.2,0.3c0.1,0.4,0.2,0.7,0.2,1.1c0,2.1-1.9,3.8-4.3,3.8c-0.5,0-1-0.1-1.5-0.2c-0.5,0.7-0.9,1.5-1.5,2.1C14,13.2,15.2,13.8,16.5,13.8z M15.3,8.7c-0.3,0-0.6,0.2-0.6,0.5s0.3,0.5,0.6,0.5c0.3,0,0.6-0.2,0.6-0.5S15.6,8.7,15.3,8.7z M17.7,8.7c-0.3,0-0.6,0.2-0.6,0.5s0.3,0.5,0.6,0.5s0.6-0.2,0.6-0.5S18,8.7,17.7,8.7z"/>
              </svg>
              微信扫码登录
            </button>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-[var(--border)] text-center">
          <span className="text-[10px] text-[var(--text-dim)]">登录即表示您同意 服务条款 与 隐私政策</span>
        </div>
      </motion.div>
    </div>
  );
}
