/**
 * FinFlow API client for the Google Apps Script backend.
 * Backend mode is opt-in with ?backend=sheet until migration is complete.
 */
const CASHFLOW_API_URL =
  'https://script.google.com/macros/s/AKfycbxeY40_Wg8-dBlkSvHCov7fLgYrSE8130Dy2sw-0ZQGpo0_XDGs5WjS8l5BZnWHB5L6ag/exec';

const CashflowApi = {
  enabled() {
    return new URLSearchParams(window.location.search).get('backend') === 'sheet';
  },

  async get(action, parameters = {}) {
    const query = new URLSearchParams({ action, ...parameters });
    return this.getJsonp_(`${CASHFLOW_API_URL}?${query.toString()}`);
  },

  async post(action, payload = {}) {
    return this.postForm_(action, payload);
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

  async parseResponse_(response) {
    const data = await response.json();
    if (!response.ok || !data.ok) {
      const message = data?.error?.message || `API request failed (${response.status}).`;
      throw new Error(message);
    }
    return data.data;
  },

  getJsonp_(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `cashflowJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const cleanup = () => {
        delete window[callbackName];
        script.remove();
      };
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('Cashflow API request timed out.'));
      }, 15000);

      window[callbackName] = data => {
        window.clearTimeout(timer);
        cleanup();
        if (!data || !data.ok) {
          reject(new Error(data?.error?.message || 'API request failed.'));
          return;
        }
        resolve(data.data);
      };
      script.onerror = () => {
        window.clearTimeout(timer);
        cleanup();
        reject(new Error('Cashflow API could not be reached.'));
      };
      script.src = `${url}&callback=${encodeURIComponent(callbackName)}`;
      document.head.appendChild(script);
    });
  },

  postForm_(action, payload) {
    return new Promise((resolve, reject) => {
      const frameName = `cashflowPost_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const iframe = document.createElement('iframe');
      iframe.name = frameName;
      iframe.hidden = true;
      const form = document.createElement('form');
      form.method = 'POST';
      form.target = frameName;
      form.action = CASHFLOW_API_URL;
      form.hidden = true;
      const input = document.createElement('input');
      input.name = 'payload';
      input.value = JSON.stringify({ action, payload });
      form.appendChild(input);
      document.body.append(iframe, form);
      const cleanup = () => {
        window.clearTimeout(timer);
        iframe.remove();
        form.remove();
      };
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('Cashflow API request timed out.'));
      }, 15000);
      iframe.onload = () => {
        // Apps Script may finish the HTTP response just before the sheet
        // write becomes visible to the following JSONP read.
        window.setTimeout(() => {
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
