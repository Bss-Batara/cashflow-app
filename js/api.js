/**
 * FinFlow API client for the Google Apps Script backend.
 * Backend mode aktif permanen: Spreadsheet menjadi sumber data utama,
 * localStorage dipakai sebagai salinan kerja/offline.
 *
 * Catatan CORS:
 * - Endpoint /exec membalas `Access-Control-Allow-Origin: *`.
 * - GET dipakai untuk aksi baca dan login/register.
 * - POST memakai `Content-Type: text/plain` (simple request) supaya tidak
 *   memicu preflight OPTIONS yang tidak didukung Apps Script.
 */
const CASHFLOW_API_URL =
  'https://script.google.com/macros/s/AKfycbwNDh1yP1ErkKPjEkGcN28YO2AnUA8Mso_FyENR7MPEiHfxcY8fNydDe-fN8KA48w85/exec';

// Cold start Apps Script bisa 10-15 detik pada permintaan pertama.
const CASHFLOW_API_TIMEOUT_MS = 25000;

const CashflowApi = {
  token_: '',

  enabled() {
    // Selalu aktif: tidak lagi bergantung pada ?backend=sheet.
    return true;
  },

  setToken(token) {
    this.token_ = String(token || '').trim();
  },

  getToken() {
    return this.token_;
  },

  async get(action, parameters = {}) {
    // 'list' adalah nama pendek untuk aksi Spreadsheet 'listTransactions'.
    const resolved = action === 'list' ? 'listTransactions' : action;
    const params = { ...parameters };
    if (this.token_ && !params.token) params.token = this.token_;
    const query = new URLSearchParams({ action: resolved, ...params }).toString();

    // Gabungkan permintaan identik yang berjalan bersamaan.
    if (!this.inflight_) this.inflight_ = new Map();
    if (!this.inflight_.has(query)) {
      const request = this.fetchJson_(`${CASHFLOW_API_URL}?${query}`)
        .finally(() => this.inflight_.delete(query));
      this.inflight_.set(query, request);
    }
    return this.inflight_.get(query);
  },

  async post(action, payload = {}) {
    const body = { ...payload };
    if (this.token_ && !body.token) body.token = this.token_;
    return this.fetchJson_(CASHFLOW_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...body })
    });
  },

  async resolveCategoryId(category, type) {
    const result = await this.get('listCategories', { categoryType: type });
    const aliases = {
      'gaji pokok': 'income-salary',
      'gaji pokok bulanan': 'income-salary',
      'freelance & side job': 'income-freelance',
      'hasil usaha / bisnis': 'income-other',
      'dividen & return investasi': 'income-other',
      'bonus, komisi & thr': 'income-other',
      'penjualan aset / barang': 'income-other',
      'hadiah & uang masuk lain': 'income-other',
      'makanan & minuman': 'expense-food',
      'transportasi & bensin': 'expense-transport',
      'kebutuhan harian & dapur': 'expense-needs',
      'tagihan, listrik & wifi': 'expense-bills',
      'hiburan, hobi & liburan': 'expense-entertainment',
      'kesehatan & medis': 'expense-health',
      'pendidikan & kursus': 'expense-education'
    };
    const wanted = String(category || '').trim().toLowerCase();
    const canonicalId = aliases[wanted];
    const match = result.items.find(item =>
      item.categoryId === canonicalId ||
      [item.categoryId, item.name, item.displayName]
        .some(value => String(value || '').trim().toLowerCase() === wanted)
    );
    if (!match) {
      throw new Error(`Category not found for ${type}: ${category}`);
    }
    return match.categoryId;
  },

  async fetchJson_(url, options = {}) {
    if (typeof fetch !== 'function') {
      return options.method === 'POST' ? this.postForm_(url, options) : this.getJsonp_(url);
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), CASHFLOW_API_TIMEOUT_MS)
      : null;

    try {
      const response = await fetch(url, {
        mode: 'cors',
        redirect: 'follow',
        cache: 'no-store',
        credentials: 'omit',
        signal: controller ? controller.signal : undefined,
        ...options
      });
      return await this.parseResponse_(response);
    } catch (error) {
      const name = error && error.name;
      const message = String((error && error.message) || '');

      if (name === 'AbortError') {
        throw new Error('Server tidak merespons (timeout). Coba lagi.');
      }
      if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
        throw new Error('Tidak dapat menghubungi server. Periksa koneksi internet Anda.');
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  },

  async parseResponse_(response) {
    const type = (response.headers && response.headers.get('content-type')) || '';
    if (type && !/json/i.test(type)) {
      throw new Error(
        'Server tidak mengembalikan JSON. Pastikan URL berakhiran /exec dan akses web app = Anyone.'
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error('Respons server tidak dapat dibaca. Coba muat ulang halaman.');
    }

    if (!response.ok || !data.ok) {
      const message = data && data.error && data.error.message
        ? data.error.message
        : 'Permintaan ke server gagal.';
      throw new Error(message);
    }
    return data.data;
  },

  // --- Cadangan untuk browser lama tanpa fetch (JSONP / form POST) ---
  getJsonp_(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `cashflowJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      delete window[callbackName];
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Cashflow API request timed out.'));
      }, CASHFLOW_API_TIMEOUT_MS);

      function cleanup() {
        clearTimeout(timer);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = data => {
        cleanup();
        if (!data || !data.ok) {
          reject(new Error((data && data.error && data.error.message) || 'API request failed.'));
          return;
        }
        resolve(data.data);
      };
      script.onerror = () => {
        cleanup();
        reject(new Error('Cashflow API could not be reached.'));
      };
      script.src = `${url}&callback=${encodeURIComponent(callbackName)}`;
      document.head.appendChild(script);
    });
  },

  postForm_(url, options) {
    return new Promise((resolve, reject) => {
      const frameName = `cashflowPost_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const iframe = document.createElement('iframe');
      iframe.name = frameName;
      iframe.hidden = true;
      const form = document.createElement('form');
      form.method = 'POST';
      form.target = frameName;
      form.action = url;
      form.hidden = true;
      const input = document.createElement('input');
      input.name = 'payload';
      input.value = (options && options.body) || '{}';
      form.appendChild(input);
      document.body.append(iframe, form);
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Cashflow API request timed out.'));
      }, CASHFLOW_API_TIMEOUT_MS);
      function cleanup() {
        clearTimeout(timer);
        iframe.remove();
        form.remove();
      }
      iframe.onload = () => {
        setTimeout(() => {
          cleanup();
          resolve({ accepted: true });
        }, 700);
      };
      try {
        form.submit();
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }
};

window.CashflowApi = CashflowApi;
