import Rx from 'rx'
const Observable= Rx.Observable
const {fromEvent, just, merge, concat, concatAll} = Observable

import {combineLatestObj, replicateStream} from '../../utils/obsUtils'
import {safeJSONParse, toArray} from '../../utils/utils'
import {extractChangesBetweenArrays} from '../../utils/diffPatchUtils'

import assign from 'fast.js/object/assign'//faster object.assign
import {pick, equals} from 'ramda'

function jsonToFormData(jsonData){
  jsonData = JSON.parse( JSON.stringify( jsonData ) )
  let formData = new FormData()
  for(let fieldName in jsonData){
    let value = jsonData[fieldName]
    //value = encodeURIComponent(JSON.stringify(value))
    //value = JSON.stringify(value)
    //value = value.replace(/\"/g, '')
    if(Object.prototype.toString.call(value) === "[object Object]"){
      value = JSON.stringify(value)
      // console.log("value",value)
    }
    if(Object.prototype.toString.call(value) === "[object Array]"){
      //value = //JSON.stringify(value)
      //value = 'arr[]', arr[i]//value.reduce()
      //console.log("value",value)
      value = `{ ${value.join(',')} }`
    }

    //console.log("append",fieldName, value)
    formData.append(fieldName, value)

  }
  //throw new Error("fpp")
  return formData
}

function remapJson(mapping, input){

  const result =  Object.keys(input)
    .reduce(function(obj, key){
      if(key in mapping){
        obj[mapping[key]] = input[key]
      }
      else{
        obj[key] = input[key]
      }
      return obj
    },{})
  //console.log("remapJson",result)
  return result
}

//storage driver for YouMagine designs & data etc
export default function makeYMDriver(httpDriver, params={}){
  const defaults = {
    apiBaseProdUri:'api.youmagine.com/v1'
    ,apiBaseTestUri:''
    ,urlBase:'https'

    ,designId:undefined

    ,testMode:true
    ,login:undefined
    ,password:undefined
  }
  params = assign({},defaults,params)

  let { apiBaseProdUri, apiBaseTestUri, urlBase, testMode, login, password} = params

  let apiBaseUri = testMode !== undefined ? apiBaseTestUri : apiBaseProdUri
  let authData   = (login !== undefined && password!==undefined) ? (`${login}:${password}@`) : ''


  const authToken  = ""

  const designId   = 0
  const bomId      = 0
  const assemblyId = 'default'

  const authTokenStr = `/?auth_token=${authToken}`

  const designUri     = `${urlBase}://${authData}${apiBaseUri}/designs/${designId}`
  const bomUri        = `${designUri}/boms`
  const partUri       = `${designUri}/parts`
  const assembliesUri = `${designUri}/assemblies/${assemblyId}/entries`
  //const documentsUri = `${urlBase}://${authData}${apiBaseUri}/designs/${designId}/documents/${params.documentId}${authTokenStr}`


  function youMagineStorageDriver(outgoing$){

    function getItem(item){
      return just( {} ).map(safeJSONParse)
    }

    function toBom(method='put', entries){

      const fieldNames = ['qty','phys_qty', 'unit', 'part_uuid' , 'part_parameters','part_version']
      const mapping = {
        'version':'part_version'
        ,'id':'part_uuid'
        ,'params':'part_parameters'
        ,'version':'part_version'
      }

      const requests = entries.map(function(entry){
        const refined = pick( fieldNames, remapJson(mapping, entry) )
        const send    = jsonToFormData(refined)

        return {
              url    :`${bomUri}/${refined.part_uuid}${authTokenStr}`
            , method
            , send
            , type   :'ymSave'
            , typeDetail:'bom'
            , mimeType: null//'application/json'
            , responseType: 'json'
          }
      })
      //console.log("request save bom",requests)
      return requests
    }

    function toParts(method='put', entries){
      const fieldNames = ['id','name','description','uuid']
      const mapping = {
        'id':'uuid'
        ,'params':'part_parameters'
      }
      /*"binary_document_id": null,
      "binary_document_url": "",
      "source_document_id": null,
      "source_document_url": "",]*/

      const requests = entries.map(function(entry){

        const refined = pick( fieldNames, remapJson(mapping, entry) )
        const send    = jsonToFormData(refined)

        return {
              url    : `${partUri}/${refined.uuid}${authTokenStr}`
            , method
            , send
            , type   :'ymSave'
            , typeDetail:'parts'
            , mimeType: null//'application/json'
            , responseType: 'json'
          }
      })
      return requests
    }

    function dataFromItems(items){
      return Object.keys(items.transforms).reduce(function(list, key){
        const transforms = items['transforms'][key]
        const metadata   = items['metadata'][key]

        if(transforms && metadata){
          const entry = assign( {}, transforms, metadata)
          list.push(entry)
        }
        return list
      },[])
    }

    function toAssemblies(method='put', entries){

      const fieldNames = ['uuid','name','color','pos','rot','sca','part_uuid']
      const mapping = {'id':'uuid', 'typeUid':'part_uuid'}
      const requests = entries.map(function(entry){

      const refined = pick( fieldNames, remapJson(mapping, entry) )
      const send    = jsonToFormData(refined)

        return {
              url    : `${assembliesUri}/${refined.uuid}${authTokenStr}`
            , method
            , send
            , type   :'ymSave'
            , typeDetail :'assemblies'
          }
      })
      return requests
    }

    //////////////////////////

    const save$ = outgoing$
      .debounce(50)//only save if last events were less than 50 ms appart
      .filter(data=>data.method === 'save')
      .pluck('data')
      .share()
      .tap(e=>console.log("save",e))

    const design$ = save$
      .pluck('design')

    const load$ = outgoing$
      .debounce(50)//only load if last events were less than 50 ms appart
      .filter(data=>data.method === 'load')
      .pluck('data')
      .share()

    ////
    const bom$ = save$.pluck("bom")
      .pluck("entries")
      .distinctUntilChanged( null, equals )
      .scan(function(acc, cur){
          return {cur,prev:acc.cur}
        },{prev:undefined,cur:undefined})
      .map(function(typeData){
        let {cur,prev} = typeData
        let changes = extractChangesBetweenArrays(prev,cur)
        return changes
      })
      .share()

    const upsertBom$ = bom$
      .map(d=>d.upserted)
      .map(toBom.bind(null,'put'))
      .flatMap(Rx.Observable.fromArray)
      .tap(e=>console.log("upsert bom",e))

    const deleteBom$ = bom$
      .map(d=>d.removed)
      .map(toBom.bind(null,'delete'))
      .flatMap(Rx.Observable.fromArray)
      .tap(e=>console.log("delete bom entry",e))


    const parts$ = save$//.pluck("parts")
      .pluck("bom")
      .pluck("entries")
      .distinctUntilChanged( null, equals )
      .scan(function(acc, cur){
          return {cur,prev:acc.cur}
        },{prev:undefined,cur:undefined})
      .map(function(typeData){
        let {cur,prev} = typeData
        let changes = extractChangesBetweenArrays(prev,cur)
        return changes
      })
      .share()

    const upsertParts$ = parts$
      .map(d=>d.upserted)
      .map(toParts.bind(null,'put'))
      .flatMap(Rx.Observable.fromArray)
      .tap(e=>console.log("upsert parts",e))

    const deleteParts$ = parts$
      .map(d=>d.removed)
      .map(toParts.bind(null,'delete'))
      .flatMap(Rx.Observable.fromArray)
      .tap(e=>console.log("delete part",e))

    const assemblies$ = combineLatestObj({
          metadata:save$.pluck('eMetas')
        , transforms:save$.pluck('eTrans')
        , meshes: save$.pluck('eMeshs')})
      .debounce(1)
      .map(dataFromItems)
      .scan(function(acc, cur){
          return {cur,prev:acc.cur}
        },{prev:undefined,cur:undefined})
      .map(function(typeData){
        let {cur,prev} = typeData
        let changes = extractChangesBetweenArrays(prev,cur)
        return changes
      })
      .share()


    const upsertAssemblies$ = assemblies$
      .map(d=>d.upserted)
      .map(toAssemblies.bind(null,'put'))
      .flatMap(Rx.Observable.fromArray)
      .tap(e=>console.log("upsert assemblies entry",e))

    const deleteFromAssemblies$ = assemblies$
      .map(d=>d.removed)
      .map(toAssemblies.bind(null,'delete'))
      .flatMap(Rx.Observable.fromArray)
      .tap(e=>console.log("remove assemblies entry",e))


    //Finally put it all together
    merge(upsertAssemblies$, deleteFromAssemblies$, upsertParts$, deleteParts$, upsertBom$, deleteBom$)
      .forEach(e=>e)


    const outToHttp$ = Rx.Observable.never()// merge(upsertAssemblies$, parts$, bom$)
      /*.startWith({
        url: `${designUri}/assemblies${authTokenStr}`
        , method: "post"
        , send: jsonToFormData({name:'default','uuid':'default'})
        , type: "ymSave"
        , typeDetail: "assemblies_default"})
        // parts$, bom$, assemblies$)*/
      .tap(e=>console.log("outToHttp",e))

    const inputs$ = httpDriver(outToHttp$)

    const saveResponses$ = inputs$
      .filter(res$ => res$.request.type === 'ymSave')//handle errors etc
      .flatMap(data => {
        const responseWrapper$ = data.catch(e=>{
          console.log("caught error in saving data",e)
          return Rx.Observable.empty()
        })
        const request$  = just(data.request)
        const response$ = responseWrapper$.pluck("response")

        return combineLatestObj({response$, request$})//.materialize()//FIXME: still do not get this one
      })
      .forEach(e=>console.log("error in saving or not"))


    return inputs$

    //to load data up again
    function fromAssemblies(entries){
      //for mesh components we require "parts" info
      //for meta components we require "assemblies" info
      //for tran components we require "assemblies" info
    }

  }

  return youMagineStorageDriver
}
