const { contextBridge } = require("electron");

// Renderer ile main arasında güvenli API köprüsü
contextBridge.exposeInMainWorld("electronAPI", {
  ping: () => "pong",
});
