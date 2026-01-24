
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PlayerState, Block, Enemy, Particle, Collectible, ASSETS, WordData, HiddenItemType } from '../types';
import { playSound, startBGM, stopBGM } from '../utils/audio';

interface GameCanvasProps {
  wordData: WordData;
  theme: string;
  backgroundImage?: string;
  isBossLevel?: boolean;
  isBonusLevel?: boolean;
  gameSpeed: number;
  initialLives: number;
  onGameOver: (success: boolean, stats?: { timeLeft: number }) => void;
  onUpdateScore: (points: number) => void;
  onCollect: (char: string) => void;
  onLivesChange: (lives: number) => void;
  goHome: () => void;
}

interface BossState {
  x: number; y: number; width: number; height: number; vx: number;
  hp: number; maxHp: number; isDead: boolean; invulnTimer: number; flashTimer: number;
}

// Global Physics Constants
const GRAVITY = 0.45; 
const JUMP_FORCE = -11; 
const BASE_MOVE_SPEED = 4.0; 
const BASE_ENEMY_SPEED = 0.9; 
const TARGET_FPS = 60;
const TIME_STEP = 1000 / TARGET_FPS; 

// Virtual Design Resolution (Physics coordinate space)
const DESIGN_HEIGHT = 600; 
const GROUND_Y = 500;
const BLOCK_SIZE = 60;
const MAX_TIME = 180;

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  wordData, theme, backgroundImage, isBossLevel = false, isBonusLevel = false,
  gameSpeed, initialLives, onGameOver, onUpdateScore, onCollect, onLivesChange, goHome
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  
  // Viewport State for Responsive UI
  const [viewSize, setViewSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const isLandscape = viewSize.width > viewSize.height;
  const isTablet = viewSize.width >= 768 && viewSize.width < 1024;
  const isMobile = viewSize.width < 768;

  const playerRef = useRef<PlayerState>({
    x: 100, y: GROUND_Y - 60, vx: 0, vy: 0, width: 48, height: 48,
    isGrounded: false, jumpCount: 0, facingRight: true, isDead: false,
    state: 'idle', frameTimer: 0, currentFrame: 0, invulnerableTimer: 0,
    starTimer: 0
  });
  
  const blocksRef = useRef<Block[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const collectiblesRef = useRef<Collectible[]>([]);
  const bossRef = useRef<BossState | null>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const cameraXRef = useRef(0);
  const cameraYRef = useRef(0);
  const shakeRef = useRef(0); 
  const lastTimeRef = useRef<number>(performance.now());
  const accumulatorRef = useRef<number>(0);
  const spritesRef = useRef<{ [key: string]: HTMLImageElement }>({});
  
  const [lives, setLives] = useState(initialLives);
  const [timeLeft, setTimeLeft] = useState(MAX_TIME);
  const [isPaused, setIsPaused] = useState(false);

  const currentMoveSpeed = BASE_MOVE_SPEED * (gameSpeed === 2 ? 1.4 : 1);
  const currentEnemySpeed = BASE_ENEMY_SPEED * (gameSpeed === 2 ? 1.4 : 1);
  const scoreMultiplier = gameSpeed === 2 ? 2 : 1;

  // Handle Resize and Orientation
  useEffect(() => {
    const handleResize = () => {
      setViewSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    startBGM(isBossLevel ? 'boss' : 'normal');
    const loadSprite = (src: string) => { const img = new Image(); img.src = src; return img; };
    spritesRef.current = {
      idle: loadSprite(ASSETS.player.walk1), walk1: loadSprite(ASSETS.player.walk1),
      walk2: loadSprite(ASSETS.player.walk2), jump: loadSprite(ASSETS.player.jump),
      die: loadSprite(ASSETS.player.die), enemy0: loadSprite(ASSETS.enemies[0]),
      enemy1: loadSprite(ASSETS.enemies[1]), enemy2: loadSprite(ASSETS.enemies[2]),
      enemy3: loadSprite(ASSETS.enemies[3]), blockYellow: loadSprite(ASSETS.blocks.yellow),
      blockRed: loadSprite(ASSETS.blocks.red), finish: loadSprite(ASSETS.blocks.finish),
      boss: loadSprite(ASSETS.ui.bossKoopa), breakableNormal: loadSprite(ASSETS.blocks.breakable.normal),
      breakableCracked: loadSprite(ASSETS.blocks.breakable.cracked),
      itemMushroom: loadSprite(ASSETS.items.mushroom), itemCoin: loadSprite(ASSETS.items.coin),
      itemStar: loadSprite(ASSETS.items.star),
      pipeEnd: loadSprite(ASSETS.blocks.pipeEnd),
    };
    if (backgroundImage) {
        const bgImg = new Image();
        bgImg.onload = () => { spritesRef.current.bg = bgImg; };
        bgImg.src = backgroundImage;
    }
    return () => { stopBGM(); };
  }, [backgroundImage, isBossLevel]);

  useEffect(() => { onLivesChange(lives); }, [lives]);

  const spawnParticle = useCallback((x: number, y: number, text: string, color?: string, image?: HTMLImageElement, w?: number, h?: number, vx?: number, vy?: number, life: number = 60) => {
    particlesRef.current.push({
      id: Math.random().toString(), x, y,
      vx: vx !== undefined ? vx : (Math.random() - 0.5) * 2,
      vy: vy !== undefined ? vy : -2 - Math.random() * 3,
      life, text, color, image, width: w, height: h
    });
  }, []);

  const spawnCollectible = useCallback((x: number, y: number, type: 'coin' | 'mushroom' | 'star', vx?: number, vy?: number) => {
    collectiblesRef.current.push({
      id: Math.random().toString(),
      x, y,
      vx: vx ?? (Math.random() - 0.5) * 6,
      vy: vy ?? -6 - Math.random() * 4,
      width: 32, height: 32,
      type,
      life: 360 
    });
  }, []);

  const addShake = (intensity: number) => {
    shakeRef.current = intensity;
  };

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
        setTimeLeft(prev => {
            if (prev <= 0) {
                if (!playerRef.current.isDead) {
                    playerRef.current.isDead = true; playerRef.current.vy = -8;
                    playSound('damage'); setTimeout(() => onGameOver(false), 2000);
                }
                return 0;
            }
            if (prev <= 10 && prev > 0) playSound('time_warning');
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused, onGameOver]);

  useEffect(() => {
    const items: Block[] = []; const enemies: Enemy[] = [];
    const syllables = wordData.syllables.length > 0 ? wordData.syllables : ['코', '인'];
    const TARGET_RED_COUNT = Math.max(syllables.length, 6); 
    let redBlockContents: string[] = []; 
    let redIndices = new Set<number>();
    
    if (!isBonusLevel && !isBossLevel) {
        while (redBlockContents.length < TARGET_RED_COUNT) {
            redBlockContents.push(...syllables);
        }
        redBlockContents = redBlockContents.slice(0, TARGET_RED_COUNT).sort(() => Math.random() - 0.5);
        while(redIndices.size < TARGET_RED_COUNT) redIndices.add(Math.floor(Math.random() * 30) + 2);
    }

    const stageEnemyType = Math.floor(Math.random() * 4);
    let currentX = 500; 
    const totalItems = isBonusLevel ? 60 : 35;
    let starsPlaced = 0; 
    let mushroomsPlaced = 0;

    for (let i = 0; i < totalItems; i++) {
      let content: string | undefined = undefined; 
      let type: 'yellow' | 'red' | 'breakable' = 'yellow';
      let hiddenType: HiddenItemType = 'none'; 
      let maxHits = 0;

      if (!isBonusLevel && !isBossLevel && redIndices.has(i)) { 
          type = 'red'; 
          content = redBlockContents.pop(); 
      } else {
          type = 'yellow'; 
          content = 'COIN'; 
          const rand = Math.random();
          if (rand < 0.25) { hiddenType = 'coin_multi'; } 
          else if (rand < 0.30 && starsPlaced < 1 && !isBossLevel) { hiddenType = 'star'; starsPlaced++; }
          else if (rand < 0.35 && mushroomsPlaced < 1 && !isBossLevel) { hiddenType = 'mushroom'; mushroomsPlaced++; }
          else if (rand < 0.37 && !isBonusLevel) hiddenType = 'rain';
      }

      const yBase = GROUND_Y - 140;
      const yVariation = Math.random() > 0.5 ? 0 : -130;
      const yPos = yBase + yVariation;

      if (Math.random() > 0.7) {
          const startX = currentX - 60; 
          const platY = GROUND_Y - 110 - (Math.random() * 60);
          for(let k = 0; k < 3; k++) {
              items.push({ id: `brick-${i}-${k}`, x: startX + (k * BLOCK_SIZE), y: platY, width: BLOCK_SIZE, height: 40, type: 'breakable', isHit: false, bumpY: 0, hp: 2, maxHp: 2 });
          }
          items.push({ id: `b-${i}`, x: currentX, y: platY - 120, width: BLOCK_SIZE, height: BLOCK_SIZE, type, content, isHit: false, bumpY: 0, hiddenType, maxHits, hitCount: 0 });
      } else {
          items.push({ id: `b-${i}`, x: currentX, y: yPos, width: BLOCK_SIZE, height: BLOCK_SIZE, type, content, isHit: false, bumpY: 0, hiddenType, maxHits, hitCount: 0 });
      }

      if (!isBonusLevel && !isBossLevel && Math.random() > 0.6) {
          enemies.push({ id: `e-${i}`, x: currentX + 50, y: GROUND_Y - 50, width: 45, height: 45, vx: -currentEnemySpeed, isDead: false, typeIndex: stageEnemyType, deadTimer: 0 });
      }
      currentX += isBonusLevel ? (90 + Math.random() * 40) : (250 + Math.random() * 100);
    }

    const endX = currentX + 450;
    if (isBossLevel) {
       bossRef.current = { x: endX, y: GROUND_Y - 150, width: 150, height: 150, vx: -2.0, hp: 5, maxHp: 5, isDead: false, invulnTimer: 0, flashTimer: 0 };
       for(let j=1; j<=4; j++) items.push({ id: `boss-step-${j}`, x: endX - 600 + (j*110), y: GROUND_Y - (j*60), width: 90, height: j*60, type: 'ground', isHit: false, bumpY: 0 });
       items.push({ id: 'boss-blocking-pipe', x: endX + 600, y: GROUND_Y - 500, width: 100, height: 500, type: 'pipe', isHit: false, bumpY: 0 });
    } else {
       items.push({ id: 'finish-box', x: endX + 30, y: GROUND_Y - 260, width: BLOCK_SIZE, height: BLOCK_SIZE, type: 'finish', isHit: false, bumpY: 0 });
       items.push({ id: 'finish-blocking-pipe', x: endX + 220, y: GROUND_Y - 500, width: 100, height: 500, type: 'pipe', isHit: false, bumpY: 0 });
    }

    const totalMapWidth = endX + 1200;
    const groundTileCount = Math.ceil(totalMapWidth / 50);
    const groundBlocks: Block[] = [];
    for (let i = 0; i < groundTileCount; i++) {
        groundBlocks.push({ id: `g-${i}`, x: i * 50, y: GROUND_Y, width: 50, height: 50, type: 'ground', isHit: false, bumpY: 0 });
    }

    blocksRef.current = [...groundBlocks, ...items]; 
    enemiesRef.current = enemies;
    playerRef.current = { ...playerRef.current, x: 100, y: GROUND_Y - 60, vx: 0, vy: 0, isDead: false, starTimer: 0 };
    collectiblesRef.current = [];
    cameraXRef.current = 0;
    cameraYRef.current = (GROUND_Y - 60) - (DESIGN_HEIGHT * 0.5); 
    setLives(initialLives); setTimeLeft(MAX_TIME);
  }, [wordData, isBossLevel, isBonusLevel, currentEnemySpeed]);

  const performJump = useCallback(() => {
      if (playerRef.current.isDead) return;
      const p = playerRef.current;
      if (p.isGrounded) { p.vy = JUMP_FORCE; p.isGrounded = false; p.jumpCount = 1; playSound('jump'); }
      else if (p.jumpCount < 2) { p.vy = JUMP_FORCE * 0.95; p.jumpCount++; playSound('doubleJump'); spawnParticle(p.x + p.width/2, p.y + p.height, '💨'); }
  }, [spawnParticle]);

  const handleDeath = useCallback(() => {
    if (playerRef.current.isDead) return;
    playerRef.current.isDead = true; playerRef.current.state = 'die'; playerRef.current.vy = -12;
    addShake(20);
    playSound('damage'); setTimeout(() => onGameOver(false), 2000);
  }, [onGameOver]);

  const handleLevelClear = useCallback((x: number, y: number) => {
      setIsPaused(true); playSound('clear');
      addShake(12);
      let mult = 1; if (timeLeft > 100) mult = 3; else if (timeLeft > 50) mult = 2;
      onUpdateScore(1000 * mult * scoreMultiplier);
      setTimeout(() => onGameOver(true, { timeLeft }), 2800);
  }, [timeLeft, scoreMultiplier, onGameOver, onUpdateScore]);

  const updatePhysics = useCallback(() => {
    const p = playerRef.current;
    if (p.isDead) { p.vy += GRAVITY; p.y += p.vy; return; }

    if (keysRef.current['ArrowLeft']) { p.vx = -currentMoveSpeed; p.facingRight = false; p.state = 'walk'; }
    else if (keysRef.current['ArrowRight']) { p.vx = currentMoveSpeed; p.facingRight = true; p.state = 'walk'; }
    else { p.vx = 0; p.state = 'idle'; }

    p.vy += GRAVITY; p.x += p.vx; p.y += p.vy;
    p.frameTimer++; if (p.frameTimer > 7) { p.currentFrame = (p.currentFrame + 1) % 2; p.frameTimer = 0; }
    if (!p.isGrounded) p.state = 'jump';
    if (p.invulnerableTimer > 0) p.invulnerableTimer--;
    
    if (p.starTimer > 0) {
        p.starTimer--;
        startBGM('star');
        if (p.starTimer % 4 === 0) spawnParticle(p.x + Math.random()*p.width, p.y + Math.random()*p.height, '✨', '#FFFF00', undefined, 10, 10, 0, -1);
    } else {
        startBGM(isBossLevel ? 'boss' : 'normal');
    }
    
    p.isGrounded = false;
    
    // Collectibles Physics
    for (let i = collectiblesRef.current.length - 1; i >= 0; i--) {
      const c = collectiblesRef.current[i];
      c.vy += GRAVITY * 0.8;
      c.x += c.vx;
      c.y += c.vy;
      c.life--;

      let hitGround = false;
      blocksRef.current.forEach(b => {
        if ((b.type === 'ground' || b.type === 'pipe') && c.x < b.x + b.width && c.x + c.width > b.x && c.y + c.height > b.y && c.y < b.y + 10) {
          c.y = b.y - c.height;
          c.vy = -c.vy * 0.4; 
          c.vx *= 0.9; 
          hitGround = true;
        }
      });
      if (c.y + c.height > GROUND_Y) {
        c.y = GROUND_Y - c.height;
        c.vy = -c.vy * 0.4;
        c.vx *= 0.8;
        hitGround = true;
      }

      if (p.x < c.x + c.width && p.x + p.width > c.x && p.y < c.y + c.height && p.y + p.height > c.y) {
        if (c.type === 'coin') {
          playSound('coin');
          onUpdateScore(20 * scoreMultiplier);
        } else if (c.type === 'mushroom') {
          playSound('coin');
          setLives(v => Math.min(v + 1, 5));
        } else if (c.type === 'star') {
          playSound('coin');
          p.starTimer = 1100;
        }
        collectiblesRef.current.splice(i, 1);
        continue;
      }
      if (c.life <= 0) collectiblesRef.current.splice(i, 1);
    }

    for (let i = blocksRef.current.length - 1; i >= 0; i--) {
      const block = blocksRef.current[i];
      if (block.bumpY < 0) block.bumpY += 2; else block.bumpY = 0;
      
      if (p.x < block.x + block.width && p.x + p.width > block.x && p.y < block.y + block.height && p.y + p.height > block.y) {
        const oX = (p.width + block.width) / 2 - Math.abs((p.x + p.width/2) - (block.x + block.width/2));
        const oY = (p.height + block.height) / 2 - Math.abs((p.y + p.height/2) - (block.y + block.height/2));
        
        if (oX < oY) { 
            if (p.x < block.x) p.x = block.x - p.width; else p.x = block.x + block.width; p.vx = 0; 
        } else {
          if (p.vy > 0 && p.y < block.y) { p.y = block.y - p.height; p.vy = 0; p.isGrounded = true; p.jumpCount = 0; }
          else if (p.vy < 0 && p.y > block.y) {
            p.y = block.y + block.height; p.vy = 0;
            if (!block.isHit && block.type !== 'ground' && block.type !== 'pipe') {
               addShake(6);
               if (block.type === 'breakable') {
                   block.hp = (block.hp || 2) - 1;
                   if (block.hp <= 0) {
                       playSound('block_break');
                       for (let j = 0; j < 6; j++) spawnParticle(block.x + 30, block.y + 20, '', '#8B4513', undefined, 12, 12, (Math.random()-0.5)*4, (Math.random()-0.5)*4, 30);
                       blocksRef.current.splice(i, 1); continue;
                   } else { playSound('block_crack'); block.bumpY = -15; }
               } else {
                   block.bumpY = -20; 
                   if (block.hiddenType && block.hiddenType !== 'none') {
                       if (block.hiddenType === 'coin_multi') {
                           block.isHit = true;
                           const count = 3 + Math.floor(Math.random() * 4);
                           playSound('time_warning'); 
                           for(let k=0; k<count; k++) {
                             spawnCollectible(block.x + 15, block.y - 40, 'coin', (Math.random()-0.5)*10, -8 - Math.random()*6);
                           }
                           onUpdateScore(10 * scoreMultiplier); 
                       } else if (block.hiddenType === 'star') {
                           block.isHit = true;
                           spawnCollectible(block.x + 15, block.y - 40, 'star', 0, -8);
                       } else if (block.hiddenType === 'mushroom') {
                           block.isHit = true;
                           spawnCollectible(block.x + 15, block.y - 40, 'mushroom', 0, -8);
                       } else if (block.hiddenType === 'rain') {
                           block.isHit = true;
                           for(let k=0; k<15; k++) spawnCollectible(p.x+(Math.random()-0.5)*600, -200, 'coin', 0, 7);
                           onUpdateScore(600 * scoreMultiplier);
                       }
                   } else {
                       block.isHit = true;
                       if (block.type === 'finish') handleLevelClear(block.x + 25, block.y);
                       else if (block.content) {
                           onUpdateScore(block.content === 'COIN' ? 10 : 350);
                           if (block.content !== 'COIN') {
                               onCollect(block.content);
                               spawnParticle(block.x + 30, block.y - 50, block.content, '#FFFFFF', undefined, 50, 50, 0, -5, 100);
                           } else {
                               spawnCollectible(block.x + 15, block.y - 40, 'coin', 0, -10);
                           }
                           playSound('coin');
                       } else playSound('block');
                   }
               }
            }
          }
        }
      }
    }

    if (bossRef.current && !bossRef.current.isDead) {
        const b = bossRef.current; b.x += b.vx;
        let hit = false; blocksRef.current.forEach(bl => { if ((bl.type==='pipe'||bl.type==='ground')&&b.x<bl.x+bl.width&&b.x+b.width>bl.x&&b.y<bl.y+bl.height&&b.y+b.height>bl.y) hit=true; });
        if (hit) { b.vx *= -1; b.x += b.vx; }
        if (p.x < b.x + b.width && p.x + p.width > b.x && p.y < b.y + b.height && p.y + p.height > b.y) {
             if (p.starTimer > 0) {
                 b.hp = 0; b.isDead = true; onUpdateScore(5000 * scoreMultiplier);
                 stopBGM(); playSound('clear'); handleLevelClear(b.x + b.width/2, b.y);
             } else {
                 if (p.vy > 0 && p.y + p.height < b.y + b.height * 0.5) {
                     if (b.invulnTimer === 0) {
                         b.hp -= 1; b.invulnTimer = 60; b.flashTimer = 10; p.vy = -14; playSound('stomp'); addShake(12);
                         if (b.hp <= 0) { b.isDead = true; onUpdateScore(5000 * scoreMultiplier); stopBGM(); handleLevelClear(b.x+b.width/2, b.y); }
                     }
                 } else if (p.invulnerableTimer === 0 && b.invulnTimer === 0) {
                      p.invulnerableTimer = 60; p.vy = -6; playSound('damage'); addShake(18);
                      setLives(l => { const nl = l-1; if (nl<=0) handleDeath(); return nl; });
                 }
             }
        }
        if (b.invulnTimer > 0) b.invulnTimer--;
        if (b.flashTimer > 0) b.flashTimer--;
    }

    for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
      const e = enemiesRef.current[i]; if (e.isDead) { e.deadTimer++; if (e.deadTimer > 30) enemiesRef.current.splice(i, 1); continue; }
      e.x += e.vx;
      if (p.x < e.x + e.width && p.x + p.width > e.x && p.y < e.y + e.height && p.y + p.height > e.y) {
         if (p.starTimer > 0 || (p.vy > 0 && p.y + p.height < e.y + e.height * 0.75)) {
             e.isDead = true; p.vy = -10; onUpdateScore(200 * scoreMultiplier); playSound('stomp');
         } else if (p.invulnerableTimer === 0) {
              p.invulnerableTimer = 60; p.vy = -5; playSound('damage'); addShake(10);
              setLives(pr => { const nl = pr - 1; if (nl <= 0) handleDeath(); return nl; });
         }
      }
    }
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const pt = particlesRef.current[i]; pt.x += pt.vx; pt.y += pt.vy; pt.life--;
        if (pt.life <= 0) particlesRef.current.splice(i, 1);
    }
    
    // Smooth Camera Follow Logic
    const physWidth = window.innerWidth / (window.innerHeight / DESIGN_HEIGHT);
    let targetX = Math.max(0, p.x + p.width/2 - physWidth/2);
    cameraXRef.current += (targetX - cameraXRef.current) * 0.15;
    
    const verticalCenterFactor = isLandscape ? 0.55 : 0.45; 
    const targetY = p.y - (DESIGN_HEIGHT * verticalCenterFactor);
    cameraYRef.current += (targetY - cameraYRef.current) * 0.12;
    
    if (shakeRef.current > 0) shakeRef.current *= 0.85;
    if (p.y > GROUND_Y + 800) handleDeath();
  }, [currentMoveSpeed, currentEnemySpeed, scoreMultiplier, onCollect, onUpdateScore, onGameOver, isBossLevel, isBonusLevel, handleDeath, spawnParticle, spawnCollectible, timeLeft, handleLevelClear, isLandscape]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (shakeRef.current > 0.1) ctx.translate((Math.random()-0.5)*shakeRef.current, (Math.random()-0.5)*shakeRef.current);

    const scale = canvas.height / DESIGN_HEIGHT;
    if (spritesRef.current.bg) {
      const bg = spritesRef.current.bg;
      const bgRatio = bg.width / bg.height;
      const canvasRatio = canvas.width / canvas.height;
      let drawW, drawH;
      if (canvasRatio > bgRatio) { drawW = canvas.width; drawH = canvas.width / bgRatio; } 
      else { drawH = canvas.height; drawW = canvas.height * bgRatio; }
      ctx.drawImage(bg, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
    } else {
      ctx.fillStyle = '#87CEEB'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    ctx.save();
    ctx.scale(scale, scale); 
    ctx.translate(-cameraXRef.current, -cameraYRef.current);

    blocksRef.current.forEach(b => {
        if (b.type === 'ground') { 
            ctx.fillStyle = '#5D4037'; ctx.fillRect(b.x, b.y, b.width, b.height); 
            ctx.fillStyle = '#4CAF50'; ctx.fillRect(b.x, b.y, b.width, 15); 
        } else if (b.type === 'pipe') {
            if (spritesRef.current.pipeEnd) { ctx.drawImage(spritesRef.current.pipeEnd, b.x, b.y, b.width, b.height); } 
            else { ctx.fillStyle = '#2ECC71'; ctx.fillRect(b.x, b.y, b.width, b.height); }
        } else if (b.type === 'breakable') {
            const s = b.hp === 1 ? spritesRef.current.breakableCracked : spritesRef.current.breakableNormal;
            if (s) ctx.drawImage(s, b.x, b.y + b.bumpY, b.width, b.height);
        } else {
            let sk = b.type === 'red' ? 'blockRed' : b.type === 'finish' ? 'finish' : 'blockYellow';
            const s = spritesRef.current[sk]; 
            ctx.save();
            if (b.isHit) ctx.globalAlpha = 0.5;
            if (s) ctx.drawImage(s, b.x, b.y + b.bumpY, b.width, b.height);
            if (b.type === 'red' && !b.isHit && b.content) {
                ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 36px "Jua"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(b.content, b.x + b.width/2, b.y + b.height/2 + b.bumpY);
            }
            ctx.restore();
        }
    });

    collectiblesRef.current.forEach(c => {
      if (c.life < 120 && Math.floor(c.life / 10) % 2 === 0) return;
      let img = spritesRef.current.itemCoin;
      if (c.type === 'mushroom') img = spritesRef.current.itemMushroom;
      if (c.type === 'star') img = spritesRef.current.itemStar;
      if (img) ctx.drawImage(img, c.x, c.y, c.width, c.height);
    });

    enemiesRef.current.forEach(e => {
        let s = spritesRef.current[`enemy${e.typeIndex}`] || spritesRef.current.enemy0;
        ctx.save();
        if (e.isDead) { ctx.translate(e.x, e.y + e.height); ctx.scale(1, 0.35); ctx.drawImage(s, 0, -e.height, e.width, e.height); }
        else { if (e.vx > 0) { ctx.translate(e.x + e.width, e.y); ctx.scale(-1, 1); ctx.drawImage(s, 0, 0, e.width, e.height); } else ctx.drawImage(s, e.x, e.y, e.width, e.height); }
        ctx.restore();
    });

    if (bossRef.current && !bossRef.current.isDead) {
         const b = bossRef.current; if (b.flashTimer > 0 && Math.floor(Date.now() / 100) % 2 === 0) ctx.globalAlpha = 0.5;
         if (spritesRef.current.boss) ctx.drawImage(spritesRef.current.boss, b.x, b.y, b.width, b.height);
         ctx.globalAlpha = 1.0; ctx.fillStyle = '#FF0000'; ctx.fillRect(b.x + 20, b.y - 35, (b.width-40) * (b.hp / b.maxHp), 15);
    }

    const p = playerRef.current;
    if (p.starTimer > 0) { ctx.shadowColor = ['#FF0000','#FFFF00','#00FF00','#0000FF'][Math.floor(Date.now()/50)%4]; ctx.shadowBlur = 30; }
    if (p.invulnerableTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) ctx.globalAlpha = 0.5;
    let ps = p.isDead ? spritesRef.current.die : p.state === 'jump' ? spritesRef.current.jump : p.currentFrame === 0 ? spritesRef.current.walk1 : spritesRef.current.walk2;
    ctx.save(); if (!p.facingRight) { ctx.translate(p.x + p.width, p.y); ctx.scale(-1, 1); ctx.drawImage(ps, 0, 0, p.width, p.height); } else ctx.drawImage(ps, p.x, p.y, p.width, p.height); ctx.restore();
    ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;

    particlesRef.current.forEach(pt => {
        ctx.save(); ctx.globalAlpha = Math.max(0, pt.life / 60);
        if (pt.image) ctx.drawImage(pt.image, pt.x - (pt.width||40)/2, pt.y - (pt.height||40)/2, pt.width||40, pt.height||40);
        else if (pt.text) { 
            ctx.font = 'bold 48px "Jua"'; ctx.fillStyle = pt.color || '#FFFF00'; 
            ctx.strokeStyle = 'black'; ctx.lineWidth = 5; ctx.strokeText(pt.text, pt.x, pt.y); ctx.fillText(pt.text, pt.x, pt.y); 
        } else { ctx.fillStyle = pt.color || 'white'; ctx.fillRect(pt.x, pt.y, pt.width || 8, pt.height || 8); }
        ctx.restore();
    });
    
    ctx.restore(); ctx.restore();
  }, [isLandscape]);

  const loop = useCallback((timestamp: number) => {
    const deltaTime = timestamp - lastTimeRef.current; lastTimeRef.current = timestamp;
    accumulatorRef.current += deltaTime; if (accumulatorRef.current > 1000) accumulatorRef.current = 1000;
    while (accumulatorRef.current >= TIME_STEP) { updatePhysics(); accumulatorRef.current -= TIME_STEP; }
    draw();
    requestRef.current = requestAnimationFrame(loop);
  }, [updatePhysics, draw]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; if (e.code === 'Space' || e.code === 'ArrowUp') performJump(); };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop, performJump]);

  // UI Scale Factors for Landscape
  const btnSizeClass = isLandscape 
    ? (isTablet ? "w-20 h-20 sm:w-24 sm:h-24" : "w-16 h-16 sm:w-20 sm:h-20") 
    : "w-20 h-20 sm:w-28 sm:h-28";
  const jumpSizeClass = isLandscape 
    ? (isTablet ? "w-24 h-24 sm:w-28 sm:h-28" : "w-20 h-20 sm:w-24 sm:h-24") 
    : "w-24 h-24 sm:w-36 sm:h-36";
  const hintWidthClass = isLandscape ? "w-[65%]" : "w-[90%]";
  const hintTopClass = isLandscape ? "top-14" : "top-36";

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center overflow-hidden touch-none select-none bg-black">
        <canvas 
            ref={canvasRef} 
            width={viewSize.width} 
            height={viewSize.height} 
            className="w-full h-full pixel-art z-10" 
        />
        
        {/* Overlay Controls */}
        <button onClick={goHome} className="absolute top-16 right-4 sm:right-8 hover:scale-110 z-40 p-2 active:scale-90 transition-transform">
          <img src={ASSETS.ui.btnHome} alt="home" className={`${isLandscape ? 'w-10 h-10 sm:w-16 sm:h-16' : 'w-14 h-14 sm:w-20 sm:h-20'}`} />
        </button>
        
        <div className={`absolute left-4 sm:left-8 z-40 bg-black/50 p-2 sm:p-3 rounded-2xl text-white font-black shadow-lg backdrop-blur-sm border-2 border-white/20 ${isLandscape ? 'top-16 text-lg sm:text-2xl' : 'top-20 text-xl sm:text-3xl'}`}>
          ⏳ {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}
        </div>
        
        {playerRef.current.starTimer > 0 && (
          <div className={`absolute left-4 sm:left-8 z-40 animate-pulse bg-yellow-400 p-2 px-4 rounded-full border-4 border-white font-black shadow-2xl text-black ${isLandscape ? 'top-30 text-sm sm:text-lg' : 'top-36 text-lg sm:text-2xl'}`}>
            🌟 무적!
          </div>
        )}

        {/* Word Hint - Optimized for Landscape */}
        <div className={`absolute left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none transition-all duration-300 ${hintWidthClass} ${hintTopClass}`}>
            <div className={`bg-black/70 text-white px-6 py-2 sm:px-10 sm:py-3 rounded-3xl font-bold border-4 border-white/40 animate-float shadow-2xl text-center backdrop-blur-md ${isLandscape ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
                💡 {wordData.hint}
            </div>
        </div>

        {/* Left Touch Controls - Smaller in Landscape */}
        <div className={`absolute left-6 flex z-50 transition-all ${isLandscape ? 'bottom-4 gap-3' : 'bottom-6 gap-4 sm:gap-8'}`}>
            <button 
              className={`${btnSizeClass} bg-black/40 rounded-3xl border-4 border-white/60 flex items-center justify-center active:bg-white/50 active:scale-90 transition-all shadow-xl backdrop-blur-sm`} 
              onTouchStart={(e) => { e.preventDefault(); keysRef.current['ArrowLeft']=true; }} 
              onTouchEnd={(e) => { e.preventDefault(); keysRef.current['ArrowLeft']=false; }}
            >
              <span className={`${isLandscape ? 'text-3xl' : 'text-4xl sm:text-6xl'} text-white`}>◀</span>
            </button>
            <button 
              className={`${btnSizeClass} bg-black/40 rounded-3xl border-4 border-white/60 flex items-center justify-center active:bg-white/50 active:scale-90 transition-all shadow-xl backdrop-blur-sm`} 
              onTouchStart={(e) => { e.preventDefault(); keysRef.current['ArrowRight']=true; }} 
              onTouchEnd={(e) => { e.preventDefault(); keysRef.current['ArrowRight']=false; }}
            >
              <span className={`${isLandscape ? 'text-3xl' : 'text-4xl sm:text-6xl'} text-white`}>▶</span>
            </button>
        </div>

        {/* Right Touch Control - Smaller in Landscape */}
        <div className={`absolute right-6 z-50 transition-all ${isLandscape ? 'bottom-4' : 'bottom-6'}`}>
            <button 
              className={`${jumpSizeClass} bg-red-600/90 rounded-full border-4 border-white/80 flex items-center justify-center active:bg-red-500 active:scale-110 transition-all shadow-2xl backdrop-blur-md`} 
              onTouchStart={(e) => { e.preventDefault(); performJump(); }}
            >
                <span className={`${isLandscape ? 'text-lg sm:text-xl' : 'text-xl sm:text-3xl'} font-black text-white`}>JUMP</span>
            </button>
        </div>
    </div>
  );
};
