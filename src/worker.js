import workerize from 'workerize'

const perfStart = str => console.time(str)
const perfEnd = str => console.timeEnd(str)

const csvLineParserMapper = `
let columnWidths
let buffer

const incrementOrNot = (val, index) => {
  if (columnWidths[index] === undefined) {
    columnWidths[index] = 0
  }
  if (columnWidths[index] < val) {
    columnWidths[index] = val
  }
}

const csvLineParser = row => {
  if (buffer.length !== 0) {
    buffer = new Array(buffer.length)
  }
  let isEscaped = false
  let cellStart = 0
  let char
  let len = row.length
  let bufferIt = 0
  for (let i = 0; i < len; i++) {
    char = row[i]
    if (char === '"') isEscaped = !isEscaped
    if (char === ',' && !isEscaped) {
      buffer[bufferIt] = row.substring(cellStart, i)
      cellStart = i + 1
      incrementOrNot(buffer[bufferIt].length, bufferIt)
      bufferIt++
    }  
  }
  buffer[bufferIt] = row.substring(cellStart)
  incrementOrNot(buffer[bufferIt].length, bufferIt)
  return buffer
}

export function consume(arr, workerNb) {
    columnWidths = []
    buffer = []

    for (let i = 0; i < arr.length; i++) {
        arr[i] = csvLineParser(arr[i])
    }
    //  reset buffer cache for next parsing
    buffer = []

    return {
        rows: arr,
        columnWidths
    }
}`

let worker = null

async function workerCsvParser(data) {
  console.log('START workerMap data ' + data.length)
  perfStart('END worker')

  if (worker === null) {
    worker = workerize(csvLineParserMapper)
  }
  const ret = await worker.consume(data)

  perfEnd('END worker')

  return ret
}

export default workerCsvParser
