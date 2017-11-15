import React, {Component} from 'react'
import {
  Table,
  Column,
  AutoSizer,
  SortDirection,
  SortIndicator,
} from 'react-virtualized'
import copy from 'copy-to-clipboard'

import 'react-virtualized/styles.css'

const perfStart = str => console.time(str)
const perfEnd = str => console.timeEnd(str)

const csvLineParser = row => {
  const cells = []
  let isEscaped = false
  let cellContent = ''
  let char
  let len = row.length
  for (let i = 0; i < len; i++) {
    char = row[i]
    if (char === '"') isEscaped = !isEscaped
    if (char === ',' && !isEscaped) {
      cells.push(cellContent)
      cellContent = ''
    } else {
      cellContent += char
    }
  }
  cells.push(cellContent)
  return cells
}

// set focus to our search input when CTRL + f is pressed
window.addEventListener('keydown', function(e) {
  if (e.keyCode === 114 || ((e.ctrlKey || e.metaKey) && e.keyCode === 70)) {
    e.preventDefault()
    document.querySelector('#search-input').focus()
  }
})

class App extends Component {
  state = {
    rows: [],
    sortedRows: [],
    headerCells: [],
    columnWidths: [],
    searchTerm: null,
    loadingState: null,
    filename: null,
    sortDirection: null,
    sortBy: null,
    sortable: false,
  }

  // Only used in dev to pre load q csv
  /*
  componentDidMount() {
    const testCsv = require('./testCsv').default
    this.processCsvFile(testCsv)
  }
  */

  processCsvFile = fileContent => {
    const fileLines = fileContent.split('\n').filter(row => row.trim() !== '')

    perfStart('processed headers')
    const headerCells = csvLineParser(fileLines.shift())
    const firstLine = csvLineParser(fileLines[0])
    const columnWidths = headerCells.map((_, colIndex) => {
      const headerLen = headerCells[colIndex].length
      const lineLen = firstLine[colIndex].length
      return headerLen < lineLen ? lineLen : headerLen
      /*
      let len = rows.reduce((acc, row) => {
        return row[colIndex].length > acc ? row[colIndex].length : acc
      }, headerCells[colIndex].length)
      return len
      */
    })
    perfEnd('processed headers')
    perfStart('processed rows')
    const toIndex = new Array(fileLines.length)
    fileLines.forEach((line, rowIdx) => {
      toIndex[rowIdx] = {
        rowIdx: rowIdx,
        valuesStr: line.toLowerCase(),
      }
    })
    perfEnd('processed rows')

    this.setState({
      rows: fileLines,
      headerCells,
      columnWidths,
      searcher: toIndex,
      loadingState: 'Building sort index',
      sortable: false,
      sortBy: null,
      sortDirection: null,
      sortedRows: fileLines,
    })
    // place focus on search input
    document.querySelector('#search-input').focus()
    const worker = new Worker('worker.js')
    worker.onmessage = e => {
      perfEnd('worker total')
      const rows = e.data
      this.setState({
        sortable: true,
        rows: rows,
        sortedRows: rows,
        loadingState: null,
      })
      // reset search as it will no longer be representative of current rows
      document.querySelector('#search-input').value = ''
    }
    perfStart('worker total')
    worker.postMessage(fileLines)
  }

  getCsvFile = e => {
    const reader = new FileReader()

    reader.addEventListener('loadend', () => {
      perfEnd('read the file')
      this.processCsvFile(reader.result)
    })
    perfStart('read the file')
    this.setState({
      loadingState: 'Reading file',
      filename: e.target.files[0].name,
    })
    reader.readAsText(e.target.files[0])
  }

  handleOnSearchChange = e => {
    const searchText = e.target.value.trim().toLowerCase()

    if (searchText === '') {
      return this.setState(prevState => ({
        ...this._sort({
          sortBy: prevState.sortBy,
          sortDirection: prevState.sortDirection,
          rows: prevState.rows,
        }),
        searchTerm: null,
      }))
    }
    perfStart('manual search')
    const newRows = this.state.searcher
      .filter(row => row.valuesStr.includes(searchText))
      .map(result => this.state.rows[result.rowIdx])
    perfEnd('manual search')
    this.setState(prevState => ({
      ...this._sort({
        sortBy: prevState.sortBy,
        sortDirection: prevState.sortDirection,
        rows: newRows,
      }),
      searchTerm: searchText,
    }))
  }

  render() {
    return (
      <div
        className="full-height"
        style={{display: 'flex', flexDirection: 'column'}}
      >
        <div
          style={{
            display: 'flex',
            margin: '.25rem',
            marginLeft: '.5rem',
            maxWidth: '900px',
          }}
        >
          <label className="button" htmlFor="file">
            Select CSV file
          </label>
          <input
            style={{display: 'none'}}
            id="file"
            type="file"
            multiple="false"
            onChange={this.getCsvFile}
          />
          <div style={{marginLeft: '.5rem', flex: 1}}>
            Showing {this.state.sortedRows.length} of {this.state.rows.length}{' '}
            rows
            <div>
              {this.state.headerCells.length} columns {this.state.loadingState}{' '}
              {this.state.filename}
            </div>
          </div>
          <div>
            <input
              id="search-input"
              style={{marginLeft: '1rem'}}
              type="text"
              onChange={this.handleOnSearchChange}
            />
          </div>
        </div>
        <div style={{flex: 1, overflowX: 'auto'}}>
          <AutoSizer disableWidth>
            {({height}) => (
              <Table
                width={
                  this.state.columnWidths.reduce((acc, cur) => acc + cur, 0) *
                  13
                }
                height={height - 15}
                headerHeight={24}
                rowHeight={22}
                rowCount={this.state.sortedRows.length}
                rowGetter={({index}) =>
                  this.state.sortable
                    ? this.state.sortedRows[index]
                    : csvLineParser(this.state.sortedRows[index])}
                onRowDoubleClick={({event}) => copy(event.target.innerHTML)}
                sort={({sortBy, sortDirection}) => {
                  let newSort =
                    this.state.sortDirection === SortDirection.ASC
                      ? SortDirection.DESC
                      : SortDirection.ASC
                  this.setState({
                    ...this._sort({
                      sortBy,
                      sortDirection: newSort,
                      rows: this.state.sortedRows,
                    }),
                  })
                }}
                sortBy={`${this.state.sortBy}`}
                sortDirection={this.state.sortDirection}
              >
                {this.state.columnWidths.map((colWidth, index) => (
                  <Column
                    disableSort={!this.state.sortable}
                    key={index}
                    dataKey={index}
                    width={colWidth * 13}
                    label={this.state.headerCells[index]}
                    headerRenderer={({dataKey, sortBy, sortDirection}) => {
                      sortBy = parseInt(sortBy, 10)
                      return (
                        <div>
                          {this.state.headerCells[dataKey]}
                          {sortBy === dataKey && (
                            <SortIndicator sortDirection={sortDirection} />
                          )}
                        </div>
                      )
                    }}
                  />
                ))}
              </Table>
            )}
          </AutoSizer>
        </div>
      </div>
    )
  }
  static sorterCache = null

  _sort({sortBy, sortDirection, rows}) {
    if (sortBy === null)
      return {
        sortedRows: rows,
        sortDirection,
        sortBy,
      }
    perfStart('row sorting')
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: 'base',
    })
    const sortFn = (a, b) => collator.compare(a[sortBy], b[sortBy])

    let sortedRows
    if (sortDirection === SortDirection.DESC) {
      sortedRows = [...rows].sort(sortFn).reverse()
    } else {
      sortedRows = [...rows].sort(sortFn)
    }
    perfEnd('row sorting')

    return {
      sortedRows,
      sortDirection,
      sortBy,
    }
  }
}

export default App
