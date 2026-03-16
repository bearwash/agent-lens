export type Locale = "en" | "ja";

const translations = {
  en: {
    // Header
    "header.pending": "pending",
    "header.sessions": "sessions",
    "header.session": "session",
    "header.spans": "spans",
    "header.span": "span",
    "header.connected": "Connected",
    "header.reconnecting": "Reconnecting...",

    // Cost
    "cost.cost": "Cost",
    "cost.tokens": "Tokens",
    "cost.in": "in",
    "cost.out": "out",
    "cost.llmCalls": "LLM calls",
    "cost.input": "Input",
    "cost.output": "Output",
    "cost.total": "Total",

    // Timeline
    "timeline.waiting": "Waiting for activity",
    "timeline.waitingDesc": "Connect an agent through the proxy to start observing its reasoning.",
    "timeline.main": "Main",

    // Span kinds
    "kind.thinking": "Thinking",
    "kind.tool_call": "Tool call",
    "kind.tool_result": "Result",
    "kind.retry": "Retry",
    "kind.user_intervention": "Intervention",
    "kind.branch": "Branch",

    // Span detail
    "detail.select": "Select a span to inspect",
    "detail.selectHint": "Click any item in the timeline, or right-click for options",
    "detail.timing": "Timing",
    "detail.started": "Started",
    "detail.ended": "Ended",
    "detail.duration": "Duration",
    "detail.status": "Status",
    "detail.reasoning": "Reasoning",
    "detail.arguments": "Arguments",
    "detail.cost": "Cost",
    "detail.attachments": "Attachments",
    "detail.attributes": "Attributes",
    "detail.events": "Events",
    "detail.metadata": "Metadata",

    // Approval
    "approval.pending": "pending",
    "approval.pendingApprovals": "pending approvals",
    "approval.pendingApproval": "pending approval",
    "approval.waiting": "Waiting for approval",
    "approval.addNote": "Add a note...",
    "approval.approve": "Approve",
    "approval.reject": "Reject",

    // Context menu
    "menu.forkHere": "Fork here",
    "menu.forkDesc": "Create a new branch",
    "menu.rewind": "Rewind to this step",
    "menu.rewindDesc": "Reset agent state",
    "menu.copyId": "Copy span ID",
    "menu.createBranch": "Create branch",
    "menu.branchLabel": "Branch label (optional)",
    "menu.cancel": "Cancel",
    "menu.create": "Create",

    // Branch tree
    "branches.title": "Branches",
    "branches.abandoned": "abandoned",

    // Attachments
    "attachment.preview": "Preview not available for",
    "attachment.openTab": "Open in new tab",
  },
  ja: {
    // Header
    "header.pending": "件保留中",
    "header.sessions": "セッション",
    "header.session": "セッション",
    "header.spans": "スパン",
    "header.span": "スパン",
    "header.connected": "接続中",
    "header.reconnecting": "再接続中...",

    // Cost
    "cost.cost": "コスト",
    "cost.tokens": "トークン",
    "cost.in": "入力",
    "cost.out": "出力",
    "cost.llmCalls": "LLM呼出",
    "cost.input": "入力",
    "cost.output": "出力",
    "cost.total": "合計",

    // Timeline
    "timeline.waiting": "アクティビティを待機中",
    "timeline.waitingDesc": "プロキシ経由でエージェントを接続すると、推論の観測が開始されます。",
    "timeline.main": "メイン",

    // Span kinds
    "kind.thinking": "思考",
    "kind.tool_call": "ツール呼出",
    "kind.tool_result": "結果",
    "kind.retry": "リトライ",
    "kind.user_intervention": "人間介入",
    "kind.branch": "ブランチ",

    // Span detail
    "detail.select": "スパンを選択してください",
    "detail.selectHint": "タイムラインの項目をクリック、または右クリックでオプション表示",
    "detail.timing": "タイミング",
    "detail.started": "開始",
    "detail.ended": "終了",
    "detail.duration": "所要時間",
    "detail.status": "ステータス",
    "detail.reasoning": "推論（Chain of Thought）",
    "detail.arguments": "引数",
    "detail.cost": "コスト",
    "detail.attachments": "添付ファイル",
    "detail.attributes": "属性",
    "detail.events": "イベント",
    "detail.metadata": "メタデータ",

    // Approval
    "approval.pending": "件保留中",
    "approval.pendingApprovals": "件の承認待ち",
    "approval.pendingApproval": "件の承認待ち",
    "approval.waiting": "承認待ち",
    "approval.addNote": "メモを追加...",
    "approval.approve": "承認",
    "approval.reject": "拒否",

    // Context menu
    "menu.forkHere": "ここでフォーク",
    "menu.forkDesc": "新しいブランチを作成",
    "menu.rewind": "このステップに巻き戻し",
    "menu.rewindDesc": "エージェントの状態をリセット",
    "menu.copyId": "スパンIDをコピー",
    "menu.createBranch": "ブランチを作成",
    "menu.branchLabel": "ブランチ名（任意）",
    "menu.cancel": "キャンセル",
    "menu.create": "作成",

    // Branch tree
    "branches.title": "ブランチ",
    "branches.abandoned": "放棄",

    // Attachments
    "attachment.preview": "プレビュー非対応:",
    "attachment.openTab": "新しいタブで開く",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(key: TranslationKey, locale: Locale): string {
  return translations[locale][key] ?? translations.en[key] ?? key;
}

export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language;
  if (lang.startsWith("ja")) return "ja";
  return "en";
}
