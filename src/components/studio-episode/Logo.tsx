
import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'full' | 'mark';
  is3D?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = "", 
  size = 40, 
  variant = 'mark',
  is3D = false 
}) => {
  // ViewBox for the 'ep' logo
  const viewBox = "0 0 120 80";
  
  // Unique ID for gradient to avoid conflicts if multiple logos rendered
  const gradId = React.useId(); 

  // Paths for the 'ep' logo
  const pathE = (
    <path d="M35 30H15C15 41.0457 23.9543 50 35 50C40.5228 50 45.5228 47.7614 49.1421 44.1421L42.0711 37.0711C40.1962 38.9459 37.7157 40 35 40C29.4772 40 25 35.5228 25 30C25 24.4772 29.4772 20 35 20C37.7157 20 40.1962 21.0541 42.0711 22.9289L49.1421 15.8579C45.5228 12.2386 40.5228 10 35 10C23.9543 10 15 18.9543 15 30Z" />
  );
  
  const pathECut = (
     <path d="M35 30H45V28C45 27.33 44.96 26.67 44.89 26.02C44.2 21.4 40.5 18.5 35 18.5V30Z" fillOpacity="0.5"/>
  );

  const pathP = (
    <>
      <path d="M65 30C65 41.0457 73.9543 50 85 50C96.0457 50 105 41.0457 105 30C105 18.9543 96.0457 10 85 10C73.9543 10 65 18.9543 65 30ZM75 30C75 24.4772 79.4772 20 85 20C90.5228 20 95 24.4772 95 30C95 35.5228 90.5228 40 85 40C79.4772 40 75 35.5228 75 30Z" />
      <path d="M65 30H55V65H65V30Z" />
    </>
  );

  // Render standard 2D Logo (Flat Brand Color)
  if (!is3D) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="relative flex-shrink-0 text-episode-500" style={{ width: size, height: size * 0.66 }}>
          <svg width="100%" height="100%" viewBox={viewBox} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            {pathE}
            {pathECut}
            {pathP}
          </svg>
        </div>
        {variant === 'full' && (
           <div className="flex flex-col justify-center">
               <h1 className="font-bold text-2xl leading-none tracking-tight text-white">episode</h1>
           </div>
        )}
      </div>
    );
  }

  // --- 3D Implementation (Glossy Black/Obsidian) ---
  
  // Layers for extrusion. 
  // We use dark grays to blacks to simulate a dark glossy material.
  const layers = [
    // Front face uses a gradient fill (defined below) + stroke for bevel highlight
    { z: '0px',  color: 'url(#glossGradient-' + gradId + ')', stroke: 'rgba(255,255,255,0.4)' }, 
    { z: '-1px', color: '#2a2a2a' },
    { z: '-2px', color: '#222222' },
    { z: '-3px', color: '#1a1a1a' },
    { z: '-4px', color: '#151515' },
    { z: '-5px', color: '#111111' },
    { z: '-6px', color: '#0d0d0d' },
    { z: '-7px', color: '#0a0a0a' },
    { z: '-8px', color: '#050505' },
    { z: '-9px', color: '#000000' },
    { z: '-10px', color: '#000000' }, // Back face
  ];

  return (
    <div className={`flex items-center gap-6 ${className}`}>
      <style>
        {`
          @keyframes float3d {
            0% { transform: rotateX(5deg) rotateY(-10deg) translateY(0px); }
            50% { transform: rotateX(-2deg) rotateY(10deg) translateY(-10px); }
            100% { transform: rotateX(5deg) rotateY(-10deg) translateY(0px); }
          }
          .logo-3d-wrapper {
            perspective: 1000px;
            transform-style: preserve-3d;
          }
          .logo-3d-inner {
            position: relative;
            width: 100%;
            height: 100%;
            transform-style: preserve-3d;
            animation: float3d 8s ease-in-out infinite;
          }
          .logo-layer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            backface-visibility: hidden;
          }
        `}
      </style>
      
      <div 
        className="logo-3d-wrapper" 
        style={{ width: size, height: size * 0.66 }}
      >
        <div className="logo-3d-inner">
          {layers.map((layer, i) => (
            <div 
              key={i} 
              className="logo-layer"
              style={{ 
                transform: `translateZ(${layer.z})`,
                // Apply color to fill, or if it's the gradient (layer 0), handled by SVG props
              }}
            >
              <svg 
                width="100%" 
                height="100%" 
                viewBox={viewBox} 
                xmlns="http://www.w3.org/2000/svg" 
                style={{ 
                    overflow: 'visible',
                    // Strong drop shadow on the first layer to cast shadow on the "background" 
                    // and also some glow to separate the black logo from dark backgrounds
                    filter: i === 0 ? 'drop-shadow(0 20px 30px rgba(0,0,0,0.8)) drop-shadow(0 0 15px rgba(255, 77, 34, 0.15))' : 'none' 
                }}
              >
                <defs>
                  <linearGradient id={`glossGradient-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#555555" />
                    <stop offset="40%" stopColor="#222222" />
                    <stop offset="100%" stopColor="#000000" />
                  </linearGradient>
                </defs>

                <g 
                  fill={i === 0 ? `url(#glossGradient-${gradId})` : layer.color}
                  stroke={i === 0 ? layer.stroke : 'none'}
                  strokeWidth={i === 0 ? 1.5 : 0}
                >
                    {pathE}
                    {pathECut}
                    {pathP}
                </g>
                
                {/* Add a "shine" highlight overlay on top layer only */}
                {i === 0 && (
                    <g fill="url(#glossHighlight)" style={{ mixBlendMode: 'overlay', opacity: 0.3 }}>
                         {/* Reuse paths for highlight effect if needed, or just let gradient do work */}
                    </g>
                )}
              </svg>
            </div>
          ))}
        </div>
      </div>

      {variant === 'full' && (
         <div className="flex flex-col justify-center">
             <h1 className="font-bold text-2xl leading-none tracking-tight text-white drop-shadow-2xl">episode</h1>
         </div>
      )}
    </div>
  );
};

export default Logo;
