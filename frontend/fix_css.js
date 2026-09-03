const fs = require('fs');
const path = require('path');

const files = ['public/RAAHI_About_Mission_Vision.html', 'public/RAAHI_Evidence_Gap_Bridge_.html', 'public/RAAHI_Success_Stories_Illustrated.html'];

for (let file of files) {
    const filePath = path.join(__dirname, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the CSS
    content = content.replace(
        '.hero .bgimg video{width:100%;height:100%;object-fit:cover;object-position:center bottom}',
        '.hero .bgimg video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center bottom;display:block;z-index:0;}'
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed CSS in ' + file);
}
