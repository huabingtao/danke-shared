# danke-shared

@danke/shared 是生态共享 TypeScript 源码包，非独立服务。先读 ../AGENTS.md 和 ../DESIGN_SYSTEM.md。

- package.json exports 直接指向 src/；没有独立 dist 构建。现有消费端通过 file:../danke-shared 引用。
- src/config.ts 管配置解析；assets.ts 管资源路径；types.ts 管领域类型；quality.ts 管品质语义；react/ 管共享 hooks；tokens/ 管浅深主题与品质 CSS。
- 公共导出以 package.json exports 和 src/index.ts 为准；新增入口需同步导出契约，不依赖私有内部文件路径。
- 共享层不读取消费端专属数据、业务密钥或窗口全局副作用；保持纯工具与 React 入口分离。
- 改 Token 或品质映射先核对现有设计语义；改 API/资产解析需覆盖空值、环境覆盖、URL 与相对路径边界。
- npm run typecheck、npm test 为主要检查；npm run lint 当前也是 tsc --noEmit，没有 npm run build。
- 改公共导出、React hooks 或主题后验证受影响的 Web/Admin/Rank/Market，兼容 React 18 与 19 的 peer 约束。
- previews/ 为演示文件，不能把其中试验样式当作全生态已采纳规则。
