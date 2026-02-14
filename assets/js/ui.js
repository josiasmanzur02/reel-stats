import { qs } from "./utils.js";

let toastTimer;

export const showToast = (message, type = "info") => {
  const el = qs("#toast");
  if (!el) return;
  el.textContent = message;
  el.style.background = type === "error" ? "#dc2626" : type === "success" ? "#0f9d8a" : "#0f172a";
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
};

export const confirmAction = (message) => window.confirm(message);

export const renderEmpty = (parent, text) => {
  parent.innerHTML = `<div class="empty">${text}</div>`;
};

export const setNavActive = (page) => {
  document.querySelectorAll(".nav a").forEach((a) => {
    if (a.getAttribute("href").includes(page)) a.classList.add("active");
  });
};
