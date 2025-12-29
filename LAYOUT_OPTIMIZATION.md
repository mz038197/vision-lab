# 布局优化说明

## 问题
之前的布局中，整个页面是可滚动的，当用户向下滚动查看训练参数设置时，相机画面会跟着向上移动并消失。

## 解决方案

### 1. 固定主布局
- 将 `main` 元素改为 `overflow-hidden`，不允许整个页面滚动
- 使用 flexbox 布局填满整个可用高度

### 2. 独立滚动区域
- **左侧相机区域**: 完全固定，不会滚动
- **右侧训练面板区域**: 独立的滚动容器，可以向下滚动查看更多内容

### 3. 组件高度调整
所有 Trainer 组件都进行了以下调整：
- 移除了 `h-full max-h-[calc(100vh-180px)]` 限制
- Header 和 Footer 设置为 `flex-none`（不缩放）
- 中间滚动区域设置为 `max-h-[400px]`（每个组件内部独立滚动）

### 4. 滚动条样式
右侧面板有自己的滚动条（`overflow-y-auto`），用户可以：
- 滚动右侧面板查看所有训练器
- 每个训练器内部也可以独立滚动（如类别列表、训练图表等）
- 相机画面始终保持在视野中

## 用户体验改进

✅ **相机画面固定**: 始终可见，不会被滚走
✅ **独立滚动**: 只有右侧训练面板可以滚动
✅ **多层滚动**: 面板整体滚动 + 每个组件内部滚动
✅ **响应式布局**: 在大屏幕上左右分栏，小屏幕上上下堆叠

## 技术实现

### App.tsx 布局结构
```
<main> (overflow-hidden, h-full)
  └── <container> (flex-col, h-full)
      ├── <controls> (flex-none) - 固定控制按钮
      └── <layout> (flex-1, overflow-hidden) - 填满剩余空间
          ├── <camera> (固定) - 相机画面
          └── <trainers> (overflow-y-auto) - 独立滚动
              ├── GestureTrainer
              ├── FaceTrainer
              ├── BodyTrainer
              ├── ImageClassifier
              └── CombinationClassifier
```

### 每个 Trainer 组件结构
```
<div> (flex-col)
  ├── <header> (flex-none) - 固定顶部
  ├── <content> (max-h-[400px], overflow-y-auto) - 可滚动内容
  └── <footer> (flex-none) - 固定底部
```

## 测试要点

1. 启动相机并激活多个模型
2. 右侧应该显示多个训练面板
3. 滚动右侧面板，相机画面应该保持固定
4. 每个训练面板内部的类别列表也可以独立滚动
5. 调整浏览器窗口大小，布局应该保持正常

