
export enum GameScreen {
  MAIN = 'MAIN',
  DASHBOARD = 'DASHBOARD',
  STAGE_SELECT = 'STAGE_SELECT',
  WORLD_MAP = 'WORLD_MAP',
  LOADING_GACHA = 'LOADING_GACHA',
  PLAYING = 'PLAYING',
  SUCCESS = 'SUCCESS',
  GAME_OVER = 'GAME_OVER'
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  isGrounded: boolean;
  jumpCount: number;
  facingRight: boolean;
  isDead: boolean;
  state: 'idle' | 'walk' | 'jump' | 'die';
  frameTimer: number;
  currentFrame: number;
  invulnerableTimer: number;
  starTimer: number;
}

export type HiddenItemType = 'none' | 'coin_multi' | 'star' | 'mushroom' | 'rain';

export interface Block {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'yellow' | 'red' | 'ground' | 'pipe' | 'grass-plat' | 'finish' | 'breakable';
  content?: string;
  isHit: boolean;
  bumpY: number;
  hp?: number;
  maxHp?: number;
  hiddenType?: HiddenItemType;
  hitCount?: number;
  maxHits?: number;
}

export interface Collectible {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  type: 'coin' | 'mushroom' | 'star';
  life: number;
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  isDead: boolean;
  typeIndex: number;
  deadTimer: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  text?: string;
  color?: string;
  image?: HTMLImageElement;
  width?: number;
  height?: number;
}

export interface WordData {
  word: string; 
  syllables: string[];
  hint: string; 
  category: string;
}

export interface LeaderboardEntry {
  id: string;
  nickname: string;
  score: number;
  created_at: string;
}

export interface GameHistory {
  id: string;
  nickname: string;
  score: number;
  word: string;
  category: string;
  played_at: string;
  ai_analysis?: string; // AI가 생성한 교사용 분석 코멘트
}

export const ASSETS = {
  player: {
    walk1: 'https://i.imgur.com/RRt4XL1.png',
    walk2: 'https://i.imgur.com/QZHBIHf.png',
    jump: 'https://i.imgur.com/MTUGJxJ.png',
    die: 'https://i.imgur.com/M7Xd2gx.png',
  },
  enemies: [
    'https://i.imgur.com/zooTPq1.png',
    'https://i.imgur.com/7jWo37c.png',
    'https://i.imgur.com/f3Tz444.png',
    'https://i.imgur.com/F8Zcrsw.png',
  ],
  blocks: {
    yellow: 'https://i.imgur.com/qkBIy2h.png',
    red: 'https://i.imgur.com/vI62Wcx.png',
    finish: 'https://i.imgur.com/4XSr8oA.png',
    breakable: {
        normal: 'https://i.imgur.com/CdIScO3.png',
        cracked: 'https://i.imgur.com/KLQsmMv.png'
    },
    pipeEnd: 'https://i.imgur.com/eUWu4q0.png'
  },
  items: {
    mushroom: 'https://i.imgur.com/lQXwslJ.png',
    coin: 'https://i.imgur.com/jhZxQZl.png',
    star: 'https://i.imgur.com/73y838r.png'
  },
  ui: {
    btnBasic: 'https://i.imgur.com/t2LaK29.png',
    bossKoopa: 'https://i.imgur.com/JJQ4gOO.png',
    mushroom: 'https://i.imgur.com/s1PUSIe.png',
    btnBack: 'https://i.imgur.com/11aBhUf.png',
    btnHome: 'https://i.imgur.com/HTxI623.png'
  }
};
