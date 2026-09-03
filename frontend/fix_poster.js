const fs = require('fs');
const path = require('path');

const files = ['public/RAAHI_About_Mission_Vision.html', 'public/RAAHI_Evidence_Gap_Bridge_.html', 'public/RAAHI_Success_Stories_Illustrated.html'];

for (let file of files) {
    const filePath = path.join(__dirname, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    const posterRegex = /poster="(data:image\/jpeg;base64,[^"]+)"/;
    let match = content.match(posterRegex);
    if (match) {
        let posterUrl = match[1];
        // remove poster attribute
        content = content.replace(posterRegex, '');
        // inject style
        content = content.replace(
            '<div class="bgimg" id="heroimg" >',
            '<div class="bgimg" id="heroimg" style="background-image: url(\'' + posterUrl + '\'); background-size: cover; background-position: center bottom;">'
        );
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed ' + file);
    } else {
        console.log('No poster found in ' + file);
    }
}
