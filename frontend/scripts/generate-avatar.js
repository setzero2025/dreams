const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const size = 400;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');
const centerX = size / 2;
const centerY = size / 2;
const radius = size / 2 - 10;

// 创建圆形裁剪区域
ctx.beginPath();
ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
ctx.closePath();
ctx.clip();

// 绘制天空渐变背景
const skyGradient = ctx.createLinearGradient(0, 0, 0, size);
skyGradient.addColorStop(0, '#ff9a9e');      // 蜜桃粉
skyGradient.addColorStop(0.3, '#fecfef');    // 淡粉
skyGradient.addColorStop(0.5, '#e0c3fc');    // 薰衣草紫
skyGradient.addColorStop(0.7, '#8ec5fc');    // 天蓝
skyGradient.addColorStop(1, '#4a5568');      // 深蓝灰

ctx.fillStyle = skyGradient;
ctx.fillRect(0, 0, size, size);

// 绘制远山（多层）
function drawMountain(yOffset, color, height) {
    ctx.beginPath();
    ctx.moveTo(0, size);
    
    const peaks = 5;
    for (let i = 0; i <= peaks; i++) {
        const x = (size / peaks) * i;
        const peakHeight = height * (0.5 + Math.sin(i * 0.8) * 0.3 + 0.2);
        const y = size - yOffset - peakHeight;
        
        if (i === 0) {
            ctx.lineTo(x, y);
        } else {
            const prevX = (size / peaks) * (i - 1);
            const midX = (prevX + x) / 2;
            const midY = y + peakHeight * 0.3;
            ctx.quadraticCurveTo(midX, midY, x, y);
        }
    }
    
    ctx.lineTo(size, size);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

// 绘制远山层
drawMountain(180, 'rgba(139, 92, 246, 0.3)', 80);   // 紫色远山
drawMountain(140, 'rgba(99, 102, 241, 0.4)', 60);   // 靛蓝山
drawMountain(100, 'rgba(79, 70, 229, 0.5)', 50);    // 深蓝山

// 绘制月亮
ctx.beginPath();
ctx.arc(320, 80, 30, 0, Math.PI * 2);
const moonGradient = ctx.createRadialGradient(320, 80, 0, 320, 80, 30);
moonGradient.addColorStop(0, '#fffef0');
moonGradient.addColorStop(0.7, '#fef3c7');
moonGradient.addColorStop(1, 'rgba(254, 243, 199, 0)');
ctx.fillStyle = moonGradient;
ctx.fill();

// 绘制星星
function drawStar(x, y, starSize, opacity) {
    ctx.beginPath();
    ctx.arc(x, y, starSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.fill();
    
    // 星光十字
    ctx.beginPath();
    ctx.moveTo(x - starSize * 2, y);
    ctx.lineTo(x + starSize * 2, y);
    ctx.moveTo(x, y - starSize * 2);
    ctx.lineTo(x, y + starSize * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
}

// 固定的星星位置（确保每次生成一致）
const stars = [
    [50, 50, 1.2, 0.8], [120, 40, 0.8, 0.6], [200, 60, 1.0, 0.9],
    [280, 45, 0.7, 0.5], [350, 70, 1.1, 0.7], [80, 100, 0.9, 0.6],
    [160, 90, 0.6, 0.4], [240, 110, 1.0, 0.8], [320, 95, 0.8, 0.5],
    [40, 140, 0.7, 0.3], [100, 130, 1.0, 0.7], [180, 150, 0.9, 0.6],
    [260, 135, 0.8, 0.4], [340, 145, 1.1, 0.8], [60, 170, 0.6, 0.3],
    [140, 165, 0.9, 0.5], [220, 175, 0.7, 0.4], [300, 160, 1.0, 0.7],
    [30, 200, 0.8, 0.4], [90, 190, 0.7, 0.3], [170, 205, 0.9, 0.6],
    [250, 195, 0.6, 0.3], [330, 210, 0.8, 0.5], [45, 230, 1.0, 0.7],
    [130, 225, 0.7, 0.4], [210, 235, 0.9, 0.6], [290, 220, 0.8, 0.5],
    [370, 240, 1.1, 0.8], [70, 250, 0.6, 0.3]
];

stars.forEach(([x, y, starSize, opacity]) => {
    drawStar(x, y, starSize, opacity);
});

// 绘制流星
function drawShootingStar(x, y, length, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    const gradient = ctx.createLinearGradient(0, 0, length, 0);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, 0);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
}

drawShootingStar(100, 120, 80, Math.PI / 4);
drawShootingStar(280, 150, 60, Math.PI / 3);

// 添加柔和的光晕效果
const glowGradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius);
glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
glowGradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.05)');
glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
ctx.fillStyle = glowGradient;
ctx.fillRect(0, 0, size, size);

// 绘制边框
ctx.beginPath();
ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
ctx.lineWidth = 2;
ctx.stroke();

// 保存图片
const outputPath = path.join(__dirname, '..', 'assets', 'images', 'default-avatar.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);

console.log('✅ 默认头像已生成:', outputPath);
