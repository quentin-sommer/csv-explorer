import React, {Component} from 'react'
import {
  Table,
  Column,
  AutoSizer,
  ArrowKeyStepper,
  SortDirection,
  SortIndicator,
} from 'react-virtualized'
import copy from 'copy-to-clipboard'
import testCsv from './testCsv'

import 'react-virtualized/styles.css'

const headerStyle = {
  borderRight: '1px solid #455A64',
  borderBottom: '1px solid #455A64',
  textAlign: 'center',
}

const cellStyle = {
  ...headerStyle,
}
const perfStart = str => console.time(str)
const perfEnd = str => console.timeEnd(str)

// set focus to our search input when CTRL + f is pressed
window.addEventListener('keydown', function(e) {
  if (e.keyCode === 114 || (e.ctrlKey && e.keyCode === 70)) {
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
    sortDirection: null,
    sortBy: null,
  }

  componentDidMount() {
    this.processCsvFile(testCsv)
  }

  processCsvFile = fileContent => {
    const toIndex = []

    perfStart('processed rows')
    let lineArr
    const rows = fileContent
      .split('\n')
      .filter(row => row.trim() !== '')
      .map((line, rowIdx) => {
        lineArr = line.split(',')
        if (rowIdx !== 0) {
          toIndex.push({
            id: `${rowIdx}`,
            rowIdx,
            values: lineArr,
            valuesStr: line.toLowerCase(),
          })
        }
        return lineArr
      })
    perfEnd('processed rows')
    perfStart('processed headers')
    const headerCells = rows.shift()
    const columnWidths = headerCells.map((_, colIndex) => {
      let len = rows.reduce((acc, row) => {
        return row[colIndex].length > acc ? row[colIndex].length : acc
      }, headerCells[colIndex].length)
      return len
    })
    perfEnd('processed headers')

    this.setState({
      rows,
      headerCells,
      columnWidths,
      searcher: toIndex,
      loadingState: null,
      ...this._sort({
        sortBy: this.state.sortBy,
        sortDirection: this.state.sortDirection,
        rows,
      }),
    })
  }
  colRenderer = ({index}) => {
    return this.state.columnWidths[index] * 13
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
            maxWidth: '700px',
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
                rowGetter={({index}) => this.state.sortedRows[index]}
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

  _sort({sortBy, sortDirection, rows}) {
    let sortedRows

    if (sortDirection === SortDirection.DESC) {
      sortedRows = [...rows].sort((a, b) => a[sortBy] - b[sortBy]).reverse()
    } else {
      sortedRows = [...rows].sort((a, b) => a[sortBy] - b[sortBy])
    }

    return {
      sortedRows,
      sortDirection,
      sortBy,
    }
  }
}

export default App

/*
              <MultiGrid
                overscanColumnCount={500}
                fixedRowCount={1}
                columnCount={this.state.headerCells.length}
                rowCount={this.state.filteredRows.length}
                cellRenderer={this.cellRenderer}
                columnWidth={param => this.colRenderer(param)}
                height={height}
                //scrollToRow={500}
                rowHeight={24}
                width={width}
                sortBy={this.state.sortByColumn}
              />*/
