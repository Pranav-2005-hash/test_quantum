import React from 'react';
import { Shield } from 'lucide-react';

export default function HeroSection() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background Effect */}
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[rgba(0,229,255,0.15)] via-[var(--color-navy)] to-[var(--color-navy)]"></div>
        <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTIwIDIwbDEwIDEwTTEwIDEwbDEwIDEwbTEwLTEwbC0xMCAxMGwtMTAgMTB2LTIwaDIweiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+Cjwvc3ZnPg==')]"></div>
      </div>

      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto mt-20">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-black/30 rounded-full border border-[rgba(0,229,255,0.3)] glow-cyan">
            <Shield className="w-16 h-16 text-[#00e5ff]" />
          </div>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 mt-4">
          <span className="text-white">Quantum</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] to-[#7c3aed] animate-glitch inline-block ml-1">Shield</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-400 mb-10 max-w-3xl mx-auto font-light">
          AI-Powered Post-Quantum Document Security — <br className="hidden md:block"/>
          <span className="text-white font-medium">Harvest Now, Decrypt Never.</span>
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <button 
            onClick={() => scrollTo('nlp-classifier')}
            className="px-8 py-4 rounded-md bg-[#00e5ff] text-black font-semibold text-lg hover:bg-white transition-all glow-cyan hover:scale-105"
          >
            Try the Simulator
          </button>
          
          <button 
            onClick={() => scrollTo('pipeline')}
            className="px-8 py-4 rounded-md bg-transparent border border-gray-600 text-white font-semibold text-lg hover:border-[#7c3aed] hover:text-[#7c3aed] transition-all hover:glow-purple hover:scale-105"
          >
            View Pipeline
          </button>
        </div>
      </div>
    </div>
  );
}
