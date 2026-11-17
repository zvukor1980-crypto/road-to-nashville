const {test, expect} = require('@playwright/test');
const {execFileSync} = require('child_process');
const fs = require('fs');

const NAMES = [
  ['אני פה!', 'ANI PO!'],
  ['כל העיר ערה!', 'KOL HAIR ERA!'],
  ['אש בלב', 'ESH BALEV'],
  ['אל תלכי', 'AL TELCHI'],
  ['די כבר!', 'DAI KVAR!'],
  ['תני לי סימן!', 'TNI LI SIMAN!'],
  ['אין לי זמן!', 'EIN LI ZMAN!'],
  ['הכול מסתובב!', 'HAKOL MISTOVEV!'],
  ['תתקרבי אליי', 'TITKARVI ELAI'],
  ['אני פה! (ACID RIOT REMIX)', 'ANI PO! ACID RIOT REMIX feat. ACIDA'],
  ['בא לי רעש!', 'BA LI RAASH! feat. ACIDA']
];

function wavBuffer(){
  const sr = 8000, n = sr;
  const data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + n * 2, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sr, 24);
  data.writeUInt32LE(sr * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(n * 2, 40);
  for(let i = 0; i < n; i++){
    const s = Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 0.2 * 32767);
    data.writeInt16LE(s, 44 + i * 2);
  }
  return data;
}

function richLibrary(){
  return {
    current: 'ani-po',
    volume: 0.8,
    equalizer: {gains: [1, 0, 0, 0, 0], enabled: true, preset: 'Свой'},
    migrations: ['new-songs-9-11', 'raash-yafe-v9-seeded-known-reference'],
    albums: [{
      id: 'ani-po',
      name: 'אני פה!',
      description: 'MARKER-KEEP',
      coverKey: 'image:cover',
      backKey: null,
      tracks: NAMES.map((pair, i) => ({
        id: 'song-' + i,
        name: pair[0],
        trans: pair[1],
        lyrics: i === 0 ? 'LYRICS-KEEP' : '',
        sunoStyle: i === 0 ? 'STYLE-KEEP' : '',
        favorite: i === 0,
        videoKey: null,
        takes: i === 0 ? [{id: 'take-1', fileKey: 'take:demo', mode: 'append', offsetSec: 0, durationSec: 1, label: 'Дубль 1', createdAt: '2026-01-01T00:00:00.000Z'}] : [],
        variants: [
          {
            fileKey: i === 0 ? 'audio:a' : null,
            fileName: i === 0 ? 'ani-po-a.wav' : '',
            suno: i === 1 ? 'https://suno.com/s/BR9oVyNqADjGCuVu' : ''
          },
          {
            fileKey: i === 0 ? 'audio:b' : null,
            fileName: i === 0 ? 'ani-po-b.mp3' : '',
            suno: ''
          }
        ]
      }))
    }]
  };
}

async function seed(page, library){
  await page.addInitScript(library => {
    if(!localStorage.getItem('raash-yafe-library-v1')) localStorage.setItem('raash-yafe-library-v1', JSON.stringify(library));
  }, library);
}
async function storeMedia(page, files){
  await page.evaluate(async files => {
    const binary = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    for(const file of files){
      await put(file.key, new File([binary(file.b64)], file.name || 'media', {type: file.type}));
    }
  }, files);
}

async function layout(page){
  return page.evaluate(() => {
    const dock = document.querySelector('.dock').getBoundingClientRect();
    const cover = document.querySelector('.hero .cover').getBoundingClientRect();
    const head = document.querySelector('#listHead').getBoundingClientRect();
    const first = document.querySelector('.song');
    const slots = [...first.querySelectorAll('.slot')];
    const problems = [];
    if(document.querySelector('.dock img, .dock video')) problems.push('dock has artwork');
    if(dock.height > 110) problems.push('dock height ' + dock.height);
    if(cover.width > 120 || cover.height > 120 || cover.width < 64) problems.push('cover ' + cover.width + 'x' + cover.height);
    if(head.top < 0 || head.bottom > dock.top) problems.push('heading not visible');
    slots.forEach(slot => {
      const r = slot.getBoundingClientRect();
      if(r.bottom > dock.top + 1) problems.push('first slots hidden by dock');
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if(!hit || !slot.contains(hit)) problems.push('slot covered by ' + (hit && hit.className));
    });
    const nodes = [...document.querySelectorAll('#app button, .dock button')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.bottom <= dock.top + 1;
    });
    for(let i = 0; i < nodes.length; i++){
      for(let j = i + 1; j < nodes.length; j++){
        if(nodes[i].contains(nodes[j]) || nodes[j].contains(nodes[i])) continue;
        const a = nodes[i].getBoundingClientRect();
        const b = nodes[j].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if(w > 2 && h > 2) problems.push('overlap ' + (nodes[i].id || nodes[i].className) + ' / ' + (nodes[j].id || nodes[j].className));
      }
    }
    return {
      problems,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      songs: document.querySelectorAll('.song').length,
      slots: document.querySelectorAll('.slot').length,
      dockH: dock.height,
      cover: [cover.width, cover.height],
      headTop: head.top,
      firstTop: first.getBoundingClientRect().top
    };
  });
}

test.describe('Raash Yafe v13 iPhone', () => {
  let wav, mp3, png;
  test.beforeAll(() => {
    wav = wavBuffer();
    png = fs.readFileSync('/workspace/raash-yafe/assets/front.webp');
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1', '-codec:a', 'libmp3lame', '-b:a', '64k', '/tmp/ry-b.mp3'], {stdio: 'ignore'});
    mp3 = fs.readFileSync('/tmp/ry-b.mp3');
  });

  test('library, playback, suno, zip and layout', async ({page}) => {
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    page.on('dialog', dialog => dialog.accept());
    const files = [
      {key: 'audio:a', type: 'audio/wav', b64: wav.toString('base64')},
      {key: 'audio:b', type: 'audio/mpeg', b64: mp3.toString('base64')},
      {key: 'image:cover', type: 'image/webp', b64: png.toString('base64')},
      {key: 'take:demo', type: 'audio/wav', b64: wav.toString('base64')}
    ];
    await seed(page, richLibrary());
    await page.setViewportSize({width: 390, height: 844});
    await page.goto('index.html');
    await storeMedia(page, files);
    await page.reload();
    await expect(page.locator('#listHead h2')).toHaveText('Песни альбома');
    await expect(page.locator('.song')).toHaveCount(11);
    await expect(page.locator('.slot')).toHaveCount(22);
    await expect(page.locator('#albumTitle')).toHaveText('אני פה!');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('raash-yafe-library-v1')));
    expect(stored.albums[0].description).toBe('MARKER-KEEP');
    expect(stored.albums[0].tracks[0].lyrics).toBe('LYRICS-KEEP');
    expect(stored.albums[0].tracks[0].takes[0].fileKey).toBe('take:demo');
    expect(stored.albums[0].tracks[0].favorite).toBe(true);
    const volume = await page.evaluate(() => document.querySelector('#audio').volume);
    expect(volume).toBeCloseTo(0.8, 2);
    const resolved = await page.evaluate(async () => {
      const original = window.fetch;
      window.fetch = async url => {
        if(String(url).includes('/api/resolve?code=goodcode1')){
          return new Response(JSON.stringify({ok:true, id:'33333333-3333-4333-8333-333333333333', url:'https://suno.com/song/33333333-3333-4333-8333-333333333333', title:'אש בלב'}), {status:200, headers:{'Content-Type':'application/json'}});
        }
        return original(url);
      };
      try{return await RaashSunoV8.resolveSong(RaashSunoV8.readLink('https://suno.com/s/goodcode1'))}
      finally{window.fetch = original}
    });
    expect(resolved.url).toBe('https://suno.com/song/33333333-3333-4333-8333-333333333333');
    expect(resolved.label).toBe('אש בלב');

    const box = await layout(page);
    expect(box.problems, JSON.stringify(box)).toEqual([]);
    expect(box.overflow).toBeLessThanOrEqual(1);
    expect(box.songs).toBe(11);
    await page.screenshot({path: '/opt/cursor/artifacts/raash-v13-home-390.png'});

    await page.locator('.song').first().locator('.slot').nth(0).click();
    await page.waitForFunction(() => {
      const audio = document.querySelector('#audio');
      return audio && audio.src && !audio.paused && audio.readyState >= 2;
    });
    await expect(page.locator('#nowTitle')).toHaveText('אני פה!');
    await expect(page.locator('#nowSub')).toContainText('Версия A');
    await page.screenshot({path: '/opt/cursor/artifacts/raash-v13-player-390.png', clip: {x: 0, y: 760, width: 390, height: 84}});
    await page.locator('#play').click();
    await page.waitForFunction(() => document.querySelector('#audio').paused);
    await page.locator('.song').first().locator('.slot').nth(1).click();
    await page.waitForFunction(() => {
      const audio = document.querySelector('#audio');
      return audio && !audio.paused && audio.readyState >= 2;
    });
    const playingB = await page.evaluate(() => ({v: selected.v, sub: document.querySelector('#nowSub').textContent}));
    expect(playingB.v).toBe(1);
    expect(playingB.sub).toContain('Версия B');
    await page.locator('#play').click();

    await page.locator('.song-open').first().click();
    await expect(page.locator('#sheettitle')).toHaveText('אני פה!');
    await expect(page.locator('#ryLyrics')).toBeVisible();
    await expect(page.locator('#rySongRec')).toBeVisible();
    await expect(page.locator('[data-song-file="0"]')).toContainText('Заменить');
    await expect(page.locator('[data-song-file="1"]')).toBeVisible();
    await page.screenshot({path: '/opt/cursor/artifacts/raash-v13-song-390.png'});
    await page.locator('#ryLyrics').click();
    await expect(page.locator('#studioLyrics')).toHaveValue('LYRICS-KEEP');
    await expect(page.locator('#studioStyle')).toHaveValue('STYLE-KEEP');
    await page.locator('#close').click();

    await page.locator('#toolsBtn').click();
    await expect(page.locator('#ryEQ')).toBeVisible();
    await expect(page.locator('#ryZip')).toBeVisible();
    await expect(page.locator('#ryRestore')).toBeVisible();
    await page.screenshot({path: '/opt/cursor/artifacts/raash-v13-tools-390.png'});
    await page.locator('#ryVolume').fill('40');
    await page.locator('#ryEQ').click();
    await expect(page.locator('#v4band0')).toBeVisible();
    await page.locator('#v4band0').fill('6');
    await page.waitForFunction(() => {
      const data = JSON.parse(localStorage.getItem('raash-yafe-library-v1'));
      return data.equalizer && data.equalizer.gains[0] === 6 && data.volume === 0.4;
    });
    await page.reload();
    await expect(page.locator('.song')).toHaveCount(11);
    const afterReload = await page.evaluate(async () => {
      const data = JSON.parse(localStorage.getItem('raash-yafe-library-v1'));
      const [a, b, cover, take] = await Promise.all(['audio:a', 'audio:b', 'image:cover', 'take:demo'].map(key => get(key)));
      return {
        gains: data.equalizer.gains,
        volume: data.volume,
        lyrics: data.albums[0].tracks[0].lyrics,
        sizes: [a && a.size, b && b.size, cover && cover.size, take && take.size],
        description: data.albums[0].description
      };
    });
    expect(afterReload.gains[0]).toBe(6);
    expect(afterReload.volume).toBeCloseTo(0.4, 2);
    expect(afterReload.lyrics).toBe('LYRICS-KEEP');
    expect(afterReload.description).toBe('MARKER-KEEP');
    expect(afterReload.sizes.every(size => size > 0)).toBe(true);

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('#addMusic').click()
    ]);
    await chooser.setFiles({name: 'אש בלב A.wav', mimeType: 'audio/wav', buffer: wav});
    await expect(page.locator('.song').nth(2).locator('.slot').first()).toContainText('Файл');
    const kept = await page.evaluate(() => {
      const song = JSON.parse(localStorage.getItem('raash-yafe-library-v1')).albums[0].tracks[2];
      return {file: song.variants[0].fileName, suno: song.variants[1].suno};
    });
    expect(kept.file).toBe('אש בלב A.wav');
    expect(kept.suno).toBe('');

    await page.locator('#fromSuno').click();
    await page.locator('#s9Batch').fill('אש בלב https://suno.com/s/abcdefgh12\nhttps://suno.com/s/unknown99');
    await page.locator('#s9Auto').click();
    await expect(page.locator('#sheettitle')).toContainText('Нужны названия');
    const assigned = await page.evaluate(() => {
      const song = JSON.parse(localStorage.getItem('raash-yafe-library-v1')).albums[0].tracks[2];
      return song.variants.map(v => ({file: v.fileName, suno: v.suno}));
    });
    expect(assigned[0].file).toBe('אש בלב A.wav');
    expect(assigned[1].suno).toBe('https://suno.com/s/abcdefgh12');
    await expect(page.locator('.song')).toHaveCount(11);
    await page.locator('#close').click();
    await page.locator('#fromSuno').click();
    await page.locator('#s9Batch').fill('https://suno.com/s/abcdefgh12');
    await page.locator('#s9Auto').click();
    await expect(page.locator('#s9BatchStatus')).toContainText('Уже были');
    const dup = await page.evaluate(() => {
      const raw = JSON.stringify(JSON.parse(localStorage.getItem('raash-yafe-library-v1')));
      return {url: JSON.parse(localStorage.getItem('raash-yafe-library-v1')).albums[0].tracks[2].variants[1].suno, n: raw.split('abcdefgh12').length - 1};
    });
    expect(dup.url).toBe('https://suno.com/s/abcdefgh12');
    expect(dup.n).toBe(1);
    await page.locator('#close').click();

    await page.locator('.song').nth(1).locator('.slot').first().click();
    await expect(page.locator('.s8-warning')).toContainText('пока не открывается');
    await expect(page.locator('#s8LocalFile')).toBeVisible();
    await page.locator('#close').click();
    await page.locator('.song').nth(2).locator('.slot').nth(1).click();
    await expect(page.locator('.s8-warning')).toBeVisible();
    await page.locator('#close').click();

    await page.evaluate(() => {
      library.albums[0].tracks[3].variants[0].suno = 'https://suno.com/song/33333333-3333-4333-8333-333333333333';
      save(); paint();
    });
    await page.locator('.song').nth(3).locator('.slot').nth(0).click();
    await expect(page.locator('.s6-frame iframe')).toHaveAttribute('src', 'https://suno.com/embed/33333333-3333-4333-8333-333333333333');
    expect(page.url()).toContain('/raash-yafe/');
    await page.locator('#close').click();

    const before = await page.evaluate(async () => {
      const digest = async key => {
        const blob = await get(key);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const hash = await crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('');
      };
      const data = JSON.parse(localStorage.getItem('raash-yafe-library-v1'));
      const keys = ['audio:a', 'audio:b', 'image:cover', 'take:demo', data.albums[0].tracks[2].variants[0].fileKey];
      const hashes = [];
      for(const key of keys) hashes.push(await digest(key));
      return hashes;
    });
    await page.locator('#saveAll').click();
    await expect(page.locator('#downloadZip')).toBeVisible();
    const zipB64 = await page.evaluate(async () => {
      const response = await fetch(document.querySelector('#downloadZip').href);
      const bytes = new Uint8Array(await response.arrayBuffer());
      let text = '';
      for(let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(text);
    });
    const zipPath = '/tmp/raash-v13-roundtrip.zip';
    fs.writeFileSync(zipPath, Buffer.from(zipB64, 'base64'));
    expect(fs.statSync(zipPath).size).toBeGreaterThan(100);
    await page.evaluate(() => {
      library.albums[0].description = 'TEMP-MUTATION';
      library.albums[0].tracks[0].lyrics = 'TEMP-LYRICS';
      save();
    });
    await page.locator('#close').click();
    await page.locator('#importzip').setInputFiles(zipPath);
    await page.waitForFunction(() => {
      const data = JSON.parse(localStorage.getItem('raash-yafe-library-v1'));
      return data.albums[0].description === 'MARKER-KEEP' && data.albums[0].tracks[0].lyrics === 'LYRICS-KEEP';
    });
    await expect(page.locator('.song')).toHaveCount(11);
    const restored = await page.evaluate(async () => {
      const data = JSON.parse(localStorage.getItem('raash-yafe-library-v1'));
      const hashes = [];
      const track = data.albums[0].tracks[0];
      const keys = [track.variants[0].fileKey, track.variants[1].fileKey, data.albums[0].coverKey, track.takes[0].fileKey, data.albums[0].tracks[2].variants[0].fileKey];
      for(const key of keys){
        const blob = await get(key);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const hash = await crypto.subtle.digest('SHA-256', bytes);
        hashes.push([...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join(''));
      }
      return {
        description: data.albums[0].description,
        lyrics: track.lyrics,
        style: track.sunoStyle,
        favorite: track.favorite,
        suno: data.albums[0].tracks[1].variants[0].suno,
        gain: data.equalizer.gains[0],
        hashes
      };
    });
    expect(restored.description).toBe('MARKER-KEEP');
    expect(restored.lyrics).toBe('LYRICS-KEEP');
    expect(restored.style).toBe('STYLE-KEEP');
    expect(restored.favorite).toBe(true);
    expect(restored.suno).toBe('https://suno.com/s/BR9oVyNqADjGCuVu');
    expect(restored.gain).toBe(6);
    expect(restored.hashes.sort()).toEqual([...before].sort());

    for(const width of [375, 430]){
      await page.setViewportSize({width, height: 844});
      await page.evaluate(() => window.scrollTo(0, 0));
      const metrics = await layout(page);
      expect(metrics.problems, width + ' ' + JSON.stringify(metrics)).toEqual([]);
      expect(metrics.overflow).toBeLessThanOrEqual(1);
    }
    await page.setViewportSize({width: 390, height: 844});

    await page.evaluate(async () => {
      const cache = await caches.open('raash-yafe-v12.0');
      await cache.put(new Request(new URL('./v12-stale', location.href)), new Response('stale'));
      const reg = await navigator.serviceWorker.getRegistration();
      if(reg) await reg.unregister();
    });
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    const cachesNow = await page.evaluate(async () => {
      const keys = await caches.keys();
      return keys.filter(key => key.startsWith('raash-yafe-'));
    });
    expect(cachesNow).toContain('raash-yafe-v13.0');
    expect(cachesNow).not.toContain('raash-yafe-v12.0');
    const unexpected = errors.filter(message => !/access control checks|Failed to fetch|Load failed/i.test(message));
    expect(unexpected, unexpected.join('\n')).toEqual([]);
  });

  test('old 8-song library gains 9–11 and keeps a custom song', async ({page}) => {
    const tracks = NAMES.slice(0, 8).map((pair, i) => ({
      id: 'old-' + i,
      name: pair[0],
      trans: pair[1],
      variants: [{fileKey: null, fileName: '', suno: ''}, {fileKey: null, fileName: '', suno: ''}]
    }));
    tracks.push({
      id: 'custom-1',
      name: 'שיר שלי',
      trans: 'MY SONG',
      lyrics: 'CUSTOM-LYRICS',
      variants: [{fileKey: null, fileName: '', suno: ''}, {fileKey: null, fileName: '', suno: ''}]
    });
    await seed(page, {
      current: 'ani-po',
      albums: [{id: 'ani-po', name: 'אני פה!', description: 'OLD-MARKER', coverKey: null, backKey: null, tracks}]
    });
    await page.setViewportSize({width: 390, height: 844});
    await page.goto('index.html');
    const names = await page.locator('.song-text strong').allTextContents();
    expect(names).toContain('שיר שלי');
    expect(names).toContain('תתקרבי אליי');
    expect(names).toContain('אני פה! (ACID RIOT REMIX)');
    expect(names).toContain('בא לי רעש!');
    expect(names.filter(name => name === 'אני פה!')).toHaveLength(1);
    const legacy = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('raash-yafe-library-v1'));
      const custom = data.albums[0].tracks.find(t => t.name === 'שיר שלי');
      const first = data.albums[0].tracks.find(t => t.name === 'אני פה!');
      return {description: data.albums[0].description, lyrics: custom.lyrics, suno: first.variants[0].suno, count: data.albums[0].tracks.length};
    });
    expect(legacy.description).toBe('OLD-MARKER');
    expect(legacy.lyrics).toBe('CUSTOM-LYRICS');
    expect(legacy.suno).toBe('https://suno.com/s/BR9oVyNqADjGCuVu');
    expect(legacy.count).toBe(12);
    const metrics = await layout(page);
    expect(metrics.problems, JSON.stringify(metrics)).toEqual([]);
  });
});
