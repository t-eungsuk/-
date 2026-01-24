
import { GoogleGenAI, Type } from "@google/genai";
import { WordData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const BASIC_HANGUL_SETS = [
  { word: "가", syllables: ["ㄱ", "ㅏ"], hint: "ㄱ + ㅏ = ?" },
  { word: "나", syllables: ["ㄴ", "ㅏ"], hint: "ㄴ + ㅏ = ?" },
  { word: "도", syllables: ["ㄷ", "ㅗ"], hint: "ㄷ + ㅗ = ?" },
  { word: "루", syllables: ["ㄹ", "ㅜ"], hint: "ㄹ + ㅜ = ?" },
  { word: "미", syllables: ["ㅁ", "ㅣ"], hint: "ㅁ + ㅣ = ?" },
  { word: "비", syllables: ["ㅂ", "ㅣ"], hint: "ㅂ + ㅣ = ?" },
  { word: "소", syllables: ["ㅅ", "ㅗ"], hint: "ㅅ + ㅗ = ?" },
  { word: "우", syllables: ["ㅇ", "ㅜ"], hint: "ㅇ + ㅜ = ?" }
];

export const THEME_BACKGROUNDS: Record<string, string> = {
  start: 'https://i.imgur.com/5Aq3P2d.png',  // 첫 접속 화면 고정 이미지
  main: 'https://i.imgur.com/4aaYxcV.png', 
  forest: 'https://i.imgur.com/4aaYxcV.png', // 기본한글
  zoo: 'https://i.imgur.com/BJmQSex.png',    // 동물단어
  mountain: 'https://i.imgur.com/adozIzp.png', // 식물단어
  city: 'https://i.imgur.com/Rr2JUFG.png'      // 생활단어
};

export const geminiService = {
  preloadFallbackImages() {
    Object.values(THEME_BACKGROUNDS).forEach(url => {
        const img = new Image();
        img.src = url;
    });
  },

  async generateWord(category: string, previousWords: string[]): Promise<WordData> {
    if (category === '기본') {
      const available = BASIC_HANGUL_SETS.filter(s => !previousWords.includes(s.word));
      const target = available.length > 0 
        ? available[Math.floor(Math.random() * available.length)]
        : BASIC_HANGUL_SETS[Math.floor(Math.random() * BASIC_HANGUL_SETS.length)];
      
      return { ...target, category: '기본' };
    }

    try {
      const model = 'gemini-3-flash-preview';
      const prompt = ` Generate ONE simple Korean word for category: "${category}" (2-3 syllables). Exclude: ${previousWords.join(', ')}. Return JSON.`;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              syllables: { type: Type.ARRAY, items: { type: Type.STRING } },
              hint: { type: Type.STRING }
            },
            required: ["word", "syllables", "hint"]
          }
        }
      });

      if (response.text) {
        return { ...JSON.parse(response.text), category } as WordData;
      }
      throw new Error("No text");
    } catch (error) {
      return { word: "바나나", syllables: ["바", "나", "나"], hint: "길고 노란 과일", category: "Fallback" };
    }
  },

  getBackground(theme: string): string {
    return THEME_BACKGROUNDS[theme] || THEME_BACKGROUNDS['forest'];
  }
};
