
import React, { useState, useEffect, useMemo } from 'react';
import { GameScreen, WordData, LeaderboardEntry, GameHistory, ASSETS } from './types';
import { supabaseService } from './services/supabaseService';
import { geminiService, THEME_BACKGROUNDS } from './services/geminiService';
import { GameCanvas } from './components/GameCanvas';
import { WorldMap } from './components/WorldMap';
import { playSound } from './utils/audio';

function App() {
  const [screen, setScreen] = useState<GameScreen>(GameScreen.MAIN);
  const [nickname, setNickname] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<GameHistory[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [currentWord, setCurrentWord] = useState<WordData | null>(null);
  const [currentTheme, setCurrentTheme] = useState<string>('forest');
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  
  const [currentBgUrl, setCurrentBgUrl] = useState<string>(THEME_BACKGROUNDS.main);
  const [collectedLetters, setCollectedLetters] = useState<string[]>([]);
  const [completedWords, setCompletedWords] = useState<string[]>([]);
  const [lives, setLives] = useState(3);
  
  const [wordCompletionCount, setWordCompletionCount] = useState(0);
  const [completionPopup, setCompletionPopup] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [worldProgress, setWorldProgress] = useState<Record<string, number>>({
      '기본': 0, '동물': 0, '식물': 0, '생활': 0
  });
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [isBossLevel, setIsBossLevel] = useState(false);
  const [isBonusLevel, setIsBonusLevel] = useState(false);

  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const isLandscape = windowSize.width > windowSize.height;
  const isPC = windowSize.width >= 1024;
  const isTablet = windowSize.width >= 768 && windowSize.width < 1024;
  const isMobile = windowSize.width < 768;

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const savedName = localStorage.getItem('hangul_hero_nickname');
    if (savedName) {
      setNickname(savedName);
      setIsLoggedIn(true);
      geminiService.preloadFallbackImages();
      loadUserData(savedName);
    }
    supabaseService.getLeaderboard().then(setLeaderboard);
  }, []);

  const loadUserData = async (name: string) => {
      const hist = await supabaseService.getGameHistory(name);
      setHistory(hist);
  };

  const personalBest = useMemo(() => {
      if (history.length === 0) return 0;
      return history.reduce((max, entry) => entry.score > max ? entry.score : max, 0);
  }, [history]);

  const handleLogin = (name: string) => {
    if (!name.trim()) return alert("이름을 입력해주세요!");
    setNickname(name);
    setIsLoggedIn(true);
    localStorage.setItem('hangul_hero_nickname', name);
    geminiService.preloadFallbackImages();
    loadUserData(name);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setNickname('');
    localStorage.removeItem('hangul_hero_nickname');
  };

  const handleStartGame = () => {
    playSound('coin');
    setIsTransitioning(true);
    setTimeout(() => {
      setLives(3);
      setScreen(GameScreen.STAGE_SELECT);
      setIsTransitioning(false);
    }, 400);
  };

  const handleShowDashboard = async () => {
    const data = await supabaseService.getGameHistory(nickname);
    setHistory(data);
    setScreen(GameScreen.DASHBOARD);
  };

  const mapCategoryToTheme = (cat: string) => {
    switch(cat) {
        case '기본': return 'forest';
        case '동물': return 'zoo';
        case '식물': return 'mountain';
        case '생활': return 'city';
        default: return 'forest'; 
    }
  };

  const handleCategorySelect = (category: string) => {
      const theme = mapCategoryToTheme(category);
      const bg = geminiService.getBackground(theme);
      setSelectedCategory(category);
      setCurrentTheme(theme);
      setCurrentBgUrl(bg);
      setScreen(GameScreen.WORLD_MAP);
  };

  const handleLevelSelect = async (levelIndex: number, isBoss: boolean, isBonus: boolean) => {
    setCurrentLevelIndex(levelIndex);
    setIsBossLevel(isBoss);
    setIsBonusLevel(isBonus);
    setScreen(GameScreen.LOADING_GACHA);
    if (lives <= 0) setLives(3);
    
    try {
      const wordData = await geminiService.generateWord(selectedCategory, completedWords);
      if (isBoss) wordData.hint = `[쿠파의 도전] 쿠파를 5번 밟아서 물리치세요!`;
      else if (isBonus) {
          wordData.hint = "보너스 스테이지! 코인을 많이 모으세요!";
          wordData.word = "보너스";
          wordData.syllables = [];
      }
      setCurrentWord(wordData);
      setCollectedLetters([]);
      setWordCompletionCount(0);
      setCompletionPopup(null);
      setTimeout(() => setScreen(GameScreen.PLAYING), 800);
    } catch (e) {
      setCurrentWord({ word: "가", syllables: ["ㄱ", "ㅏ"], hint: "ㄱ + ㅏ = ?", category: "기본" });
      setScreen(GameScreen.PLAYING);
    }
  };

  const handleCollect = (char: string) => {
    const newCollected = [...collectedLetters, char];
    setCollectedLetters(newCollected);
    if (currentWord && !isBonusLevel) {
        const targetSyllables = currentWord.syllables;
        if (targetSyllables.length > 0) {
            const requiredCounts: Record<string, number> = {};
            targetSyllables.forEach(s => requiredCounts[s] = (requiredCounts[s] || 0) + 1);
            const collectedCounts: Record<string, number> = {};
            newCollected.forEach(s => collectedCounts[s] = (collectedCounts[s] || 0) + 1);
            let setsPossible = 999;
            for (const key of Object.keys(requiredCounts)) {
                const available = collectedCounts[key] || 0;
                const needed = requiredCounts[key];
                setsPossible = Math.min(setsPossible, Math.floor(available / needed));
            }
            if (setsPossible > wordCompletionCount) {
                setWordCompletionCount(setsPossible);
                const speedMult = gameSpeed === 2 ? 2 : 1;
                const comboMult = Math.min(3, setsPossible);
                const totalMult = comboMult * speedMult;
                const msg = setsPossible >= 2 
                    ? `단어 ${setsPossible}번 완성! 점수 x${totalMult}배! 🔥` 
                    : `단어 완성! ${speedMult > 1 ? '(2배속 보너스!)' : ''} 🎉`;
                setCompletionPopup(msg);
                setTimeout(() => setCompletionPopup(null), 1500);
            }
        }
    }
  };

  const handleGameOver = async (success: boolean, stats?: { timeLeft: number }) => {
    if (success && currentWord) {
      const comboMultiplier = Math.max(1, Math.min(3, wordCompletionCount));
      const speedMultiplier = gameSpeed === 2 ? 2 : 1;
      const stageClearBonus = 500 * comboMultiplier * speedMultiplier;
      const newTotalScore = score + stageClearBonus;
      setScore(newTotalScore);
      setCompletedWords(prev => [...prev, currentWord.word]);
      await supabaseService.saveGameRecord(nickname, newTotalScore, currentWord.word, selectedCategory);
      loadUserData(nickname);
      setWorldProgress(prev => {
          const currentMax = prev[selectedCategory] || 0;
          if (currentLevelIndex === currentMax) return { ...prev, [selectedCategory]: Math.min(currentMax + 1, 10) };
          return prev;
      });
      setScreen(GameScreen.SUCCESS);
    } else setScreen(GameScreen.GAME_OVER);
  };

  // Screen Styles
  const containerStyle = "h-[100dvh] w-full flex flex-col items-center p-4 font-['Jua'] overflow-y-auto overflow-x-hidden bg-cover bg-center transition-all duration-500 relative";
  const overlayStyle = "fixed inset-0 bg-white/20 backdrop-blur-[1px] z-0 pointer-events-none";

  if (screen === GameScreen.MAIN) {
    // PC Layout: Two column with menu on the side
    const mainContentClass = isPC
      ? "flex-row justify-center w-full max-w-7xl items-center gap-20 px-10"
      : isLandscape 
        ? "flex-row justify-between w-[95%] max-w-5xl items-center gap-10" 
        : "flex-col items-center justify-center min-h-full";
    
    const logoAreaClass = isPC ? "w-[50%] flex justify-center" : isLandscape ? "max-w-[40%]" : "max-w-[500px]";
    const panelWidth = isPC ? "w-[350px]" : isLandscape ? "w-[45%]" : "w-full max-w-lg";

    return (
      <div 
        className={`${containerStyle} ${isTransitioning ? 'opacity-0 scale-110' : 'opacity-100'}`}
        style={{ backgroundImage: `url(${THEME_BACKGROUNDS.start})` }}
      >
        <div className={overlayStyle}></div>
        <div className={`relative z-10 flex ${mainContentClass} py-8 h-full`}>
            <div className={`text-center relative flex justify-center shrink-0 ${logoAreaClass}`}>
                <img src="https://i.imgur.com/gnzM2cu.png" alt="제목" className="w-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)] animate-float" />
            </div>
            {!isLoggedIn ? (
                <div className={`${panelWidth} bg-white/95 p-8 rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-4 border-black text-center shrink-0 backdrop-blur-md`}>
                    <h2 className="text-2xl font-black mb-6 text-gray-800">모험을 시작해볼까요?</h2>
                    <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="이름을 입력하세요" className="w-full text-xl p-4 border-b-4 border-gray-300 mb-8 text-center focus:outline-none bg-gray-50 rounded-2xl" onKeyDown={(e) => e.key === 'Enter' && handleLogin(nickname)} />
                    <button onClick={() => handleLogin(nickname)} className="w-full bg-green-500 text-white text-2xl py-4 rounded-2xl border-b-8 border-green-700 active:translate-y-2 active:border-b-4 transition-all font-black shadow-xl">입장하기</button>
                </div>
            ) : (
                <div className={`${panelWidth} shrink-0`}>
                    <div className="bg-white/95 p-10 rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-4 border-black w-full text-center backdrop-blur-md">
                        <h2 className="text-3xl font-black mb-8 text-blue-600">반가워요, {nickname}!</h2>
                        <div className="flex flex-col gap-6 items-center">
                             <button onClick={handleStartGame} className="w-full hover:scale-105 transition-transform active:scale-95">
                                 <img src="https://i.imgur.com/zoj6g4o.png" alt="모험 시작" className="w-full drop-shadow-2xl" />
                             </button>
                             <div className="w-full space-y-3">
                                <button onClick={handleShowDashboard} className="w-full bg-yellow-400 text-black text-xl py-4 rounded-2xl border-4 border-black font-black shadow-[6px_6px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all">📒 나의 탐험 기록</button>
                                <button onClick={handleLogout} className="w-full bg-white text-gray-400 text-sm py-2 rounded-xl border-2 border-gray-200 font-bold hover:text-red-400 hover:border-red-200 transition-colors">로그아웃</button>
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    );
  }

  if (screen === GameScreen.DASHBOARD) {
      const gridCols = isPC ? 'grid-cols-3' : isLandscape ? 'grid-cols-2' : 'grid-cols-1';
      return (
        <div className="h-[100dvh] bg-yellow-100 flex flex-col items-center p-4 font-['Jua'] overflow-hidden">
            <div className={`w-full ${isPC ? 'max-w-6xl' : isLandscape ? 'max-w-4xl' : 'max-w-lg'} bg-white rounded-3xl border-4 border-black shadow-2xl overflow-hidden flex flex-col h-full max-h-[85vh] sm:max-h-[90vh]`}>
                <div className="bg-yellow-400 p-4 border-b-4 border-black flex items-center justify-between shrink-0">
                    <button onClick={() => setScreen(GameScreen.MAIN)} className="text-3xl hover:scale-125 transition-transform">🔙</button>
                    <h2 className="text-2xl sm:text-3xl font-black">📒 {nickname}의 탐험 도감</h2>
                    <div className="w-8"></div>
                </div>
                <div className={`flex-1 overflow-y-auto p-6 space-y-4 bg-white/50 grid ${gridCols} gap-4`}>
                    {history.length === 0 ? (
                        <div className="col-span-full text-center py-20 flex flex-col items-center gap-4">
                            <span className="text-8xl grayscale">🏜️</span>
                            <div className="text-gray-400 text-2xl font-black">아직 발견한 단어가 없어요!</div>
                        </div>
                    ) : history.map((record) => (
                        <div key={record.id} className="bg-blue-50 p-5 rounded-3xl border-4 border-blue-200 flex justify-between items-center shadow-md transform hover:-rotate-1 transition-all h-fit group">
                            <div>
                                <span className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full font-bold group-hover:bg-blue-600">{record.category}</span>
                                <div className="text-3xl font-black text-gray-800 mt-2">{record.word}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-orange-500 font-black text-2xl">+{record.score}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      );
  }

  if (screen === GameScreen.STAGE_SELECT) {
    // PC Layout for Stage Selection: Vertical Menu Sidebar
    const isPCLayout = isPC;
    const selectContentClass = isPCLayout 
        ? "flex-row justify-center w-full max-w-7xl gap-12"
        : "flex-col items-center";
    
    const sidebarWidth = isPCLayout ? "w-[400px]" : "w-full max-w-lg";
    const previewAreaClass = isPCLayout ? "flex-1 block" : "hidden";

    return (
      <div className="h-[100dvh] bg-cover bg-center relative font-['Jua'] overflow-hidden" style={{ backgroundImage: `url(${THEME_BACKGROUNDS.main})` }}>
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-0 pointer-events-none"></div>
        <div className="absolute inset-0 z-10 overflow-y-auto overflow-x-hidden scrollbar-hide">
            <div className={`w-full min-h-full flex ${selectContentClass} py-12 px-8`}>
                
                {/* Left Sidebar Menu (PC) or Main Vertical Stack (Mobile) */}
                <div className={`${sidebarWidth} flex flex-col space-y-6`}>
                    <div className="bg-white px-10 py-5 border-4 border-black rounded-[30px] shadow-2xl animate-bounce self-center sm:self-start">
                        <span className="text-2xl text-black font-black tracking-tighter">🍄 {nickname} 탐험가</span>
                    </div>
                    
                    <div className="bg-white/95 p-2 rounded-2xl border-4 border-black shadow-xl flex gap-2 w-full backdrop-blur-sm">
                        <button onClick={() => setGameSpeed(1)} className={`flex-1 py-3 rounded-xl font-black text-xl transition-all ${gameSpeed === 1 ? 'bg-green-500 text-white scale-105 shadow-inner' : 'bg-gray-100 text-gray-400'}`}>🐢 1배속</button>
                        <button onClick={() => setGameSpeed(2)} className={`flex-1 py-3 rounded-xl font-black text-xl transition-all ${gameSpeed === 2 ? 'bg-red-500 text-white scale-105 shadow-inner' : 'bg-gray-100 text-gray-400'}`}>🐇 2배속</button>
                    </div>

                    <div className="w-full bg-black/60 backdrop-blur-lg rounded-[30px] p-6 border-4 border-white/20 flex justify-between items-center text-white shadow-2xl">
                         <div className="flex flex-col"><span className="text-sm font-bold opacity-70 uppercase tracking-widest">Personal Best</span><span className="text-4xl font-black text-yellow-300">{personalBest.toLocaleString()}</span></div>
                         <div className="text-5xl">🏆</div>
                    </div>

                    <div className="w-full space-y-4">
                        <PixelBlockButton color="yellow" imgSrc={ASSETS.player.jump} label="기본 한글" subLabel="자음과 모음의 기초!" onClick={() => handleCategorySelect('기본')} landscape={isLandscape} />
                        <PixelBlockButton color="red" imgSrc={ASSETS.enemies[0]} label="동물 단어" subLabel="사자, 호랑이 친구들!" onClick={() => handleCategorySelect('동물')} landscape={isLandscape} />
                        <PixelBlockButton color="green" imgSrc={ASSETS.enemies[2]} label="식물 단어" subLabel="나무와 꽃을 찾아서!" onClick={() => handleCategorySelect('식물')} landscape={isLandscape} />
                        <PixelBlockButton color="blue" imgSrc={ASSETS.ui.bossKoopa} label="생활 단어" subLabel="우리 집 주변에는 무엇이?" onClick={() => handleCategorySelect('생활')} landscape={isLandscape} />
                    </div>

                    <div className="mt-8 flex gap-4 w-full max-w-xs self-center">
                        <button onClick={() => setScreen(GameScreen.MAIN)} className="flex-1 bg-red-500 text-white px-8 py-4 rounded-full border-4 border-white/80 font-black text-2xl shadow-xl active:scale-95 transition-all">🏠 메인화면</button>
                    </div>
                </div>

                {/* Right Preview Area (PC Exclusive) */}
                <div className={`${previewAreaClass} flex flex-col justify-center items-center`}>
                    <div className="bg-white/80 backdrop-blur-md p-12 rounded-[50px] border-8 border-white/40 shadow-2xl max-w-2xl transform rotate-1">
                        <div className="text-center">
                            <h3 className="text-4xl font-black text-gray-800 mb-6">월드를 선택하세요!</h3>
                            <div className="relative group cursor-pointer">
                                <img src={ASSETS.player.walk1} alt="Preview" className="w-48 mx-auto animate-float drop-shadow-2xl" />
                                <div className="mt-8 text-xl font-bold text-gray-600">선택한 단어 카테고리로<br/>흥미진진한 모험이 펼쳐집니다!</div>
                            </div>
                        </div>
                    </div>
                    {/* PC Extra Decoration */}
                    <div className="mt-12 flex gap-10 opacity-30">
                        <img src={ASSETS.blocks.yellow} className="w-16 h-16 pixel-art" />
                        <img src={ASSETS.items.mushroom} className="w-16 h-16 pixel-art" />
                        <img src={ASSETS.blocks.red} className="w-16 h-16 pixel-art" />
                    </div>
                </div>

            </div>
        </div>
      </div>
    );
  }

  if (screen === GameScreen.WORLD_MAP) {
      return (
          <WorldMap category={selectedCategory} theme={currentTheme} backgroundImage={currentBgUrl} unlockedIndex={worldProgress[selectedCategory]} onSelectLevel={handleLevelSelect} onBack={() => setScreen(GameScreen.STAGE_SELECT)} />
      );
  }

  if (screen === GameScreen.LOADING_GACHA) {
      return (
          <div className="h-[100dvh] flex flex-col items-center justify-center text-white font-['Jua'] bg-cover bg-center overflow-hidden" style={{ backgroundImage: `url(${currentBgUrl})` }}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md"></div>
              <div className="relative z-10 flex flex-col items-center text-center px-4">
                  <h2 className="text-4xl sm:text-5xl font-black mb-6 drop-shadow-lg">{selectedCategory} 월드 진입 중...</h2>
                  <div className="w-full max-w-sm h-10 border-4 border-white rounded-full overflow-hidden relative shadow-2xl">
                      <div className="absolute top-0 left-0 h-full bg-yellow-400 animate-[width_2s_ease-in-out_infinite]" style={{width: '60%'}}></div>
                  </div>
                  <div className="mt-8 text-2xl sm:text-3xl animate-pulse text-yellow-300 font-bold">탐험 장비를 챙기고 있습니다!</div>
              </div>
          </div>
      )
  }

  if (screen === GameScreen.PLAYING && currentWord) {
    const hudPaddingTop = isLandscape ? 'pt-2' : 'pt-4';
    return (
      <div className="relative w-full h-[100dvh] bg-black overflow-hidden font-['Jua']">
        {completionPopup && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
                 <div className="absolute inset-0 bg-black/50 backdrop-blur-[4px]"></div>
                 <div className="relative text-5xl sm:text-8xl font-black text-yellow-300 drop-shadow-2xl text-center px-8 animate-bounce tracking-tighter">{completionPopup}</div>
            </div>
        )}
        <div className={`absolute top-0 left-0 w-full z-40 flex justify-between items-start px-4 ${hudPaddingTop} pb-20 text-white bg-gradient-to-b from-black/80 to-transparent pointer-events-none`}>
             <div className="flex flex-col gap-1">
                 <span className={`font-bold text-yellow-400 uppercase tracking-widest opacity-80 ${isLandscape ? 'text-xs sm:text-sm' : 'text-sm sm:text-xl'}`}>Explorer</span>
                 <div className={`${isLandscape ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-4xl'} font-black drop-shadow-lg flex items-center gap-2`}>❤️ x {lives}</div>
             </div>
             <div className="flex flex-col items-center flex-1 mx-2">
                <div className={`flex gap-2 origin-top mt-1 ${isLandscape ? 'transform scale-75 sm:scale-100' : 'transform scale-90 sm:scale-125'}`}>
                    {isBonusLevel ? <div className="text-3xl font-black text-pink-400 animate-pulse">BONUS</div> : isBossLevel ? <div className="text-2xl font-black text-red-500 animate-pulse">🔥 BOSS 🔥</div> : (
                        <div className="flex gap-1 bg-white/10 p-2 rounded-2xl backdrop-blur-md border-2 border-white/20">
                            {currentWord.syllables.map((s, i) => (
                                <div key={i} className={`flex items-center justify-center rounded-xl border-4 shadow-md text-2xl font-black transition-all ${isLandscape ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-10 h-10'} ${collectedLetters.includes(s) ? 'bg-yellow-400 border-yellow-600 text-black scale-110' : 'bg-gray-800/80 border-gray-600 text-white/30'}`}>{collectedLetters.includes(s) ? s : '?'}</div>
                            ))}
                        </div>
                    )}
                </div>
             </div>
             <div className="text-right flex flex-col gap-1">
                 <div className={`font-bold opacity-80 text-blue-300 tracking-widest uppercase ${isLandscape ? 'text-xs sm:text-sm' : 'text-sm sm:text-xl'}`}>Score</div>
                 <div className={`${isLandscape ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-4xl'} font-black text-yellow-300 drop-shadow-lg`}>{score.toString().padStart(6, '0')}</div>
             </div>
        </div>
        <div className="absolute inset-0 z-10">
             <GameCanvas wordData={currentWord} theme={currentTheme} backgroundImage={currentBgUrl} isBossLevel={isBossLevel} isBonusLevel={isBonusLevel} gameSpeed={gameSpeed} initialLives={lives} onGameOver={handleGameOver} onUpdateScore={(pts) => setScore(prev => prev + pts)} onCollect={handleCollect} onLivesChange={setLives} goHome={() => setScreen(GameScreen.WORLD_MAP)} />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-[100dvh] flex flex-col items-center justify-center p-6 font-['Jua'] overflow-hidden bg-black text-white`}>
        <div className="absolute inset-0 bg-cover bg-center opacity-40 grayscale" style={{ backgroundImage: `url(${currentBgUrl})` }} />
        <div className="relative z-10 w-full max-w-md flex flex-col items-center">
            {screen === GameScreen.SUCCESS ? (
                <div className="animate-bounce text-center mb-6">
                    <h1 className="text-5xl sm:text-7xl text-yellow-400 font-black drop-shadow-[0_8px_0_rgba(0,0,0,1)] tracking-tighter">STAGE CLEAR!</h1>
                    <div className="text-2xl mt-2 font-black text-white">축하합니다! 대단해요!</div>
                </div>
            ) : (
                <div className="text-center mb-6">
                    <h1 className="text-5xl sm:text-7xl text-red-500 font-black drop-shadow-[0_8px_0_rgba(0,0,0,1)] tracking-tighter">GAME OVER</h1>
                    <div className="text-2xl mt-2 font-black text-white">포기하지 마세요! 다시 해봐요!</div>
                </div>
            )}
            
            <div className={`bg-white/95 text-black ${isLandscape ? 'p-4' : 'p-8'} rounded-[30px] mb-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)] border-8 border-black w-full transform -rotate-1 backdrop-blur-md`}>
                {screen === GameScreen.SUCCESS ? (
                    <>
                        <div className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Success Word</div>
                        <div className="text-5xl sm:text-6xl font-black mb-4 text-gray-900">{currentWord?.word}</div>
                        <div className="flex justify-between items-center bg-gray-100 p-3 rounded-2xl border-4 border-gray-200">
                            <span className="text-lg font-bold text-gray-500">Total Score</span>
                            <span className="text-2xl font-black text-orange-500">{score.toLocaleString()}</span>
                        </div>
                    </>
                ) : (
                    <div className="py-2">
                        <span className="text-6xl">🍄</span>
                        <p className="text-xl font-black mt-2 text-gray-600">버섯을 먹고 다시 시작해요!</p>
                    </div>
                )}
            </div>
            
            <button onClick={() => setScreen(GameScreen.WORLD_MAP)} className={`w-full max-w-xs py-4 rounded-full text-2xl font-black shadow-[0_6px_0_rgba(0,0,0,0.5)] border-4 border-black active:translate-y-2 active:shadow-none transition-all ${screen === GameScreen.SUCCESS ? 'bg-blue-500 hover:bg-blue-400' : 'bg-yellow-400 text-black hover:bg-yellow-300'}`}>
                {screen === GameScreen.SUCCESS ? "다음 모험! 🚀" : "다시 도전 ↺"}
            </button>
            <button onClick={() => setScreen(GameScreen.STAGE_SELECT)} className="mt-4 text-white/60 underline font-bold hover:text-white transition-colors">월드 맵으로 돌아가기</button>
        </div>
    </div>
  );
}

const PixelBlockButton = ({ color, imgSrc, label, subLabel, onClick, landscape }: { color: 'yellow' | 'red' | 'green' | 'blue', imgSrc: string, label: string, subLabel: string, onClick: () => void, landscape: boolean }) => {
    const colors = {
        yellow: { bg: 'bg-[#FFD700]', border: 'border-[#B8860B]' },
        red: { bg: 'bg-[#FF4444]', border: 'border-[#CC0000]' },
        green: { bg: 'bg-[#4CAF50]', border: 'border-[#2E7D32]' },
        blue: { bg: 'bg-[#42A5F5]', border: 'border-[#1565C0]' },
    };
    const c = colors[color];
    const iconSize = landscape ? "w-12 h-12" : "w-16 h-16 sm:w-20 sm:h-20";
    const labelSize = landscape ? "text-xl" : "text-2xl sm:text-3xl";
    const subLabelSize = landscape ? "text-[10px]" : "text-xs sm:text-sm";

    return (
        <button onClick={onClick} className={`w-full relative ${c.bg} border-4 ${c.border} rounded-2xl shadow-[0_6px_0_rgba(0,0,0,0.3)] active:translate-y-[4px] active:shadow-none flex items-center p-3 sm:p-4 gap-3 transition-all hover:brightness-105 hover:scale-[1.02]`}>
            <div className={`${iconSize} bg-black/20 rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-inner`}>
                <img src={imgSrc} alt={label} className="w-full h-full object-contain p-2" />
            </div>
            <div className="flex flex-col items-start text-white text-left overflow-hidden">
                <span className={`${labelSize} font-black tracking-tight leading-none mb-1`}>{label}</span>
                <span className={`${subLabelSize} font-bold opacity-80 truncate w-full`}>{subLabel}</span>
            </div>
            <div className="ml-auto text-2xl opacity-50 font-black">▶</div>
        </button>
    );
};

export default App;
