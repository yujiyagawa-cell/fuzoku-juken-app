import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kotobaSpec } from '../../modules/kotoba';
import { examplesFor } from '../../modules/kotoba/words';
import { SHAPE_SPEECH } from '../../modules/kakitashi/types';
import { traceInstruction, TRACE_KINDS } from '../../modules/kakitashi/trace';
import { makeStory, TEMPLATE_IDS } from '../../modules/ohanashi/stories';
import { QUESTION_TYPES } from '../../modules/registry';
import { SHITSUGI_BANK } from '../../modules/shitsugi';
import { ALL_KANA } from '../kana';
import { makeRng } from '../rng';
import { DEFAULT_SETTINGS } from '../settings';
import type { Settings } from '../types';
import { countKana, hasKanji, numKana, speechTextOf, toSpeechText } from './speechText';

// 読み上げは かなだけ（漢字は読み間違える。例：「方」を「かた」と読む）。数字も かなの読みに直す。

const spoken = (speech: string | undefined, prompt: string) => toSpeechText(speechTextOf(speech, prompt));
const bad = (s: string) => hasKanji(s) || /\d/.test(s);

describe('数の読み', () => {
  it('ふつうの数', () => {
    expect(numKana(0)).toBe('ぜろ');
    expect(numKana(4)).toBe('よん');
    expect(numKana(10)).toBe('じゅう');
    expect(numKana(17)).toBe('じゅうなな');
    expect(numKana(90)).toBe('きゅうじゅう');
    expect(numKana(180)).toBe('ひゃくはちじゅう');
  });

  it('音が変わる助数詞', () => {
    expect(countKana(1, 'こ')).toBe('いっこ');
    expect(countKana(6, 'こ')).toBe('ろっこ');
    expect(countKana(8, 'こ')).toBe('はっこ');
    expect(countKana(10, 'こ')).toBe('じゅっこ');
    expect(countKana(12, 'こ')).toBe('じゅうにこ');
    expect(countKana(1, 'かい')).toBe('いっかい');
    expect(countKana(3, 'かい')).toBe('さんかい');
    expect(countKana(1, 'ひき')).toBe('いっぴき');
    expect(countKana(3, 'ひき')).toBe('さんびき');
    expect(countKana(4, 'びき')).toBe('よんひき');
    expect(countKana(6, 'ぴき')).toBe('ろっぴき');
    expect(countKana(10, 'ひき')).toBe('じゅっぴき');
    expect(countKana(3, 'ほん')).toBe('さんぼん');
    expect(countKana(8, 'ぽん')).toBe('はっぽん');
    expect(countKana(1, 'にん')).toBe('ひとり');
    expect(countKana(2, 'にん')).toBe('ふたり');
    expect(countKana(4, 'にん')).toBe('よにん');
    expect(countKana(3, 'つ')).toBe('みっつ');
    expect(countKana(1, 'ふん')).toBe('いっぷん');
    expect(countKana(5, 'ふん')).toBe('ごふん');
    expect(countKana(6, 'さい')).toBe('ろくさい');
  });

  it('文の中の数字と ？', () => {
    expect(toSpeechText('「い」で はじまる 2もじの ことば')).toBe('「い」で はじまる にもじの ことば');
    expect(toSpeechText('みぎに 1かい まわすと')).toBe('みぎに いっかい まわすと');
    expect(toSpeechText('6この りんごを 2にんで')).toBe('ろっこの りんごを ふたりで');
    expect(toSpeechText('うえから 3ばんめ')).toBe('うえから さんばんめ');
    expect(toSpeechText('？に はいるのは どれですか。')).toBe('はてなに はいるのは どれですか。');
  });
});

describe('読み上げる文に 漢字・数字がない', () => {
  it('タップ問題（全タイプ・いろいろな seed）', () => {
    const ng: string[] = [];
    for (const t of QUESTION_TYPES) {
      if (!t.generate) continue;
      for (let seed = 1; seed <= 40; seed++) {
        const q = t.generate(makeRng(seed));
        const s = spoken(q.speech, q.prompt);
        if (bad(s)) ng.push(`${t.id}: ${s}`);
        if (q.preview?.speech && bad(toSpeechText(q.preview.speech))) ng.push(`${t.id} preview: ${q.preview.speech}`);
      }
    }
    expect([...new Set(ng)].slice(0, 10)).toEqual([]);
  });

  it('お話の記憶（お話と4問）', () => {
    const ng: string[] = [];
    for (const tid of TEMPLATE_IDS) {
      for (let seed = 1; seed <= 40; seed++) {
        const st = makeStory(tid, makeRng(seed));
        const s = toSpeechText(speechTextOf(st.speech, st.text));
        if (bad(s)) ng.push(`${tid}: ${s}`);
        for (const q of st.questions) {
          const qs = spoken(q.speech, q.prompt);
          if (bad(qs)) ng.push(`${tid} q: ${qs}`);
        }
      }
    }
    expect([...new Set(ng)].slice(0, 10)).toEqual([]);
  });

  it('質疑応答・ことば即答', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, childName: 'はな', childNameKanji: '花', age: 6, birthday: { month: 5, day: 3 }, handedness: 'right' };
    const ng: string[] = [];
    for (const q of SHITSUGI_BANK) {
      const spec = q.make(s);
      const t = spoken(spec.speech, spec.prompt);
      if (bad(t)) ng.push(`${q.key}: ${t}`);
    }
    for (const kana of ALL_KANA) {
      for (const length of [2, 3] as const) {
        if (!examplesFor(kana, length, s.moraRules).length) continue;
        const spec = kotobaSpec({ kana, length }, s);
        const t = spoken(spec.speech, spec.prompt);
        if (bad(t)) ng.push(`${kana}-${length}: ${t}`);
      }
    }
    expect(ng).toEqual([]);
  });

  it('書き足し・なぞりの指示', () => {
    expect(bad(toSpeechText(SHAPE_SPEECH))).toBe(false);
    for (const k of TRACE_KINDS) expect(bad(toSpeechText(traceInstruction(k))), k).toBe(false);
  });

  it('ソースの speak("…") に 漢字がない', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) files.push(p);
      }
    };
    walk(resolve('src'));
    const ng: string[] = [];
    const re = /speak\(\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g;
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(re)) if (hasKanji(m[2])) ng.push(`${f}: ${m[2]}`);
    }
    expect(ng).toEqual([]);
  });
});
