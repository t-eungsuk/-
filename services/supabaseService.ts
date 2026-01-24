import { createClient } from '@supabase/supabase-js';
import { LeaderboardEntry, GameHistory } from '../types';

// NOTE: In a real deployment, these would come from process.env
const SUPABASE_URL = process.env.SUPABASE_URL || ''; 
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const isConfigured = SUPABASE_URL && SUPABASE_ANON_KEY;

const supabase = isConfigured 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

export const supabaseService = {
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    if (!supabase) {
      // Mock data updated to Mario characters
      return [
        { id: '1', nickname: '마리오', score: 5000, created_at: new Date().toISOString() },
        { id: '2', nickname: '쿠파', score: 4500, created_at: new Date().toISOString() },
        { id: '3', nickname: '키노피오', score: 4000, created_at: new Date().toISOString() },
      ];
    }

    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
    return data as LeaderboardEntry[];
  },

  async getGameHistory(nickname: string): Promise<GameHistory[]> {
    if (!supabase) {
        // Mock History
        return [
            { id: '101', nickname, score: 300, word: '사자', category: '동물', played_at: new Date(Date.now() - 10000000).toISOString() },
            { id: '102', nickname, score: 450, word: '나비', category: '동물', played_at: new Date(Date.now() - 5000000).toISOString() },
            { id: '103', nickname, score: 200, word: '가', category: '기본', played_at: new Date(Date.now() - 100000).toISOString() },
        ];
    }

    const { data, error } = await supabase
        .from('game_history')
        .select('*')
        .eq('nickname', nickname)
        .order('played_at', { ascending: false });

    if (error) {
        console.error('Error fetching history:', error);
        return [];
    }
    return data as GameHistory[];
  },

  async saveGameRecord(nickname: string, score: number, word: string, category: string): Promise<void> {
    if (!supabase) {
      console.log(`[MOCK DB] Saved record: ${nickname} - ${word} (${score})`);
      return;
    }

    // 1. Save to History
    const { error: historyError } = await supabase
        .from('game_history')
        .insert([{ nickname, score, word, category, played_at: new Date().toISOString() }]);

    if (historyError) console.error('Error saving history:', historyError);

    // 2. Update Leaderboard (Simple max score logic or just insert new entry)
    const { error: lbError } = await supabase
      .from('leaderboard')
      .insert([{ nickname, score }]);

    if (lbError) {
      console.error('Error saving leaderboard:', lbError);
    }
  }
};