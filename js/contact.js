// サイト独自デザインのフォームから、裏側でGoogleフォームへ送信する
const form = document.getElementById("contactForm");
const done = document.getElementById("contactDone");
const submitButton = form.querySelector(".contact-submit");
let submitting = false;

// 全角の英数字・記号を半角にそろえる（例：ｔｅｓｔ＠ｇｍａｉｌ．ｃｏｍ → test@gmail.com）
const toHalfWidth = (value) =>
  value.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\u3000/g, " ");

// 電話番号：全角数字や、いろいろな種類の「ー」「−」「（）」・空白を整えて「090-1234-5678」の形にする
const normalizeTel = (value) =>
  toHalfWidth(value)
    .replace(/[ー‐‑‒–—―−ｰ]/g, "-")
    .replace(/[\s()]/g, "");

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

fieldNames.forEach((name) => {
  form.querySelectorAll(`[name="${name}"]`).forEach((input) => {
    input.addEventListener(input.type === "radio" ? "change" : "input", () => {
      if (fieldIsValid(name)) showError(name, false);
    });
  });
});

const sendError = document.getElementById("contactSendError");
const doneEmail = document.getElementById("contactDoneEmail");

const finish = () => {
  if (!submitting) return;
  submitting = false;
  doneEmail.textContent = form.querySelector('[name="entry.146166439"]').value;
  form.hidden = true;
  done.hidden = false;
  document.querySelectorAll(".contact-intro, .contact-book, .contact-line").forEach((el) => { el.hidden = true; });
  if (typeof gtag === "function") gtag("event", "contact_form_submit");
  done.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// 送信できなかったときは「完了」を出さず、入力内容を残したままもう一度送れる状態に戻す
const fail = () => {
  submitting = false;
  submitButton.disabled = false;
  submitButton.textContent = "送信する";
  sendError.hidden = false;
  sendError.scrollIntoView({ block: "center", behavior: "smooth" });
  if (typeof gtag === "function") gtag("event", "contact_form_error");
};

form.addEventListener("submit", (event) => {
  const tel = form.querySelector('[name="entry.290535761"]');
  tel.value = normalizeTel(tel.value);
  const email = form.querySelector('[name="entry.146166439"]');
  email.value = toHalfWidth(email.value).replace(/\s+/g, "");

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
  if (typeof fetch !== "function" || typeof AbortController !== "function") return;

  event.preventDefault();
  if (submitting) return;
  submitting = true;
  sendError.hidden = true;
  submitButton.disabled = true;
  submitButton.textContent = "送信中…";

  // ブラウザのGoogleログイン情報を付けずに送る（Chromeで複数アカウントにログインしていると、
  // ログイン情報付きの送信はGoogleに受け付けられないため）
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  fetch(form.action, {
    method: "POST",
    mode: "no-cors",
    credentials: "omit",
    body: new URLSearchParams(new FormData(form)),
    signal: controller.signal,
  })
    .then(() => { clearTimeout(timer); finish(); })
    .catch(() => { clearTimeout(timer); fail(); });
});
