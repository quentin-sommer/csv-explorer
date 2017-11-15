let buffer = []
const csvLineParser = row => {
  if (buffer.length !== 0) {
    buffer = new Array(buffer.length)
  }
  let isEscaped = false
  let cellContent = ''
  let char
  let len = row.length
  let bufferIt = 0
  for (let i = 0; i < len; i++) {
    char = row[i]
    if (char === '"') isEscaped = !isEscaped
    if (char === ',' && !isEscaped) {
      buffer[bufferIt] = cellContent
      bufferIt++
      cellContent = ''
    } else {
      cellContent += char
    }
  }
  buffer[bufferIt] = cellContent
  bufferIt++
  return buffer
}

onmessage = function(e) {
  const fileLines = e.data
  console.time('worker perf')
  const rows = fileLines
    .filter(row => row.trim() !== '')
    .map((line, rowIdx) => csvLineParser(line))

  console.timeEnd('worker perf')

  console.log('Posting message back to main script', rows.length, 'lines')
  postMessage(rows)
}
