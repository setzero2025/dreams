const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// 创建图标
function createIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // 圆角半径
    const borderRadius = size * 0.18;

    // 绘制圆角背景
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, borderRadius);
    ctx.clip();

    // 渐变背景 - 午夜蓝
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#1a1a3e');
    gradient.addColorStop(0.5, '#2d2d5a');
    gradient.addColorStop(1, '#1a1a3e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // 内发光效果
    const innerGlow = ctx.createRadialGradient(size/2, size/2, size*0.3, size/2, size/2, size*0.8);
    innerGlow.addColorStop(0, 'rgba(139, 123, 184, 0.2)');
    innerGlow.addColorStop(1, 'rgba(139, 123, 184, 0)');
    ctx.fillStyle = innerGlow;
    ctx.fillRect(0, 0, size, size);

    // 绘制背景小星星
    const bgStars = [
        {x: 0.20, y: 0.10, size: 0.004},
        {x: 0.80, y: 0.15, size: 0.003},
        {x: 0.10, y: 0.25, size: 0.005},
        {x: 0.85, y: 0.30, size: 0.003},
        {x: 0.15, y: 0.70, size: 0.004},
        {x: 0.75, y: 0.80, size: 0.003},
        {x: 0.70, y: 0.85, size: 0.005},
        {x: 0.90, y: 0.60, size: 0.003},
        {x: 0.05, y: 0.40, size: 0.004},
        {x: 0.40, y: 0.90, size: 0.003},
    ];

    bgStars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x * size, star.y * size, star.size * size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();
    });

    // 绘制云朵
    function drawCloud(cx, cy, w, h, opacity) {
        ctx.save();
        ctx.globalAlpha = opacity;
        const cloudGradient = ctx.createLinearGradient(cx - w/2, cy - h/2, cx - w/2, cy + h/2);
        cloudGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        cloudGradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
        ctx.fillStyle = cloudGradient;
        ctx.beginPath();
        ctx.roundRect(cx - w/2, cy - h/2, w, h, h/2);
        ctx.fill();
        ctx.restore();
    }

    drawCloud(size * 0.25, size * 0.85, size * 0.20, size * 0.06, 0.8);
    drawCloud(size * 0.80, size * 0.15, size * 0.15, size * 0.045, 0.6);

    // 绘制月亮
    const moonX = size / 2;
    const moonY = size / 2;
    const moonRadius = size * 0.20;

    // 月亮光晕
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.8, moonX, moonY, moonRadius * 1.5);
    moonGlow.addColorStop(0, 'rgba(245, 212, 145, 0.6)');
    moonGlow.addColorStop(0.5, 'rgba(245, 212, 145, 0.3)');
    moonGlow.addColorStop(1, 'rgba(245, 212, 145, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 月亮主体
    const moonGradient = ctx.createLinearGradient(moonX - moonRadius, moonY - moonRadius, moonX + moonRadius, moonY + moonRadius);
    moonGradient.addColorStop(0, '#f5d491');
    moonGradient.addColorStop(0.5, '#e8c878');
    moonGradient.addColorStop(1, '#d4b568');
    ctx.fillStyle = moonGradient;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
    ctx.fill();

    // 月亮阴影（陨石坑）
    ctx.fillStyle = 'rgba(180, 150, 80, 0.2)';
    ctx.beginPath();
    ctx.arc(moonX - moonRadius * 0.25, moonY - moonRadius * 0.2, moonRadius * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX + moonRadius * 0.2, moonY + moonRadius * 0.1, moonRadius * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX - moonRadius * 0.1, moonY + moonRadius * 0.3, moonRadius * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // 绘制四角星函数
    function drawStar(x, y, starSize, opacity) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(x, y);

        // 星星光晕
        const starGlow = ctx.createRadialGradient(0, 0, starSize * 0.5, 0, 0, starSize * 2);
        starGlow.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        starGlow.addColorStop(0.5, 'rgba(139, 123, 184, 0.6)');
        starGlow.addColorStop(1, 'rgba(139, 123, 184, 0)');
        ctx.fillStyle = starGlow;
        ctx.beginPath();
        ctx.arc(0, 0, starSize * 2, 0, Math.PI * 2);
        ctx.fill();

        // 星星主体
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2 - Math.PI / 4;
            const x1 = Math.cos(angle) * starSize;
            const y1 = Math.sin(angle) * starSize;
            const x2 = Math.cos(angle + Math.PI / 8) * starSize * 0.4;
            const y2 = Math.sin(angle + Math.PI / 8) * starSize * 0.4;

            if (i === 0) {
                ctx.moveTo(x1, y1);
            } else {
                ctx.lineTo(x1, y1);
            }
            ctx.lineTo(x2, y2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // 绘制前景星星
    drawStar(size * 0.15, size * 0.12, size * 0.025, 0.9);
    drawStar(size * 0.82, size * 0.18, size * 0.035, 1.0);
    drawStar(size * 0.20, size * 0.78, size * 0.022, 0.85);
    drawStar(size * 0.85, size * 0.85, size * 0.028, 0.95);
    drawStar(size * 0.08, size * 0.30, size * 0.018, 0.75);
    drawStar(size * 0.90, size * 0.70, size * 0.020, 0.80);

    return canvas;
}

// 生成不同尺寸的图标
const sizes = [48, 72, 96, 144, 192, 512, 1024];
const assetsDir = path.join(__dirname, '..', 'assets');

// 确保 assets 目录存在
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// 生成图标
sizes.forEach(size => {
    const canvas = createIcon(size);
    const buffer = canvas.toBuffer('image/png');
    const filePath = path.join(assetsDir, `icon-${size}.png`);
    fs.writeFileSync(filePath, buffer);
    console.log(`Generated: icon-${size}.png`);
});

// 同时生成自适应图标用的前景和背景
// 前景（月亮和星星）
function createForeground(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // 透明背景
    ctx.clearRect(0, 0, size, size);

    // 绘制月亮
    const moonX = size / 2;
    const moonY = size / 2;
    const moonRadius = size * 0.20;

    const moonGradient = ctx.createLinearGradient(moonX - moonRadius, moonY - moonRadius, moonX + moonRadius, moonY + moonRadius);
    moonGradient.addColorStop(0, '#f5d491');
    moonGradient.addColorStop(0.5, '#e8c878');
    moonGradient.addColorStop(1, '#d4b568');
    ctx.fillStyle = moonGradient;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
    ctx.fill();

    // 陨石坑
    ctx.fillStyle = 'rgba(180, 150, 80, 0.2)';
    ctx.beginPath();
    ctx.arc(moonX - moonRadius * 0.25, moonY - moonRadius * 0.2, moonRadius * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX + moonRadius * 0.2, moonY + moonRadius * 0.1, moonRadius * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX - moonRadius * 0.1, moonY + moonRadius * 0.3, moonRadius * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // 星星
    function drawStar(x, y, starSize) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2 - Math.PI / 4;
            const x1 = x + Math.cos(angle) * starSize;
            const y1 = y + Math.sin(angle) * starSize;
            const x2 = x + Math.cos(angle + Math.PI / 8) * starSize * 0.4;
            const y2 = y + Math.sin(angle + Math.PI / 8) * starSize * 0.4;

            if (i === 0) {
                ctx.moveTo(x1, y1);
            } else {
                ctx.lineTo(x1, y1);
            }
            ctx.lineTo(x2, y2);
        }
        ctx.closePath();
        ctx.fill();
    }

    drawStar(size * 0.15, size * 0.12, size * 0.025);
    drawStar(size * 0.82, size * 0.18, size * 0.035);
    drawStar(size * 0.20, size * 0.78, size * 0.022);
    drawStar(size * 0.85, size * 0.85, size * 0.028);

    return canvas;
}

// 生成自适应图标资源
const fgCanvas = createForeground(1024);
fs.writeFileSync(path.join(assetsDir, 'icon-foreground.png'), fgCanvas.toBuffer('image/png'));
console.log('Generated: icon-foreground.png');

// 背景
const bgCanvas = createCanvas(1024, 1024);
const bgCtx = bgCanvas.getContext('2d');
const bgGradient = bgCtx.createLinearGradient(0, 0, 1024, 1024);
bgGradient.addColorStop(0, '#1a1a3e');
bgGradient.addColorStop(0.5, '#2d2d5a');
bgGradient.addColorStop(1, '#1a1a3e');
bgCtx.fillStyle = bgGradient;
bgCtx.fillRect(0, 0, 1024, 1024);
fs.writeFileSync(path.join(assetsDir, 'icon-background.png'), bgCanvas.toBuffer('image/png'));
console.log('Generated: icon-background.png');

console.log('\nAll icons generated successfully!');
