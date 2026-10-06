import http from 'http';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(process.cwd());
const PORT = 3001;

function startStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      // Proxy route for Gemini: POST /_api/gemini
      if (req.method === 'POST' && req.url.startsWith('/_api/gemini')) {
        let body = '';
        for await (const chunk of req) body += chunk;
        const payload = body ? JSON.parse(body) : {};
        // Load local config for key
        let key = '';
        try {
          const mod = await import(path.join(ROOT, 'config', 'api_gemini.js'));
          key = (mod && mod.default && mod.default.apiKey) || '';
        } catch (e) {
          // Try to read file and regex
          try {
            const txt = fs.readFileSync(path.join(ROOT, 'config', 'api_gemini.js'), 'utf8');
            const m = txt.match(/apiKey\s*:\s*['"]([^'"]+)['"]/);
            key = m ? m[1] : '';
          } catch (ee) { key = ''; }
        }

        if (!key) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Local Gemini key missing on server' }));
          return;
        }

        // Forward to Google Generative Language API
        const model = (payload.model) || 'gemini-1.0';
        const url = `https://generativelanguage.googleapis.com/v1beta2/models/${encodeURIComponent(model)}:predict`;
        const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': key };
        try {
          console.log('Proxy forwarding to', url);
          const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
          const text = await r.text();
          console.log('Proxy received status', r.status, 'body length', text && text.length);
          if (r.ok) {
            let j;
            try { j = JSON.parse(text); } catch (e) { j = { raw: text }; }
            res.writeHead(r.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify(j));
            return;
          }

          // Fallback: if generative endpoint returns error (e.g., 404),
          // perform Google Vision OCR then call a text model to produce JSON.
          console.log('Proxy fallback: generative call failed, attempting Vision OCR + text model');
          // 1) Vision OCR
          const visUrl = `https://vision.googleapis.com/v1/images:annotate`;
          const visBody = {
            requests: [
              {
                image: { content: payload.instances?.[0]?.content?.imageBytes || payload.instances?.[0]?.content?.image || '' },
                features: [{ type: 'TEXT_DETECTION' }],
              },
            ],
          };
          const visHeaders = { 'Content-Type': 'application/json' };
          if (key && key.startsWith('AIza')) {
            // use key as query param
          }
          const visResp = await fetch(visUrl + (key && key.startsWith('AIza') ? `?key=${encodeURIComponent(key)}` : ''), { method: 'POST', headers: visHeaders, body: JSON.stringify(visBody) });
          const visText = await visResp.text();
          let visJson;
          try { visJson = JSON.parse(visText); } catch (e) { visJson = null; }
          const ocrText = visJson?.responses?.[0]?.fullTextAnnotation?.text || visJson?.responses?.[0]?.textAnnotations?.[0]?.description || '';

          // 2) Call text model (text-bison-001) to extract structured JSON
          const textModel = 'text-bison-001';
          const textUrl = `https://generativelanguage.googleapis.com/v1beta2/models/${encodeURIComponent(textModel)}:predict`;
          const instruction = `Read the English vocabulary flashcard image text and extract fields. Return a single JSON object only with fields: word, partOfSpeech, ipa, meaning, example, synonyms, antonyms, wordFamily, collocations. Do not guess missing data.`;
          const textPayload = {
            instances: [ { prompt: instruction + '\n\n' + (ocrText || '') } ]
          };
          const textHeaders = { 'Content-Type': 'application/json', 'x-goog-api-key': key };
          const textResp = await fetch(textUrl, { method: 'POST', headers: textHeaders, body: JSON.stringify(textPayload) });
          const textRespText = await textResp.text();
          // Return in a shape similar to generative API so frontend parsers can extract content
          const wrapped = { predictions: [ { content: String(textRespText) } ] };
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(wrapped));
          return;
        } catch (err) {
          console.error('Proxy error forwarding request', err);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
        return;
      }

      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.join(ROOT, reqPath.replace(/^\//, ''));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end('Forbidden');
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimes = {
          '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
          '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
          '.json': 'application/json', '.wasm': 'application/wasm'
        };
        res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream' });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } catch (err) {
      res.writeHead(500);
      res.end('Server error');
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function generateTestImage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  const html = `
    <html><body>
    <canvas id="c" width="1200" height="800"></canvas>
    <script>
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,1200,800);
      ctx.fillStyle = '#000'; ctx.font = '48px serif'; ctx.fillText('anniversary', 50,120);
      ctx.font = '36px serif'; ctx.fillText('[noun]', 50,180);
      ctx.font = '32px serif'; ctx.fillText('/ˌæn.ɪˈvɜː.sər.i/', 50,240);
      ctx.font = '28px serif'; ctx.fillText('the day on which an important event happened in a previous year', 50,300);
      ctx.fillText('Our company is offering special discounts to celebrate our 10th anniversary.', 50,360);
      const data = c.toDataURL('image/png');
      document.body.innerText = data;
    <\/script>
    </body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const dataUrl = await page.evaluate(() => document.body.innerText.trim());
  await page.close();

  const base64 = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
  const outPath = path.join(process.cwd(), 'tests', 'tmp-test-image.png');
  fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
  return outPath;
}

(async () => {
  console.log('Starting static server...');
  const server = await startStaticServer();
  // start local proxy for Gemini
  console.log('Starting local proxy server...');
  const { startProxy } = await import('../server/proxy-server.js');
  const proxy = await startProxy(3002);
  console.log('Proxy started on port 3002');
  console.log('Server running on http://localhost:' + PORT);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
    const tmpImage = await generateTestImage(browser);

    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    page.on('console', (msg) => {
      console.log('PAGE LOG:', msg.type(), msg.text());
    });
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));
    // Use a longer timeout and waitUntil domcontentloaded first
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    // allow external scripts to load (firebase, etc.)
    await new Promise((r) => setTimeout(r, 5000));

    // Ensure Gemini config exists
    const localConfigPath = path.join(process.cwd(), 'config', 'api_gemini.js');
    if (!fs.existsSync(localConfigPath)) {
      throw new Error('Missing config/api_gemini.js — create it with your Google Gemini key and provider=google');
    }

    // Switch to image mode
    await page.waitForSelector('#input-mode-image');
    await page.click('#input-mode-image');

    // Upload generated image
    const inputHandle = await page.$('#image-import-input');
    if (!inputHandle) throw new Error('Image input selector not found');
    await inputHandle.uploadFile(tmpImage);

    // Wait for preview and click OCR
    await page.waitForSelector('#image-import-preview-img', { visible: true });
    await page.click('#image-import-rerun');

    // Wait for OCR to finish — check status element
    await page.waitForFunction(() => {
      const s = document.getElementById('image-import-status');
      return s && s.textContent && s.textContent.toLowerCase().indexOf('đang') === -1;
    }, { timeout: 120000 });

    // Check fields
    const word = await page.$eval('#input-word', (el) => el.value || '');
    const type = await page.$eval('#input-type', (el) => el.value || '');
    const ipa = await page.$eval('#input-ipa', (el) => el.value || '');
    const meaning = await page.$eval('#input-meaning', (el) => el.value || '');
    const example = await page.$eval('#input-example', (el) => el.value || '');

    console.log('OCR Results:', { word, type, ipa, meaning: meaning.slice(0,120), example: example.slice(0,120) });

    if (!word) throw new Error('Word not filled');
    // Click save
    await page.click('#add-submit');
    // Wait for save feedback
    await page.waitForFunction(() => {
      const feedback = document.getElementById('add-feedback');
      return /Lưu từ thành công|Cập nhật thành công|Word already exists/.test(feedback?.textContent || '');
    }, { timeout: 30000 });

    // Reload and check list contains word
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#word-list', { timeout: 30000 });
    await page.waitForFunction((expectedWord) => document.body.innerText.includes(expectedWord), { timeout: 30000 }, word);

    console.log('E2E test passed');
    } catch (err) {
      console.error('E2E test failed:', err);
      process.exitCode = 2;
    } finally {
      await browser.close();
      server.close();
      try { proxy.close(); } catch (e) {}
    }
})();
