
import React, { useState, useEffect } from 'react';
import { ASSETS } from '../types';

interface WorldMapProps {
  category: string;
  theme: string;
  backgroundImage: string; 
  unlockedIndex: number;
  onSelectLevel: (levelIndex: number, isBoss: boolean, isBonus: boolean) => void;
  onBack: () => void;
}

const TOTAL_STAGES = 10; 

export const WorldMap: React.FC<WorldMapProps> = ({ 
    category, 
    theme, 
    backgroundImage, 
    unlockedIndex, 
    onSelectLevel, 
    onBack 
}) => {
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const isLandscape = windowSize.width > windowSize.height;

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Board Game Layout Coordinates (Relative percentages)
  const nodes = [
    { id: 0, x: 15, y: 80, isBoss: false, isBonus: false },  // Start
    { id: 1, x: 35, y: 75, isBoss: false, isBonus: false },  
    { id: 2, x: 55, y: 80, isBoss: false, isBonus: false },  
    { id: 3, x: 75, y: 75, isBoss: false, isBonus: true },   // Bonus
    { id: 4, x: 85, y: 60, isBoss: false, isBonus: false },  
    { id: 5, x: 85, y: 40, isBoss: false, isBonus: false },  
    { id: 6, x: 75, y: 25, isBoss: false, isBonus: false },  
    { id: 7, x: 55, y: 20, isBoss: false, isBonus: true },   // Bonus
    { id: 8, x: 35, y: 25, isBoss: false, isBonus: false },  
    { id: 9, x: 15, y: 20, isBoss: true, isBonus: false },   // Boss
  ];

  const headerHeightClass = isLandscape ? "p-2 sm:p-4" : "p-4 sm:p-6";
  const footerHeightClass = isLandscape ? "h-14 sm:h-20" : "h-20 sm:h-24";

  return (
    <div className={`w-full h-[100dvh] relative overflow-hidden font-['Jua'] flex flex-col bg-black`}>
        {/* Background Image Layer */}
        <div 
            className="absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-300"
            style={{ 
                backgroundImage: `url(${backgroundImage})`,
            }}
        />
        
        {/* Overlay for better visibility */}
        <div className="absolute inset-0 bg-white/10 z-0 pointer-events-none backdrop-blur-[2px]" />

        {/* Header - Compact in landscape */}
        <div className={`absolute top-0 w-full ${headerHeightClass} flex justify-between items-start z-20`}>
            <button onClick={onBack} className="hover:scale-110 transition-transform active:scale-95 drop-shadow-xl">
                <img src={ASSETS.ui.btnBack} alt="back" className={`${isLandscape ? 'w-12 h-12 sm:w-16 sm:h-16' : 'w-16 h-16 sm:w-20 sm:h-20'} object-contain`} />
            </button>
            <div className="bg-white/95 text-black px-6 py-2 sm:px-10 sm:py-3 rounded-2xl border-4 border-black shadow-2xl transform rotate-[-0.5deg] backdrop-blur-md">
                <h1 className={`${isLandscape ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-5xl'} font-black tracking-tight`}>{category} 월드</h1>
            </div>
            <div className="w-12 sm:w-20"></div> 
        </div>

        {/* Map Area */}
        <div className="flex-1 relative w-full h-full z-10 max-w-[1200px] mx-auto overflow-hidden">
            
            {/* Draw Paths (SVG Lines) */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 filter drop-shadow-lg opacity-60">
                {nodes.map((node, i) => {
                    if (i === nodes.length - 1) return null;
                    const next = nodes[i + 1];
                    const isUnlocked = i < unlockedIndex;
                    return (
                        <line 
                            key={`path-${i}`}
                            x1={`${node.x}%`} y1={`${node.y}%`}
                            x2={`${next.x}%`} y2={`${next.y}%`}
                            stroke={isUnlocked ? "white" : "#333"}
                            strokeWidth={isLandscape ? "8" : "12"}
                            strokeLinecap="round"
                            className="transition-all duration-500"
                        />
                    );
                })}
            </svg>

            {/* Draw Nodes */}
            {nodes.map((node, i) => {
                const isUnlocked = i <= unlockedIndex;
                const isCleared = i < unlockedIndex;
                const isCurrent = i === unlockedIndex;
                
                let bgColor = isUnlocked ? 'bg-yellow-400' : 'bg-gray-400';
                let borderColor = isUnlocked ? 'border-black' : 'border-gray-600';
                
                if (node.isBonus && isUnlocked) bgColor = 'bg-pink-400';
                if (node.isBoss && isUnlocked) bgColor = 'bg-red-500';

                // Node Size adjustment for landscape
                const nodeSizeClass = node.isBoss 
                    ? (isLandscape ? 'w-20 h-20 sm:w-28 sm:h-28' : 'w-24 h-24 sm:w-32 sm:h-32')
                    : (isLandscape ? 'w-12 h-12 sm:w-18 sm:h-18' : 'w-16 h-16 sm:w-24 sm:h-24');

                return (
                    <div 
                        key={node.id}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 z-10"
                        style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    >
                        <button
                            disabled={!isUnlocked}
                            onClick={() => onSelectLevel(i, node.isBoss, node.isBonus)}
                            className={`
                                relative group
                                ${nodeSizeClass}
                                flex items-center justify-center rounded-2xl border-4 
                                shadow-[0_6px_0_rgba(0,0,0,0.4)]
                                transition-transform
                                ${bgColor} ${borderColor}
                                ${isUnlocked ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'grayscale cursor-not-allowed'}
                                ${node.isBoss && isUnlocked ? 'animate-pulse' : ''}
                            `}
                        >
                            {/* Node Content */}
                            {node.isBoss ? (
                                <img src={ASSETS.ui.bossKoopa} alt="Boss" className="w-full h-full object-contain p-2" />
                            ) : node.isBonus ? (
                                <span className={`${isLandscape ? 'text-2xl sm:text-4xl' : 'text-3xl sm:text-5xl'}`}>🎁</span>
                            ) : (
                                <span className={`${isLandscape ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-4xl'} font-black ${isUnlocked ? 'text-black' : 'text-gray-600'}`}>
                                    {i + 1}
                                </span>
                            )}

                            {/* Mario Avatar for Current Level */}
                            {isCurrent && (
                                <div className={`absolute left-1/2 -translate-x-1/2 pointer-events-none ${isLandscape ? '-top-12 w-12 sm:w-20' : '-top-16 sm:-top-24 w-16 sm:w-24'}`}>
                                    <img 
                                        src={ASSETS.player.walk1} 
                                        alt="Player" 
                                        className="w-full animate-bounce drop-shadow-2xl"
                                    />
                                </div>
                            )}
                            
                            {/* Stars for Cleared */}
                            {isCleared && (
                                <div className={`absolute -right-2 -top-2 drop-shadow-lg z-20 ${isLandscape ? 'text-2xl sm:text-4xl' : 'text-3xl sm:text-5xl'}`}>⭐</div>
                            )}

                        </button>
                    </div>
                );
            })}
        </div>
        
        {/* Decor - Footer Info - Compact in landscape */}
        <div className={`${footerHeightClass} bg-[#5d4037] border-t-8 border-[#3e2723] relative w-full z-20 flex items-center justify-center shadow-2xl backdrop-blur-sm`}>
             <div className={`${isLandscape ? 'text-lg sm:text-2xl' : 'text-xl sm:text-3xl'} text-white font-black tracking-widest drop-shadow-md`}>
                 🏆 {unlockedIndex} / {TOTAL_STAGES} 스테이지 정복! 🏆
             </div>
        </div>
    </div>
  );
};
