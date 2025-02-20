"use client"

import Spline from '@splinetool/react-spline/next';

export default function DashboardBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Spline
        scene="https://prod.spline.design/xUUjAFVfSxeg2fVu/scene.splinecode"
        className="w-full h-full"
      />
    </div>
  );
} 