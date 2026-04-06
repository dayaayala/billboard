/**
 * Positions based on a 1024x819 stage.
 * Frames removed: these are now just larger image slots.
 */
const FRAMES = [
  {
    shape: "rect",
    frame: { x: 118, y: 177, w: 162, h: 193 },
  },
  {
    shape: "rect",
    frame: { x: 323, y: 115, w: 392, h: 265 },
  },
  {
    shape: "rect",
    frame: { x: 734, y: 190, w: 212, h: 319 },
  },
  {
    shape: "rect",
    frame: { x: 110, y: 426, w: 159, h: 226 },
  },
  {
    shape: "rect",
    frame: { x: 329, y: 394, w: 386, h: 222 },
  },
];

function applySlotPhoto(slotEl, url) {
  const img = slotEl.querySelector(".photo-inner img");
  if (!url) {
    img.removeAttribute("src");
    slotEl.classList.remove("has-image");
    return;
  }
  img.src = url;
  img.onload = () => slotEl.classList.add("has-image");
  if (img.complete) slotEl.classList.add("has-image");
}

function buildGallery() {
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";

  FRAMES.forEach((frame, index) => {
    const slot = document.createElement("article");
    slot.className = "frame-slot";
    if (frame.shape === "oval") slot.classList.add("frame-slot--oval");
    slot.dataset.slot = String(index);
    const { x, y, w, h } = frame.frame;
    slot.style.setProperty("--frame-x", `${(x / 1024) * 100}%`);
    slot.style.setProperty("--frame-y", `${(y / 819) * 100}%`);
    slot.style.setProperty("--frame-w", `${(w / 1024) * 100}%`);
    slot.style.setProperty("--frame-h", `${(h / 819) * 100}%`);

    const fileId = `frame-file-${index}`;
    slot.innerHTML = `
      <div class="frame-stack">
        <div class="photo-inner">
          <img class="photo" alt="" />
        </div>
        <input type="file" id="${fileId}" class="frame-file-input" accept="image/*" tabindex="-1" />
        <label for="${fileId}" class="frame-upload-hit" aria-label="Upload photo" tabindex="0"></label>
      </div>
    `;

    const stack = slot.querySelector(".frame-stack");
    const input = slot.querySelector(".frame-file-input");

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      uploadSlot(index, file, slot);
      input.value = "";
    });

    bindTilt(slot, stack);
    gallery.appendChild(slot);
  });
}

function bindTilt(slot, stack) {
  const maxTilt = 9;

  slot.addEventListener("mousemove", (e) => {
    const rect = slot.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    const rx = py * -2 * maxTilt;
    const ry = px * 2 * maxTilt;
    stack.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(4px)`;
  });

  slot.addEventListener("mouseleave", () => {
    stack.style.transform = "";
  });
}

async function uploadSlot(slotIndex, file, slotEl) {
  slotEl.classList.add("is-uploading");
  const fd = new FormData();
  fd.append("photo", file);
  try {
    const res = await fetch(`/api/upload/${slotIndex}`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    if (data.url) applySlotPhoto(slotEl, data.url);
  } catch (err) {
    alert(err.message || "Upload failed");
  } finally {
    slotEl.classList.remove("is-uploading");
  }
}

function applyState(s) {
  if (!s || !Array.isArray(s.slots)) return;
  document.querySelectorAll(".frame-slot").forEach((el) => {
    const i = parseInt(el.dataset.slot, 10);
    applySlotPhoto(el, s.slots[i] || "");
  });
}

async function init() {
  buildGallery();

  const res = await fetch("/api/state");
  const initial = await res.json();
  applyState(initial);

  const socket = io();
  socket.on("state", applyState);
  socket.on("photo", ({ slot, url }) => {
    const el = document.querySelector(`.frame-slot[data-slot="${slot}"]`);
    if (el) applySlotPhoto(el, url);
  });
}

init();
