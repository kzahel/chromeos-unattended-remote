class NanoEvents {
  constructor() {
    this._listeners = {}
  }
  on(k, cb) {
    if (this._listeners[k] === undefined) this._listeners[k] = []
    this._listeners[k].push(cb)
  }
  emit(k, arg) {
    for (const cb of this._listeners[k]) {
      cb(arg)
    }
  }
}

// this class is a standin for simple-peer
export class RTCPeer extends NanoEvents {
  constructor(opts) {
    super()
    this.opts = opts || {}
    this.initiator = this.opts.initiator
    this.pc = new RTCPeerConnection
    this.dc = null
    this.pc.onicecandidate = this.onicecandidate

    const events = ['signalingstatechanged',
                    'icecandidateerror',
                    'icegatheringstatechange',
                    'negotiationneeded']
    for (event of events) {
      this.pc[event] = (e) => {
        console.warn(event,e)
      }
    }
    this.dc = this.pc.createDataChannel(this.initiator ? 'sendChannel' : 'receiveChannel')
    this.dc.onmessage = this.dc_message
    this.dc.onopen = this.dc_open
    this.dc.onclose = this.dc_close
    this.dc.onerror = this.dc_error

    this.pc.ondatachannel = this.ondatachannel
    if (this.initiator) this.initiate()
  }
  async initiate() {
    const offer = await this.pc.createOffer()
    this.pc.setLocalDescription(offer)
    this.localDescription = offer
    this.emit('signal',offer.toJSON())
  }
  async signal(data) {
    if (data.candidate) {
      // console.log('adding as ice candidate')
      this.pc.addIceCandidate(data.candidate)
      return
    }

    if (data.type === 'offer') {
      console.assert(! this.initiator)
      this.remoteDescription = data
      this.pc.setRemoteDescription(data)

      const answer = await this.pc.createAnswer()
      this.localDescription = answer
      this.pc.setLocalDescription(answer)
      console.log('webrtc: sending answer')
      this.emit('signal',answer.toJSON())
      return
    }
    if (data.type === 'answer') {
      console.assert(this.initiator)
      this.remoteDescription = data
      this.pc.setRemoteDescription(data)
      console.log('webrtc: got answer')
      return
    }

    console.warn('unhandled signal',data)
  }
  onicecandidate = e => {
    // console.log('on ice candidate',e)
    if (e.target.iceGatheringState === 'complete') return
    this.emit('signal',{candidate:e.candidate.toJSON()})
  }
  ondatachannel = e => {
    this.peer_dc = e.channel
    console.log('on data channel',e)

    this.peer_dc.onmessage = this.dc_peer_message
    this.peer_dc.onopen = this.dc_peer_open
    this.peer_dc.onclose = this.dc_peer_close
    this.peer_dc.onerror = this.dc_peer_error
  }
  dc_message = e => {
    console.log('dc message',e)
  }
  dc_open = () => {
    console.log('dc open')
  }
  dc_close = () => {
    console.log('dc close')
  }
  dc_error = () => {
    console.log('dc error')
  }

  dc_peer_message = e => {
    console.log('dc_peer message',e)
    // try to json parse
    let {data} = e
    if (data instanceof ArrayBuffer) {
      console.log('array buffer dc message',data)
    } else {
      try {
        data = JSON.parse(data)
        console.log('got json message',data)
      } catch(e) {
        console.log('got string message',data)
      }
    }
    this.emit('data',data)
  }
  dc_peer_open = () => {
    console.log('dc_peer open')
  }
  dc_peer_close = () => {
    console.log('dc_peer close')
  }
  dc_peer_error = () => {
    console.log('dc_peer error')
  }

  send = d => {
    if (d instanceof ArrayBuffer) {
      this.dc.send(d)
    } else if (typeof d === 'string') {
      this.dc.send(d)
    } else {
      this.dc.send(JSON.stringify(d))
    }
  }
}
