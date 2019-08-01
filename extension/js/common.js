import {getRandomB16} from './util.js'
import {Messaging} from './sync_messaging.js'
import {RTCPeer} from './rtc_peer.js'
import {handleMessage} from './handler.js'

export async function authfetch(url, opts) {
  opts = opts || {}
  opts.headers = opts.headers || {}
  const username = 'user'
  const password = (await chromise.storage.local.get('rpcpassword')).rpcpassword
  //const headers = new Headers()
  const headers = {'Authorization': 'Basic '+btoa(`${username}:${password}`), ...opts.headers}
  return fetch(url,{...opts, headers})
}

export async function main() {
  const clientid = await ensure_clientid()
  window.me = clientid
  console.log('clientid is ',clientid)
  registerSelf()
  /*
  let ctr = 0
  setInterval( () => {
    // this lets us know there's about 16 seconds between sync,
    // some jitter. sometimes 1 sec, sometimes close to 20
    chrome.storage.sync.set({[`debug_${clientid}`]: {t:new Date().getTime(), ctr:ctr++}})
  }, 1000);
  */
  console.log('getpeers',await getPeers())
  // XXX RACE CONDITION!
  const m = new Messaging(clientid)
  window.m = m
  m.onDirectMessage = handleMessage
}

export async function ensure_clientid() {
  const key = 'clientid'
  const data = await chromise.storage.local.get(key)

  if (data[key]) return data[key];
  
  if (! data[key]) {
    const r = getRandomB16(20)
    await chromise.storage.local.set({[key]: r})
    return r
  }
}

async function getandsend_clientInfo(clientid) {
  const key = `info_${clientid}`
  let name;
  let res
  res = await chromise.storage.sync.get(key)
  if (res[key]) name = res[key].name
  res = await chromise.storage.local.get(key)
  if (res[key]) name = res[key].name

  if (! name) name = clientid

  const info = {name, t: new Date().getTime()}

  await chromise.storage.sync.set({[key]:info})
  //await chromise.storage.local.remove([key])
  return info
}

async function set_clientInfo(name) {
  const clientid = await ensure_clientid()
  const key = `info_${clientid}`
  const info = {name, t: new Date().getTime()}

  await chromise.storage.local.set({[key]:info})
}

export function p2pconnect(clientid) {
  const opts = {initiator:true}
  const peer = new RTCPeer(opts)

  const id = Math.floor(Math.random() * 2**30)
  m.sendto(clientid, {initp2p:true, id, ctr:peer.ctr++})
  peer.on('signal', data => {
    // console.log('initiator wants to signal',data)
    m.sendto(clientid, {frominitiator:true, id, signal:data, ctr:peer.ctr++})
  });
  peer.on('error',e=>console.error('p2p conn failed',e))
  peer.on('connect',()=>console.log('connected'))

  // receive chunked binary data and reassemble it
  let offset = 0
  let fullBuffer = null
  const STATES = {
    none:0,
    payload:1,
  }
  let STATE = STATES.none
  async function onReceivedDataFromClient(d) {
    // client peer behavior is different ...
    if (d.payloadBegin) {
      console.assert(STATE === STATES.none)
      // console.log('payload begin')
      console.assert(d.byteLength)
      fullBuffer = new Uint8Array(d.byteLength)
      STATE = STATES.payload
    } else if (d instanceof ArrayBuffer) {
      console.assert(STATE === STATES.payload)
      fullBuffer.set(new Uint8Array(d), offset)
      offset += d.byteLength
    } else if (d.payloadEnd) {
      console.assert(offset === fullBuffer.length)
      console.assert(STATE === STATES.payload)
      peer.emit('payload',fullBuffer.buffer)
      STATE = STATES.none
      fullBuffer = null
      offset = 0
    } else {
      console.warn('unhandled p2p response data',d)
    }
  }
  peer.on('data',onReceivedDataFromClient)
  initiator_conns[id] = {peer, peerid: clientid}
  return peer
}


export async function registerSelf() {
  const clientid = await ensure_clientid()
  const clientInfo = await getandsend_clientInfo(clientid)

  console.log('register self',clientid, clientInfo)
}

export async function getPeers() {
  const res = await chromise.storage.sync.get()
  const infos = Object.keys(res).filter( k => k.startsWith('info_') )
  const peers = []
  for (const info of infos) {
    const clientid = info.split('_')[1]
    peers.push( {clientid, info: res[`info_${clientid}`]} )
  }
  return peers
}
