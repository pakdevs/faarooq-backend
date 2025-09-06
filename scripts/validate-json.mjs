import fs from 'fs'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/validate-json.mjs <file>')
  process.exit(1)
}
try {
  const txt = fs.readFileSync(file, 'utf8')
  JSON.parse(txt)
  console.log('OK:', file)
} catch (e) {
  console.error('ERR:', e.message)
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const pos = (e.message.match(/position (\d+)/) || [])[1]
  if (pos) {
    const idx = Number(pos)
    let sum = 0
    for (let i = 0; i < lines.length; i++) {
      sum += lines[i].length + 1
      if (sum >= idx) {
        console.error('Near line:', i + 1)
        console.error(lines[i])
        break
      }
    }
  }
  process.exit(1)
}
