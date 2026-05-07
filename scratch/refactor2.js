const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, '../mobile/src/screens');
const navDir = path.join(__dirname, '../mobile/src/navigation');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    if (!content.includes('stitchTheme.colors')) return;

    console.log('Processing: ' + filePath);

    content = content.replace(/import\s+\{\s*useUnistyles\s*\}\s+from\s+['"]\.\.\/theme\/unistyles['"];/g, "import { useStyles } from 'react-native-unistyles';");
    content = content.replace(/import\s+\{\s*useUnistyles\s*\}\s+from\s+['"]\.\.\/\.\.\/theme\/unistyles['"];/g, "import { useStyles } from 'react-native-unistyles';");

    content = content.replace(/const [Cc] = stitchTheme\.colors;\s*/g, '');

    let hasStyleSheet = content.includes('const s = StyleSheet.create({');
    if (hasStyleSheet) {
        let parts = content.split('const s = StyleSheet.create({');
        let beforeStyles = parts[0];
        let styleAndAfter = parts[1];

        // Find the matching `});` or `})`
        // We will just split by `});` 
        let styleChunks = styleAndAfter.split('});');
        if (styleChunks.length > 1) {
            let stylesContent = styleChunks[0];
            let afterStyles = styleChunks.slice(1).join('});');

            // Find shadow objects before StyleSheet.create
            let shadowStr = '';
            let shadowReturns = '';
            
            let shMatch = beforeStyles.match(/const sh = \{([\s\S]*?)\};\s*/);
            if (shMatch) {
                shadowStr += `\n    const sh = {${shMatch[1]}};`;
                shadowReturns += `\n        sh,`;
                beforeStyles = beforeStyles.replace(shMatch[0], '');
                afterStyles = afterStyles.replace(/\bsh\b/g, 's.sh');
            }

            let psMatch = beforeStyles.match(/const pixelShadow = \{([\s\S]*?)\};\s*/);
            if (psMatch) {
                shadowStr += `\n    const pixelShadow = {${psMatch[1]}};`;
                shadowReturns += `\n        pixelShadow,`;
                beforeStyles = beforeStyles.replace(psMatch[0], '');
                afterStyles = afterStyles.replace(/\bpixelShadow\b/g, 's.pixelShadow');
            }

            let newStyleSheet = `const stylesheet = StyleSheet.create(theme => {\n    const c = theme.colors as any;\n    const C = theme.colors as any;${shadowStr}\n    return {${shadowReturns}${stylesContent}\n    };\n});`;

            afterStyles = afterStyles.replace(/useUnistyles\(\);(\s*\/\/.*)?/, `const { styles: s, theme } = useStyles(stylesheet);\n    const c = theme.colors as any;\n    const C = theme.colors as any;`);

            content = beforeStyles + newStyleSheet + afterStyles;
        }
    } else {
        // No stylesheet, just dynamic variables
        content = content.replace(/useUnistyles\(\);(\s*\/\/.*)?/, `const { theme } = useStyles();\n    const c = theme.colors as any;\n    const C = theme.colors as any;`);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Success: ' + filePath);
}

const files = [
    ...fs.readdirSync(screensDir).map(f => path.join(screensDir, f)),
    ...fs.readdirSync(navDir).map(f => path.join(navDir, f))
].filter(f => f.endsWith('.tsx'));

for (const file of files) {
    processFile(file);
}
