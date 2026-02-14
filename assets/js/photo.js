import { uuid } from "./utils.js";

const resizeImage = (img, maxSize, mimeType) =>
  new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    let { width, height } = img;
    const ratio = Math.min(maxSize / width, maxSize / height, 1);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    resolve(canvas.toDataURL(mimeType, 0.9));
  });

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const processFiles = async (fileList) => {
  const files = Array.from(fileList || []);
  const results = [];
  for (const file of files) {
    const img = await loadImage(file);
    const mimeType = file.type || "image/jpeg";
    const fullDataUrl = await resizeImage(img, 1600, mimeType);
    const thumbDataUrl = await resizeImage(img, 400, mimeType);
    results.push({
      id: uuid(),
      mimeType,
      fullDataUrl,
      thumbDataUrl,
      createdAt: new Date().toISOString(),
    });
  }
  return results;
};
