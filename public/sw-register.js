if ("serviceWorker" in navigator) {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(function (registration) {
        registration.unregister();
      });
    });
    if (window.caches) {
      caches.keys().then(function (names) {
        names.forEach(function (name) { caches.delete(name); });
      });
    }
  } else {
    window.addEventListener("load", function () {
      navigator.serviceWorker
        .register("/sw.js")
        .then(function (registration) {
          console.log("ServiceWorker registered:", registration.scope);
        })
        .catch(function (error) {
          console.log("ServiceWorker registration failed:", error);
        });
    });
  }
}
