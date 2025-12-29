# TrainingChart NaN 错误修复

## 问题描述

当用户点击"训练"按钮时，会出现以下错误：
```
Error: <line> attribute y1: Expected length, "NaN".
Error: <line> attribute y2: Expected length, "NaN".
Error: <path> attribute d: Expected number, "M 50 NaN L 50 200 Z".
Error: <circle> attribute cy: Expected length, "NaN".
```

## 原因分析

训练刚开始时，某些训练日志可能包含无效的数值：
- `loss` 值为 `NaN` (Not a Number)
- `loss` 值为 `undefined` 或 `null`
- `loss` 值为 `Infinity` 或 `-Infinity`

这些无效值会导致 SVG 渲染失败，因为 SVG 属性需要有效的数字。

## 修复措施

### 1. 数据过滤
在处理训练日志时，过滤掉所有无效数据：
```typescript
const sorted = [...trainingLogs]
  .filter(log => {
    return (
      log &&
      typeof log.epoch === 'number' &&
      typeof log.loss === 'number' &&
      !isNaN(log.epoch) &&
      !isNaN(log.loss) &&
      isFinite(log.epoch) &&
      isFinite(log.loss)
    );
  })
  .sort((a, b) => a.epoch - b.epoch);
```

### 2. 缩放函数保护
在 `scaleY` 函数中添加验证：
```typescript
const scaleY = (loss: number) => {
  // Ensure valid numbers and avoid division by zero
  if (!isFinite(loss) || isNaN(loss)) return height - padding.bottom;
  if (maxLoss === minLoss) return height - padding.bottom - chartHeight / 2;
  
  const normalized = (loss - minLoss) / (maxLoss - minLoss);
  return height - padding.bottom - normalized * chartHeight;
};
```

### 3. Y 轴刻度验证
只添加有效的刻度值：
```typescript
for (let i = 0; i <= tickCount; i++) {
  const value = minLoss + (maxLoss - minLoss) * (i / tickCount);
  if (isFinite(value) && !isNaN(value)) {
    ticks.push(value);
  }
}
```

### 4. SVG 元素渲染保护
在渲染每个 SVG 元素前检查坐标有效性：
```typescript
{chartData.map((log, i) => {
  const x = scaleX(log.epoch);
  const y = scaleY(log.loss);
  // Only render if coordinates are valid
  if (!isFinite(x) || !isFinite(y) || isNaN(x) || isNaN(y)) return null;
  
  return <circle cx={x} cy={y} ... />;
})}
```

### 5. 显示文本保护
在显示 loss 值时进行验证：
```typescript
{isFinite(loss) && !isNaN(loss)
  ? loss.toFixed(4)
  : 'N/A'}
```

## 改进效果

✅ **训练可以正常开始** - 不会因为初始数据问题而崩溃
✅ **图表安全渲染** - 所有 SVG 元素都有有效坐标
✅ **优雅降级** - 当数据无效时显示 'N/A' 而不是错误
✅ **零除法保护** - 当 maxLoss === minLoss 时也能正常工作

## 测试要点

1. 训练刚开始（第一个 epoch）
2. 训练中途
3. 训练完成
4. 只有一个数据点
5. 所有数据点相同（loss 不变）

所有情况都应该能正常显示，不会出现 NaN 错误。

## 注意事项

- 如果训练过程中持续出现 NaN，可能是训练参数设置问题（学习率过高等）
- 建议检查训练数据是否充足（至少 2 个样本）
- 确保标签和特征数据正确匹配

