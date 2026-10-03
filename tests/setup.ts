// 让 React 的 act(...) 在 jsdom 测试环境下被识别，消除环境警告。
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
