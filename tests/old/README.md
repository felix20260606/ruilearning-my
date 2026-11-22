# 旧的浏览器测试（不会自动跑）

这里是早期用 Playwright 驱动真浏览器的测试（t7–t40）。它们写死了当时的本机路径（`/home/claude/ext` 等），要装 Playwright 和插件才能跑，GitHub Actions 的「自动测试」从来不跑它们，所以挪到这里，免得让人以为有测试兜底。

- 想重新用：装好 `playwright`，按各文件开头的路径改成自己机器上的，再 `node tests/old/tXX.js`。
- 新写的测试放在 `tests/` 下，文件名 `tNN-名字.js`（NN ≥ 41），不联网、用假数据，`.github/workflows/test.yml` 会自动跑。
- 原来的 t38（插件 → 生词本同步，不用浏览器）已经改名成 `tests/t69-bg-sync.js`，自动测试会跑它。
