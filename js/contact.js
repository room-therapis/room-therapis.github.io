// サイト独自デザインのフォームから、裏側でGoogleフォームへ送信する
const form = document.getElementById("contactForm");
const sink = document.getElementById("contactFormSink");
const done = document.getElementById("contactDone");
const submitButton = form.querySelector(".contact-submit");
let submitting = false;

const toHalfWidth = (value) =>
  value.replace(/[０-９－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\s+/g, "");

const fieldIsValid = (name) => {
  const inputs = form.querySelectorAll(`[name="${name}"]`);
  if (inputs[0].type === "radio") return [...inputs].some((input) => input.checked);
  const input = inputs[0];
  if (input.required && !input.value.trim()) return false;
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

const finish = () => {
  if (!submitting) return;
  submitting = false;
  form.hidden = true;
  done.hidden = false;
  document.querySelectorAll(".contact-intro, .contact-book, .contact-line").forEach((el) => { el.hidden = true; });
  if (typeof gtag === "function") gtag("event", "contact_form_submit");
  done.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

form.addEventListener("submit", (event) => {
  const tel = form.querySelector('[name="entry.290535761"]');
  tel.value = toHalfWidth(tel.value);

  const invalid = fieldNames.filter((name) => !fieldIsValid(name));
  fieldNames.forEach((name) => showError(name, invalid.includes(name)));
  if (invalid.length) {
    event.preventDefault();
    const first = form.querySelector(`[name="${invalid[0]}"]`);
    first.focus();
    first.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }

  submitting = true;
  submitButton.disabled = true;
  submitButton.textContent = "送信中…";

  // ブラウザのGoogleログイン情報を付けずに送る（Chromeで複数アカウントにログインしていると、
  // ログイン情報付きの送信はGoogleに受け付けられないため）
  event.preventDefault();
  fetch(form.action, {
    method: "POST",
    mode: "no-cors",
    credentials: "omit",
    body: new URLSearchParams(new FormData(form)),
  })
    .then(finish)
    .catch(() => {
      // 通信に失敗した場合は、従来どおり見えない窓（iframe）から送る
      form.submit();
      setTimeout(finish, 8000);
    });
});

sink.addEventListener("load", finish);
