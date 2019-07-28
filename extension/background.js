import {getRandomB16} from './util.js'
import {Messaging} from './messaging.js'
import {RTCPeer as SimplePeer} from './peer.js'


window.reload = chrome.runtime.reload

const p2pConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}
const p2pOpts = {
  iceCompleteTimeout: 1,
  trickle: true
}

async function get_clientid() {
  const key = 'clientid'
  const data = await chromise.storage.local.get(key)

  if (data[key]) return data[key];
  
  if (! data[key]) {
    const r = getRandomB16(20)
    await chromise.storage.local.set({[key]: r})
    return r
  }
}


function storageChanged( changes, area ) {
  console.log('storage change',changes,area)
}

async function get_clientInfo(clientid) {
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
  const clientid = await get_clientid()
  const key = `info_${clientid}`
  const info = {name, t: new Date().getTime()}

  await chromise.storage.local.set({[key]:info})
}

window.set_clientInfo = set_clientInfo

async function registerSelf() {
  const clientid = await get_clientid()
  const clientInfo = await get_clientInfo(clientid)

  console.log('register self',clientid, clientInfo)
}

async function getPeers() {
  const res = await chromise.storage.sync.get()
  const infos = Object.keys(res).filter( k => k.startsWith('info_') )
  const peers = []
  for (const info of infos) {
    const clientid = info.split('_')[1]
    peers.push( {clientid, info: res[`info_${clientid}`]} )
  }
  return peers
}

window.initiator_conns = {}
window.client_conns = {}
window.aorus = '92364d99165eba90cc60e19142312cde024f2da'

window.aorusreload = function() {
  m.sendto(aorus, {reload:true})
}

async function p2pconnect(clientid) {
  // timing on this is very sensitive. if you time this just after a sync window
  // the rtc connection will time out
  const opts = {initiator:true, ...p2pOpts}
  console.log('p2p opts',opts)
  const p = new SimplePeer(opts)
  const id = Math.floor(Math.random() * 2**30)
  m.sendto(clientid, {initp2p:true, id})
  p.on('signal', data => {
    console.log('initiator wants to signal',data)
    m.sendto(clientid, {frominitiator:true, id, signal:data})
  });
  p.on('error',e=>console.error('p2p conn failed',e))
  p.on('connect',()=>console.log('connected'))
  p.on('data',d=>console.log('got data',d))
  initiator_conns[id] = {peer:p, peerid: clientid}
}
window.p2pconnect = p2pconnect

async function main() {
  console.log('main')
  const clientid = await get_clientid()
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
  
  const m = new Messaging(clientid)
  window.m = m

  
  m.onDirectMessage = msg => {
    console.log('got direct message',msg)

    const {message} = msg.payload
    if (message.initp2p) {
      // create a new client conn
      const opts = {...p2pOpts}
      console.log('simplepeer',opts)
      const peer = new SimplePeer(opts)
      client_conns[message.id] = {peer, peerid: msg.sender}
      peer.on('data', d => console.log('client p2p got data',d))
      peer.on('connect', d => console.log('client p2p connected',d))
      peer.on('error',e=>console.error('p2p conn failed',e))
      peer.on('signal', d => {
        console.log('client wants to signal',d)
        m.sendto(msg.sender, {frominitiator:false, signal: d, id:message.id})
      })
    } else if (message.signal && message.id) {
      let peer
      if (message.frominitiator) {
        // from the initiator 
        peer = client_conns[message.id].peer
      } else {
        peer = initiator_conns[message.id].peer
      }
      console.assert(peer)
      console.assert(message.signal)
      console.log('inputting signal',message.signal)
      peer.signal(message.signal)
      // drain this more slowly??
    } else if (message.reload) {
      chrome.runtime.reload()
    } else {
      console.warn('unknown direct message',m)
    }
    
  }
}

main()



