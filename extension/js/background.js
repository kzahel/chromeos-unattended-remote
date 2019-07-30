import {getRandomB16} from './util.js'
import {Messaging} from './sync_messaging.js'
import {RTCPeer} from './rtc_peer.js'
import {handleMessage} from './handler.js'

window.reload = chrome.runtime.reload
window.initiator_conns = {}
window.client_conns = {}
window.aorus = '92364d99165eba90cc60e19142312cde024f2da'
window.asus15 = "71235165e3d6122a8df2f6d56fac3c77fc2915e"
window.set_clientInfo = set_clientInfo
window.aorusreload = aorusreload
window.p2pconnect = p2pconnect

window.authfetch = async function(url) {
  const username = 'user'
  const password = (await chromise.storage.local.get('rpcpassword')).rpcpassword
  const headers = new Headers({'Authorization': 'Basic '+btoa(`${username}:${password}`)})
  return fetch(url,{headers})
}

const p2pConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}

async function ensure_clientid() {
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


async function registerSelf() {
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

function aorusreload() {
  if (initiator_conns.length) {
    const dc = Object.values(initiator_conns)[0].peer.dc
    if (dc.readyState === 'open') {
      dc.send({command:{reload:true}})
      return
    }
  }

  m.sendto(aorus, {reload:true})
}

function p2pconnect(clientid) {
  const opts = {initiator:true}
  const peer = new RTCPeer(opts)

  const id = Math.floor(Math.random() * 2**30)
  m.sendto(clientid, {initp2p:true, id})
  peer.on('signal', data => {
    // console.log('initiator wants to signal',data)
    m.sendto(clientid, {frominitiator:true, id, signal:data})
  });
  peer.on('error',e=>console.error('p2p conn failed',e))
  peer.on('connect',()=>console.log('connected'))
  peer.on('data',d=>console.log('got data',d))
  initiator_conns[id] = {peer, peerid: clientid}
  return peer
}

async function main() {
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
  const m = new Messaging(clientid)
  window.m = m
  m.onDirectMessage = handleMessage
}

chrome.browserAction.onClicked.addListener(()=>{
  chrome.runtime.openOptionsPage()
});

main()
