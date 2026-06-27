# 微境像素官网上线说明

## 免费上线方式

推荐使用 Vercel 部署官网前台。

## Vercel 设置

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

## 维护方式

后台案例管理仍用于本机维护。修改案例或页面后：

1. 本地确认 `npm run build` 通过。
2. 提交代码到 GitHub。
3. Vercel 会自动重新部署线上官网。

## 注意

线上版本只展示官网前台，不提供在线上传后台。
