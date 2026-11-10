export {};
declare global {
  interface Window {
    saku: {
      summary: () => Promise<{ income: number; expense: number; savings: number }>;
      transactions: { list: () => Promise<any[]>; add: (tx: any) => Promise<any>; update: (tx: any) => Promise<any>; delete: (id: number) => Promise<any> };
      budget: { get: () => Promise<{ month: string; amount: number }>; set: (amount: number) => Promise<any> };
      savings: { list: () => Promise<any[]>; add: (goal: any) => Promise<any>; update: (goal: any) => Promise<any>; delete: (id: number) => Promise<any> };
      vault: { list: () => Promise<any[]>; add: (item: any) => Promise<any>; update: (item: any) => Promise<any>; read: (id: number) => Promise<any>; delete: (id: number) => Promise<any> };
      auth: { status: () => Promise<any>; setup: (pin: string) => Promise<any>; verify: (pin: string) => Promise<any>; recover: (recovery: string, newPin: string) => Promise<any>; change: (currentPin: string, newPin: string) => Promise<any> };
      backup: { export: (password: string) => Promise<any>; import: (password: string, mode: "merge" | "replace") => Promise<any> };
    };
  }
}
