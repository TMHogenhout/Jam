import { h } from '@cycle/dom'
import { html } from 'snabbdom-jsx'
import Class from 'classnames'
import { prepend } from 'ramda'
import Menu from '../widgets/Menu'
import checkbox from '../widgets/Checkbox'
require('./bom.css')


import { generateUUID } from '../../utils/utils'

export default function view (state$) {
  return state$
    .distinctUntilChanged()
    .map(function ({entries, selectedEntries, fieldNames, sortFieldName, sortablesDirection,
      editableFields, fieldDescriptions, fieldTypes, units,
      newEntryValues, toggled, removeEntryRequested, readOnly}) {
      let direction = sortablesDirection
      // const readOnly = true // for testing

      /*const exportIconSvg = `<svg version="1.1" id="Flag" xmlns="http://www.w3.org/2000/svg"
        width="16" height="16" x="0px" y="0px" viewBox="0 0 20 20" enable-background="new 0 0 20 20" class="icon">
      <path d="M18.926,5.584c-9.339,13.568-6.142-0.26-14.037,6.357L6.684,19H4.665L1,4.59l1.85-0.664
        c8.849-6.471,4.228,5.82,15.637,1.254C18.851,5.033,19.142,5.27,18.926,5.584z"/>
      </svg>`

      const exportSubItems = <span>
        <button className='bom-as-json' value='bom-as-json'>Export as json</button>
        <button className='bom-as-text' value='bom-as-text'>Export as plain text</button>
      </span>

      const exportButton = Menu(true
        , exportIconSvg, 'exportBOMData', 'export', 'bottom', false, exportSubItems)*/
      const exportButtons =
        h('span', [
          h('button.bom-as-json', {props: {value: 'bom-as-json'}}, [
            h('span.tooltip-bottom', {attrs: {'data-tooltip': 'copy to clipboard as Json'}}, ['json'])
          ]),

          h('button.bom-as-text', {props: {value: 'bom-as-text'}}, [
            h('span.tooltip-bottom', {attrs: {'data-tooltip': 'copy to clipboard as text'}}, ['text'])
          ])
        ])
        /*<span>
          <button className='bom-as-json' value='bom-as-json' >
            <span className='tooltip-bottom' attributes={{'data-tooltip': 'copy to clipboard as Json'}}> json </span> </button>
          <button className='bom-as-text' value='bom-as-text'>
            <span className='tooltip-bottom' attributes={{'data-tooltip': 'copy to clipboard as text'}}> text </span> </button>
          </span>*/
          //

      // PRIMARY DOM-FUNCTIONS
      function getHeaderRow () {
        let cells = fieldNames.map(function (name) {
          const editable = editableFields.indexOf(name) > -1
          const toolTip = editable ? '(editable) ' + fieldDescriptions[name] : fieldDescriptions[name]
          const columnName = 'column' + fieldNames.indexOf(name)

          let sortArrow = getSortArrow(name, direction)
          const lastInRow = fieldNames.indexOf(name) === (fieldNames.length - 1)
          const thContent = h('span', {attrs: {'data-tooltip': toolTip}}, [name, sortArrow])// <span className='tooltip-bottom' attributes={{'data-tooltip': toolTip}}>{name} {sortArrow}</span>
          return h('th',
            {props: {className: `headerCell ${columnName}`},
            attrs: {'data-name': name, 'colspan': lastInRow ? '1' : '1'}}, [thContent])
          /*(
            <th className={`headerCell ${columnName}`} attributes={{'data-name': name, 'colspan': lastInRow ? '1' : '1'}}>
              {thContent}
            </th>
          )*/
        }).concat([<th className='export'>{exportButtons}</th>]) // for 'hidden field to add/remove entries'
        return (<tr className='headerRow'>
                  {cells}
                </tr>)
      }

      function getAdderRow (adderFieldsArray) {
        return adderFieldsArray.map(function (row, index) {
          const placeholder = row.hasOwnProperty('_adder') ? 'f.e:velcro, nuts, bolts' : 'not specified'
          let cells = getCells(row, placeholder)
          const adder = h('tr.adderRow', cells)
            /*  <tr className='adderRow'>
                {cells}
              </tr> */

          return adder
        }).concat([])
      }

      function getTableBody (bodyFieldsArray) {
        return bodyFieldsArray.map(function (row, index) {
          let cells = getCells(row)
          return getRow(row, cells, index)
        })
      }

      // HELPER FUNCTIONS
      function getRow (row, cells, index = 0) {
        const selected = selectedEntries.indexOf(row.id) > -1
        if (removeEntryRequested !== undefined && removeEntryRequested.id === row.id) {
          // deletion row
          //<button className='confirm' attributes={{'data-name': row.name, 'data-id': row.id}}> Yes </button>
          const confirmButton = h('button.confirm', {attrs: {'data-name': row.name, 'data-id': row.id}}, ['yes'])
          const cancelButton = h('button.cancel', ['no'])
          return h('tr.test.removal', {attrs: {'data-name': row.name, 'data-id': row.id}}, [
            h('td.cell', {attrs: {'colspan': '100%'}}, [
              h('span', ['This will delete this part (and its copies), are you sure ?']),
              h('span', [
                confirmButton,
                cancelButton
              ])
            ])
          ])
            /*(<tr className='test removal' attributes={{'data-name': row.name, 'data-id': row.id}} key={index}>
                   <td className='cell' attributes={{colspan: '100%'}}>
                     <span>This will delete this part (and its copies), are you sure ?</span>
                     <span>
                      {confirmButton}
                      <button className='cancel'> No </button></span>
                   </td>
                 </tr>)*/
        } else {
          // normal row
          //key: index,
          return h('tr',
            {class: { test: true, normal: true, selected }, attrs: {'data-name': row.name, 'data-id': row.id}},
            cells)
            /*(
            <tr className={Class('test', 'normal', {selected})} attributes={{'data-name': row.name, 'data-id': row.id}} key={index}>
             {cells}
            </tr>
          )*/
        }
      }

      function getCells (row, placeholder) {
        const baseClassName = row.hasOwnProperty('_adder') ? 'adder cell' : 'bomEntry cell'
        const selected = selectedEntries.indexOf(row.id) > -1
        
        let cells = fieldNames.map(function (name) {
          const columnName = 'column' + fieldNames.indexOf(name)

          let cellToolTip
          cellToolTip = readOnly ? undefined : cellToolTip // if the field is disabled do not add any extra toolTip

          let value = getInputField(row, name, placeholder)
          return h('td',
            {props: {className: `${baseClassName} ${columnName} ${name}`},
            attrs: {'data-name': name, 'data-id': row.id, 'data-selected': selected}}, [value])

          /*(<td className={`${baseClassName} ${columnName} ${name}`} attributes={{'data-name': name, 'data-id': row.id}}>
                    {value}
                  </td>)*/
        })
        if (!readOnly) {
          cells.push(
            h('td',
              {props: {className: `${baseClassName} ${'column' + fieldNames.length}`}}, [getModifierButton(row)])
          )
          /*<td className={`${baseClassName} ${'column' + fieldNames.length}`}>
                      {getModifierButton(row)}
                    </td>*/
        }
        return cells
      }

      function getModifierButton (row) {
        const isAdder = row.hasOwnProperty('_adder')
        if (isAdder) {
          return (<button type='button' className='addBomEntry'>
                    Add
                  </button>)
        } else {
          return h('button.removeBomEntry', {attrs: {'data-name': '', 'data-id': row.id}}, [
                  h('span.tooltip-bottom', {props: {innerHTML: getIcon('delete')}, attrs: {'data-tooltip': 'remove this part type'}})
                ])

          /*(<button type='button' className='removeBomEntry' attributes={{'data-name': '', 'data-id': row.id}}>
                    <span innerHTML={getIcon('delete')}/>
                  </button>)*/
        }
      }

      function getSortArrow (name, direction) {
        if (direction !== undefined && sortFieldName === name) {
          if (direction) {
            return <span className='directionArrow'><span className='asc'/></span>
          } else {
            return <span className='directionArrow'><span className='desc'/></span>
          }
        }else if (direction === undefined || sortFieldName !== name) {
          return <span className='directionArrow'><span className='neut'/></span>
        }
      }

      function getInputField (row, name, placeholder) {
        //FIXME: data attributes should be added to these directly?
        const isDynamic = row.dynamic // row['_qtyOffset'] !== 0 ? true: false //are we dealing with a 'dynamic' entry ie from a 3d file
        const disabled = (isDynamic && (name === 'phys_qty' || name === 'unit')) || readOnly// if readony or if we have a dynamic entry called phys_qty, disable
        const dataValue = (isDynamic && name === 'phys_qty') ? null : row[name]
        const className = row._adder !== undefined ? 'adderTextInput' : 'bomTextInput'

        switch (fieldTypes[name]) {
          case 'text':
            return <input
                      type='text'
                      value={dataValue}
                      name={name}
                      placeholder={placeholder}
                      className={className}
                      disabled={disabled} />
          case 'number':
            const steps = (name === 'qty') ? 1 : 0.01
            const min = isDynamic ? row['_qtyOffset'] : 0
            return <input
                      type='number'
                      value={dataValue}
                      min={min}
                      steps={steps}
                      name={name}
                      disabled={disabled} />
          case 'boolean':
            return checkbox({checked: dataValue, value: dataValue, name, disabled, id: generateUUID()})

            return <input
                      type='checkbox'
                      checked={dataValue}
                      value={dataValue}
                      name={name}
                      disabled={disabled}
                      key={generateUUID()} /> // VDOM BUG: need to force a new uuid or it will not rerender correctly
          case 'list':
            /*const options = units.map(unit => <option value={unit} selected={dataValue === unit}>
                                                {unit}
                                              </option>)

            function classes(list){
              return list.join('.') //list.reduce(funcio(acc, cur)=> acc = ,'')
            }*/
            const options = units.map(unit => h('option', {props: {value: unit, selected: dataValue === unit}}, [unit]))
            //VDOM BUG: need to force a new uuid or it will not rerender correctly
            return <select
                      name={name}
                      value={dataValue}
                      disabled={disabled}
                      key={generateUUID()}>
                      {options}
                    </select>
          default:
            return name
        }
      }

      function getIcon (icon) {
        switch (icon) {
          case 'bomToggler':
            return `<svg width="24px" height="21px" viewBox="0 0 24 21" version="1.1" id='List' class='icon'
              xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                <!-- Generator: Sketch 3.8.3 (29802) - http://www.bohemiancoding.com/sketch -->
                <title>bom</title>
                <desc>Created with Sketch.</desc>
                <defs></defs>
                <g id="icons" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                    <g id="bom" fill="#000000">
                        <path d="M2.5,5 C3.88071187,5 5,3.88071187 5,2.5 C5,1.11928813 3.88071187,0 2.5,0 C1.11928813,0 0,1.11928813 0,2.5 C0,3.88071187 1.11928813,5 2.5,5 L2.5,5 Z M2.5,4 C1.67157288,4 1,3.32842712 1,2.5 C1,1.67157288 1.67157288,1 2.5,1 C3.32842712,1 4,1.67157288 4,2.5 C4,3.32842712 3.32842712,4 2.5,4 L2.5,4 Z" id="Oval"></path>
                        <polygon id="Shape" points="8.5 3 23.5 3 23.5 2 8.5 2"></polygon>
                        <path d="M2.5,13 C3.88071187,13 5,11.8807119 5,10.5 C5,9.11928813 3.88071187,8 2.5,8 C1.11928813,8 0,9.11928813 0,10.5 C0,11.8807119 1.11928813,13 2.5,13 L2.5,13 Z M2.5,12 C1.67157288,12 1,11.3284271 1,10.5 C1,9.67157288 1.67157288,9 2.5,9 C3.32842712,9 4,9.67157288 4,10.5 C4,11.3284271 3.32842712,12 2.5,12 L2.5,12 Z" id="Oval"></path>
                        <polygon id="Shape" points="8.5 11 23.5 11 23.5 10 8.5 10"></polygon>
                        <path d="M2.5,21 C3.88071187,21 5,19.8807119 5,18.5 C5,17.1192881 3.88071187,16 2.5,16 C1.11928813,16 0,17.1192881 0,18.5 C0,19.8807119 1.11928813,21 2.5,21 L2.5,21 Z M2.5,20 C1.67157288,20 1,19.3284271 1,18.5 C1,17.6715729 1.67157288,17 2.5,17 C3.32842712,17 4,17.6715729 4,18.5 C4,19.3284271 3.32842712,20 2.5,20 L2.5,20 Z" id="Oval"></path>
                        <polygon id="Shape" points="8.5 19 23.5 19 23.5 18 8.5 18"></polygon>
                    </g>
                </g>
            </svg>`
          case 'delete':
            return `<svg width="27px" height="27px" viewBox="0 0 27 27" class='icon'
            version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                <!-- Generator: Sketch 3.8.3 (29802) - http://www.bohemiancoding.com/sketch -->
                <title>remove</title>
                <desc>Created with Sketch.</desc>
                <defs></defs>
                <g id="icons" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                    <g id="remove" fill="#000000">
                        <path d="M20.5,15 L20.5,15 C17.4682847,15 15,17.4682847 15,20.5 C15,23.5317153 17.4682847,26 20.5,26 C23.5317153,26 26,23.5317153 26,20.5 C26,17.4682847 23.5317153,15 20.5,15 L20.5,15 Z M20.5,14 L20.5,14 C24.084,14 27,16.916 27,20.5 C27,24.084 24.084,27 20.5,27 C16.916,27 14,24.084 14,20.5 C14,16.916 16.916,14 20.5,14 L20.5,14 Z" id="Shape"></path>
                        <path d="M23.554,17.446 C23.359,17.251 23.042,17.251 22.847,17.446 L20.5,19.793 L18.153,17.446 C17.958,17.251 17.641,17.251 17.446,17.446 C17.251,17.641 17.251,17.958 17.446,18.153 L19.793,20.5 L17.446,22.847 C17.251,23.042 17.251,23.359 17.446,23.554 C17.544,23.652 17.672,23.7 17.8,23.7 C17.928,23.7 18.056,23.651 18.154,23.554 L20.501,21.207 L22.848,23.554 C22.946,23.652 23.074,23.7 23.202,23.7 C23.33,23.7 23.458,23.651 23.556,23.554 C23.751,23.359 23.751,23.042 23.556,22.847 L21.207,20.5 L23.554,18.153 C23.749,17.958 23.749,17.642 23.554,17.446 L23.554,17.446 Z" id="Shape"></path>
                        <polygon id="Path-93" points="12 22.5 1 22.5 1.46423835 23.1856953 7.46423835 8.18569534 7.54115587 7.99340152 7.45957252 7.80304035 4.45957252 0.803040351 4 1.5 19 1.5 18.5404275 0.803040351 15.5404275 7.80304035 15.4490778 8.0161896 15.5527864 8.2236068 17.5527864 12.2236068 18.4472136 11.7763932 16.4472136 7.7763932 16.4595725 8.19695965 19.4595725 1.19695965 19.7582695 0.5 19 0.5 4 0.5 3.24173049 0.5 3.54042748 1.19695965 6.54042748 8.19695965 6.53576165 7.81430466 0.535761655 22.8143047 0.261483519 23.5 1 23.5 12 23.5"></polygon>
                    </g>
                </g>
            </svg>`
          default:
            return '<p>icon</p>'
        }
      }

      function getFieldsArray (entries, property, include = true) {
        // this function can also exclude by property by calling fillFieldsArray('property', false)
        // add editable row for new entries before all the rest
        const uiEntries = readOnly ? entries : prepend(newEntryValues, entries)
        const fieldsArray = uiEntries.map(function (row, index) {
          const valid = include && row.hasOwnProperty(property)
          //if( valid || !valid )
          if (include && row.hasOwnProperty(property)) {
            return row
          }
          if (!include && !row.hasOwnProperty(property)) {
            return row
          }
        })
        .filter(x => x !== undefined)
        return fieldsArray
      }

      // THIS PART ACTUALLY RETURNS THE BOM
      let content
      let header = getHeaderRow()
      let adder = !readOnly ? getAdderRow([newEntryValues]) : ''
      if(adder) adder = adder[0] // FIXME hack, snabdom

      let body = getTableBody(getFieldsArray(entries, '_adder', false))
        content =
          <div className={Class('tableContainer', {toggled})}>
            <table id='tableheader'>
              {header}
              {adder}
            </table>
            <table id='tablebody'>
              {body}
            </table>
          </div>

      return (
        <div className={Class('bom', {readOnly})}>
          {Menu({toggled, icon: getIcon('bomToggler'), klass: 'containerToggler bomToggler',
          tooltip: 'bom/list of parts', tooltipPos: 'bottom', content, contentPosition: 'bottom', arrow: false})}
        </div>
      )
    })
}
