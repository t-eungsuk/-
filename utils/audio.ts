
let audioCtx: AudioContext | null = null;
let bgmOscillators: OscillatorNode[] = [];
let nextNoteTime = 0;
let timerID: number | null = null;
let currentBgmType: 'normal' | 'boss' | 'star' = 'normal';

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

export const playSound = (type: 'jump' | 'doubleJump' | 'coin' | 'block' | 'stomp' | 'clear' | 'damage' | 'wrong' | 'time_warning' | 'block_crack' | 'block_break') => {
  const ctx = initAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;

  switch (type) {
    case 'jump':
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(300, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
      break;
    case 'doubleJump':
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(450, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
      break;
    case 'coin':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(1600, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
      break;
    case 'block':
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
      break;
    case 'block_crack':
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
      break;
    case 'block_break':
      // 부드러운 뽀각 소리 (Soft Crunchy Break)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.15);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
      break;
    case 'stomp':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
      break;
    case 'damage':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
      break;
    case 'time_warning':
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
      break;
    case 'clear':
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const t = now + i * 0.1;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square'; o.frequency.value = freq;
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        o.start(t); o.stop(t + 0.4);
      });
      break;
  }
};

// BGM Basslines
const NORMAL_BASS = [110, 110, 130, 130, 146, 146, 130, 110];
const BOSS_BASS = [55, 55, 82, 82, 73, 73, 65, 65];
const STAR_BASS = [220, 220, 261, 261, 293, 293, 329, 329, 392, 392, 329, 329, 293, 293, 261, 261]; // Fast Upbeat

export const startBGM = (type: 'normal' | 'boss' | 'star' = 'normal') => {
  const ctx = initAudio();
  if (bgmOscillators.length > 0 && currentBgmType === type) return;
  stopBGM();
  
  currentBgmType = type;
  let noteIndex = 0;
  nextNoteTime = ctx.currentTime + 0.1;

  const scheduleNotes = () => {
    while (nextNoteTime < ctx.currentTime + 0.5) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      let freqs = NORMAL_BASS;
      let speed = 0.25;
      let duration = 0.2;
      let volume = 0.03;
      osc.type = 'triangle';

      if (type === 'boss') {
          freqs = BOSS_BASS;
          speed = 0.18;
          duration = 0.15;
          volume = 0.05;
          osc.type = 'sawtooth';
      } else if (type === 'star') {
          freqs = STAR_BASS;
          speed = 0.12; // Very fast
          duration = 0.1;
          volume = 0.06;
          osc.type = 'square';
      }
      
      const freq = freqs[noteIndex % freqs.length];
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      gain.gain.setValueAtTime(volume, nextNoteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + duration);
      
      osc.start(nextNoteTime);
      osc.stop(nextNoteTime + duration + 0.1);
      bgmOscillators.push(osc);
      
      nextNoteTime += speed;
      noteIndex++;
      if (bgmOscillators.length > 30) bgmOscillators = bgmOscillators.slice(15);
    }
    timerID = window.setTimeout(scheduleNotes, 100);
  };
  scheduleNotes();
};

export const stopBGM = () => {
  if (timerID !== null) { clearTimeout(timerID); timerID = null; }
  bgmOscillators.forEach(osc => { try { osc.stop(); } catch(e) {} });
  bgmOscillators = [];
};
