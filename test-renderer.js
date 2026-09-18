const fs = require('fs');
const path = require('path');

const rendererCode = fs.readFileSync(path.join(__dirname, 'js', 'markdown-renderer.js'), 'utf-8');
const fn = new Function(rendererCode + '\nreturn MarkdownRenderer;');
const MR = fn();

// 测试图片渲染
const contentWithImage = `☞承平三年-二月初七-月明风清-子时-皇帝寝宫-烛火摇曳☜

深夜的皇宫深处，皇帝寝宫内烛火摇曳。

*她纤细的手指轻抚过他*，饱满的双乳在胸前磨蹭。

![角色图片](https://files.catbox.moe/qcitcd.png)

**粗体文本测试**

[链接文本](https://example.com)

<UpdateVariable>
<JSONPatch>
[{ "op": "replace" }]
</JSONPatch>
</UpdateVariable>
<StatusPlaceHolderImpl/>`;

console.log('=== render() 测试 ===');
const fullResult = MR.render(contentWithImage);
console.log('包含 <img:', fullResult.includes('<img'));
console.log('包含 <a href:', fullResult.includes('<a class="md-link"'));
console.log('包含 <em>:', fullResult.includes('<em>'));
console.log('包含 <strong>:', fullResult.includes('<strong>'));
console.log('包含 md-scene-header:', fullResult.includes('md-scene-header'));
console.log('包含 UpdateVariable:', fullResult.includes('UpdateVariable'));
console.log('图片 src 正确:', fullResult.includes('https://files.catbox.moe/qcitcd.png'));
console.log('\n--- 渲染结果 ---\n');
console.log(fullResult);

console.log('\n=== renderStream() 测试 ===');
const streamResult = MR.renderStream(contentWithImage);
console.log('包含 <img:', streamResult.includes('<img'));
console.log('包含 <a href:', streamResult.includes('<a class="md-link"'));
console.log('包含 <em>:', streamResult.includes('<em>'));
console.log('包含 <strong>:', streamResult.includes('<strong>'));
console.log('包含 md-scene-header:', streamResult.includes('md-scene-header'));
console.log('图片 src 正确:', streamResult.includes('https://files.catbox.moe/qcitcd.png'));
console.log('\n--- 渲染结果 ---\n');
console.log(streamResult);

// 测试 URL 中含 & 的情况
console.log('\n=== URL 含 & 测试 ===');
const urlWithAmp = '![图片](https://example.com/img?a=1&b=2)';
const ampResult = MR.render(urlWithAmp);
console.log('URL 保留 & 而非 &amp;:', ampResult.includes('&') && !ampResult.includes('&amp;'));
console.log(ampResult);

// 测试多图片
console.log('\n=== 多图片测试 ===');
const multiImg = `![图1](https://files.catbox.moe/qcitcd.png)\n\n![图2](https://files.catbox.moe/ejdd08.png)\n\n![图3](https://files.catbox.moe/mzczmy.png)`;
const multiResult = MR.render(multiImg);
const imgCount = (multiResult.match(/<img/g) || []).length;
console.log('图片数量:', imgCount, '(期望3)');
console.log(multiResult);
