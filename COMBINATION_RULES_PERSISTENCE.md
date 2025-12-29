# 組合識別器規則持久化功能

## 新增功能

### 1. 規則持久化 💾
規則現在會自動保存到瀏覽器的 localStorage，即使關閉瀏覽器或重新整理頁面，之前設定的規則都會被保留。

#### 技術實現
```typescript
// 從 localStorage 載入規則
const [rules, setRules] = useState<CombinationRule[]>(() => {
  try {
    const saved = localStorage.getItem('visionlab-combination-rules');
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.error('Failed to load rules from localStorage:', error);
  }
  return [];
});

// 自動保存規則到 localStorage
useEffect(() => {
  try {
    localStorage.setItem('visionlab-combination-rules', JSON.stringify(rules));
  } catch (error) {
    console.error('Failed to save rules to localStorage:', error);
  }
}, [rules]);
```

### 2. 清空所有規則 🗑️
在規則列表標題旁新增「清空全部」按鈕，方便用戶一次刪除所有規則。

#### 特點
- ✅ 只在有規則時顯示
- ✅ 點擊前會顯示確認對話框
- ✅ 顯示要刪除的規則數量
- ✅ 防止誤操作

#### 使用方式
1. 點擊規則列表右上角的「清空全部」按鈕
2. 確認對話框會顯示：`確定要清空所有 X 條規則嗎？此操作無法復原。`
3. 點擊「確定」後所有規則被刪除

### 3. 刪除單個規則 ❌
原有的刪除功能保持不變，每個規則右上角都有垃圾桶圖標，點擊即可刪除該規則。

## 規則管理操作總覽

### 新增規則
1. 點擊「新增組合規則」按鈕
2. 填寫條件和最終類別
3. 點擊「添加」
4. ✅ **自動保存到 localStorage**

### 啟用/停用規則
1. 點擊規則左側的複選框
2. ✅ **狀態自動保存到 localStorage**

### 刪除單個規則
1. 點擊規則右上角的垃圾桶圖標
2. 規則立即刪除
3. ✅ **更新自動保存到 localStorage**

### 清空所有規則
1. 點擊「清空全部」按鈕（規則列表標題旁）
2. 確認對話框
3. 所有規則被刪除
4. ✅ **localStorage 被清空**

### 導出規則
1. 點擊底部「導出規則」按鈕
2. 下載 JSON 文件
3. 可以備份或分享給他人

### 導入規則
1. 點擊底部「導入規則」按鈕
2. 選擇之前導出的 JSON 文件
3. 規則被導入
4. ✅ **自動保存到 localStorage**

## 數據持久化細節

### 存儲位置
- **Key**: `visionlab-combination-rules`
- **位置**: 瀏覽器 localStorage
- **格式**: JSON 字符串

### 存儲內容
```json
[
  {
    "id": "1234567890",
    "faceLabel": "Happy",
    "handLabel": "Peace",
    "bodyLabel": "",
    "resultLabel": "開心比讚",
    "enabled": true
  },
  ...
]
```

### 何時保存
- 新增規則時
- 刪除規則時
- 啟用/停用規則時
- 導入規則時
- 清空所有規則時

### 何時載入
- 組件首次掛載時（頁面載入時）

## 跨瀏覽器使用

### 注意事項
⚠️ **規則是綁定到瀏覽器的**
- 不同瀏覽器之間不共享規則
- 無痕模式下的規則不會保存
- 清除瀏覽器數據會刪除規則

### 解決方案
使用「導出/導入」功能在不同瀏覽器或設備之間遷移規則：
1. 在 A 瀏覽器導出規則 JSON
2. 在 B 瀏覽器導入該 JSON
3. 完成規則遷移

## 容量限制

localStorage 通常有 5-10MB 的容量限制，但對於規則存儲來說綽綽有餘：
- 單個規則約 200 bytes
- 可存儲數千條規則
- 實際使用中通常不會超過幾十條

## 故障恢復

如果遇到問題：

### localStorage 損壞
```javascript
// 在瀏覽器控制台執行
localStorage.removeItem('visionlab-combination-rules');
```

### 規則數據格式錯誤
應用會自動處理錯誤並返回空數組，不會影響使用。

### 完全重置
1. 使用「清空全部」按鈕
2. 或在控制台執行上述命令

## 更新日誌

### v1.1.0
- ✅ 新增規則持久化功能
- ✅ 新增清空所有規則功能
- ✅ 改進用戶體驗，規則不會丟失
- ✅ 添加錯誤處理，提高穩定性

