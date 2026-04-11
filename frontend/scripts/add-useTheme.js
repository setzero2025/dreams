/**
 * 为页面添加 useTheme hook
 * 使用方法: node scripts/add-useTheme.js
 */

const fs = require('fs');
const path = require('path');

// 需要添加 useTheme 的文件
const filesToFix = [
  'src/pages/Record.tsx',
  'src/pages/PsychologicalTest.tsx',
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

function addUseTheme(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ 文件不存在: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  
  // 检查是否已导入 useTheme
  if (!content.includes("useTheme")) {
    console.log(`⚠️  未导入 useTheme: ${filePath}`);
    return;
  }
  
  // 检查是否已使用 useTheme
  if (content.includes('const { colors, isDark } = useTheme();')) {
    console.log(`⏭️  已添加 useTheme: ${filePath}`);
    return;
  }
  
  // 在组件函数开头添加 useTheme
  // 匹配 export const ComponentName: React.FC<...> = ({ ... }) => {
  const componentPattern = /(export\s+const\s+\w+:\s*React\.FC[^>]+>\s*=\s*\([^)]*\)\s*=>\s*\{)(\s*\n)/;
  
  if (componentPattern.test(content)) {
    content = content.replace(componentPattern, '$1\n  const { colors, isDark } = useTheme();$2');
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ 已添加 useTheme: ${filePath}`);
  } else {
    console.log(`⚠️  无法匹配组件: ${filePath}`);
  }
}

// 执行
console.log('🎨 开始添加 useTheme hook...\n');

filesToFix.forEach(addUseTheme);

console.log('\n✨ 完成！');
