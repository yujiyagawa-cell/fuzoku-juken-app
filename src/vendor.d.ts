declare module 'kuromoji/src/Tokenizer.js' {
  const Tokenizer: any;
  export default Tokenizer;
}
declare module 'kuromoji/src/dict/DynamicDictionaries.js' {
  const DynamicDictionaries: any;
  export default DynamicDictionaries;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
  webkitAudioContext?: typeof AudioContext;
}
