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

const getNbWorkers = length => {
  if (length < 500e3) return 1
  if (length < 1000e3) return 2
  return 4
}

async function workerCsvParser(data) {
  perfStart('END workerMap')
  const concurrency = getNbWorkers(data.length)
  const promisesArr = []
  const step = Math.ceil(data.length / concurrency)
  const rows = data.filter(row => row.trim() !== '')

  console.log(
    'START workerMap data',
    rows.length,
    'concurrency',
    concurrency,
    'step size',
    step
  )

  perfStart('map')
  const workers = []
  for (let i = 0; i < rows.length; i += step) {
    const consumer = workerize(csvLineParserMapper)
    promisesArr.push(consumer.consume(rows.slice(i, i + step), i / step + 1))
    workers.push()
  }
  const ret = await Promise.all(promisesArr)
  workers.forEach(worker => worker.kill())
  perfEnd('map')

  perfStart('reduce')
  const concated = ret.reduce(
    (acc, cur) => {
      return {
        rows: acc.rows.concat(cur.rows),
        columnWidths: cur.columnWidths.map(
          (col, index) => (acc.columnWidths[index] > col ? acc.columnWidths[index] : col)
        ),
      }
    },
    {rows: [], columnWidths: []}
  )
  perfEnd('reduce')

  perfEnd('END workerMap')

  return concated
}

export default workerCsvParser