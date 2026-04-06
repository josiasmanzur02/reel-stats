import { qs } from "./utils.js";

let toastTimer;

export const showToast = (message, type = "info") => {
  const el = qs("#toast");
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
};

export const confirmAction = (message) => window.confirm(message);

export const renderEmpty = (parent, text) => {
  if (!parent) return;
  parent.innerHTML = `<div class="empty-state">${text}</div>`;
};
