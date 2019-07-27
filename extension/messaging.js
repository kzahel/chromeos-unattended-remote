const store = chrome.storage.sync
// chrome.storage.sync behavior on merge conflict: newest update wins (some kind of synchronized clock)

export class Messaging {
  
  constructor(clientid, opts) {
    this.batching_latency = 10*1000 // around 10 seconds for a sync message to propagate
    this.clientid = clientid
    this.buf = 100 // message sequence number / ring buffer limit
    this.bidx = this.buf - 2 // our outgoing broadcast index
    this.ridx = {} // our outgoing to recipient indicies
    store.onChanged.addListener( this.recv.bind(this) )
  }

  recv(changes) {
    //console.log('recv',changes)
    /* Receive broadcast and direct messages

       Message format: Messages always sent in pairs:

       msg_{sender}_{recipient}_{index}: payload
       msg_{sender}_{recipient}_idx: {index}

       or

       bst_{sender}_{index}: payload
       bst_{sender}_idx: {index}

       We rotate keys using an index (like a ring buffer).
       Because the storage.sync channel is batched. When we receive a message,
       there could be many _{index} messages, but only one _idx message.
    */
    const changeKeys = Object.keys(changes)
    const incomingBroadcasts = changeKeys.filter( k => k.startsWith('bst_') && k.endsWith('_idx') )
    const incomingMessages = changeKeys.filter( k => k.startsWith('msg_') && k.endsWith('_idx') )

    for (const key of incomingBroadcasts) {
      const sender = key.split('_')[1]
      if (sender === this.clientid) continue
      const messageKeys = changeKeys.filter( k => k.startsWith(`bst_${sender}_`) && ! k.endsWith('_idx') )
      this.handleIncomingBroadcasts(key, sender, messageKeys, changes)
    }
    for (const key of incomingMessages) {
      const [sender, recipient] = key.split('_').slice(1,1+2)
      // if (sender === this.clientid) continue // debug sending to self
      if (recipient !== this.clientid) continue
      const messageKeys = changeKeys.filter( k => k.startsWith(`msg_${sender}_${this.clientid}`) && ! k.endsWith('_idx') )
      this.handleIncomingMessages(key, sender, messageKeys, changes)
    }
  }

  handleIncomingBroadcasts(key, sender, messageKeys, changes) {
    this.handleIncoming(
      'broadcast',
      (sender, idx) => `bst_${sender}_${idx}`,
      key, sender, messageKeys, changes)
  }

  handleIncomingMessages(key, sender, messageKeys, changes) {
    this.handleIncoming(
      'direct',
      (sender, idx) => `msg_${sender}_${this.clientid}_${idx}`,
      key, sender, messageKeys, changes)
  }

  handleIncoming(type, keyFmt, key, sender, messageKeys, changes) {
    const peerIndex = changes[key].newValue.idx
    const messages = []
    let idx = peerIndex
    while (true) {
      const msgKey = keyFmt(sender, idx)
      if (msgKey in changes && changes[msgKey].newValue !== undefined) {
        messages.push({
          sender,
          type,
          idx,
          payload:changes[msgKey].newValue
        })
      } else {
        break
      }
      idx--;
      if (idx == -1) idx = this.buf - 1
    }
    messages.reverse()
    if (this.onDirectMessage && type === 'direct') {
      for (const message of messages) {
        this.onDirectMessage(message)
      }
    }
    //console.log('got messages from', sender, messages)
    return messages
  }
  
  sendto(recipient, message) {
    console.log('sendto',recipient,message)
    // sender will clear the messages after {X} seconds
    const payload = this.getpayload(message)
    if (this.ridx[recipient] === undefined) {
      this.ridx[recipient] = 0
    }
    // TODO heuristics with overflow
    const idx = this.ridx[recipient]
    const messages = {
      [`msg_${this.clientid}_${recipient}_${idx}`]: payload,
      [`msg_${this.clientid}_${recipient}_idx`]: {t:new Date().getTime(), idx}
    }
    //console.log('sending',messages)
    store.set(messages)
    this.ridx[recipient] = (this.ridx[recipient] + 1) % this.buf
  }
  
  broadcast(message) {
    // sender will clear the messages after {X} seconds
    const payload = this.getpayload(message)
    const messages = {
      [`bst_${this.clientid}_${this.bidx}`]: payload,
      [`bst_${this.clientid}_idx`]: {t:new Date().getTime(), idx:this.bidx}
    }
    //console.log('sending',messages)
    store.set(messages)
    // dont clear the message if we re-use it in the meantime ?
    setTimeout( () => this.clearMessages(messages), this.batching_latency*2 )
    this.bidx = (this.bidx + 1) % this.buf
  }

  clearMessages(messages) {
    // after some time clear the messages
    const keys = Object.keys(messages).filter( k => ! k.endsWith('_idx') )
    store.remove(keys)
  }

  getpayload(message) {
    return {t: new Date().getTime(), message}
  }
}
