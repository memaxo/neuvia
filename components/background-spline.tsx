"use client"

import Spline from '@splinetool/react-spline/next';

export default function BackgroundSpline() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Spline
        scene="https://prod.spline.design/Y6XgUDfF8whAr82F/scene.splinecode"
        className="w-full h-full"
      />
    </div>
  );
} 