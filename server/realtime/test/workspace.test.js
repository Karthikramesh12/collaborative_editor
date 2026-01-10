const { ensureVscode } = require("../../modules/workspace/workspace.vscode.js");

(async () => {
  try {
    const runtime = await ensureVscode(
      "test",
      "/home/karthik/workspaces/test"
    );

    console.log("VS Code runtime started:");
    console.log(runtime);
  } catch (err) {
    console.error("Failed to start VS Code:", err);
  }
})();
