import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("saku", {
  summary: () => ipcRenderer.invoke("app:summary"),
  transactions: { list: () => ipcRenderer.invoke("transactions:list"), add: (tx: unknown) => ipcRenderer.invoke("transactions:add", tx), update: (tx: unknown) => ipcRenderer.invoke("transactions:update", tx), delete: (id: number) => ipcRenderer.invoke("transactions:delete", id) },
  budget: { get: () => ipcRenderer.invoke("budget:get"), set: (amount: number) => ipcRenderer.invoke("budget:set", amount) },
  savings: { list: () => ipcRenderer.invoke("savings:list"), add: (goal: unknown) => ipcRenderer.invoke("savings:add", goal), update: (goal: unknown) => ipcRenderer.invoke("savings:update", goal), delete: (id: number) => ipcRenderer.invoke("savings:delete", id) },
  vault: {
    list: () => ipcRenderer.invoke("vault:list"), update: (item: unknown) => ipcRenderer.invoke("vault:update", item),
    add: (item: unknown) => ipcRenderer.invoke("vault:add", item),
    read: (id: number) => ipcRenderer.invoke("vault:read", id), delete: (id: number) => ipcRenderer.invoke("vault:delete", id),
  },
  auth: { status: () => ipcRenderer.invoke("auth:status"), setup: (pin: string) => ipcRenderer.invoke("auth:setup", pin), verify: (pin: string) => ipcRenderer.invoke("auth:verify", pin), recover: (recovery: string, newPin: string) => ipcRenderer.invoke("auth:recover", recovery, newPin), change: (currentPin: string, newPin: string) => ipcRenderer.invoke("auth:change", currentPin, newPin) },
  backup: { export: (password: string) => ipcRenderer.invoke("backup:export", password), import: (password: string, mode: "merge" | "replace") => ipcRenderer.invoke("backup:import", password, mode) },
});
