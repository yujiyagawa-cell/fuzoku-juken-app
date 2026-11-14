# 附属小 受験れんしゅう — 作りと分担

Vite + React 18 + TypeScript + vite-plugin-pwa + Dexie。Android Chrome の PWA。仕様の元は `fuzoku_app_spec.md`（ダウンロードフォルダ）と、手書きノートの書き起こし（スクラッチパッド `notes/transcription.md`。公開リポジトリには入れない）。

## 守ること（全員）

- 歌詞・録音・外部画像は入れない。絵は SVG と絵文字（`src/ui/emoji.tsx` の `Emoji` / `EMOJI`）だけ。
- 子ども向けの文はひらがな・分かち書き・敬語（「〜してください」「〜ですか」）。保護者向けは漢字まじりでよい。
- **読み上げる文は かなだけ**（漢字は読み間違える。例：「方」を「かた」）。`TapQuestion.speech`・`VoiceQSpec.speech` に漢字があると `prompt` を読む（`speechTextOf`）。数字は `speak()` が かなの読みに直す（「1こ」→いっこ、「2にん」→ふたり。`src/core/speech/speechText.ts`）。`speechText.test.ts` が全部の問題を生成して、漢字・数字が残っていないか確かめる。
- オフラインで動く（音声認識だけはネットが必要）。新しい npm パッケージは足さない。
- **自分の担当ファイル以外は編集しない。** 共有ファイル（`src/core/*`, `src/player/*`, `src/ui/*`, `src/styles/app.css`, `src/modules/registry.ts`, `src/App.tsx`）を変えたいときは、変えずに最終報告で「何をどう変えたいか」を書く。CSS が足りないときは自分のファイルの中で `style={{}}` を使う。
- 確認は `npx tsc --noEmit` と `npx vitest run`。ほかの人の作業中のファイルでエラーが出ても直さない（自分のファイルのエラーだけ直す）。dev サーバーやブラウザは起動しない（統合とブラウザ確認はメインがやる）。git は使わない。

## フォルダ

```
src/core/       型(types.ts)・DB(db.ts)・設定(settings.tsx)・乱数(rng.ts)・かな(kana.ts)・判定(judge.ts)・
                読み仮名(reading.ts)・音(audio.ts)・ジャンル(genres.ts)・苦手な音(weakKana.ts)・音声(speech/*)
src/player/     問題の契約(types.ts)・タップ1問(TapRound.tsx)・タップ連続(TapSetRunner.tsx)・声の流れ(voice.tsx)・
                記録(session.ts)・計画(plan.ts)・部品(parts.tsx)
src/modules/    モジュールごと（index.tsx が xxxModule: ModuleDef と XXX_TYPES: QuestionType[] を export）
src/screens/    画面。保護者用は screens/parent/
src/ui/         共通部品(components.tsx)・アイコン(icons.tsx)・絵文字(emoji.tsx)・モード(mode.tsx)・ルーター(router.ts)
```

## 分担（ファイルの持ち主）

- **メイン**：`src/core/*` `src/player/*` `src/ui/*` `src/styles/*` `src/App.tsx` `src/main.tsx` `src/modules/registry.ts` `src/modules/common.tsx` `src/modules/zukei/index.tsx`、モジュール `taiki` `uta` `kotoba` `shitsugi`、画面 `Home` `SetSetup` `Player` `Results` `Songs`、PWA アイコン、ビルド・ブラウザ確認。
- **Z1**：`src/modules/zukei/typesA.tsx` と `src/modules/zukei/a/**`（＋テスト `src/modules/zukei/a/*.test.ts`）
- **Z2**：`src/modules/zukei/typesB.tsx` と `src/modules/zukei/b/**`、`src/modules/ohanashi/**`（＋テスト）
- **M**：`src/modules/kakitashi/**`、`src/modules/hyogen/**`
- **P**：`src/screens/parent/**`、`src/core/progress.ts`、`src/core/practiceItems.ts`（＋テスト `src/core/progress.test.ts`）

各モジュールの `index.tsx` は `xxxModule` と `XXX_TYPES` の名前を変えないこと（registry.ts が読む）。

## 問題の契約（src/player/types.ts）

- `QuestionType`：カタログ・進捗・おまかせの単位。`id` は全体で一意（例 `zukei-rotate-box`）。`source` は `'本番' | 'ノート' | 'ノート（予想）' | 'とっくん42' | 'とっくん65' | '365日' | '仕様' | 'アプリ（追加）'` のどれか。**ふだん出すのはプリント（本番・ノート・ノート（予想））にある問題だけ**。それ以外はカタログで「良い」にしたときだけ出す（`src/modules/scope.ts`）。種類を指定した練習ではどれでも出せる。`priority` 3=本番で出た・最重要、2=ノートにある、1=予想・補助。`speedTargetSec` は「答えるまでの秒数」の目標（進捗の Lv4 判定に使う）。
- タップ問題は `generate(rng) => TapQuestion` を持つ。`rng`（`src/core/rng.ts`）だけを乱数に使う（同じ seed なら同じ問題）。
- `TapQuestion`：`prompt`（ひらがな・分かち書き。保護者パネルに出る）、`speech`（読み上げ用。漢字まじり可。省略で prompt）、`figure`（問題の絵）、`choices`（3〜4択が基本。`id` は一意、`label` はひらがなの名前）、`answer`（choice の id。order モードは正しい順の id 配列）、`params`（記録用の小さな JSON。ReactNode を入れない）、`explain`（保護者向けの説明）、`askReason`（答えたあと「どうして その こたえ ですか」と聞く）、`preview`（先に見せて隠す：絵の記憶）。
- 表示：`TapRound` が `figure` を `.figure-card`（白・角丸）に、選択肢を `.choice` ボタン（4択は 2列×2行、3択は3列）に入れる。画面幅は 330〜380px。図は `<svg viewBox=... style={{ width: '100%', maxHeight: 230 }}>`、選択肢の絵は `style={{ width: '100%', maxHeight: 110 }}` くらい。線は `#1e2a3b`・太さ 2.5〜3、塗りは淡い色（#dceeff・#fff2c6・#e2f5e6・#ffe4ec など）。色だけで区別させない。
- 子どもには正誤を見せない（設定でその場表示にできる）。時間切れは TapRound が「大丈夫です」と言って次へ。
- 記録は `TapSetRunner` がやる（`questionType = q.type`）。独自ランナーは `session.record()` を呼ぶ。

## タイプ一覧（作るもの）

### Z1（typesA）— 図形・推理 A
| id | 名前 | source | priority | 中身 |
|---|---|---|---|---|
| zukei-rotate-box | 回転（旗の箱） | 本番 | 3 | 四角い箱に旗などの印。「みぎに ◯かい まわすと どれに なりますか」（1回＝90°）。選択肢に鏡像・別の角度を混ぜる。speedTarget 8 |
| zukei-rotate-grid | マス目の回転 | とっくん42 | 2 | 3×3 のマス目に ●▲ など2〜3個。90°/180° 回したものを選ぶ |
| zukei-rotate-arrow | ▷の回転（90°・180°） | ノート | 2 | ▷ を回すとどの向きか（▷◁△▽ と矢印つきの形） |
| zukei-ferris | 観覧車 | 本番 | 3 | 6〜8個のゴンドラに動物の絵文字、回る向きを矢印で。「◯こ うごくと いちばん うえに くる どうぶつは どれですか」。`askReason: true`（本番で理由を聞かれた） |
| zukei-rotate-table | 回るテーブル | とっくん42 | 1 | 丸いテーブルの上の物が回る。「◯こ まわると、くまの まえに くるのは どれですか」 |
| zukei-tsumiki-count | 積み木の数 | 本番 | 3 | 立方体を積んだ見取図（3〜10個、下に隠れた積み木あり）。選択肢は「数字＋点」のカード。speedTarget 8 |
| zukei-tsumiki-donguri | 積み木と同じ数のどんぐり | ノート | 2 | 見取図と同じ数のどんぐり（SVG）の絵を選ぶ |
| zukei-tsumiki-views | 四方からの見え方 | 本番 | 3 | 積み木を前・横・上から見た図を選ぶ（2〜3列、高さ1〜3） |
| zukei-same-shape | 同じ形さがし | ノート（予想） | 2 | 見本を回したもの（正解）と鏡像（不正解）を混ぜる |
| zukei-series | 系列（きまりの並び） | ノート（予想） | 2 | ◯△□ などの繰り返し（周期2〜4）。「？に はいるのは どれですか」 |
| zukei-coordinates | 座標（マス目の位置） | ノート（予想） | 2 | マス目に絵文字。「うえから ◯ばんめ、ひだりから ◯ばんめ」にあるもの |
| zukei-puzzle | パズル（絵の分割） | ノート（予想） | 1 | 簡単な絵を3〜4つに分け、足りないかけらを選ぶ |
| zukei-split | 同じ数ずつ分ける | 365日 | 1 | 「◯この りんごを ふたりで おなじ かずずつ わけると…」 |

### Z2（typesB ＋ ohanashi）— 図形・推理 B と お話の記憶
| id | 名前 | source | priority | 中身 |
|---|---|---|---|---|
| zukei-length | 長さくらべ（電車・鉛筆・ひも） | 本番 | 3 | 本番は「電車の一番長いもの・一番短いもの」。ひもは折れ線も。3〜4本 |
| zukei-water | 水の量 | ノート | 2 | 同じ容器で水位違い／違う容器で同じ水位。「いちばん おおく」「いちばん すくない」 |
| zukei-weight | 重さ（シーソー） | ノート（予想） | 2 | 2〜3組のシーソーから一番重いもの・軽いもの |
| zukei-area | 広さ | ノート（予想） | 1 | マス目を塗った形。一番広いもの |
| zukei-more-less | 多い・少ない | 365日 | 1 | 2種類の絵文字。「どちらが おおいですか」「いくつ おおいですか」 |
| zukei-gloves | 手袋・くつした | ノート（予想） | 1 | 「◯にんの こどもが てぶくろを します。いくつ いりますか」 |
| zukei-story-order | お話の順番 | ノート（予想） | 2 | 3〜4場面を正しい順にタップ（`mode: 'order'`）。たね→め→はな、たまご→ひよこ→にわとり など |
| zukei-picture-memory | 絵の記憶 | 365日 | 2 | `preview` で 5秒見せて隠す →「なにが ありましたか」「どこに ありましたか」 |
| zukei-who-am-i | わたしは だれでしょう | 365日 | 1 | ヒントを3つ読み上げ（「みみが ながいです」…）、絵文字から選ぶ |
| zukei-mukashi | 昔話・絵本 | ノート（予想） | 1 | 昔話（ももたろう・うらしまたろう・かぐやひめ・おむすびころりん・つるのおんがえし・さるかにがっせん・きんたろう・はなさかじいさん・3びきのこぶた・おおきなかぶ 等、著作権の切れた話のみ）。「◯◯に でてくるのは どれですか」 |
| zukei-kisetsu | 季節・行事 | 365日 | 1 | 「なつの ものは どれですか」など（花・行事・天気） |
| ohanashi-kakekko | お話：かけっこ | 本番 | 3 | ノート17枚目：動物4匹、さくらの木まで競走、ウサギよりリスが速く、クマよりウサギが速い、1位はリス →「なんびき」「きせつ」「1ばん」「いちばん おそい」 |
| ohanashi-yukidaruma | お話：雪だるま | ノート | 2 | ノート4枚目：雪の山に うさぎ・くま・たぬき・きつね、雪だるまの大きさくらべ（うさぎが一番小さい、たぬき＞くま、きつね＞たぬき）→「いちばん おおきい」「いちばん ちいさい」「なにを つくった」「きせつ」 |
| ohanashi-otsukai | お話：おつかい | 仕様 | 1 | 誰が・何を・いくつ・何色の袋で買ったか |
| ohanashi-odekake | お話：きせつの おでかけ | 仕様 | 1 | 季節の行事（七夕・お月見・雪あそび等）・誰と・持ち物 |

- お話はテンプレートに語句を差し込んで毎回変える（登場する動物・順位・数・季節を入れかえる）。
- `ohanashiModule.Runner` は独自ランナー：スタート → お話を1回だけ読み上げ（文字は出さない。耳のアイコン）→ 4問を `TapRound` で順に（問題文だけ読み上げ、お話は読み直さない）→ 1問ずつ `session.record({ moduleId: 'ohanashi', questionType: 'ohanashi-xxx', ... })`。`count` はお話の数（わ）。保護者パネルにお話の全文と答えを出す。
- 実際の試験：「お話を聞いたあと4問くらい、指差しで答える」「1回しか流れない」。

### M（kakitashi ＋ hyogen）
**絵の書き足し**（KAKITASHI_TYPES）
| id | 形 | source | priority | 作例（完成後に文字で見せる） |
|---|---|---|---|---|
| kakitashi-rect | 長方形 | 本番 | 3 | 電車（真ん中の車両）、旗（日の丸）、マスク |
| kakitashi-triangle | 三角 | 本番 | 3 | トイレマーク、シーソー（支点）、いえの屋根、イカの頭 |
| kakitashi-halfUp | 半円（弧が上） | 本番 | 3 | カメの甲羅、帽子 |
| kakitashi-halfDown | 半円（弧が下） | ノート | 2 | 笑った口、風車の羽、トンボの羽 |
| kakitashi-square | 正方形 | ノート | 2 | サイコロ、いえの壁、おにぎりの海苔 |
| kakitashi-diamond | ひし形 | ノート | 2 | 鳥のくちばし |
| kakitashi-circle | 円 | 仕様 | 1 | （顔、太陽、ボール など） |
| zukei-trace | 点線なぞり・線をひく（genre は `zukei`） | ノート | 2 | 直線・曲線・ジグザグの点線を指でなぞる。はみ出しと時間を記録、判定は保護者 |

- 画面中央に形を1つ（赤っぽい線、例 `#d0453a`）。指で描く（Pointer Events、黒1色・太さ固定、消しゴムなし、「さいしょから」だけ）。読み上げ「この かたちを つかって じゆうに えを かいてください。」。
- 制限時間は `settings.kakitashiTimeLimitSec`（0＝なし）。時間がきたら `buzzer` と「おしまいです」。ガイド「かたちの そとにも かこう」は `settings.kakitashiGuide` のときだけ表示。
- 「できた」→ PNG を `db.drawings.add({ shape, pngDataUrl, starred: false, sessionId, seconds })` → 作例を文字で表示 → 保護者が判定（よくできた＝correct／もうすこし＝wrong）と ◎（本番で使う＝starred）。`session.record({ moduleId: 'kakitashi', questionType: 'kakitashi-xxx', answerMode: 'parent', latencyMs: 描き始めまでの時間, latencySource: 'tap', meta: { drawingId, seconds, strokes } })`。
- 形の選び方：`types` 指定があればその中から、なければ書き足しの7タイプから（priority の高いもの・まだ少ないものを多めに）。`zukei-trace` は `types` に入っているときだけ出す。
- shape の名前（drawings.shape）は `rect | triangle | halfUp | halfDown | square | diamond | circle`（`ShapeGlyph` と同じ）。

**表現・模倣**（HYOGEN_TYPES、すべて保護者判定 `answerMode: 'parent'`）
| id | 名前 | source | priority | 中身 |
|---|---|---|---|---|
| hyogen-rhythm-walk | 手拍子のリズムで歩く | 本番 | 3 | `playClaps(pattern, bpm)`（光る丸も表示）→「その リズムの とおりに あるいてください」 |
| hyogen-pose | 手と足のまね | 本番 | 3 | 棒人間 SVG のポーズを2〜3個、1つずつ見せる → 「おなじように うごいてください」 |
| hyogen-sing-copy | まねして歌う | 本番 | 2 | オリジナルの短いメロディ（`playMelody`、ペンタトニックで毎回作る。既存曲は使わない）→「らら で まねして うたってください」 |
| hyogen-instrument | 楽器を選んで鳴らす | 本番 | 2 | トライアングル・カスタネット・タンバリン・すず（SVG）から選ぶ → `startTune` の間、カードをたたくと音が鳴る |
| hyogen-metronome | メトロノームに合わせて歩く | ノート | 2 | `startMetronome(bpm)` 15秒（途中で速さが変わることも） |
| hyogen-dance | 自由に踊る | ノート | 2 | `startTune` 20秒「てと あしを うごかして じゆうに おどってください」 |
- 判定パネル：○できた／×できなかった、「すぐ はじめた」（`parentChecks.immediate`）、「どうどうと できた」（`meta.confident`）。指示は1回だけ（本番どおり）。

### P（保護者画面・進捗）
画面は `screens/parent/` の7つ（関数名は今のスタブと同じ）。データは `useLive(() => db.xxx.toArray(), [], [])`。
1. **ProgressScreen（進捗（レベル）一覧）** — 今回の一番大事な追加。子どもがアプリで解いた正答率・速さと、運動・生活ログ（ぞうきん絞りなど）・待機練習から、項目ごとのレベルと全体の進み具合を一覧にする。
   - 上：全体の「じゅんび度」（%、priority で重みづけ）と目標 60% の線、試験まであと何日、Lv の内訳、「本番で出た項目」だけのじゅんび度。
   - ジャンル（`GENRES` の順）ごとに項目を並べる：名前・出どころチップ（本番／ノート／予想…）・Lv バッジ（Lv0 まだ／Lv1 れんしゅう中／Lv2 もうすこし／Lv3 できる／Lv4 ばっちり）・数字（例「8/10 正解・平均 3.2秒」「最新 12秒 ○」）・最後にやった日。
   - 絞り込み：すべて／アプリ（子どもが操作）／練習ログ（運動・生活）／Lv2以下だけ。
   - 「今日のおすすめ」：priority が高く Lv が低い、または3日以上やっていない項目を3つ。
   - 項目をタップ → 詳細（最近の結果、レベルの条件、次の Lv までに何が足りないか）と「これを練習」（アプリの項目 → `navigate('/setup?m=<moduleId>&types=<typeId>')`）／「記録する」（練習ログ → `navigate('/log?item=<id>')`）。
2. **RecordsScreen（記録）** — 仕様 6.9：モジュール別の正答率と平均回答秒数の推移（日別の折れ線、SVG 自作）、総合正答率に 60% の線、苦手な音（`computeWeakKana(attempts, kanaSeeds)`）、正答率の低い問題タイプ上位5、待機練習の成功時間の推移、運動・生活ログの最新値、最近の記録一覧（判定の上書き `overrideJudge`）。
3. **LogScreen（運動・生活ログ）** — `practiceItems.ts` の項目ごとに入力（秒数・○×・きれいさ3段階・回数・メモ）と履歴。`?item=` で開いたらその項目を開く。ストップウォッチ（設定した時間で `buzzer` と「おしまいです」の読み上げ。はさみ・折り紙・箸用）。
4. **NetachoScreen（ネタ帳）** — `db.drawings` を形ごとに一覧（サムネイル）、◎（本番で使う）切り替え、削除（確認あり）、形ごとの作例。
5. **CatalogScreen（問題カタログ）** — ジャンルごとに全タイプ（`QUESTION_TYPES`）。タップ問題は `generate(makeRng(seed))` の見本を静的に描く（問題の絵＋選択肢、正解に印、「べつの もんだい」で作り直し）。それ以外は `sample` と説明。評価ボタン 良い／直す／外す（`db.reviews.put`、外すとおまかせ・連続出題で出なくなる）とメモ。「追加したい問題のメモ」（`db.ideas`）。
6. **SettingsScreen（設定）** — 子どもの情報（名前ひらがな・漢字、年齢、誕生日、保育園／幼稚園、利き手）、試験日、本番再現ルール（読み上げ回数1/2、タップ制限時間、無音タイムアウト、正誤のその場表示、自動で次へ）、読み上げ（速さ 0.8〜1.2、声の選択 `japaneseVoices(await getVoices())`、試しに読む）、ことば（拗音・促音・長音の数え方、濁音の許容、濁音・半濁音も出す、3文字の割合、質疑応答に混ぜる）、書き足し（制限時間、ガイド）、音声認識 on/off、性質の候補リスト編集、データ（JSON 書き出し `{ app: 'fuzoku-juken', version: 1, exportedAt, tables: { [TABLE_NAMES]: rows } }`・読み込み・全削除は確認ダイアログ）。
7. **OnboardingScreen（はじめての設定）** — 開いたら保護者モードにする（`useMode().setMode('parent')`）。説明（「音声は Google のサーバーで文字に変換されます。録音は保存しません」）→ 子どもの情報 → マイク許可（`requestMicPermission`）と音声テスト（「『ねこ』と いってください」→ `listen` → 文字・読み（`fullReading`）・文字数（`countMora`）・回答秒数）→ 完了で `update({ onboarded: true })` → ホームへ。「あとで設定する」でも onboarded にする。

**`src/core/practiceItems.ts`**（運動・生活の練習項目。ノートと仕様 6.8 から）
`export interface PracticeItem { id; name; genre: 'undo' | 'seikatsu'; source; priority: 1|2|3; fields: { seconds?: { better: 'higher' | 'lower'; target?: number }; ok?: boolean; quality?: boolean; count?: { label: string } }; tip?: string }` と `PRACTICE_ITEMS`。
- 運動：鉄棒ダンゴムシ（秒・目標10秒・本番）、鉄棒つばめ（○×・本番）、鉄棒ぶら下がり（秒・本番「すぐ落ちた子がいた」）、くま歩き（秒・転んだ回数・本番「なるべく速く」）、跳び箱（3段に登ってフワッと降りる／丸の中へ・○×・本番）、平均台（またいで進む・秒・落ちた回数・ノート予想）、ケンケンパ（左ケン・両パ・○×・ノート予想）、前転（○×・ノート）。
- 生活・巧緻性：ぞうきん絞り（○×・ノート）、はさみ（線のとおり・ひし形・秒・きれいさ・本番）、折り紙（三角・四角・○×・きれいさ・ノート）、箸で移す（おはじき3＋スポンジ3・秒・ノート）、ちょうちょ結び（○×・ノート）、しばったヒモをほどいて元通り（○×・ノート）、服（シャツ）たたみ（秒・○×・ノート予想）、傘をたたむ（○×・ノート予想）、給食着を着る（○×・ノート予想）、くつをそろえてしまう（○×・ノート）、合図で片付ける（○×・ノート）、洗濯バサミを戻す（○×・仕様）、プレートパズル（秒・○×・ノート）、積み木で見本を再現（ロボット・秒・○×・本番）、みんなで協力して積み木（声かけできた・○×・本番）。
- tip にノートの注意（例：ダンゴムシ「『いいですよ』と言われるまでガマン」、跳び箱「フワッと降りてください」、運動全般「途中で失敗してもやり直さない」）。

**`src/core/progress.ts`**（レベル計算。テストも書く）
- `export type Lv = 0|1|2|3|4`、`LEVEL_LABELS`、`export interface ProgressItem { id; kind: 'type'|'practice'|'waiting'; name; genre; source; priority; level: Lv; metric: string; next?: string; lastAt?: string; count: number; moduleId?; typeId?; practiceItemId? }`
- `export function computeProgress(input: { attempts; practiceLogs; waitingLogs; types: QuestionType[] }): { items: ProgressItem[]; readiness: number; examReadiness: number; byGenre: Record<GenreId, { readiness: number; items: ProgressItem[] }> }`
- アプリの項目（タイプごと、最近10回の finalJudge）：Lv0 記録なし／Lv1 正答率50%未満／Lv2 50〜79%（または80%以上でも5回未満）／Lv3 80%以上かつ5回以上／Lv4 Lv3 に加えて speedTargetSec 以内（正解の回答秒数の中央値）・最後の3回が続けて正解・2日以上に分けて練習。
- 練習ログ：Lv0 記録なし／Lv1 やった（最新が × か目標未満）／Lv2 1回でも ○（または目標達成）／Lv3 最新2回つづけて ○／Lv4 最新3回つづけて ○ かつ（きれいさがあれば 3、秒の目標があれば達成）。
- 待機（`taiki-wait` の行）：Lv0 記録なし／Lv1 やった／Lv2 5分成功／Lv3 10分成功／Lv4 20分成功（`waitingLogs` の success と durationMin）。
- じゅんび度 = Σ(priority × level/4) ÷ Σ(priority)。examReadiness は source が「本番」の項目だけ。

## 記録の共有（スマホどうし）（2026-11-14 追加）

- 保存先：保護者が作る Firebase プロジェクトの Firestore。`rows` コレクション1つ（1家族だけが使うプロジェクトなので、合言葉なし）。匿名ログイン＋ルール `allow read, write: if request.auth != null`（`FIRESTORE_RULES`）。
- Firebase の設定は、公開しているアプリ・リポジトリには入れない。設定画面に貼りつけ → `db.syncMeta`（このスマホだけ）。家族のスマホへは設定つきURL（`EnvSnapshot.y`）で渡す。
- `src/core/sync/`
  - `rows.ts`：共有する表（`SYNC_TABLES` = `TABLE_NAMES`）、行キー、canonical JSON とハッシュ。設定の端末ごとの項目（`voiceURI`・`onboarded`）は送らず、受けとっても このスマホの値を残す。
  - `dirty.ts`：このスマホで変わった行。`db.ts` の DBCore ミドルウェアが書く（localStorage にも保存）。共有から入れた行（トランザクションに `__fzSync`）はおぼえない。表の `clear()` は「消した」と扱わず、全部受けとり直す（JSON の読み込み・設定つきURL）。
  - `engine.ts`：受けとる（前に受けとった時刻 `cursor` より新しい行だけ。このスマホの未送信の変更の方が新しければ残す）→ はじめてのときは保存先の内容に合わせてから、全部の行を見直して送る（保存先にない行・変わった行・消した行）。
  - `firestoreRemote.ts`：Firebase SDK（共有しているときだけ動的 import。最初の読みこみを重くしない）。
  - `index.ts`：始める（`enableSync`）・やめる（`disableSync`）・アプリを開いたとき（`startSyncIfConfigured`）・ようす（`useSyncStatus`）。
- 1行 = 1文書 `{ t, k, j: JSON 文字列, del, u: 変わった時刻 ms, d: 端末 ID, su: serverTimestamp }`。文書 ID は `表~encodeURIComponent(主キー)`。900KB をこえる行は送らない。
- 「全部削除」「ゼロから始める」は、先にこのスマホの共有をやめる（共有している記録は消さない）。
- テスト：`src/core/sync/engine.test.ts`（fake-indexeddb ＋ メモリの中の保存先）。npm は firebase と fake-indexeddb（テスト用）を足した（保護者の依頼）。

## うたの録音（2026-11-15 追加）

- 設定「うたを録音する」（初期値オン）。うたの問題で、音声認識と同時に MediaRecorder で録る（`src/core/speech/recorder.ts`）。webm/Opus 32kbps を先に（40秒で約 210KB）、だめなら mp4/AAC。最長 40秒。
- 音がまったく入っていない録音（マイクを取られて無音）は保存しない。「うたわない」の判定・声が聞こえなかったときも残さない。
- `db.recordings`（v4）：`{ id, attemptId, mime, dataUrl, durationMs, createdAt }`。Attempt の `meta.recId`・`meta.recMs` でつなぐ。書き出し・記録の共有にも入る。
- 聞く所：うたの問題の保護者パネル（終わったあと）と「うたと え」（押したときに読みこむ。保護者は消せる）。
- Android で音声認識と録音のマイクの取り合いが起きると、自動判定か録音のどちらかが効かないことがある（実機で未確認）。
