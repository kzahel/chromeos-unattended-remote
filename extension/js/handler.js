import {RTCPeer} from './rtc_peer.js'
import {config} from './config.js'
import {
  authfetch
} from './common.js'

export function handleMessage(msg) {
  // console.log('got direct message',msg)
  const {message} = msg.payload
  if (message.initp2p) {
    const peer = new RTCPeer()
    client_conns[message.id] = {peer, peerid: msg.sender}
    peer.on('data', async (d) => {
      console.log('client p2p got data',d)
      if (d.command) {
        const {command} = d
        if (command.reload) {
          peer.dc.close()
          setTimeout( () => {
            chrome.runtime.reload()
          }, 500)
        }
        if (command.echo) {
          peer.send(command.echo + ' pong')
        }
        if (command.close) {
          peer.dc.close()
        }
        if (command.click) {
          const response = await authfetch(`${config.rpc_url}/click?x=${command.click.x}&y=${command.click.y}`)
          const text = await response.text()
          peer.send({clicked:true, text})
        }
        if (command.screenshot) {
          const response = await authfetch(`${config.rpc_url}/screenshot`)
          const buf = await response.arrayBuffer()
          // TODO - need to chunk this !
          // use dataview / readablestream or something
          peer.send(buf)
        }
        if (command.fetch) {
          const response = await authfetch(`${config.rpc_url}${command.fetch}`)
          let data
          if (command.responseType) {
            data = await response[command.responseType]()
          } else {
            data = await response.text()
          }
          peer.send(data)
        }
      }
    })
    peer.on('connect', d => console.log('client p2p connected',d))
    peer.on('error',e=>console.error('p2p conn failed',e))
    peer.on('signal', d => {
      // console.log('client wants to signal',d)
      m.sendto(msg.sender, {test:1, frominitiator:false, signal: d, id:message.id, ctr:peer.ctr++})
    })
  } else if (message.signal && message.id) {
    console.log('signal',message)
    let peer
    if (message.frominitiator) {
      // from the initiator 
      peer = client_conns[message.id].peer
    } else {
      peer = initiator_conns[message.id].peer
    }
    console.assert(peer)
    console.assert(message.signal)
    // console.log('inputting signal',message.signal)
    peer.signal(message.signal)
    // drain this more slowly??
  } else if (message.reload) {
    chrome.runtime.reload()
  } else {
    console.warn('unknown direct message',m)
  }
}
