/* Story data: manifest, sketch figures, fates, chapters. */
(function (global) {
  'use strict';

  // 乗員名簿（名簿の並び順）
  const CREW = [
    { id: 'hargrave', name: 'ジョナス・ハーグレイヴ', role: '船長', nat: 'イングランド' },
    { id: 'vale', name: 'エドマンド・ヴェイル', role: '一等航海士', nat: 'イングランド' },
    { id: 'reed', name: 'トマス・リード', role: '船医', nat: 'スコットランド' },
    { id: 'oconnor', name: 'サミュエル・オコナー', role: '甲板長', nat: 'アイルランド' },
    { id: 'moretti', name: 'ルカ・モレッティ', role: '料理番', nat: 'イタリア' },
    { id: 'strand', name: 'ヘンリク・ストランド', role: '水夫', nat: 'ノルウェー' },
    { id: 'crowe', name: 'ダニエル・クロウ', role: '水夫', nat: 'イングランド' },
    { id: 'pike', name: 'ジェイコブ・パイク', role: '水夫', nat: 'イングランド' },
    { id: 'will', name: 'ウィリアム・ハーグレイヴ', role: '見習い', nat: 'イングランド' },
    { id: 'heizo', name: '林 平蔵', role: '乗客（通詞）', nat: '日本' },
  ];

  // 出航前に描かれた集合画の人物（番号＝肖像画の番号）
  const FIGURES = [
    { no: 1, who: 'hargrave', s: 1.02, look: { hat: 'bicorne', coat: 0.14, longCoat: true, beard: 'sideburns', hair: 'dark', pants: 0.88, shirt: 0.92 } },
    { no: 2, who: 'heizo', s: 0.96, look: { hair: 'chonmage', robe: 0.42, skin: 0.8 } },
    { no: 3, who: 'strand', s: 1.04, look: { hat: 'knit', beard: 'short', stripes: true, shirt: 0.88, pants: 0.4 } },
    { no: 4, who: 'vale', s: 1.0, look: { hat: 'peaked', coat: 0.3, longCoat: true, mustache: true, hair: 'dark', pants: 0.3, shirt: 0.9 } },
    { no: 5, who: 'will', s: 0.76, look: { hair: 'messy', shirt: 0.92, pants: 0.5 } },
    { no: 6, who: 'crowe', s: 1.0, look: { hat: 'bandana', eyepatch: true, shirt: 0.75, vest: 0.18, pants: 0.35 } },
    { no: 7, who: 'reed', s: 0.98, look: { glasses: true, hair: 'bald', vest: 0.32, shirt: 0.92, pants: 0.22 } },
    { no: 8, who: 'oconnor', s: 1.08, look: { hat: 'flat', beard: 'full', shirt: 0.62, whistle: true, pants: 0.4 } },
    { no: 9, who: 'pike', s: 1.0, look: { hair: 'shaggy', scarf: true, shirt: 0.82, pants: 0.5 } },
    { no: 10, who: 'moretti', s: 0.98, look: { hair: 'curly', mustache: true, apron: true, shirt: 0.7, pants: 0.35 } },
  ];

  const CAUSES = [
    { id: 'disease', label: '病に倒れた', killer: false },
    { id: 'stabbed', label: '刺し殺された', killer: true },
    { id: 'shot', label: '撃ち殺された', killer: true },
    { id: 'strangled', label: '絞め殺された', killer: true },
    { id: 'poisoned', label: '毒を盛られた', killer: true },
    { id: 'bludgeoned', label: '殴り殺された', killer: true },
    { id: 'crushed', label: '下敷きになって死んだ', killer: false },
    { id: 'drowned', label: '溺れ死んだ', killer: false },
    { id: 'escaped', label: '生きて船を去った', killer: false },
  ];

  // 正解（肖像番号 → 名前・死因・下手人）
  const SOLUTION = {
    1: { who: 'hargrave', cause: 'stabbed', by: 'vale' },
    2: { who: 'heizo', cause: 'stabbed', by: 'crowe' },
    3: { who: 'strand', cause: 'crushed', by: null },
    4: { who: 'vale', cause: 'poisoned', by: 'moretti' },
    5: { who: 'will', cause: 'escaped', by: null },
    6: { who: 'crowe', cause: 'stabbed', by: 'hargrave' },
    7: { who: 'reed', cause: 'escaped', by: null },
    8: { who: 'oconnor', cause: 'shot', by: 'vale' },
    9: { who: 'pike', cause: 'disease', by: null },
    10: { who: 'moretti', cause: 'strangled', by: 'strand' },
  };

  // 船内の場所（地図上の位置は％）
  const PLACES = {
    fore: { name: '上甲板（前部）', x: 34, y: 33 },
    quarter: { name: '後甲板', x: 74, y: 27 },
    cabin: { name: '船長室', x: 82, y: 45 },
    galley: { name: '厨房', x: 22, y: 51 },
    berth: { name: '寝台甲板', x: 52, y: 60 },
    hold: { name: '船倉', x: 50, y: 78 },
  };

  /* 章：時系列順。発見は逆順（第8章の遺体から辿る）。
   * line: { t: 本文, who?: 話者表示, lang?: 言語タグ, sfx?: 効果音 } */
  const CHAPTERS = [
    {
      id: 1, title: '熱病', place: 'berth', date: '1837年3月2日 夜', body: 9,
      present: [9, 7, 5, 3, 2],
      lines: [
        { t: '「熱が下がらん……。坊主、水をもっと汲んでこい」' },
        { t: '「先生……海の上で死ぬのは……嫌だ……」', who: 'かすれた声' },
        { t: '「しっかりしろ、ジェイコブ。長崎まであと少しだ」' },
        { t: '「……」', sfx: 'silence' },
      ],
    },
    {
      id: 2, title: '船倉の銀', place: 'hold', date: '1837年3月9日 深夜', body: 2,
      present: [6, 4, 2],
      lines: [
        { t: '「……開いたぞ。見ろよ、中身は全部銀だ」' },
        { t: '「船長め。こいつを長崎に密かに持ち込むつもりだったか」' },
        { t: '「そこで何をしておる！ それは船長殿の荷であろう！」', lang: '日本語' },
        { t: '「黙らせろ」' },
        { t: '「ぐ……っ」', sfx: 'stab' },
      ],
    },
    {
      id: 3, title: '反乱', place: 'fore', date: '1837年3月10日 朝', body: 8,
      present: [4, 8, 1, 6, 3, 10, 5, 7],
      lines: [
        { t: '「通詞を殺したのは貴様らだな。一等航海士ともあろう者が、銀に目が眩んだか！」' },
        { t: '「船長、あんたの銀はもう俺たちのものだ。この船もな」' },
        { t: '「船長に指一本でも触れてみろ。この甲板長が黙っちゃいねえぞ！」', who: '訛りの強い声' },
        { t: '（銃声）', sfx: 'shot' },
        { t: '「やめろォ！」' },
      ],
    },
    {
      id: 4, title: '船長室の剣', place: 'cabin', date: '1837年3月12日 夜', body: 6,
      present: [1, 6, 5],
      lines: [
        { t: '「父さん、見張りの鍵を盗ってきたよ」', who: '少年の声' },
        { t: '「よくやった。さがっていろ」' },
        { t: '「誰だ！ ……船長、てめえ、どうやって鎖を——」' },
        { t: '（剣が肉を貫く音）', sfx: 'stab' },
      ],
    },
    {
      id: 5, title: '夜明けの決闘', place: 'quarter', date: '1837年3月13日 夜明け', body: 1,
      present: [1, 4, 3, 5, 7],
      lines: [
        { t: '「もう終わりだ、ハーグレイヴ。剣を捨てろ」' },
        { t: '「この船は……誰にも渡さん」' },
        { t: '（刃のぶつかる音）', sfx: 'clash' },
        { t: '「父さん！！」', who: '少年の声' },
      ],
    },
    {
      id: 6, title: '最後の葡萄酒', place: 'cabin', date: '1837年3月14日 夜', body: 4,
      present: [4, 10, 7],
      lines: [
        { t: '「料理番、もう一杯だ。……今日からこの船は、俺の船だ」' },
        { t: '「Sì, signore. ……Per il capitano.」', lang: 'イタリア語' },
        { t: '「なんだ、この味は……貴様……っ」' },
        { t: '（硝子の割れる音）', sfx: 'glass' },
      ],
    },
    {
      id: 7, title: '厨房', place: 'galley', date: '1837年3月15日 夕刻', body: 10,
      present: [3, 10, 5],
      lines: [
        { t: '「Du drepte ham! Morder!」', lang: 'ノルウェー語' },
        { t: '「No... lasciami... aiuto...!」', lang: 'イタリア語' },
        { t: '「やめて！ 離してあげて！」', who: '少年の声' },
        { t: '「……」', sfx: 'silence' },
      ],
    },
    {
      id: 8, title: '嵐', place: 'fore', date: '1837年3月16日 夜', body: 3,
      present: [3, 7, 5],
      lines: [
        { t: '（雷鳴と、軋む帆柱の音）', sfx: 'storm' },
        { t: '「メインマストが折れるぞ！ 離れろ！」' },
        { t: '「Herregud——!」', lang: 'ノルウェー語' },
        { t: '（轟音）', sfx: 'crash' },
        { t: '「……ウィル、ボートを降ろせ！ 島影が見える。私たちだけでも生き延びるんだ」' },
      ],
    },
  ];

  const INTRO = [
    '天保八年（1837年）、長崎。',
    '霧の朝、一隻の英国商船が港外に流れ着いた。\n船名は「ハルシオン号」。\n広州を出たまま行方の知れなかった船である。',
    '甲板に生きた者の姿はなかった。\n乗員十名のうち、見つかったのは骸ばかり。',
    '長崎奉行所の検分役であるあなたは、\n出島の商館長からひとつの懐中時計を託された。',
    '「この時計を骸にかざせば、その者が死んだ瞬間が見える」',
    'あなたの務めは、乗員十名の運命を\nひとり残らず突き止め、この検分帳に記すことだ。',
  ];

  const EPILOGUE_PERFECT = [
    '検分帳は奉行所に提出された。',
    '数日後、五島の漁村から知らせが届いた。\n異国の男と少年を乗せた小舟が、嵐の翌朝に浜へ流れ着いたという。',
    '船医トマス・リードと見習いウィリアム・ハーグレイヴ。\nふたりは船長の銀について、最後まで何も語らなかった。',
    'ハルシオン号の十の運命は、こうして閉じられた。',
  ];

  global.DATA = { CREW, FIGURES, CAUSES, SOLUTION, PLACES, CHAPTERS, INTRO, EPILOGUE_PERFECT };
})(window);
