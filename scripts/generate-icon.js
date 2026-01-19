/**
 * 生成 Windows ICO 图标文件
 * 从 PNG 文件生成带黑色背景的 ICO 文件，确保 exe 图标背景正确显示
 */

const fs = require('fs');
const path = require('path');

async function generateIconIco() {
  try {
    // 检查是否安装了必要的依赖
    let sharp, pngToIco;
    try {
      sharp = require('sharp');
      pngToIco = require('png-to-ico');
    } catch (error) {
      console.error('❌ 缺少必要的依赖库');
      console.error('请运行: npm install --save-dev sharp png-to-ico');
      process.exit(1);
    }

    const iconsDir = path.join(__dirname, '../icons');
    const inputPngPath = path.join(iconsDir, 'icon-256.png');
    const outputIcoPath = path.join(iconsDir, 'icon.ico');

    // 检查输入文件是否存在
    if (!fs.existsSync(inputPngPath)) {
      console.error(`❌ 输入文件不存在: ${inputPngPath}`);
      process.exit(1);
    }

    console.log('🎨 开始生成 icon.ico 文件...');
    console.log(`   输入: ${inputPngPath}`);
    console.log(`   输出: ${outputIcoPath}`);

    // ICO 文件通常包含多个尺寸
    const sizes = [16, 32, 48, 64, 128, 256];
    const inputBuffer = fs.readFileSync(inputPngPath);

    // 为每个尺寸生成图像，确保黑色背景
    const resizedBuffers = await Promise.all(
      sizes.map(async (size) => {
        // 1. 先用 flatten 将透明区域填充为黑色（在原始尺寸上操作）
        const flattenedBuffer = await sharp(inputBuffer)
          .flatten({ background: { r: 0, g: 0, b: 0 } })
          .toBuffer();
        
        // 2. 然后调整大小
        return await sharp(flattenedBuffer)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 1 }
          })
          .png()
          .toBuffer();
      })
    );

    // 编码为 ICO 格式
    const icoBuffer = await pngToIco(resizedBuffers);

    // 写入文件
    fs.writeFileSync(outputIcoPath, icoBuffer);

    console.log('✅ icon.ico 文件生成成功！');
    console.log(`   包含尺寸: ${sizes.join(', ')}`);
  } catch (error) {
    console.error('❌ 生成 icon.ico 时出错:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  generateIconIco();
}

module.exports = { generateIconIco };
