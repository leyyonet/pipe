import * as fs from "node:fs";
import path from "node:path";

const src = path.normalize(__dirname + '../../src/assets');
console.log(src);
if (fs.existsSync(src)) {
    const dest = path.normalize(__dirname + '../../dist/assets');
    fs.cpSync(src, dest, {recursive: true});
    console.log('Assets are copied')
}
else {
    console.log('Assets could not be found')
}
