/**
 * 主题修复脚本 - 批量替换硬编码颜色为主题变量
 * 使用方法: node scripts/fix-all-theme.js
 */

const fs = require('fs');
const path = require('path');

// 需要修复的所有文件
const filesToFix = [
  'src/pages/Record.tsx',
  'src/pages/PsychologicalTest.tsx',
  'src/pages/DreamDetail.tsx',
  'src/pages/Subscription.tsx',
  'src/pages/Login.tsx',
  'src/pages/Register.tsx',
  'src/pages/Generate.tsx',
  'src/pages/ScriptToVideo.tsx',
  'src/pages/CreationCenter.tsx',
  'src/pages/VideoPlayer.tsx',
  'src/pages/ImageViewer.tsx',
  'src/pages/ScriptViewer.tsx',
];

// 颜色替换规则
const replacements = [
  // 导入替换
  {
    from: /import\s*\{\s*colors\s*\}\s*from\s*['"]\.\.\/theme\/colors['"];/g,
    to: "import { useTheme } from '../theme/themeContext';"
  },
  // 背景色替换 - rgba(26, 26, 46, 0.8) -> colors.card
  {
    from: /rgba\(26,\s*26,\s*46,\s*0\.8\)/g,
    to: 'colors.card'
  },
  // 背景色替换 - rgba(26, 26, 46, 0.7) -> colors.glass
  {
    from: /rgba\(26,\s*26,\s*46,\s*0\.7\)/g,
    to: 'colors.glass'
  },
  // 半透明白色背景
  {
    from: /rgba\(255,\s*255,\s*255,\s*0\.1\)/g,
    to: "isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'"
  },
  // 半透明白色背景 - 0.05
  {
    from: /rgba\(255,\s*255,\s*255,\s*0\.05\)/g,
    to: "isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'"
  },
  // 半透明白色背景 - 0.2
  {
    from: /rgba\(255,\s*255,\s*255,\s*0\.2\)/g,
    to: "isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'"
  },
  // 错误色半透明
  {
    from: /rgba\(239,\s*68,\s*68,\s*0\.2\)/g,
    to: "isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'"
  },
  // 错误色半透明边框
  {
    from: /rgba\(239,\s*68,\s*68,\s*0\.3\)/g,
    to: "isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)'"
  },
  // 主色半透明
  {
    from: /rgba\(99,\s*102,\s*241,\s*0\.1\)/g,
    to: "isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)'"
  },
  // 主色半透明 - 0.15
  {
    from: /rgba\(99,\s*102,\s*241,\s*0\.15\)/g,
    to: "isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)'"
  },
  // 主色半透明 - 0.2
  {
    from: /rgba\(99,\s*102,\s*241,\s*0\.2\)/g,
    to: "isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)'"
  },
  // 主色半透明边框
  {
    from: /rgba\(99,\s*102,\s*241,\s*0\.3\)/g,
    to: "isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'"
  },
  // 次色半透明
  {
    from: /rgba\(139,\s*92,\s*246,\s*0\.1\)/g,
    to: "isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)'"
  },
  // 次色半透明 - 0.15
  {
    from: /rgba\(139,\s*92,\s*246,\s*0\.15\)/g,
    to: "isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)'"
  },
  // 信息色半透明
  {
    from: /rgba\(59,\s*130,\s*246,\s*0\.1\)/g,
    to: "isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)'"
  },
  // 警告色半透明
  {
    from: /rgba\(245,\s*158,\s*11,\s*0\.1\)/g,
    to: "isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.1)'"
  },
  // 成功色半透明
  {
    from: /rgba\(16,\s*185,\s*129,\s*0\.1\)/g,
    to: "isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)'"
  },
  // 深色背景
  {
    from: /['"]#0a0a0f['"]/g,
    to: 'colors.background'
  },
  // 深色卡片
  {
    from: /['"]#1a1a2e['"]/g,
    to: 'colors.card'
  },
];

function fixFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ 文件不存在: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;
  const originalContent = content;
  
  replacements.forEach(({ from, to }) => {
    content = content.replace(from, to);
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ 已修复: ${filePath}`);
  } else {
    console.log(`⏭️  无需修改: ${filePath}`);
  }
}

// 执行修复
console.log('🎨 开始修复所有页面主题兼容性...\n');

filesToFix.forEach(fixFile);

console.log('\n✨ 所有页面主题修复完成！');
