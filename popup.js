/**
 * SEO & Render Checker
 * Author: limaomao
 * Version: 1.0
 * Description: Analyze CSR/SSR, HTTP status, SEO tags, hreflang, structured data (JSON-LD),
 *              content metrics, and export reports. Supports missing field highlighting.
 */

// 翻译函数
function t(key, args = {}) {
  let msg = chrome.i18n.getMessage(key) || key;
  for (const [k, v] of Object.entries(args)) {
    msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return msg;
}

function updateUIText() {
  document.getElementById('title').textContent = t('appName');
  document.getElementById('lang-switch').textContent = t('langSwitch');
  document.getElementById('result').innerHTML = `<p>${t('loading')}</p>`;
}

function switchLanguage() {
  location.reload();
}

// CSV 导出工具（扁平化）
function jsonToCsv(data) {
  const flatten = (obj, prefix = '') => {
    const result = {};
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        Object.assign(result, flatten(obj[key], prefix + key + '_'));
      } else if (Array.isArray(obj[key])) {
        if (key === 'hreflang') {
          result[prefix + key] = obj[key].join('; ');
        } else if (key === 'jsonLdList') {
          result[prefix + key] = obj[key].map(item => item.types.join(', ')).join('; ');
        } else {
          result[prefix + key] = obj[key].join('; ');
        }
      } else {
        result[prefix + key] = obj[key];
      }
    }
    return result;
  };

  const flat = flatten(data);
  const escape = (v) => {
    if (v == null) return '';
    if (typeof v === 'string') {
      let s = v.replace(/"/g, '""');
      if (s.includes(',') || s.includes('\n') || s.includes('"')) s = `"${s}"`;
      return s;
    }
    return String(v);
  };

  const headers = Object.keys(flat);
  const values = headers.map(k => escape(flat[k]));
  return [headers.join(','), values.join(',')].join('\n');
}

// 渲染报告
function renderReport(report) {
  const r = report;
  let html = '';

  // 作者标识（顶部小字）
  html += `<div style="text-align:right; font-size:11px; color:#888; margin-bottom:10px;">by limaomao</div>`;

  // 渲染类型 & 状态码
  html += `<h3>${t('renderType')}</h3><div class="value">${r.renderType}</div>`;
  html += `<h3>${t('statusCode')}</h3><div class="value">${r.statusCode}</div>`;

  // 基础信息（带缺失高亮）
  const highlightMissing = (value, isCritical = true) => {
    if (value) {
      return `<div class="value">${value}</div>`;
    } else {
      const cls = isCritical ? 'value missing critical' : 'value missing';
      return `<div class="${cls}">${t('missing')}</div>`;
    }
  };

  html += `<h3>${t('basicInfo')}</h3>`;
  html += `<div class="field"><strong>${t('pageTitle')}:</strong>${highlightMissing(r.pageTitle)}</div>`;
  html += `<div class="field"><strong>${t('canonical')}:</strong>${highlightMissing(r.canonical)}</div>`;
  html += `<div class="field"><strong>${t('charset')}:</strong>${highlightMissing(r.charset, false)}</div>`;
  html += `<div class="field"><strong>${t('contentLanguage')}:</strong>${highlightMissing(r.contentLanguage, false)}</div>`;

  // 内容分析
  html += `<h3>${t('contentAnalysis')}</h3>`;
  html += `<div class="field"><strong>${t('fullChars')}:</strong><div class="value">${r.fullPage_characters.toLocaleString()}</div></div>`;
  html += `<div class="field"><strong>${t('fullWords')}:</strong><div class="value">${r.fullPage_words.toLocaleString()}</div></div>`;
  html += `<div class="field"><strong>${t('mainChars')}:</strong><div class="value">${r.mainContent_characters.toLocaleString()}</div></div>`;
  html += `<div class="field"><strong>${t('mainWords')}:</strong><div class="value">${r.mainContent_words.toLocaleString()}</div></div>`;

  // SEO Tags
  html += `<h3>${t('seoTags')}</h3>`;
  const tagGroups = [
    { cat: 'general', label: 'General' },
    { cat: 'openGraph', label: t('openGraph') },
    { cat: 'twitterCard', label: t('twitterCard') }
  ];
  tagGroups.forEach(({ cat, label }) => {
    html += `<h4>${label}</h4>`;
    let has = false;
    for (const [k, v] of Object.entries(r.seoMetas[cat] || {})) {
      if (v) {
        html += `<div class="field"><strong>${k}:</strong><div class="value">${v}</div></div>`;
        has = true;
      }
    }
    if (!has) html += `<div class="empty">${t('noData')}</div>`;
  });

  // Hreflang：显示为 "lang: URL"
  html += `<h3>${t('hreflangLinks')}</h3>`;
  if (r.hreflang && Array.isArray(r.hreflang) && r.hreflang.length > 0) {
    html += `<ul class="url-list">`;
    r.hreflang.forEach(item => {
      const colonIndex = item.indexOf(':');
      if (colonIndex === -1) return;
      const lang = item.substring(0, colonIndex);
      const url = item.substring(colonIndex + 1);
      html += `<li><strong>${lang}:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#1a73e8; text-decoration:underline;">${url}</a></li>`;
    });
    html += `</ul>`;
  } else {
    html += `<div class="empty">${t('noData')}</div>`;
  }

  // 结构化数据
  html += `<h3>${t('structuredData')}</h3>`;
  if (r.jsonLdList && r.jsonLdList.length > 0) {
    r.jsonLdList.forEach((item, idx) => {
      const { raw, types } = item;
      const typeLabel = types.join(', ');
      const formatted = (() => {
        try {
          return JSON.stringify(JSON.parse(raw), null, 2);
        } catch {
          return raw;
        }
      })();

      html += `
        <details style="margin:8px 0; border:1px solid #ddd; border-radius:6px;">
          <summary style="padding:8px 12px; background:#f5f5f5; cursor:pointer; font-weight:bold; list-style:none;">
            📦 JSON-LD ${idx + 1}: ${typeLabel}
            <button type="button" 
                    data-clipboard="${encodeURIComponent(raw)}"
                    style="float:right; margin-left:8px; padding:2px 8px; font-size:11px;"
                    class="copy-json-btn">
              ${t('copy')}
            </button>
          </summary>
          <pre class="json-ld" style="margin:0; border-top:1px solid #eee; background:#2d3748; color:#e2e8f0; padding:12px; font-family:monospace; font-size:12px; overflow:auto; max-height:200px;">${formatted}</pre>
        </details>
      `;
    });
  } else {
    html += `<div class="empty">${t('noData')}</div>`;
  }

  // 导出按钮
  html += `<p style="margin-top:20px;">
    <button id="export-json">${t('exportJson')}</button>
    <button id="export-csv">${t('exportCsv')}</button>
    <button id="export-all-jsonld">${t('exportAllJsonLd')}</button>
  </p>`;

  // 作者署名（底部）
  html += `<div class="footer-note">🔍 Tool by <strong>limaomao</strong></div>`;

  document.getElementById('result').innerHTML = html;

  // 绑定导出事件
  document.getElementById('export-json')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `seo-report-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('export-csv')?.addEventListener('click', () => {
    const csv = jsonToCsv(report);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `seo-report-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // 新增：导出所有 JSON-LD 为单独文件
  document.getElementById('export-all-jsonld')?.addEventListener('click', () => {
    if (!report.jsonLdList || report.jsonLdList.length === 0) {
      alert(t('noStructuredData'));
      return;
    }

    report.jsonLdList.forEach((item, idx) => {
      try {
        let obj;
        if (item.types.includes('Invalid JSON')) {
          obj = { error: "Invalid JSON", raw: item.raw };
        } else {
          obj = JSON.parse(item.raw);
        }
        // 注入作者元信息
        obj._meta = {
          exportedBy: "SEO & Render Checker",
          author: "limaomao",
          timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
        const safeType = (item.types[0] || 'unknown').replace(/[^a-z0-9]/gi, '_');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `schema-${idx + 1}-${safeType}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (e) {
        console.error('Export JSON-LD failed:', e);
      }
    });
  });

  // 绑定复制按钮
  document.querySelectorAll('.copy-json-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const encoded = btn.getAttribute('data-clipboard');
      const text = decodeURIComponent(encoded);
      try {
        await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = t('copied');
        setTimeout(() => {
          btn.textContent = original;
        }, 1500);
      } catch (err) {
        console.error('Copy failed:', err);
        btn.textContent = '❌';
      }
    });
  });
}

// 主分析函数
async function analyzeAndRender() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  const url = tabs[0]?.url;

  if (!tabId) {
    document.getElementById('result').innerHTML = '<p>❌ Tab not found</p>';
    return;
  }

  try {
    let statusCode = 'N/A';
    try {
      const res = await chrome.storage.local.get(['statusCode']);
      statusCode = res.statusCode || 'N/A';
    } catch (e) {}

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const hasVisibleContentInHTML = (() => {
          const bodyText = document.body ? document.body.innerText.trim() : '';
          const title = document.title.trim();
          return title.length > 0 && bodyText.length > 50;
        })();
        const rootDiv = document.getElementById('root') || document.getElementById('app');
        const isLikelyCSR = rootDiv && rootDiv.children.length === 0;
        const renderType = (isLikelyCSR || !hasVisibleContentInHTML) ? 'CSR' : 'SSR';

        const extractMeta = (names) => {
          const obj = {};
          names.forEach(name => {
            const el = document.querySelector(`meta[name="${name}"]`) ||
                       document.querySelector(`meta[property="${name}"]`);
            obj[name] = el ? el.content : null;
          });
          return obj;
        };

        const jsonLdList = [];
        document.querySelectorAll('script[type="application/ld+json"]').forEach(el => {
          const text = el.textContent.trim();
          if (!text) return;

          try {
            const json = JSON.parse(text);
            const extractTypes = (obj) => {
              if (Array.isArray(obj)) {
                return obj.flatMap(extractTypes);
              }
              if (obj && typeof obj === 'object') {
                let types = [];
                if (obj['@type']) {
                  if (Array.isArray(obj['@type'])) {
                    types = types.concat(obj['@type']);
                  } else {
                    types.push(obj['@type']);
                  }
                }
                for (const key in obj) {
                  if (key !== '@type' && typeof obj[key] === 'object') {
                    types = types.concat(extractTypes(obj[key]));
                  }
                }
                return types;
              }
              return [];
            };
            const types = [...new Set(extractTypes(json))];
            jsonLdList.push({ raw: text, types: types.length ? types : ['Unknown'] });
          } catch (e) {
            jsonLdList.push({ raw: text, types: ['Invalid JSON'] });
          }
        });

        // ====== 【智能内容统计：支持中英文】======
        const fullText = document.body?.innerText || '';
        const fullChars = fullText.length;

        // 判断是否为中文页面
        const isChinesePage = (() => {
          // 1. 优先看 html lang 属性
          const htmlLang = (document.documentElement.lang || '').toLowerCase();
          if (htmlLang.startsWith('zh')) return true;

          // 2. 其次看 meta content-language
          const metaLang = document.querySelector('meta[http-equiv="Content-Language"]');
          if (metaLang && metaLang.content.toLowerCase().startsWith('zh')) return true;

          // 3. 最后通过内容采样：如果中文字符占比 > 30%，视为中文页
          const chineseCharCount = (fullText.match(/[\u4e00-\u9fff]/g) || []).length;
          const totalVisibleChars = fullText.replace(/\s+/g, '').length || 1;
          return chineseCharCount / totalVisibleChars > 0.3;
        })();

        // 根据语言类型统计“词数”
        const countWordsOrChinese = (text) => {
          if (isChinesePage) {
            // 中文：只统计汉字（Unicode 范围 \u4e00-\u9fff）
            return (text.match(/[\u4e00-\u9fff]/g) || []).length;
          } else {
            // 英文/其他：按单词（非空白连续字符）
            return text.trim() ? text.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
          }
        };

        const fullWords = countWordsOrChinese(fullText);

        // 主体内容提取（复用修复后的逻辑）
        let mainText = '';
        const MAIN_SELECTORS = [
          'main', '[role="main"]', '.main-content', '.MainContent',
          '#main', '#content', '.content', '.post-content',
          '.entry-content', '.article-body'
        ].join(', ');

        let mainContainer = document.querySelector(MAIN_SELECTORS);
        if (mainContainer) {
          mainText = mainContainer.innerText || '';
        } else {
          const clone = document.body.cloneNode(true);
          if (clone) {
            const NON_MAIN_SELECTORS = [
              'header', 'footer', 'nav', 'aside',
              '[role="banner"]', '[role="contentinfo"]', '[role="navigation"]',
              '.header', '.Header', '#header',
              '.footer', '.Footer', '#footer',
              '.site-header', '.site-footer',
              '.navigation', '.nav', '.sidebar',
              '.widget', '.ad', '.advertisement',
              '[class*="ad-"]', '[id*="ad-"]',
              '.cookie-banner', '.consent-banner'
            ].join(', ');

            try {
              clone.querySelectorAll(NON_MAIN_SELECTORS).forEach(el => {
                if (el.parentNode) el.parentNode.removeChild(el);
              });
            } catch (e) {
              // 忽略选择器错误
            }
            mainText = clone.innerText || '';
          }
        }

        let mainChars = mainText.length;
        let mainWords = countWordsOrChinese(mainText);

        // 安全兜底：主体不应超过全文
        if (mainChars > fullChars) {
          mainChars = fullChars;
          mainWords = fullWords;
        }
        // ====== 【智能统计结束】======

        return {
          renderType,
          pageTitle: document.title || null,
          canonical: (() => {
            const el = document.querySelector('link[rel="canonical"]');
            return el ? el.href : null;
          })(),
          charset: (() => {
            const el = document.querySelector('meta[charset]');
            return el ? el.getAttribute('charset') : null;
          })(),
          contentLanguage: (() => {
            const el = document.querySelector('meta[http-equiv="Content-Language"]');
            return el ? el.content : document.documentElement.lang || null;
          })(),
          seoMetas: {
            general: extractMeta(['description', 'keywords', 'author', 'robots', 'viewport']),
            openGraph: extractMeta(['og:title', 'og:description', 'og:image', 'og:type', 'og:url']),
            twitterCard: extractMeta(['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:site'])
          },
          hreflang: Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'))
            .map(el => `${el.hreflang}:${el.href}`),
          fullPage_characters: fullChars,
          fullPage_words: fullWords,
          mainContent_characters: mainChars,
          mainContent_words: mainWords,
          jsonLdList
        };
      }
    });

    const pageData = results[0]?.result;
    if (!pageData) throw new Error('No data from page');

    const report = {
      url,
      timestamp: new Date().toISOString(),
      statusCode,
      _meta: {
        tool: "SEO & Render Checker",
        author: "limaomao",
        version: "1.0"
      },
      ...pageData
    };

    renderReport(report);
  } catch (err) {
    console.error(err);
    document.getElementById('result').innerHTML = `
      <p style="color:red;">${t('error')}</p>
      <pre>${err.message}</pre>
    `;
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  updateUIText();
  document.getElementById('lang-switch').addEventListener('click', switchLanguage);
  analyzeAndRender();
});