declare module 'kuromoji/src/Tokenizer.js' {
  const Tokenizer: any;
  export default Tokenizer;
}
declare module 'kuromoji/src/dict/DynamicDictionaries.js' {
  const DynamicDictionaries: any;
  export default DynamicDictionaries;
}

/** アプリを作った日時（日本時間「11/16 23:05」。vite.config.ts の define で入れる） */
declare const __APP_BUILD__: string;

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
  webkitAudioContext?: typeof AudioContext;
}
