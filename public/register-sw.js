let deferredPrompt = null;

function emitInstallReady() {
  window.dispatchEvent(new Event("pwa-install-ready"));
}

window.__promptPwaInstall = async function promptPwaInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice.catch(() => ({ outcome: "dismissed" }));
  deferredPrompt = null;
  return choice?.outcome === "accepted";
};

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  emitInstallReady();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
});

if ("serviceWorker" in navigator) {
  if (
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "::1"
  ) {
    // Avoid SW cache interference during local development.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  }

  const currentScript = document.currentScript;
  const scriptSrc = currentScript?.src || `${location.origin}/register-sw.js`;
  const scriptUrl = new URL(scriptSrc, location.href);
  const basePath = scriptUrl.pathname.replace(/register-sw\.js$/, "");
  const swUrl = `${basePath}sw.js`;

  if (
    location.hostname !== "localhost" &&
    location.hostname !== "127.0.0.1" &&
    location.hostname !== "::1"
  ) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(swUrl).catch((err) => {
        console.error("service worker register failed", err);
      });
    });
  }
}
