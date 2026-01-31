
import { LeaderboardEntry, GameHistory } from '../types';

// 아래 주소에 본인이 2단계에서 복사한 웹 앱 URL을 꼭! 붙여넣으세요.
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbw49zVCUyOQD_DLdOxKqgAUqmWVWwll_swDiMAebcpEnDCfV7-895536cyxJkoSG8xf/exec';

export const supabaseService = {
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const response = await fetch(GOOGLE_SHEETS_URL);
      const data = await response.json();
      return data
        .map((item: any, index: number) => ({
          id: String(index),
          nickname: item.nickname || '익명',
          score: Number(item.score) || 0,
          created_at: `${item.date} ${item.time}`
        }))
        .sort((a: any, b: any) => b.score - a.score).slice(0, 10);
    } catch (e) { return []; }
  },

  async getGameHistory(nickname: string): Promise<GameHistory[]> {
    try {
      const response = await fetch(GOOGLE_SHEETS_URL);
      const data = await response.json();
      return data
        .filter((item: any) => item.nickname === nickname)
        .map((item: any, index: number) => ({
          id: String(index),
          nickname: item.nickname,
          score: Number(item.score),
          word: item.word,
          category: item.category,
          played_at: `${item.date} ${item.time}`,
          ai_analysis: item.ai_analysis
        })).reverse();
    } catch (e) { return []; }
  },

  async saveGameRecord(nickname: string, score: number, word: string, category: string): Promise<void> {
    try {
      await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors', // 구글 스크립트 특성상 필수 설정
        body: JSON.stringify({ nickname, score, word, category })
      });
    } catch (e) { console.error("저장 실패", e); }
  }
};
