import React from "react";

interface LaserScannerOverlayProps {
  scanning: boolean;
}

export const LaserScannerOverlay: React.FC<LaserScannerOverlayProps> = ({ scanning }) => {
  if (!scanning) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-10">
      <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-laser-scan opacity-90" />
    </div>
  );
};

export default LaserScannerOverlay;
