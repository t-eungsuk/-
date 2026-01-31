
import React, { useState, useEffect, useCallback } from 'react';
import { GameScreen, WordData, LeaderboardEntry, GameHistory, ASSETS } from './types';
import { supabaseService } from './services/supabaseService';
import { geminiService, THEME_BACKGROUNDS } from './services/geminiService';
import { GameCanvas } from './components/GameCanvas';
import { WorldMap } from './components/WorldMap';
import { playSound } from './utils/audio';

function App() {
  // --- 상태 관리 ---
  const [screen, setScreen] = useState<GameScreen>(GameScreen.MAIN);
  const [nickname, setNickname] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [currentWord, setCurrentWord] = useState<WordData | null>(null);
  const [currentTheme, setCurrentTheme] = useState<string>('forest');
  const [currentBgUrl, setCurrentBgUrl] = useState<string>(THEME_BACKGROUNDS.main);
  const [lives, setLives] = useState(3);

  // 난이도 상태 추가
  const [difficulty, setDifficulty] = useState<'easy' | 'hard'>('easy');

  const [worldProgress, setWorldProgress] = useState<Record<string, number>>({
      '기본': 0, '동물': 0, '식물': 0, '생활': 0
  });
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [isBossLevel, setIsBossLevel] = useState(false);
  const [isBonusLevel, setIsBonusLevel] = useState(false);

  // --- 초기화 및 데이터 로드 ---
  useEffect(() => {
    const savedName = localStorage.getItem('hangul_hero_nickname');
    if (savedName) {
      setNickname(savedName);
      setIsLoggedIn(true);
      loadUserData(savedName);
    }
  }, []);

  const loadUserData = async (name: string) => {
    if (!name) return;
    setIsHistoryLoading(true);
    try {
      const hist = await supabaseService.getGameHistory(name);
      setHistory(hist);
    } catch (e) {
      console.error("데이터 로드 실패", e);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // --- 핸들러 함수 ---
  const handleLogin = (name: string) => {
    if (!name.trim()) return alert("이름을 입력해주세요!");
    setNickname(name);
    setIsLoggedIn(true);
    localStorage.setItem('hangul_hero_nickname', name);
    loadUserData(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('hangul_hero_nickname');
    setNickname('');
    setIsLoggedIn(false);
    setScore(0);
    setScreen(GameScreen.MAIN);
  };

  const handleCategorySelect = (category: string) => {
    playSound('coin');
    const theme = category === '기본' ? 'forest' : category === '동물' ? 'zoo' : category === '식물' ? 'mountain' : 'city';
    setSelectedCategory(category);
    setCurrentTheme(theme);
    setCurrentBgUrl(geminiService.getBackground(theme));
    setScreen(GameScreen.WORLD_MAP);
  };

  const handleLevelSelect = async (levelIndex: number, isBoss: boolean, isBonus: boolean) => {
    setCurrentLevelIndex(levelIndex);
    setIsBossLevel(isBoss);
    setIsBonusLevel(isBonus);
    setScreen(GameScreen.LOADING_GACHA);
    
    try {
      const wordData = await geminiService.generateWord(selectedCategory, []);
      if (isBoss) wordData.hint = `[쿠파의 도전] 쿠파를 물리치고 단어를 완성해!`;
      setCurrentWord(wordData);
      setTimeout(() => setScreen(GameScreen.PLAYING), 800);
    } catch (e) {
      setCurrentWord({ word: "가", syllables: ["ㄱ", "ㅏ"], hint: "기본 글자 '가'", category: "기본" });
      setScreen(GameScreen.PLAYING);
    }
  };

  const handleGameOver = async (success: boolean) => {
    if (success && currentWord) {
      // 하드모드일 경우 클리어 보너스도 2배
      const baseBonus = 500;
      const difficultyMultiplier = difficulty === 'hard' ? 2 : 1;
      const finalBonus = baseBonus * difficultyMultiplier;

      setScore(s => s + finalBonus);
      await supabaseService.saveGameRecord(nickname, score + finalBonus, currentWord.word, selectedCategory);
      
      setWorldProgress(prev => {
        const currentMax = prev[selectedCategory] || 0;
        if (currentLevelIndex === currentMax) return { ...prev, [selectedCategory]: Math.min(currentMax + 1, 9) };
        return prev;
      });
      setScreen(GameScreen.SUCCESS);
    } else {
      setScreen(GameScreen.GAME_OVER);
    }
  };

  // --- 화면 렌더링 로직 ---
  const renderContent = () => {
    switch (screen) {
      case GameScreen.MAIN:
        return (
          <div className="h-full w-full flex flex-col items-center justify-center p-4 bg-cover bg-center" style={{ backgroundImage: `url(${THEME_BACKGROUNDS.start})` }}>
            <div className="flex flex-col items-center z-10 bg-white/30 backdrop-blur-md p-6 sm:p-10 rounded-[40px] border-4 border-white/50 shadow-2xl max-w-[90%] w-full sm:w-auto">
              <img src="https://i.imgur.com/gnzM2cu.png" alt="Logo" className="w-full max-w-sm animate-float mb-6" />
              
              {!isLoggedIn ? (
                <div className="bg-white p-6 rounded-[30px] border-4 border-black shadow-xl w-full max-w-xs animate-in zoom-in duration-300">
                  <h2 className="text-xl font-black mb-4 text-center text-blue-600">이름을 알려줘!</h2>
                  <input 
                    type="text" 
                    value={nickname} 
                    onChange={(e) => setNickname(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin(nickname)}
                    placeholder="여기에 적어주세요" 
                    className="w-full text-lg p-3 border-b-4 border-gray-200 mb-6 text-center outline-none focus:border-blue-400" 
                  />
                  <button onClick={() => handleLogin(nickname)} className="w-full bg-green-500 text-white text-xl py-3 rounded-2xl border-b-8 border-green-700 active:translate-y-1 active:border-b-4 font-black">시작하기!</button>
                </div>
              ) : (
                <div className="bg-white p-6 sm:p-8 rounded-[30px] border-4 border-black shadow-2xl w-full max-w-sm text-center animate-in zoom-in duration-300">
                  <h2 className="text-2xl sm:text-3xl font-black text-blue-600 mb-4">{nickname}님, 환영해요!</h2>
                  
                  {/* 난이도 선택 버튼 */}
                  <div className="flex gap-3 mb-6 w-full">
                    <button 
                      onClick={() => { setDifficulty('easy'); playSound('coin'); }} 
                      className={`flex-1 py-3 rounded-xl border-4 font-black transition-all ${difficulty === 'easy' ? 'bg-green-400 border-black scale-105 shadow-md' : 'bg-gray-100 border-gray-300 text-gray-400'}`}
                    >
                      이지 모드
                    </button>
                    <button 
                      onClick={() => { setDifficulty('hard'); playSound('coin'); }} 
                      className={`flex-1 py-3 rounded-xl border-4 font-black transition-all ${difficulty === 'hard' ? 'bg-red-500 text-white border-black scale-105 shadow-md' : 'bg-gray-100 border-gray-300 text-gray-400'}`}
                    >
                      하드 모드 🔥
                    </button>
                  </div>

                  <div className="flex flex-col gap-4">
                    <button onClick={() => { playSound('coin'); setScreen(GameScreen.STAGE_SELECT); }} className="w-full bg-blue-500 text-white text-2xl sm:text-3xl py-4 sm:py-6 rounded-2xl border-b-8 border-blue-800 active:translate-y-1 active:border-b-4 font-black shadow-lg">모험 출발!</button>
                    <button onClick={() => setScreen(GameScreen.DASHBOARD)} className="w-full bg-yellow-400 text-black text-lg py-3 rounded-xl border-b-4 border-yellow-600 font-black flex items-center justify-center gap-2">📒 탐험 도감</button>
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); }} 
                      className="text-gray-400 text-xs sm:text-sm mt-2 hover:text-red-500 underline decoration-dotted underline-offset-4 cursor-pointer p-2 z-50"
                    >
                      다른 이름으로 로그인하기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case GameScreen.STAGE_SELECT:
        return (
          <div className="h-full w-full flex flex-col items-center justify-center p-4 bg-cover bg-center" style={{ backgroundImage: `url(${THEME_BACKGROUNDS.main})` }}>
            <div className="absolute inset-0 bg-black/20 z-0" />
            
            <div className="relative z-10 flex flex-col items-center w-full max-w-4xl">
              <div className="bg-white/90 px-8 py-3 rounded-full border-4 border-black shadow-xl mb-10 transform -rotate-1">
                <h1 className="text-3xl sm:text-4xl text-blue-600 font-black tracking-tighter">어떤 모험을 떠날까?</h1>
              </div>
              
              <div className="grid grid-cols-2 gap-4 sm:gap-10 w-full px-2">
                {[
                  { name: '기본', color: 'from-red-400 to-red-600', icon: '🍄' },
                  { name: '동물', color: 'from-green-400 to-green-600', icon: '🐾' },
                  { name: '식물', color: 'from-yellow-300 to-yellow-500', icon: '🌱' },
                  { name: '생활', color: 'from-blue-400 to-blue-600', icon: '🏠' }
                ].map(cat => (
                  <button 
                    key={cat.name} 
                    onClick={() => handleCategorySelect(cat.name)} 
                    className={`group relative bg-gradient-to-b ${cat.color} p-6 sm:p-10 rounded-[30px] border-4 border-black border-b-[12px] shadow-2xl transition-all hover:-translate-y-2 active:translate-y-1 active:border-b-4`}
                  >
                    <div className="flex flex-col items-center gap-2 pointer-events-none">
                      <span className="text-4xl sm:text-6xl drop-shadow-lg group-hover:animate-bounce">{cat.icon}</span>
                      <span className="text-2xl sm:text-4xl font-black text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">{cat.name}</span>
                    </div>
                    {/* 광택 효과 */}
                    <div className="absolute top-2 left-4 w-3/4 h-2 bg-white/30 rounded-full" />
                  </button>
                ))}
              </div>
              
              <button onClick={() => setScreen(GameScreen.MAIN)} className="mt-12 bg-gray-800 text-white px-8 py-3 rounded-2xl border-b-4 border-black font-black hover:bg-gray-700 transition-colors">
                🔙 뒤로가기
              </button>
            </div>
          </div>
        );

      case GameScreen.WORLD_MAP:
        return (
          <WorldMap 
            category={selectedCategory} 
            theme={currentTheme} 
            backgroundImage={currentBgUrl} 
            unlockedIndex={worldProgress[selectedCategory] || 0}
            onSelectLevel={handleLevelSelect}
            onBack={() => setScreen(GameScreen.STAGE_SELECT)}
          />
        );

      case GameScreen.LOADING_GACHA:
        return (
          <div className="h-full bg-black flex flex-col items-center justify-center text-white">
            <div className="text-8xl animate-bounce mb-8">🍄</div>
            <h2 className="text-3xl font-black">모험 준비 중...</h2>
            {difficulty === 'hard' && <p className="text-red-400 mt-4 text-xl font-bold animate-pulse">🔥 하드 모드: 속도 UP! 점수 2배! 🔥</p>}
          </div>
        );

      case GameScreen.PLAYING:
        return currentWord ? (
          <GameCanvas 
            wordData={currentWord} 
            theme={currentTheme} 
            backgroundImage={currentBgUrl}
            isBossLevel={isBossLevel}
            isBonusLevel={isBonusLevel}
            gameSpeed={1} // Base speed is handled inside Canvas with difficulty
            difficulty={difficulty} // 난이도 전달
            initialLives={lives}
            onGameOver={handleGameOver}
            onUpdateScore={(pts) => setScore(s => s + pts)}
            onCollect={() => {}}
            onLivesChange={setLives}
            goHome={() => setScreen(GameScreen.MAIN)}
          />
        ) : <div className="text-white text-center p-20">단어 정보가 없습니다.</div>;

      case GameScreen.SUCCESS:
      case GameScreen.GAME_OVER:
        const win = screen === GameScreen.SUCCESS;
        return (
          <div className={`h-full flex flex-col items-center justify-center ${win ? 'bg-green-400' : 'bg-red-500'}`}>
            <h1 className="text-6xl text-white font-black mb-8 drop-shadow-xl">{win ? '임무 성공!' : '다음에 다시!'}</h1>
            <div className="flex gap-4">
              <button onClick={() => setScreen(GameScreen.WORLD_MAP)} className="bg-white px-10 py-4 rounded-2xl text-2xl font-black shadow-lg">계속하기</button>
              <button onClick={() => setScreen(GameScreen.MAIN)} className="bg-gray-800 text-white px-10 py-4 rounded-2xl text-2xl font-black shadow-lg">메인으로</button>
            </div>
          </div>
        );

      case GameScreen.DASHBOARD:
        return (
          <div className="h-full bg-blue-50 flex flex-col items-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-3xl border-4 border-black shadow-2xl flex flex-col h-full overflow-hidden">
              <div className="bg-blue-500 p-4 flex justify-between items-center text-white border-b-4 border-black">
                <button onClick={() => setScreen(GameScreen.MAIN)} className="text-2xl hover:scale-110 active:scale-90 transition-transform">🔙</button>
                <h2 className="text-2xl font-black">탐험 도감</h2>
                <button onClick={() => loadUserData(nickname)} className="text-2xl hover:rotate-180 transition-transform duration-500">↺</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {isHistoryLoading ? <div className="text-center py-10 font-bold">기록 찾는 중...</div> : 
                 history.length === 0 ? <div className="text-center py-10 text-gray-400 font-bold">아직 기록이 없어요!</div> :
                 history.map(h => (
                   <div key={h.id} className="bg-gray-50 p-5 rounded-2xl border-4 border-blue-100 shadow-sm">
                     <div className="flex justify-between font-black text-2xl mb-3">
                       <span className="text-gray-800">{h.word}</span>
                       <span className="text-blue-500">{h.score.toLocaleString()}점</span>
                     </div>
                     <p className="text-base text-gray-600 bg-white p-4 rounded-2xl border-2 border-gray-100 italic">
                       🎓 AI 분석: <span className="text-blue-700 font-bold">{h.ai_analysis || '열심히 공부하고 있군요!'}</span>
                     </p>
                   </div>
                 ))
                }
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="h-full flex flex-col items-center justify-center bg-black text-white p-10 text-center">
            <p className="text-2xl font-black mb-4">화면을 찾을 수 없어요!</p>
            <button onClick={() => setScreen(GameScreen.MAIN)} className="px-10 py-4 bg-blue-600 rounded-2xl font-bold">메인으로 돌아가기</button>
          </div>
        );
    }
  };

  return (
    <div className="h-[100dvh] w-full font-['Jua'] select-none overflow-hidden bg-black">
      {renderContent()}
    </div>
  );
}

export default App;
