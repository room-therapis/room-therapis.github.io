// サイト独自デザインのフォームから、裏側でGoogleフォームへ送信する
const form = document.getElementById("contactForm");
const done = document.getElementById("contactDone");
const submitButton = form.querySelector(".contact-submit");
const sendError = document.getElementById("contactSendError");
const doneEmail = document.getElementById("contactDoneEmail");
const emailInput = form.querySelector('[name="entry.146166439"]');
const telInput = form.querySelector('[name="entry.290535761"]');
const emailSuggest = document.getElementById("emailSuggest");
const emailCarrier = document.getElementById("emailCarrier");
let submitting = false;

// 全角の英数字・記号を半角にそろえる（例：ｔｅｓｔ＠ｇｍａｉｌ．ｃｏｍ → test@gmail.com）
const toHalfWidth = (value) =>
  value.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, " ");

// 電話番号：全角数字や、いろいろな種類の「ー」「−」「（）」・空白を整えて「090-1234-5678」の形にする
const normalizeTel = (value) =>
  toHalfWidth(value)
    .replace(/[ー‐‑‒–—―−ｰ]/g, "-")
    .replace(/[\s()]/g, "");

// メールアドレス：半角にそろえ、空白を取り、「@」より後ろ（ドメイン）を小文字にする
const normalizeEmail = (value) => {
  const v = toHalfWidth(value).replace(/\s+/g, "");
  const at = v.lastIndexOf("@");
  return at < 0 ? v : v.slice(0, at + 1) + v.slice(at + 1).toLowerCase();
};

const fieldIsValid = (name) => {
  const inputs = form.querySelectorAll(`[name="${name}"]`);
  if (inputs[0].type === "radio") return [...inputs].some((input) => input.checked);
  const input = inputs[0];
  if (input.required && !input.value.trim()) return false;
  // メールアドレスは「@」の後ろに「.」を含む形だけ受け付ける（例：name@example → 返信できないため不可）
  if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) return false;
  return input.checkValidity();
};

const showError = (name, show) => {
  const error = form.querySelector(`[data-error-for="${name}"]`);
  if (error) error.classList.toggle("is-visible", show);
  form.querySelectorAll(`[name="${name}"]`).forEach((input) => input.toggleAttribute("aria-invalid", show));
};

const fieldNames = [...new Set([...form.elements].map((el) => el.name).filter(Boolean))];

// ---------------------------------------------------------------
// メールアドレスの打ち間違い・携帯会社のメールへの注意
// （アドレスが間違っていると返信が届かず、実質お問い合わせが届かないのと同じになるため）
// ---------------------------------------------------------------
const DOMAIN_TYPOS = {
  "gmail.com": ["gmial.com", "gmal.com", "gmai.com", "gamil.com", "gmali.com", "gnail.com", "gmail.co", "gmail.con", "gmail.cm", "gmail.om", "gmail.jp", "gmail.co.jp", "gmail.comm", "gmaill.com"],
  "yahoo.co.jp": ["yahoo.co.j", "yahoo.cojp", "yahoo.co.pj", "yaho.co.jp", "yahooo.co.jp", "yahoo.co.jo", "yahoo.ne.jp", "yahoo.co.jpp"],
  "icloud.com": ["icloud.co", "icloud.con", "icoud.com", "iclod.com", "icloud.jp", "icould.com", "icloud.cm"],
  "docomo.ne.jp": ["docomo.ne.j", "docomo.nejp", "docomo.co.jp", "docomo.ne.jpp", "docomo.ne", "docomo.jp"],
  "ezweb.ne.jp": ["ezweb.co.jp", "ezweb.nejp", "ezweb.ne.j", "ezweb.jp"],
  "softbank.ne.jp": ["softbank.co.jp", "softbank.nejp", "softbank.ne.j"],
  "i.softbank.jp": ["i.softbank.co.jp", "i.softbank.ne.jp", "softbank.jp"],
  "hotmail.com": ["hotmail.co", "hotmai.com", "hotmial.com", "hotmail.con"],
  "outlook.com": ["outlook.co", "outlok.com", "outlook.con"],
  "outlook.jp": ["outlook.jpp", "outlok.jp"],
};
const TYPO_TO_DOMAIN = {};
Object.entries(DOMAIN_TYPOS).forEach(([right, typos]) => typos.forEach((t) => { TYPO_TO_DOMAIN[t] = right; }));

// 携帯会社のメールは、パソコンからのメールを受け取らない設定になっていることが多い
const CARRIER_DOMAINS = ["docomo.ne.jp", "ezweb.ne.jp", "au.com", "softbank.ne.jp", "i.softbank.jp", "disney.ne.jp", "ymobile.ne.jp", "y-mobile.ne.jp", "emobile.ne.jp", "pdx.ne.jp", "willcom.com", "rakumail.jp", "uqmobile.jp"];

const checkEmailHints = () => {
  const value = normalizeEmail(emailInput.value);
  const domain = value.includes("@") ? value.split("@").pop() : "";
  const right = TYPO_TO_DOMAIN[domain];
  if (right) {
    emailSuggest.querySelector("button").textContent = `${value.slice(0, value.lastIndexOf("@") + 1)}${right}`;
    emailSuggest.hidden = false;
  } else {
    emailSuggest.hidden = true;
  }
  const checkDomain = right || domain;
  emailCarrier.hidden = !CARRIER_DOMAINS.some((d) => checkDomain === d || checkDomain.endsWith(`.${d}`));
};

emailSuggest.querySelector("button").addEventListener("click", (event) => {
  emailInput.value = event.currentTarget.textContent;
  emailInput.dispatchEvent(new Event("input", { bubbles: true }));
  emailInput.focus();
});
// 入力中は候補を出さず（「gmail.co」→「gmail.com」と打つ途中で出てしまうため）、入力欄から離れたときに確かめる
emailInput.addEventListener("input", () => { emailSuggest.hidden = true; emailCarrier.hidden = true; });
emailInput.addEventListener("blur", checkEmailHints);

// ---------------------------------------------------------------
// 入力途中の内容を、同じタブの中だけ一時保存する
// （ページの再読み込み・SNSアプリ内での画面切り替え・送信エラーなどで入力が消えないように）
// ---------------------------------------------------------------
const DRAFT_KEY = "rt-contact-draft";

const saveDraft = () => {
  try {
    const data = {};
    new FormData(form).forEach((value, key) => { data[key] = value; });
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch (e) { /* 保存できない環境では何もしない */ }
};

const clearDraft = () => {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* 何もしない */ }
};

const restoreDraft = () => {
  let data;
  try { data = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { data = null; }
  if (!data) return;
  Object.entries(data).forEach(([key, value]) => {
    form.querySelectorAll(`[name="${key}"]`).forEach((input) => {
      if (input.type === "radio") input.checked = input.value === value;
      else if (!input.value) input.value = value;
    });
  });
  checkEmailHints();
};

restoreDraft();
form.addEventListener("input", saveDraft);
form.addEventListener("change", saveDraft);

fieldNames.forEach((name) => {
  form.querySelectorAll(`[name="${name}"]`).forEach((input) => {
    input.addEventListener(input.type === "radio" ? "change" : "input", () => {
      if (fieldIsValid(name)) showError(name, false);
    });
  });
});

// ---------------------------------------------------------------
// 送信
// ---------------------------------------------------------------
const finish = () => {
  if (!submitting) return;
  submitting = false;
  doneEmail.textContent = emailInput.value;
  clearDraft();
  form.hidden = true;
  done.hidden = false;
  document.querySelectorAll(".contact-intro, .contact-book, .contact-line").forEach((el) => { el.hidden = true; });
  if (typeof gtag === "function") gtag("event", "contact_form_submit");
  done.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// 送信できなかったときは「完了」を出さず、入力内容を残したままもう一度送れる状態に戻す
const fail = (reason) => {
  submitting = false;
  submitButton.disabled = false;
  submitButton.textContent = "送信する";
  sendError.hidden = false;
  sendError.scrollIntoView({ block: "center", behavior: "smooth" });
  if (typeof gtag === "function") gtag("event", "contact_form_error", { reason });
};

form.addEventListener("submit", (event) => {
  telInput.value = normalizeTel(telInput.value);
  emailInput.value = normalizeEmail(emailInput.value);
  checkEmailHints();

  const invalid = fieldNames.filter((name) => !fieldIsValid(name));
  fieldNames.forEach((name) => showError(name, invalid.includes(name)));
  if (invalid.length) {
    event.preventDefault();
    const first = form.querySelector(`[name="${invalid[0]}"]`);
    first.focus();
    first.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }

  // 古いブラウザなど、裏側で送る仕組みが使えない場合は、通常のフォーム送信（Googleの完了画面へ移動）に任せる
  if (typeof fetch !== "function" || typeof AbortController !== "function" || typeof URLSearchParams !== "function") return;

  event.preventDefault();
  if (submitting) return;
  submitting = true;
  saveDraft();
  sendError.hidden = true;
  submitButton.disabled = true;
  submitButton.textContent = "送信中…";

  const body = new URLSearchParams(new FormData(form)).toString();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);

  // ・ブラウザのGoogleログイン情報を付けずに送る（Chromeで複数アカウントにログインしていると、
  //   ログイン情報付きの送信はGoogleに受け付けられないため）
  // ・keepalive：送信中にお客様がページを閉じたり別のアプリに切り替えたりしても、送信を最後まで続ける
  //   （ブラウザの決まりで約64KBまでなので、それより長い内容のときは付けない）
  fetch(form.action, {
    method: "POST",
    mode: "no-cors",
    credentials: "omit",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
    keepalive: body.length < 60000,
    signal: controller.signal,
  })
    .then(() => { clearTimeout(timer); finish(); })
    .catch(() => { clearTimeout(timer); fail(timedOut ? "timeout" : "network"); });
});
