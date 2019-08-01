import {RTCPeer} from './rtc_peer.js'
import {config} from './config.js'
import {
  authfetch,
} from './common.js'

class WebSocketRPC {
  constructor() {
    this.authed = false
    this._connect_attempts = 0
    this._connected = false
    this.connect()
  }
  async connect() {
    const ws = new WebSocket(`${config.ws_rpc_url}/wsRPC`)
    this._connect_attempts++
    ws.onopen = this.onopen
    ws.onmessage = this.onmessage
    // ws.onclose = ws.onerror = this.onclose
    // onerror is redundant?
    ws.onclose = this.onclose
    this.ws = ws
    this._requests = {}
    this.reqid = 0
  }
  onopen = async () => {
    console.log('ws onopen')
    this._connected = true
    this._connect_attempts = 0
    const id = this.reqid++
    const password = (await chromise.storage.local.get('rpcpassword')).rpcpassword
    const authresp = await this.request({id, type:'AUTH', payload:{password:password}})
    if (authresp.ok) this.authed = true
  }
  onmessage = ({data}) => {
    const message = JSON.parse(data)
    const {id, type, payload} = message
    const req = this._requests[id]
    console.assert(req)
    req.resolve(payload)
  }
  onclose = (e) => {
    this._connected = false
    const retry = Math.pow(this._connect_attempts,2) * 200
    console.error('ws close',e,'retry in',retry/1000,'seconds')
    setTimeout(()=>{
      this.connect()
    }, retry)
  }
  send(m) {
    this.ws.send(m)
  }
  request(req) {
    const id = this.reqid++
    req.id = id
    return new Promise(resolve=>{
      this._requests[id] = {resolve, req}
      this.ws.send(JSON.stringify(req))
    })
  }
  
}
const wsRPC = new WebSocketRPC

export function handleMessage(msg) {
  // console.log('got direct message',msg)
  const {message} = msg.payload
  if (message.initp2p) {
    const peer = new RTCPeer()
    client_conns[message.id] = {peer, peerid: msg.sender}
    peer.on('data', async (d) => {
      // console.log('client p2p got data',d)
      if (d.command) {
        const {command} = d
        const {id} = command;
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
        if (command.utype) {
          const response = await authfetch(`${config.rpc_url}/utype`,
                                           {
                                             credentials:'include',
                                             headers:{'content-type':'application/json'},
                                             method:'post',
                                             body:JSON.stringify({text:command.utype})
                                           });
          const text = await response.text()
          peer.send({id, ok:true, text})
          // type a unicode string
        }
        if (command.rawKeyboard) {
          // raw keyboard event
          await wsRPC.request({type: 'RAW_KEYBOARD', payload: {event:command.rawKeyboard}})
          return
          const response = await authfetch(`${config.rpc_url}/rawkeyboard`,
                                           {
                                             credentials:'include',
                                             headers:{'content-type':'application/json'},
                                             method:'post',
                                             body:JSON.stringify({event:command.rawKeyboard})
                                           });
          const text = await response.text()
          peer.send({id, ok:true, text})
        }
        if (command.keypress) {
          // raw keyboard event
          const response = await authfetch(`${config.rpc_url}/keypress`,
                                           {
                                             credentials:'include',
                                             headers:{'content-type':'application/json'},
                                             method:'post',
                                             body:JSON.stringify({event:command.keypress})
                                           });
          const text = await response.text()
          peer.send({id, ok:true, text})
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
          if (! [204,200].includes(response.status)) {
            peer.send({id, status:response.status})
            return
          }
          let data
          if (command.responseType) {
            const clen = parseInt(response.headers.get('content-length'))
            console.assert(clen)
            const buffer = await response[command.responseType]()
            // 16 KiB chunks is safest
            // no backpressure AFAIK mechanism, so just send it all...
            peer.send({payloadBegin:true,byteLength:clen,request:command})
            const chunkSz = 2**14
            let offset = 0
            while (true) {
              const cur = buffer.slice(offset, offset+chunkSz)
              // console.log('send buf of len',cur.byteLength)
              peer.send(cur)
              offset += chunkSz
              if (offset >= clen) {
                break
              }
            }
            peer.send({payloadEnd:true,byteLength:clen,request:command})
            return
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
    //console.log('signal',message)
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
