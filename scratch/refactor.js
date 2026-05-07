const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, '../mobile/src/screens');
const navDir = path.join(__dirname, '../mobile/src/navigation');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    if (!content.includes('const C = stitchTheme.colors;')) {
        return; // Already refactored or doesn't need it
    }

    console.log('Processing: ' + filePath);

    // 1. Change imports
    content = content.replace(/import\s+\{\s*useUnistyles\s*\}\s+from\s+['"]\.\.\/theme\/unistyles['"];/, "import { useStyles } from 'react-native-unistyles';");
    
    // 2. Remove static C
    content = content.replace(/const C = stitchTheme\.colors;\s*/, '');

    // 3. Change StyleSheet.create
    // We want to change `const s = StyleSheet.create({` to `const stylesheet = StyleSheet.create(theme => {\n    const C = theme.colors as any;\n    return {`
    // And add `});` at the end of the stylesheet.
    
    let parts = content.split('const s = StyleSheet.create({');
    if (parts.length === 2) {
        let beforeStyles = parts[0];
        let styleAndAfter = parts[1];

        // Find the end of StyleSheet.create
        // Usually ends with `});` before `// ─── Helper` or `// ─── Constants`
        let endOfStyleIndex = styleAndAfter.indexOf('\n});');
        if (endOfStyleIndex === -1) endOfStyleIndex = styleAndAfter.indexOf('\n});\n');
        
        if (endOfStyleIndex !== -1) {
            let stylesContent = styleAndAfter.substring(0, endOfStyleIndex);
            let afterStyles = styleAndAfter.substring(endOfStyleIndex + 4);

            // Now look for pixelShadow in afterStyles
            let pixelShadowRegex = /const pixelShadow = \{([\s\S]*?)\};\s*/;
            let pixelShadowMatch = afterStyles.match(pixelShadowRegex);
            
            let pixelShadowStr = '';
            if (pixelShadowMatch) {
                pixelShadowStr = `\n    // ── Helper: Pixel Shadow ──\n    pixelShadow: {${pixelShadowMatch[1]}},`;
                afterStyles = afterStyles.replace(pixelShadowRegex, '');
                
                // Replace `pixelShadow` with `s.pixelShadow` in the rest of the component
                afterStyles = afterStyles.replace(/pixelShadow/g, 's.pixelShadow');
            }

            let newStyleSheet = `const stylesheet = StyleSheet.create(theme => {\n    const C = theme.colors as any;\n    return {${stylesContent}${pixelShadowStr}\n    };\n});`;

            // Replace useUnistyles() with const { styles: s, theme } = useStyles(stylesheet); const C = theme.colors as any;
            afterStyles = afterStyles.replace(/useUnistyles\(\);\s*(\/\/.*)?/, `const { styles: s, theme } = useStyles(stylesheet);\n    const C = theme.colors as any;`);

            content = beforeStyles + newStyleSheet + afterStyles;
            
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Success: ' + filePath);
        } else {
            console.log('Failed to find end of styles: ' + filePath);
        }
    } else {
         console.log('Failed to find StyleSheet.create: ' + filePath);
    }
}

const files = [
    ...fs.readdirSync(screensDir).map(f => path.join(screensDir, f)),
    ...fs.readdirSync(navDir).map(f => path.join(navDir, f))
].filter(f => f.endsWith('.tsx'));

for (const file of files) {
    processFile(file);
}
