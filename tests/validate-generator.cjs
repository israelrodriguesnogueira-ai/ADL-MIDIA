const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('gerador.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'script do gerador presente');
new vm.Script(script,{filename:'gerador.html'});
for(const [name,pattern] of Object.entries({
  canvasVertical:/<canvas[^>]*width="540"[^>]*height="960"/,
  previewVideo:/<video[^>]*id="playback"[^>]*controls[^>]*playsinline/,
  download:/id="download" hidden/,
  recorder:/new MediaRecorder\(/,
  formatFallback:/video\/webm/,
  formatMp4:/video\/mp4/,
  deviceCheck:/function checkCompatibility\(/,
  errorHandling:/recorder\.onerror/,
  cleanup:/getTracks\(\)\.forEach/,
  localImage:/type="file" accept="image\/png,image\/jpeg,image\/webp"/
}))assert.match(html,pattern,name);
console.log('PASS: sintaxe e 10 verificações estáticas do gerador.');
