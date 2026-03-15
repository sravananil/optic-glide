import { Mail, Lock, Eye, EyeOff, Chrome, Apple } from 'lucide-react';
import { useState } from 'react';
const ogLogoImage = "/assets/logo.png";

interface SignInProps {
  onClose: () => void;
}

export function SignIn({ onClose }: SignInProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden flex items-center justify-center p-8">
      {/* Background Nebula Glows */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
      <div className="absolute top-40 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-purple-700/15 rounded-full blur-[110px]" />

      {/* Main Card */}
      <div className="relative max-w-6xl w-full backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-[0_8px_32px_0_rgba(0,255,255,0.2)]">
        <div className="grid md:grid-cols-2 min-h-[600px]">
          {/* Left Side - Branding */}
          <div className="relative bg-gradient-to-br from-[#00FFFF]/10 via-purple-600/10 to-[#BF00FF]/10 backdrop-blur-xl border-r border-white/10 flex flex-col items-center justify-center p-12">
            {/* Animated Glow Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#00FFFF]/5 to-purple-600/5" />
            
            {/* Logo */}
            <div className="relative z-10 flex flex-col items-center">
              <img 
                src={ogLogoImage} 
                alt="OpticGlide Logo" 
                className="w-64 h-auto mb-8 drop-shadow-[0_0_30px_rgba(0,255,255,0.6)]"
              />
              
              {/* Stylish OpticGlide Text */}
              <h1 className="text-6xl font-bold bg-gradient-to-r from-[#00FFFF] via-purple-400 to-[#BF00FF] bg-clip-text text-transparent mb-4"
                  style={{ fontFamily: "'Orbitron', 'Exo 2', sans-serif" }}>
                OpticGlide
              </h1>
              
              <p className="text-gray-300 text-center text-lg leading-relaxed max-w-md">
                Speak. Visualize. Understand.
                <br />
                <span className="text-[#00FFFF] text-sm">AI-powered visual intelligence platform</span>
              </p>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-10 left-10 w-20 h-20 border-2 border-[#00FFFF]/20 rounded-full blur-sm" />
            <div className="absolute bottom-10 right-10 w-32 h-32 border-2 border-purple-500/20 rounded-full blur-sm" />
          </div>

          {/* Right Side - Form */}
          <div className="relative p-12 flex flex-col justify-center">
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="max-w-md w-full mx-auto">
              {/* Title */}
              <h2 className="text-3xl font-bold text-white mb-2">
                {isSignUp ? 'Create an account' : 'Welcome back'}
              </h2>
              <p className="text-gray-400 mb-8">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button 
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-[#00FFFF] hover:underline"
                >
                  {isSignUp ? 'Log In' : 'Sign Up'}
                </button>
              </p>

              {/* Form */}
              <form className="space-y-5">
                {/* Name Field - Only for Sign Up */}
                {isSignUp && (
                  <div>
                    <label className="block text-gray-300 text-sm mb-2">Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter your name"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FFFF]/50 focus:bg-white/10 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Email Field */}
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FFFF]/50 focus:bg-white/10 transition-all"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-11 pr-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FFFF]/50 focus:bg-white/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                {!isSignUp && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#00FFFF] focus:ring-[#00FFFF]/50"
                      />
                      <span className="text-gray-400 text-sm">Remember me</span>
                    </label>
                    <button type="button" className="text-[#00FFFF] text-sm hover:underline">
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#00FFFF] to-purple-500 text-black font-semibold py-3 rounded-lg hover:shadow-[0_0_30px_rgba(0,255,255,0.5)] transition-all duration-300"
                >
                  {isSignUp ? 'Create account' : 'Sign In'}
                </button>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-[#050505] px-4 text-gray-400">Or continue with</span>
                  </div>
                </div>

                {/* Social Sign In Buttons */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-lg py-3 text-white hover:bg-white/10 transition-all"
                  >
                    <Chrome className="w-5 h-5" />
                    <span>Google</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-lg py-3 text-white hover:bg-white/10 transition-all"
                  >
                    <Apple className="w-5 h-5" />
                    <span>Apple</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
