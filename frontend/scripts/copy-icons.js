const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'assets');
const androidResDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

const iconMappings = [
    { source: 'icon-48.png', dest: path.join(androidResDir, 'mipmap-mdpi', 'ic_launcher.png') },
    { source: 'icon-72.png', dest: path.join(androidResDir, 'mipmap-hdpi', 'ic_launcher.png') },
    { source: 'icon-96.png', dest: path.join(androidResDir, 'mipmap-xhdpi', 'ic_launcher.png') },
    { source: 'icon-144.png', dest: path.join(androidResDir, 'mipmap-xxhdpi', 'ic_launcher.png') },
    { source: 'icon-192.png', dest: path.join(androidResDir, 'mipmap-xxxhdpi', 'ic_launcher.png') },
    { source: 'icon-48.png', dest: path.join(androidResDir, 'mipmap-mdpi', 'ic_launcher_round.png') },
    { source: 'icon-72.png', dest: path.join(androidResDir, 'mipmap-hdpi', 'ic_launcher_round.png') },
    { source: 'icon-96.png', dest: path.join(androidResDir, 'mipmap-xhdpi', 'ic_launcher_round.png') },
    { source: 'icon-144.png', dest: path.join(androidResDir, 'mipmap-xxhdpi', 'ic_launcher_round.png') },
    { source: 'icon-192.png', dest: path.join(androidResDir, 'mipmap-xxxhdpi', 'ic_launcher_round.png') },
];

console.log('开始复制图标文件...\n');

iconMappings.forEach(({ source, dest }) => {
    const sourcePath = path.join(sourceDir, source);
    
    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, dest);
        console.log(`✓ ${source} -> ${path.relative(androidResDir, dest)}`);
    } else {
        console.error(`✗ 源文件不存在: ${sourcePath}`);
    }
});

console.log('\n图标复制完成！');
