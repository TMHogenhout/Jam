import assert from 'assert'
import Rx from 'rx'
const never = Rx.Observable.never
const of = Rx.Observable.of

import { extractMeshSources, extractSourceSources } from './dataSourceExtractors'

describe('mesh source extractors', function () {
  it('can extract mesh sources from input raw addressbar sources', function (done) {
    const dnd$ = never()
    const postMessage = never()
    const addressbar = {
      get: function () {
        return of(['fakeModel.stl'])
      }
    }

    let meshSource$ = extractMeshSources({dnd$, postMessage, addressbar})

    meshSource$.forEach(function (meshSource) {
      assert.strictEqual(meshSource[0], 'fakeModel.stl')
      done()
    })
  })

  it('can extract mesh sources from input raw postMessage sources', function (done) {
    const dnd$ = never()
    const postMessage = of({data: {modelUrl: 'fakeModel.stl'}})
    const addressbar = {get: () => never()}

    let meshSource$ = extractMeshSources({dnd$, postMessage, addressbar})

    meshSource$.forEach(function (meshSource) {
      assert.strictEqual(meshSource[0], 'fakeModel.stl')
      done()
    })
  })

  it('can extract mesh sources from input raw dragAnddrop sources', function (done) {
    const dnd$ = of({type: 'url', data: ['fakeModel.stl']})
    const postMessage = never()
    const addressbar = {get: () => never()}

    let meshSource$ = extractMeshSources({dnd$, postMessage, addressbar})

    meshSource$.forEach(function (meshSource) {
      assert.strictEqual(meshSource[0], 'fakeModel.stl')
      done()
    })
  })

  /* it("should handle different data types passed by sources gracefully(html5 File)", function(done) {

    const dnd$          = never()
    const postMessages$ = of({modelUrl:{foo:e=>e,bar:e=>e}})
    const addressbar    = {get:()=>never()}

    let meshSource$ = extractMeshSources({dnd$,postMessages$,addressbar})

    meshSource$.forEach(function(meshSource){
      assert.strictEqual(meshSource[0],"fakeModel.stl")
      done()
    })
  })*/

  it('should filter out invalid data', function (done) {
    this.timeout(3000)

    const dnd$ = of({type: 'url', data: [undefined, '']})
    const postMessage = of({data: {modelUrl: ''}})
    const addressbar = {get: () => of([undefined])}

    let meshSource$ = extractMeshSources({dnd$, postMessage, addressbar})

    setTimeout(done, 1500)

    meshSource$.forEach(function (meshSource) {
      assert.fail(meshSource, undefined, 'data should have been fitered out')
      done()
    })
  })
})
