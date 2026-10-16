# 3D 方塊世界（GitHub Pages 入門版）

這是一個使用 HTML、CSS、JavaScript 與 Three.js 製作的簡易 3D 第一人稱方塊沙盒遊戲。

## 功能

- WASD 移動、滑鼠轉動視角、空白鍵跳躍
- 左鍵挖掘、右鍵放置方塊
- 1～4 選擇草地、泥土、石頭、木頭
- 使用瀏覽器 `localStorage` 儲存世界與玩家位置
- 固定 32 × 32 的平坦世界

## 本機測試

因為 `game.js` 使用 ES Module，建議透過本機 HTTP 伺服器開啟，不要直接雙擊 `index.html`。

如果已安裝 Python，在專案資料夾執行：

```bash
python -m http.server 8000
```

接著用瀏覽器開啟：

```text
http://localhost:8000
```

也可以使用 VS Code 的 Live Server。

## 部署到 GitHub Pages

1. 在 GitHub 建立一個新的 repository。
2. 將 `index.html`、`style.css`、`game.js`、`README.md` 上傳到 repository 根目錄。
3. 開啟 repository 的 **Settings → Pages**。
4. 在 **Build and deployment** 選擇 **Deploy from a branch**。
5. Branch 選 `main`，資料夾選 `/ (root)`，按 Save。
6. 等待部署完成，使用 GitHub Pages 顯示的網址開啟遊戲。

## 存檔注意事項

存檔只存在目前瀏覽器的 `localStorage`，不是雲端存檔。換瀏覽器、換裝置或清除網站資料後，可能無法取回原本世界。

## 限制

- 這是教學用的最小原型，不是完整 Minecraft。
- 目前沒有怪物、合成、物品掉落、地形生成或多人連線。
- Three.js 從 jsDelivr CDN 載入，因此遊玩時需要網路連線。
- 滑鼠視角使用 Pointer Lock API，通常需要使用者點擊開始遊戲後啟用。
