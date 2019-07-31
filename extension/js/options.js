const {useEffect, useState} = React
const {
  Card,
  CardContent,
  CardActions,
  Button,
  CircularProgress,
} = MaterialUI;

import {
  main,
  getPeers,
  p2pconnect,
} from './common.js'
import * as common from './common.js'

window.common = common
window.initiator_conns = {}
window.client_conns = {}

function Peer(props) {
  const [p, setP] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [screenshotURL, setScreenshotURL] = useState(false)
  const [unmounted, setUnmounted] = useState(false)
  
  useEffect(()=>{
    (async ()=>{
      // take a screenshot on occasion, if connected
      if (!connected) return
      while (true) {
        if (unmounted) return
        const url = await fetchurl('/screenshot')
        console.log('got updated screenshot url',url)
        await new Promise(r=>setTimeout(r,2000))
      }
    })()
    return () => {
      setUnmounted(true)
    }
  },[connected])
  
  async function connect() {
    const p = p2pconnect(props.clientid)
    setP(p)
    setConnecting(true)
    p.on('connected',()=>{
      setConnected(true)
      setConnecting(false)
    })
  }
  function fetchurl(fetchurl) {
    return new Promise(r=>{
      p.send({command:{responseType:'arrayBuffer',fetch:fetchurl}})
      p.on('payload',buffer => {
        const blob = new Blob([buffer], {type: 'image/png'})
        const url = URL.createObjectURL(blob)
        if (screenshotURL) URL.revokeObjectURL(screenshotURL)
        setScreenshotURL(url)
        r(url)
      }, {once:true})
    })
  }
  function reload() {
    p.send({command:{reload:true}})
  }
  function echo() {
    p.send({command:{echo:'echo this'}})
  }

  async function imageClick(e) {
    const relx = e.pageX - e.target.offsetLeft
    const rely = e.pageY - e.target.offsetTop
    const imgw = e.target.width
    const imgh = e.target.height
    const percentX = relx/imgw
    const percentY = rely/imgh
    const touchw = 1920
    const touchh = 1080
    const mousex = Math.floor(percentX*touchw)
    const mousey = Math.floor(percentY*touchh)
    p.send({command:{click:{x:mousex,y:mousey}}})
    // wait a little bit to let the click go through
    await new Promise(r=>setTimeout(r,100))
    fetchurl('/screenshot')
  }
  
  return (
    <Card styles={{padding:10,margin:10}}>
      <CardContent>
        Peer: {props.info.name}
        <br />
        {p ? JSON.stringify(p) : null }
        {connecting ? <CircularProgress /> : null}
      </CardContent>
      <CardActions>
        <Button onClick={connect}>Connect</Button>
        {connected &&
         <span>
         <Button onClick={()=>fetchurl('/screenshot')}>Screenshot</Button>
         <Button onClick={echo}>Echo</Button>
         <Button onClick={reload}>Reload</Button>
        </span>
        }
      </CardActions>
      {screenshotURL ? <img onClick={imageClick} style={{width:'100%'}} src={screenshotURL} /> : null }
    </Card>
  );
}

function Options() {
  const [peers, setPeers] = useState(null);
  useEffect(()=>{
    (async()=>{
      const res = await getPeers()
      setPeers(res)
    })()
  },[])

  return (
    <div>
    Peers ({peers && peers.length})

    <ul>
    {peers && peers.map(peer => {
      return <li key={peer.clientid}><Peer {...peer} /></li>
    })}
    </ul>
    </div>
  )
}

document.addEventListener("DOMContentLoaded",()=>{
  main()
  const approot = document.getElementById('approot')
  console.log('approot',approot)
  ReactDOM.render(
      <Options />
      ,approot
  );
});
