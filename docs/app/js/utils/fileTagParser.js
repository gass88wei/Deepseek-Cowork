/**
 * 文件标签解析工具模块
 * 参考 optionsParser.js 实现
 * 从消息文本中解析 <files> 块
 * 
 * @created 2026-01-27
 * @module utils/fileTagParser
 */

/**
 * 文件引用对象
 * @typedef {Object} FileReference
 * @property {string} path - 文件完整路径
 * @property {string} name - 显示名称
 * @property {string} [icon] - 图标（可选）
 */

/**
 * 解析文件引用结果
 * @typedef {Object} ParseFilesResult
 * @property {string} cleanText - 移除文件块后的干净文本
 * @property {FileReference[]} files - 解析出的文件引用数组
 */

/**
 * 从文本中解析文件引用块
 * 
 * 支持的格式：
 * ```
 * <files>
 *     <file path="/path/to/file.js">file.js</file>
 *     <file path="/path/to/config.json">config.json</file>
 * </files>
 * ```
 * 
 * @param {string} text - 原始文本
 * @returns {ParseFilesResult} 解析结果
 */
function parseFiles(text) {
  if (!text || typeof text !== 'string') {
    return { cleanText: text || '', files: [] };
  }

  const files = [];
  let cleanText = text;

  // 匹配 <files>...</files> 块（支持多行）
  const filesBlockRegex = /<files>\s*([\s\S]*?)\s*<\/files>/gi;
  let blockMatch;

  while ((blockMatch = filesBlockRegex.exec(text)) !== null) {
    const filesContent = blockMatch[1];
    
    // 提取所有 <file path="...">...</file> 标签
    const fileRegex = /<file\s+path=["']([^"']+)["'](?:\s+icon=["']([^"']+)["'])?\s*>([\s\S]*?)<\/file>/gi;
    let fileMatch;
    
    while ((fileMatch = fileRegex.exec(filesContent)) !== null) {
      const filePath = fileMatch[1].trim();
      const fileIcon = fileMatch[2]?.trim() || '';
      const fileName = fileMatch[3].trim() || getFileNameFromPath(filePath);
      
      if (filePath) {
        files.push({
          path: filePath,
          name: fileName,
          icon: fileIcon || getDefaultFileIcon(filePath)
        });
      }
    }
  }

  // 移除所有 files 块，保留干净的文本
  cleanText = text.replace(filesBlockRegex, '').trim();

  return { cleanText, files };
}

/**
 * 检查文本是否包含文件引用块
 * @param {string} text - 原始文本
 * @returns {boolean} 是否包含文件引用块
 */
function hasFiles(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  return /<files>[\s\S]*<\/files>/i.test(text);
}

/**
 * 格式化文件引用为 XML 字符串
 * @param {FileReference[]} files - 文件引用数组
 * @returns {string} XML 格式的文件引用字符串
 */
function formatFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return '';
  }
  
  const fileTags = files
    .map(file => {
      const iconAttr = file.icon ? ` icon="${file.icon}"` : '';
      return `    <file path="${file.path}"${iconAttr}>${file.name}</file>`;
    })
    .join('\n');
  
  return `<files>\n${fileTags}\n</files>`;
}

/**
 * 从路径中提取文件名
 * @param {string} filePath - 文件路径
 * @returns {string} 文件名
 */
function getFileNameFromPath(filePath) {
  if (!filePath) return '';
  return filePath.split(/[\/\\]/).pop() || filePath;
}

/**
 * 根据文件路径获取默认图标
 * @param {string} filePath - 文件路径
 * @returns {string} 图标
 */
function getDefaultFileIcon(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  
  const iconMap = {
    // 代码文件
    'js': '📜',
    'jsx': '⚛️',
    'ts': '📘',
    'tsx': '⚛️',
    'vue': '💚',
    'svelte': '🔥',
    'py': '🐍',
    'rb': '💎',
    'go': '🔷',
    'rs': '🦀',
    'java': '☕',
    'c': '🔧',
    'cpp': '🔧',
    'h': '📑',
    'hpp': '📑',
    'cs': '🎯',
    'php': '🐘',
    
    // Web 文件
    'html': '🌐',
    'htm': '🌐',
    'css': '🎨',
    'scss': '🎨',
    'less': '🎨',
    'sass': '🎨',
    
    // 配置文件
    'json': '📋',
    'yaml': '📋',
    'yml': '📋',
    'toml': '📋',
    'xml': '📋',
    'ini': '⚙️',
    'conf': '⚙️',
    'config': '⚙️',
    'env': '🔐',
    
    // 文档
    'md': '📝',
    'txt': '📄',
    'doc': '📄',
    'docx': '📄',
    'pdf': '📕',
    
    // 数据
    'sql': '🗃️',
    'db': '🗃️',
    'csv': '📊',
    'xlsx': '📊',
    
    // Shell
    'sh': '💻',
    'bash': '💻',
    'zsh': '💻',
    'ps1': '💻',
    'bat': '💻',
    'cmd': '💻',
    
    // 图片
    'png': '🖼️',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'gif': '🖼️',
    'svg': '🖼️',
    'webp': '🖼️',
    'ico': '🖼️',
    
    // 其他
    'zip': '📦',
    'tar': '📦',
    'gz': '📦',
    'rar': '📦',
    '7z': '📦',
    'lock': '🔒',
    'log': '📝'
  };
  
  return iconMap[ext] || '📄';
}

/**
 * 从工具调用创建文件引用
 * @param {Object} tool - 工具调用对象
 * @returns {FileReference|null} 文件引用或 null
 */
function createFileRefFromTool(tool) {
  if (!tool || !tool.input) return null;
  
  // 支持的文件操作工具
  const fileTools = ['Read', 'Edit', 'MultiEdit', 'Write', 'StrReplace'];
  if (!fileTools.includes(tool.name)) return null;
  
  const filePath = tool.input.path || tool.input.file_path;
  if (!filePath) return null;
  
  return {
    path: filePath,
    name: getFileNameFromPath(filePath),
    icon: getDefaultFileIcon(filePath)
  };
}

// 导出到全局
if (typeof window !== 'undefined') {
  window.FileTagParser = {
    parseFiles,
    hasFiles,
    formatFiles,
    getFileNameFromPath,
    getDefaultFileIcon,
    createFileRefFromTool
  };
}
