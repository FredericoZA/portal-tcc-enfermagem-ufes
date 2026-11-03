import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
// Original artwork retained unchanged. Only the area outside its circular seal is masked.
const size=377;
const png=await sharp('server/documents/assets/colenf-original.png').extract({left:30,top:14,width:size,height:size}).composite([{input:Buffer.from(`<svg width="${size}" height="${size}"><circle cx="188.5" cy="188.5" r="188" fill="white"/></svg>`),blend:'dest-in'}]).png().toBuffer();
await Promise.all(['public/colenf-logo.png','server/documents/assets/colenf-logo.png'].map(path=>writeFile(path,png)));
